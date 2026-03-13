const express = require('express');
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const { query } = require('../../db');
const { validate } = require('../middleware/validate');
const logger = require('../../utils/logger');

const router = express.Router();

// POST /auth/setup — first-time admin setup
router.post(
  '/setup',
  [
    body('token').notEmpty(),
    body('username').trim().isLength({ min: 2, max: 32 }).matches(/^[a-zA-Z0-9_.-]+$/),
    body('password').isLength({ min: 8 }),
  ],
  validate,
  async (req, res) => {
    try {
      const { token, username, email, password, display_name } = req.body;

      // Verify token
      const tokenResult = await query(
        "SELECT value FROM instance_settings WHERE key = 'setup_token'"
      );

      const stored = tokenResult.rows[0]?.value;
      let storedToken;
      try { storedToken = JSON.parse(stored); } catch { storedToken = stored; }
      if (!stored || storedToken !== token) {
        return res.status(403).json({ error: 'Invalid setup token' });
      }

      // Check if admin already exists
      const adminCount = await query('SELECT COUNT(*) FROM users WHERE is_admin = TRUE');
      if (parseInt(adminCount.rows[0].count) > 0) {
        return res.status(409).json({ error: 'Admin account already exists' });
      }

      const hash = await bcrypt.hash(password, 12);
      await query(
        `INSERT INTO users (username, email, password_hash, display_name, is_admin)
         VALUES ($1, $2, $3, $4, TRUE)`,
        [username, email || null, hash, display_name || username]
      );

      // Invalidate setup token
      await query("DELETE FROM instance_settings WHERE key = 'setup_token'");

      logger.info(`Admin account created: ${username}`);
      res.json({ message: 'Admin account created successfully. You can now log in.' });
    } catch (err) {
      logger.error('Setup error:', err);
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Username or email already taken' });
      }
      res.status(500).json({ error: 'Setup failed' });
    }
  }
);

module.exports = router;
