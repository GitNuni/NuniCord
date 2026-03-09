const express = require('express');
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const { query } = require('../../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const logger = require('../../utils/logger');

const router = express.Router();

// All admin routes require authentication + admin flag
router.use(authenticate, requireAdmin);

// GET /admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [users, servers, messages, activeUsers] = await Promise.all([
      query('SELECT COUNT(*) FROM users WHERE is_bot = FALSE'),
      query('SELECT COUNT(*) FROM servers'),
      query("SELECT COUNT(*) FROM messages WHERE created_at > NOW() - INTERVAL '24 hours'"),
      query("SELECT COUNT(DISTINCT author_id) FROM messages WHERE created_at > NOW() - INTERVAL '15 minutes'"),
    ]);

    // Message volume over last 7 days
    const volume = await query(`
      SELECT DATE_TRUNC('day', created_at) as day, COUNT(*) as count
      FROM messages
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY day
      ORDER BY day ASC
    `);

    res.json({
      total_users: parseInt(users.rows[0].count),
      total_servers: parseInt(servers.rows[0].count),
      messages_24h: parseInt(messages.rows[0].count),
      active_users_15m: parseInt(activeUsers.rows[0].count),
      message_volume: volume.rows,
    });
  } catch (err) {
    logger.error('Admin stats error:', err);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// GET /admin/users
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = "WHERE is_bot = FALSE";
    const params = [];
    let idx = 1;

    if (search) {
      whereClause += ` AND (username ILIKE $${idx} OR email ILIKE $${idx} OR display_name ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    const [countResult, usersResult] = await Promise.all([
      query(`SELECT COUNT(*) FROM users ${whereClause}`, params),
      query(
        `SELECT id, username, email, display_name, avatar_url, status, is_admin, is_banned, ban_reason,
                email_verified, last_seen, created_at
         FROM users ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, parseInt(limit), offset]
      ),
    ]);

    res.json({
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      users: usersResult.rows,
    });
  } catch (err) {
    logger.error('Admin list users error:', err);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// GET /admin/users/:userId
router.get('/users/:userId', async (req, res) => {
  try {
    const result = await query(
      `SELECT u.*,
              (SELECT COUNT(*) FROM server_members WHERE user_id = u.id) as server_count,
              (SELECT COUNT(*) FROM messages WHERE author_id = u.id) as message_count
       FROM users u WHERE u.id = $1`,
      [req.params.userId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    const { password_hash, bot_token, mfa_secret, ...user } = result.rows[0];
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// POST /admin/users/:userId/ban
router.post(
  '/users/:userId/ban',
  [body('reason').optional().trim().isLength({ max: 512 })],
  validate,
  async (req, res) => {
    try {
      if (req.params.userId === req.user.id) {
        return res.status(400).json({ error: 'Cannot ban yourself' });
      }
      const result = await query(
        'UPDATE users SET is_banned = TRUE, ban_reason = $1 WHERE id = $2 RETURNING id, username',
        [req.body.reason || null, req.params.userId]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
      logger.info(`Admin ${req.user.username} banned user ${result.rows[0].username}`);
      res.json({ message: 'User banned', user: result.rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Failed to ban user' });
    }
  }
);

// POST /admin/users/:userId/unban
router.post('/users/:userId/unban', async (req, res) => {
  try {
    await query('UPDATE users SET is_banned = FALSE, ban_reason = NULL WHERE id = $1', [req.params.userId]);
    res.json({ message: 'User unbanned' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

// POST /admin/users/:userId/reset-password
router.post(
  '/users/:userId/reset-password',
  [body('new_password').isLength({ min: 8 })],
  validate,
  async (req, res) => {
    try {
      const hash = await bcrypt.hash(req.body.new_password, 12);
      await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.params.userId]);
      res.json({ message: 'Password reset successfully' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to reset password' });
    }
  }
);

// PATCH /admin/users/:userId
router.patch('/users/:userId', async (req, res) => {
  try {
    const { is_admin } = req.body;
    const result = await query(
      'UPDATE users SET is_admin = COALESCE($1, is_admin) WHERE id = $2 RETURNING id, username, is_admin',
      [is_admin, req.params.userId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /admin/users/:userId
router.delete('/users/:userId', async (req, res) => {
  try {
    if (req.params.userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }
    await query('DELETE FROM users WHERE id = $1', [req.params.userId]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// GET /admin/servers
router.get('/servers', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const result = await query(
      `SELECT s.*,
              json_build_object('id', u.id, 'username', u.username) as owner
       FROM servers s
       JOIN users u ON u.id = s.owner_id
       ORDER BY s.created_at DESC
       LIMIT $1 OFFSET $2`,
      [parseInt(limit), offset]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list servers' });
  }
});

// DELETE /admin/servers/:serverId
router.delete('/servers/:serverId', async (req, res) => {
  try {
    await query('DELETE FROM servers WHERE id = $1', [req.params.serverId]);
    res.json({ message: 'Server deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete server' });
  }
});

// GET /admin/settings
router.get('/settings', async (req, res) => {
  try {
    const result = await query('SELECT key, value FROM instance_settings ORDER BY key');
    const settings = {};
    result.rows.forEach(row => { settings[row.key] = row.value; });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// PATCH /admin/settings
router.patch('/settings', async (req, res) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      await query(
        `INSERT INTO instance_settings (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, JSON.stringify(value)]
      );
    }
    res.json({ message: 'Settings updated' });
  } catch (err) {
    logger.error('Update settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// GET /admin/audit-log
router.get('/audit-log', async (req, res) => {
  try {
    const { server_id, limit = 50 } = req.query;
    const result = await query(
      `SELECT al.*,
              json_build_object('id', u.id, 'username', u.username) as user
       FROM audit_log al
       LEFT JOIN users u ON u.id = al.user_id
       ${server_id ? 'WHERE al.server_id = $2' : ''}
       ORDER BY al.created_at DESC
       LIMIT $1`,
      server_id ? [parseInt(limit), server_id] : [parseInt(limit)]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get audit log' });
  }
});

// POST /admin/bots — create bot account
router.post(
  '/bots',
  [
    body('username').trim().isLength({ min: 2, max: 32 }).matches(/^[a-zA-Z0-9_.-]+$/),
    body('display_name').optional().trim().isLength({ max: 64 }),
  ],
  validate,
  async (req, res) => {
    try {
      const { username, display_name } = req.body;
      const token = require('crypto').randomBytes(32).toString('base64url');

      const result = await query(
        `INSERT INTO users (username, display_name, is_bot, bot_token)
         VALUES ($1, $2, TRUE, $3)
         RETURNING id, username, display_name, is_bot, created_at`,
        [username, display_name || username, token]
      );

      res.status(201).json({ ...result.rows[0], token });
    } catch (err) {
      logger.error('Create bot error:', err);
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Username already taken' });
      }
      res.status(500).json({ error: 'Failed to create bot' });
    }
  }
);

module.exports = router;
