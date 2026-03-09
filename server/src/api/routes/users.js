const express = require('express');
const { query } = require('../../db');
const { authenticate } = require('../middleware/auth');
const logger = require('../../utils/logger');

const router = express.Router();

// GET /users/:userId
router.get('/:userId', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, username, display_name, avatar_url, banner_url, bio, pronouns,
              status, custom_status, is_bot, created_at
       FROM users WHERE id = $1 AND is_banned = FALSE`,
      [req.params.userId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// GET /users/:userId/profile — mutual servers, shared info
router.get('/:userId/profile', authenticate, async (req, res) => {
  try {
    const userResult = await query(
      `SELECT id, username, display_name, avatar_url, banner_url, bio, pronouns,
              status, custom_status, is_bot, created_at
       FROM users WHERE id = $1 AND is_banned = FALSE`,
      [req.params.userId]
    );
    if (!userResult.rows[0]) return res.status(404).json({ error: 'User not found' });

    const mutualServers = await query(
      `SELECT s.id, s.name, s.icon_url
       FROM servers s
       JOIN server_members sm1 ON sm1.server_id = s.id AND sm1.user_id = $1
       JOIN server_members sm2 ON sm2.server_id = s.id AND sm2.user_id = $2`,
      [req.user.id, req.params.userId]
    );

    res.json({
      user: userResult.rows[0],
      mutual_servers: mutualServers.rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

// GET /users/search — search users
router.get('/search', authenticate, async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    if (!q || q.length < 2) return res.status(400).json({ error: 'Query too short' });

    const result = await query(
      `SELECT id, username, display_name, avatar_url, status
       FROM users
       WHERE (username ILIKE $1 OR display_name ILIKE $1) AND is_banned = FALSE AND is_bot = FALSE
       ORDER BY username ASC
       LIMIT $2`,
      [`${q}%`, Math.min(parseInt(limit), 50)]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
