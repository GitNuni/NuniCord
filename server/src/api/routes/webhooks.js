const express = require('express');
const { body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { query } = require('../../db');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const logger = require('../../utils/logger');

const router = express.Router();

function generateWebhookToken() {
  return crypto.randomBytes(32).toString('base64url');
}

// GET /webhooks/channel/:channelId
router.get('/channel/:channelId', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT w.*,
              json_build_object('id', u.id, 'username', u.username) as created_by_user
       FROM webhooks w
       LEFT JOIN users u ON u.id = w.created_by
       WHERE w.channel_id = $1`,
      [req.params.channelId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list webhooks' });
  }
});

// POST /webhooks/channel/:channelId
router.post(
  '/channel/:channelId',
  authenticate,
  [body('name').trim().isLength({ min: 1, max: 80 })],
  validate,
  async (req, res) => {
    try {
      const channel = await query(
        'SELECT * FROM channels WHERE id = $1',
        [req.params.channelId]
      );
      if (!channel.rows[0]) return res.status(404).json({ error: 'Channel not found' });

      const token = generateWebhookToken();
      const result = await query(
        `INSERT INTO webhooks (channel_id, server_id, name, token, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [req.params.channelId, channel.rows[0].server_id, req.body.name, token, req.user.id]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      logger.error('Create webhook error:', err);
      res.status(500).json({ error: 'Failed to create webhook' });
    }
  }
);

// POST /webhooks/:webhookId/:token — execute webhook (public endpoint)
router.post('/:webhookId/:token', async (req, res) => {
  try {
    const webhook = await query(
      'SELECT * FROM webhooks WHERE id = $1 AND token = $2',
      [req.params.webhookId, req.params.token]
    );
    if (!webhook.rows[0]) return res.status(404).json({ error: 'Unknown webhook' });

    const wh = webhook.rows[0];
    const { content, username, avatar_url, embeds = [], tts = false } = req.body;

    if (!content && embeds.length === 0) {
      return res.status(400).json({ error: 'Content or embeds required' });
    }

    // Find or create webhook bot user
    let webhookUser = await query('SELECT id FROM users WHERE username = $1 AND is_bot = TRUE', [
      `webhook_${wh.id.slice(0, 8)}`
    ]);

    if (!webhookUser.rows[0]) {
      webhookUser = await query(
        `INSERT INTO users (username, display_name, avatar_url, is_bot)
         VALUES ($1, $2, $3, TRUE) RETURNING id`,
        [`webhook_${wh.id.slice(0, 8)}`, username || wh.name, avatar_url || wh.avatar_url]
      );
    }

    const result = await query(
      `INSERT INTO messages (channel_id, author_id, content, embeds, tts, webhook_id, type)
       VALUES ($1, $2, $3, $4, $5, $6, 'webhook') RETURNING *`,
      [wh.channel_id, webhookUser.rows[0].id, content || null, JSON.stringify(embeds), tts, wh.id]
    );

    await query('UPDATE channels SET last_message_id = $1, updated_at = NOW() WHERE id = $2', [
      result.rows[0].id, wh.channel_id
    ]);

    res.status(204).end();
  } catch (err) {
    logger.error('Execute webhook error:', err);
    res.status(500).json({ error: 'Failed to execute webhook' });
  }
});

// DELETE /webhooks/:webhookId
router.delete('/:webhookId', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM webhooks WHERE id = $1', [req.params.webhookId]);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

module.exports = router;
