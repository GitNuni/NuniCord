const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../../db');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const logger = require('../../utils/logger');

const router = express.Router();

function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// POST /auth/register
router.post(
  '/register',
  [
    body('username')
      .trim()
      .isLength({ min: 2, max: 32 })
      .matches(/^[a-zA-Z0-9_.-]+$/)
      .withMessage('Username must be 2-32 chars, alphanumeric/._-'),
    body('email').optional().isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('display_name').optional().trim().isLength({ max: 64 }),
  ],
  validate,
  async (req, res) => {
    try {
      // Check registration open
      const settingResult = await query(
        "SELECT value FROM instance_settings WHERE key = 'registration_open'"
      );
      const regOpen = settingResult.rows[0]?.value;
      if (regOpen === false || regOpen === 'false') {
        return res.status(403).json({ error: 'Registration is currently closed' });
      }

      const { username, email, password, display_name } = req.body;

      // Check existing
      const existing = await query(
        'SELECT id FROM users WHERE username = $1 OR (email = $2 AND email IS NOT NULL)',
        [username, email || null]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Username or email already taken' });
      }

      const password_hash = await bcrypt.hash(password, 12);
      const isFirstUser = (await query('SELECT COUNT(*) FROM users')).rows[0].count === '0';

      // Check if approval is required
      const approvalSetting = await query(
        "SELECT value FROM instance_settings WHERE key = 'require_approval'"
      );
      const approvalVal = approvalSetting.rows[0]?.value;
      const requireApproval = !isFirstUser && (approvalVal === true || approvalVal === 'true');

      const result = await query(
        `INSERT INTO users (username, email, password_hash, display_name, is_admin, is_banned, ban_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, username, email, display_name, avatar_url, is_admin, created_at`,
        [username, email || null, password_hash, display_name || username, isFirstUser,
         requireApproval, requireApproval ? 'pending_approval' : null]
      );

      const user = result.rows[0];

      if (requireApproval) {
        logger.info(`New user pending approval: ${username}`);
        return res.status(201).json({ pending: true, message: 'Your account is pending admin approval.' });
      }

      const token = generateToken(user.id);
      logger.info(`New user registered: ${username}`);
      res.status(201).json({ token, user });
    } catch (err) {
      logger.error('Registration error:', err);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// POST /auth/login
router.post(
  '/login',
  [
    body('login').trim().notEmpty(),
    body('password').notEmpty(),
  ],
  validate,
  async (req, res) => {
    try {
      const { login, password } = req.body;

      const result = await query(
        'SELECT * FROM users WHERE (LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)) AND is_bot = FALSE',
        [login]
      );

      const user = result.rows[0];
      if (!user || !user.password_hash) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (user.ban_reason === 'pending_approval') {
        return res.status(403).json({ error: 'Your account is pending admin approval.' });
      }
      if (user.is_banned) {
        return res.status(403).json({ error: `Account suspended: ${user.ban_reason || 'No reason provided'}` });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Update last seen
      await query('UPDATE users SET last_seen = NOW(), status = $1 WHERE id = $2', [
        user.status === 'offline' ? 'online' : user.status,
        user.id,
      ]);

      const token = generateToken(user.id);
      const { password_hash, bot_token, mfa_secret, ...safeUser } = user;

      res.json({ token, user: safeUser });
    } catch (err) {
      logger.error('Login error:', err);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// GET /auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.username, u.email, u.display_name, u.avatar_url, u.banner_url,
              u.bio, u.pronouns, u.status, u.custom_status, u.is_admin, u.is_bot,
              u.notification_settings, u.created_at,
              COALESCE(json_agg(DISTINCT jsonb_build_object(
                'id', s.id, 'name', s.name, 'icon_url', s.icon_url
              )) FILTER (WHERE s.id IS NOT NULL), '[]') as servers
       FROM users u
       LEFT JOIN server_members sm ON sm.user_id = u.id
       LEFT JOIN servers s ON s.id = sm.server_id
       WHERE u.id = $1
       GROUP BY u.id`,
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Get me error:', err);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

// PATCH /auth/me
router.patch(
  '/me',
  authenticate,
  [
    body('display_name').optional().trim().isLength({ max: 64 }),
    body('bio').optional().trim().isLength({ max: 512 }),
    body('pronouns').optional().trim().isLength({ max: 64 }),
    body('status').optional().isIn(['online', 'idle', 'dnd', 'invisible']),
    body('custom_status').optional().trim().isLength({ max: 128 }),
  ],
  validate,
  async (req, res) => {
    try {
      const { display_name, bio, pronouns, status, custom_status } = req.body;
      const result = await query(
        `UPDATE users SET
          display_name = COALESCE($1, display_name),
          bio = COALESCE($2, bio),
          pronouns = COALESCE($3, pronouns),
          status = COALESCE($4, status),
          custom_status = COALESCE($5, custom_status),
          updated_at = NOW()
         WHERE id = $6
         RETURNING id, username, email, display_name, avatar_url, bio, pronouns, status, custom_status`,
        [display_name, bio, pronouns, status, custom_status, req.user.id]
      );
      res.json(result.rows[0]);
    } catch (err) {
      logger.error('Update profile error:', err);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);

// POST /auth/change-password
router.post(
  '/change-password',
  authenticate,
  [
    body('current_password').notEmpty(),
    body('new_password').isLength({ min: 8 }),
  ],
  validate,
  async (req, res) => {
    try {
      const { current_password, new_password } = req.body;
      const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
      const valid = await bcrypt.compare(current_password, result.rows[0].password_hash);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

      const hash = await bcrypt.hash(new_password, 12);
      await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
      res.json({ message: 'Password updated successfully' });
    } catch (err) {
      logger.error('Change password error:', err);
      res.status(500).json({ error: 'Failed to change password' });
    }
  }
);

// POST /auth/logout
router.post('/logout', authenticate, async (req, res) => {
  await query('UPDATE users SET status = $1, last_seen = NOW() WHERE id = $2', [
    'offline',
    req.user.id,
  ]);
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
