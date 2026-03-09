const jwt = require('jsonwebtoken');
const { query } = require('../../db');
const logger = require('../../utils/logger');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : req.cookies?.token;

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if it's a bot token
    if (token.startsWith('Bot ')) {
      const botToken = token.slice(4);
      const result = await query(
        'SELECT * FROM users WHERE bot_token = $1 AND is_bot = TRUE AND is_banned = FALSE',
        [botToken]
      );
      if (!result.rows[0]) {
        return res.status(401).json({ error: 'Invalid bot token' });
      }
      req.user = result.rows[0];
      req.isBot = true;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await query(
      'SELECT id, username, email, display_name, avatar_url, bio, pronouns, status, custom_status, is_bot, is_admin, is_banned, created_at FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!result.rows[0]) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (result.rows[0].is_banned) {
      return res.status(403).json({ error: 'Account suspended' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    logger.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
    if (result.rows[0] && !result.rows[0].is_banned) {
      req.user = result.rows[0];
    }
  } catch {}
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { authenticate, optionalAuth, requireAdmin };
