const express = require('express');
const { body, param, query: qv } = require('express-validator');
const { query, transaction } = require('../../db');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { requirePermission } = require('../middleware/permissions');
const { Permissions } = require('../../utils/permissions');
const logger = require('../../utils/logger');

const router = express.Router();

// GET /channels/:channelId
router.get('/:channelId', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM channels WHERE id = $1',
      [req.params.channelId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Channel not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get channel' });
  }
});

// POST /channels — create channel in a server
router.post(
  '/',
  authenticate,
  requirePermission(Permissions.MANAGE_CHANNELS, req => req.body.server_id),
  [
    body('server_id').isUUID(),
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('type').isIn(['text', 'voice', 'forum', 'thread']),
    body('category_id').optional().isUUID(),
    body('topic').optional().trim().isLength({ max: 1024 }),
    body('position').optional().isInt(),
    body('nsfw').optional().isBoolean(),
    body('slowmode_delay').optional().isInt({ min: 0, max: 21600 }),
    body('user_limit').optional().isInt({ min: 0 }),
    body('bitrate').optional().isInt({ min: 8000, max: 384000 }),
  ],
  validate,
  async (req, res) => {
    try {
      const {
        server_id, name, type, category_id, topic,
        nsfw = false, slowmode_delay = 0, user_limit = 0, bitrate = 64000
      } = req.body;

      // Verify member
      const member = await query(
        'SELECT id FROM server_members WHERE server_id = $1 AND user_id = $2',
        [server_id, req.user.id]
      );
      if (!member.rows[0]) return res.status(403).json({ error: 'Not a member' });

      const pos = await query(
        'SELECT COALESCE(MAX(position), -1) + 1 as pos FROM channels WHERE server_id = $1',
        [server_id]
      );

      const result = await query(
        `INSERT INTO channels (server_id, category_id, name, type, topic, position, nsfw, slowmode_delay, user_limit, bitrate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [server_id, category_id || null, name, type, topic, pos.rows[0].pos, nsfw, slowmode_delay, user_limit, bitrate]
      );
      const channel = result.rows[0];
      const io = req.app.get('io');
      if (io) io.to(`server:${server_id}`).emit('CHANNEL_CREATE', channel);
      res.status(201).json(channel);
    } catch (err) {
      logger.error('Create channel error:', err);
      res.status(500).json({ error: 'Failed to create channel' });
    }
  }
);

// PATCH /channels/:channelId
router.patch(
  '/:channelId',
  authenticate,
  requirePermission(Permissions.MANAGE_CHANNELS, async req => {
    const r = await require('../../db').query('SELECT server_id FROM channels WHERE id = $1', [req.params.channelId]);
    return r.rows[0]?.server_id;
  }),
  [
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
    body('topic').optional().trim().isLength({ max: 1024 }),
    body('position').optional().isInt(),
    body('nsfw').optional().isBoolean(),
    body('slowmode_delay').optional().isInt({ min: 0, max: 21600 }),
    body('category_id').optional().isUUID(),
  ],
  validate,
  async (req, res) => {
    try {
      const { name, topic, position, nsfw, slowmode_delay, category_id } = req.body;
      const result = await query(
        `UPDATE channels SET
          name = COALESCE($1, name),
          topic = COALESCE($2, topic),
          position = COALESCE($3, position),
          nsfw = COALESCE($4, nsfw),
          slowmode_delay = COALESCE($5, slowmode_delay),
          category_id = COALESCE($6, category_id),
          updated_at = NOW()
         WHERE id = $7 RETURNING *`,
        [name, topic, position, nsfw, slowmode_delay, category_id, req.params.channelId]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Channel not found' });
      const channel = result.rows[0];
      const io = req.app.get('io');
      if (io) io.to(`server:${channel.server_id}`).emit('CHANNEL_UPDATE', channel);
      res.json(channel);
    } catch (err) {
      logger.error('Update channel error:', err);
      res.status(500).json({ error: 'Failed to update channel' });
    }
  }
);

// DELETE /channels/:channelId
router.delete('/:channelId', authenticate,
  requirePermission(Permissions.MANAGE_CHANNELS, async req => {
    const r = await require('../../db').query('SELECT server_id FROM channels WHERE id = $1', [req.params.channelId]);
    return r.rows[0]?.server_id;
  }),
  async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM channels WHERE id = $1 RETURNING id, server_id',
      [req.params.channelId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Channel not found' });
    const { id, server_id } = result.rows[0];
    const io = req.app.get('io');
    if (io) io.to(`server:${server_id}`).emit('CHANNEL_DELETE', { id, server_id });
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete channel' });
  }
});

// GET /channels/:channelId/messages
router.get('/:channelId/messages', authenticate, async (req, res) => {
  try {
    const { before, after, around, limit = 50 } = req.query;
    const msgLimit = Math.min(parseInt(limit), 100);

    let whereClause = 'WHERE m.channel_id = $1';
    const params = [req.params.channelId];
    let idx = 2;

    if (before) {
      whereClause += ` AND m.created_at < (SELECT created_at FROM messages WHERE id = $${idx})`;
      params.push(before);
      idx++;
    } else if (after) {
      whereClause += ` AND m.created_at > (SELECT created_at FROM messages WHERE id = $${idx})`;
      params.push(after);
      idx++;
    }

    params.push(msgLimit);

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
              (SELECT json_agg(json_build_object('emoji', mr.emoji, 'count', cnt, 'me', EXISTS(
                SELECT 1 FROM message_reactions WHERE message_id = m.id AND user_id = $${idx + 1} AND emoji = mr.emoji
              )))
               FROM (SELECT emoji, COUNT(*) as cnt FROM message_reactions WHERE message_id = m.id GROUP BY emoji) mr) as reaction_counts
       FROM messages m
       JOIN users u ON u.id = m.author_id
       ${whereClause}
       ORDER BY m.created_at ${after ? 'ASC' : 'DESC'}
       LIMIT $${idx}`,
      [...params, req.user.id]
    );

    const messages = after ? result.rows : result.rows.reverse();
    res.json(messages);
  } catch (err) {
    logger.error('Get messages error:', err);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// GET /channels/:channelId/pins
router.get('/:channelId/pins', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT m.*,
              json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url) as author,
              pm.pinned_at, pm.pinned_by
       FROM pinned_messages pm
       JOIN messages m ON m.id = pm.message_id
       JOIN users u ON u.id = m.author_id
       WHERE pm.channel_id = $1
       ORDER BY pm.pinned_at DESC`,
      [req.params.channelId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get pins' });
  }
});

// PUT /channels/:channelId/pins/:messageId
router.put('/:channelId/pins/:messageId', authenticate, async (req, res) => {
  try {
    await query(
      'INSERT INTO pinned_messages (channel_id, message_id, pinned_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [req.params.channelId, req.params.messageId, req.user.id]
    );
    await query('UPDATE channels SET last_pin_timestamp = NOW() WHERE id = $1', [req.params.channelId]);
    res.json({ message: 'Message pinned' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to pin message' });
  }
});

// DELETE /channels/:channelId/pins/:messageId
router.delete('/:channelId/pins/:messageId', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM pinned_messages WHERE channel_id = $1 AND message_id = $2', [
      req.params.channelId,
      req.params.messageId,
    ]);
    res.json({ message: 'Message unpinned' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unpin message' });
  }
});

// POST /channels/:channelId/typing
router.post('/:channelId/typing', authenticate, async (req, res) => {
  // This is handled via Socket.io, just acknowledge
  res.status(204).end();
});

// GET /channels/:channelId/search
router.get('/:channelId/search', authenticate, async (req, res) => {
  try {
    const { q, limit = 25 } = req.query;
    if (!q) return res.status(400).json({ error: 'Query required' });

    const result = await query(
      `SELECT m.*,
              json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url) as author
       FROM messages m
       JOIN users u ON u.id = m.author_id
       WHERE m.channel_id = $1
       AND to_tsvector('english', m.content) @@ plainto_tsquery('english', $2)
       ORDER BY m.created_at DESC
       LIMIT $3`,
      [req.params.channelId, q, Math.min(parseInt(limit), 100)]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// POST /channels/dm — create or get DM channel
router.post('/dm', authenticate, async (req, res) => {
  try {
    const { recipient_id } = req.body;
    if (!recipient_id) return res.status(400).json({ error: 'recipient_id required' });
    if (recipient_id === req.user.id) return res.status(400).json({ error: 'Cannot DM yourself' });

    // Check for existing DM
    const existing = await query(
      `SELECT c.* FROM channels c
       WHERE c.type = 'dm'
       AND $1 = ANY(c.dm_participants)
       AND $2 = ANY(c.dm_participants)
       LIMIT 1`,
      [req.user.id, recipient_id]
    );

    if (existing.rows[0]) return res.json(existing.rows[0]);

    const result = await query(
      `INSERT INTO channels (name, type, dm_participants) VALUES ('dm', 'dm', $1) RETURNING *`,
      [[req.user.id, recipient_id]]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error('Create DM error:', err);
    res.status(500).json({ error: 'Failed to create DM' });
  }
});

// GET /channels/dms — list user's DMs
router.get('/dms/list', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT c.*,
              json_agg(json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'status', u.status)) as participants
       FROM channels c
       JOIN unnest(c.dm_participants) as pid ON TRUE
       JOIN users u ON u.id = pid
       WHERE $1 = ANY(c.dm_participants) AND c.type IN ('dm', 'group_dm')
       GROUP BY c.id
       ORDER BY c.updated_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    logger.error('List DMs error:', err);
    res.status(500).json({ error: 'Failed to list DMs' });
  }
});

// PUT /channels/:channelId/read — mark as read
router.put('/:channelId/read', authenticate, async (req, res) => {
  try {
    const { message_id } = req.body;
    await query(
      `INSERT INTO read_states (user_id, channel_id, last_read_message_id, mention_count, updated_at)
       VALUES ($1, $2, $3, 0, NOW())
       ON CONFLICT (user_id, channel_id) DO UPDATE SET
         last_read_message_id = EXCLUDED.last_read_message_id,
         mention_count = 0,
         updated_at = NOW()`,
      [req.user.id, req.params.channelId, message_id || null]
    );
    res.json({ message: 'Channel marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update read state' });
  }
});

module.exports = router;
