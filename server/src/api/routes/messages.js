const express = require('express');
const { body } = require('express-validator');
const { query } = require('../../db');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const logger = require('../../utils/logger');

const router = express.Router();

// POST /messages — send message
router.post(
  '/',
  authenticate,
  [
    body('channel_id').isUUID(),
    body('content').optional().trim().isLength({ max: 4000 }),
    body('reply_to_id').optional().isUUID(),
    body('nonce').optional().isString(),
    body('tts').optional().isBoolean(),
  ],
  validate,
  async (req, res) => {
    try {
      const { channel_id, content, reply_to_id, nonce, tts = false, embeds = [] } = req.body;

      if (!content && !req.files?.length && embeds.length === 0) {
        return res.status(400).json({ error: 'Message must have content, attachments, or embeds' });
      }

      // Get channel info
      const channel = await query('SELECT * FROM channels WHERE id = $1', [channel_id]);
      if (!channel.rows[0]) return res.status(404).json({ error: 'Channel not found' });

      // Parse mentions
      const mentionRegex = /<@!?([a-f0-9-]{36})>/g;
      const roleMentionRegex = /<@&([a-f0-9-]{36})>/g;
      const mentions = [];
      const mentionRoles = [];
      let match;
      if (content) {
        while ((match = mentionRegex.exec(content)) !== null) mentions.push(match[1]);
        while ((match = roleMentionRegex.exec(content)) !== null) mentionRoles.push(match[1]);
      }

      const mentionEveryone = content?.includes('@everyone') || content?.includes('@here');

      const result = await query(
        `INSERT INTO messages (channel_id, author_id, content, reply_to_id, tts, embeds, mentions, mention_roles, mention_everyone, nonce)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [channel_id, req.user.id, content || null, reply_to_id || null, tts, JSON.stringify(embeds),
         mentions, mentionRoles, mentionEveryone, nonce || null]
      );

      // Update channel last_message_id
      await query('UPDATE channels SET last_message_id = $1, updated_at = NOW() WHERE id = $2', [
        result.rows[0].id, channel_id
      ]);

      // Get full message with author
      const fullMessage = await getFullMessage(result.rows[0].id, req.user.id);
      res.status(201).json(fullMessage);
    } catch (err) {
      logger.error('Send message error:', err);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }
);

// GET /messages/:messageId
router.get('/:messageId', authenticate, async (req, res) => {
  try {
    const msg = await getFullMessage(req.params.messageId, req.user.id);
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    res.json(msg);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get message' });
  }
});

// PATCH /messages/:messageId
router.patch(
  '/:messageId',
  authenticate,
  [body('content').trim().isLength({ min: 1, max: 4000 })],
  validate,
  async (req, res) => {
    try {
      const msg = await query('SELECT * FROM messages WHERE id = $1', [req.params.messageId]);
      if (!msg.rows[0]) return res.status(404).json({ error: 'Message not found' });

      if (msg.rows[0].author_id !== req.user.id) {
        return res.status(403).json({ error: 'Cannot edit another user\'s message' });
      }

      const editHistory = [...(msg.rows[0].edit_history || []), {
        content: msg.rows[0].content,
        edited_at: msg.rows[0].edited_at || msg.rows[0].created_at,
      }];

      const result = await query(
        `UPDATE messages SET content = $1, edited_at = NOW(), edit_history = $2 WHERE id = $3 RETURNING *`,
        [req.body.content, JSON.stringify(editHistory), req.params.messageId]
      );

      const fullMessage = await getFullMessage(result.rows[0].id, req.user.id);
      res.json(fullMessage);
    } catch (err) {
      logger.error('Edit message error:', err);
      res.status(500).json({ error: 'Failed to edit message' });
    }
  }
);

// DELETE /messages/:messageId
router.delete('/:messageId', authenticate, async (req, res) => {
  try {
    const msg = await query('SELECT author_id, channel_id FROM messages WHERE id = $1', [req.params.messageId]);
    if (!msg.rows[0]) return res.status(404).json({ error: 'Message not found' });

    if (msg.rows[0].author_id !== req.user.id && !req.user.is_admin) {
      // Check if user has MANAGE_MESSAGES in server
      return res.status(403).json({ error: 'Cannot delete another user\'s message' });
    }

    await query('DELETE FROM messages WHERE id = $1', [req.params.messageId]);
    res.status(204).end();
  } catch (err) {
    logger.error('Delete message error:', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// PUT /messages/:messageId/reactions/:emoji
router.put('/:messageId/reactions/:emoji', authenticate, async (req, res) => {
  try {
    const emoji = decodeURIComponent(req.params.emoji);
    await query(
      'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [req.params.messageId, req.user.id, emoji]
    );
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// DELETE /messages/:messageId/reactions/:emoji
router.delete('/:messageId/reactions/:emoji', authenticate, async (req, res) => {
  try {
    const emoji = decodeURIComponent(req.params.emoji);
    await query(
      'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
      [req.params.messageId, req.user.id, emoji]
    );
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
});

// GET /messages/:messageId/reactions/:emoji — list users who reacted
router.get('/:messageId/reactions/:emoji', authenticate, async (req, res) => {
  try {
    const emoji = decodeURIComponent(req.params.emoji);
    const result = await query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url
       FROM message_reactions mr
       JOIN users u ON u.id = mr.user_id
       WHERE mr.message_id = $1 AND mr.emoji = $2
       LIMIT 100`,
      [req.params.messageId, emoji]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list reactions' });
  }
});

async function getFullMessage(messageId, userId) {
  const result = await query(
    `SELECT m.*,
            json_build_object(
              'id', u.id, 'username', u.username, 'display_name', u.display_name,
              'avatar_url', u.avatar_url, 'is_bot', u.is_bot
            ) as author,
            CASE WHEN m.reply_to_id IS NOT NULL THEN
              (SELECT json_build_object(
                'id', rm.id, 'content', rm.content, 'author', json_build_object(
                  'id', ru.id, 'username', ru.username, 'display_name', ru.display_name, 'avatar_url', ru.avatar_url
                )
              ) FROM messages rm JOIN users ru ON ru.id = rm.author_id WHERE rm.id = m.reply_to_id)
            END as reply_to,
            (SELECT COALESCE(json_agg(json_build_object(
              'emoji', mr.emoji, 'count', mr.cnt, 'me',
              EXISTS(SELECT 1 FROM message_reactions WHERE message_id = m.id AND user_id = $2 AND emoji = mr.emoji)
            )), '[]')
             FROM (SELECT emoji, COUNT(*) as cnt FROM message_reactions WHERE message_id = m.id GROUP BY emoji) mr) as reaction_counts
     FROM messages m
     JOIN users u ON u.id = m.author_id
     WHERE m.id = $1`,
    [messageId, userId]
  );
  return result.rows[0] || null;
}

module.exports = router;
module.exports.getFullMessage = getFullMessage;
