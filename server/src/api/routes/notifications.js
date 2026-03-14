const express = require('express');
const webpush = require('web-push');
const { body } = require('express-validator');
const { query } = require('../../db');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const logger = require('../../utils/logger');

const router = express.Router();

// Configure VAPID
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'admin@nunicord.local'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// GET /notifications/vapid-key
router.get('/vapid-key', (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: 'Push notifications not configured' });
  }
  res.json({ public_key: process.env.VAPID_PUBLIC_KEY });
});

// POST /notifications/subscribe
router.post(
  '/subscribe',
  authenticate,
  [
    body('endpoint').notEmpty().isString(),
    body('keys.p256dh').notEmpty(),
    body('keys.auth').notEmpty(),
  ],
  validate,
  async (req, res) => {
    try {
      const { endpoint, keys } = req.body;

      await query(
        `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh = $3, auth = $4`,
        [req.user.id, endpoint, keys.p256dh, keys.auth]
      );

      res.json({ message: 'Subscribed to push notifications' });
    } catch (err) {
      logger.error('Push subscribe error:', err);
      res.status(500).json({ error: 'Failed to subscribe' });
    }
  }
);

// DELETE /notifications/subscribe
router.delete('/subscribe', authenticate, async (req, res) => {
  try {
    const { endpoint } = req.body;
    await query(
      'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
      [req.user.id, endpoint]
    );
    res.json({ message: 'Unsubscribed from push notifications' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

// PATCH /notifications/settings
router.patch(
  '/settings',
  authenticate,
  [
    body('server_id').optional().isUUID(),
    body('channel_id').optional().isUUID(),
    body('level').isIn(['all', 'mentions', 'none', 'default']),
    body('muted').optional().isBoolean(),
  ],
  validate,
  async (req, res) => {
    try {
      const { server_id, channel_id, level, muted } = req.body;

      await query(
        `INSERT INTO notification_settings (user_id, server_id, channel_id, level, muted)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, COALESCE(channel_id, '00000000-0000-0000-0000-000000000000'),
                      COALESCE(server_id, '00000000-0000-0000-0000-000000000000'))
         DO UPDATE SET level = $4, muted = COALESCE($5, notification_settings.muted)`,
        [req.user.id, server_id || null, channel_id || null, level, muted]
      );

      res.json({ message: 'Notification settings updated' });
    } catch (err) {
      logger.error('Notification settings error:', err);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  }
);

// POST /notifications/device-token — register APNs device token (iOS native app)
router.post('/device-token', authenticate, async (req, res) => {
  try {
    const { token, platform } = req.body;
    if (!token) return res.status(400).json({ error: 'token required' });

    await query(
      `INSERT INTO device_tokens (user_id, token, platform, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, token) DO UPDATE SET platform = $3, updated_at = NOW()`,
      [req.user.id, token, platform || 'ios']
    );

    res.json({ message: 'Device token registered' });
  } catch (err) {
    // Table may not exist yet — create it
    await query(`
      CREATE TABLE IF NOT EXISTS device_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        platform VARCHAR(20) DEFAULT 'ios',
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, token)
      )
    `).catch(() => {});
    logger.warn('Device token table created on-demand');
    res.json({ message: 'Device token registered' });
  }
});

// Helper to send push notification
async function sendPushNotification(userId, payload) {
  if (!process.env.VAPID_PUBLIC_KEY) return;

  try {
    const subs = await query(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );

    const notifications = subs.rows.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 86400 }
      ).catch(err => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired, remove it
          query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]).catch(() => {});
        }
      })
    );

    await Promise.allSettled(notifications);
  } catch (err) {
    logger.error('Push notification error:', err);
  }
}

module.exports = router;
module.exports.sendPushNotification = sendPushNotification;
