const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const jwt = require('jsonwebtoken');
const { query } = require('../../db');
const logger = require('../../utils/logger');

const router = express.Router();

function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// Configure Google OAuth
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.OAUTH_CALLBACK_URL}/api/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const avatarUrl = profile.photos?.[0]?.value;

          // Find existing user
          let user = await query(
            'SELECT * FROM users WHERE oauth_provider = $1 AND oauth_id = $2',
            ['google', profile.id]
          );

          if (!user.rows[0] && email) {
            user = await query('SELECT * FROM users WHERE email = $1', [email]);
          }

          if (!user.rows[0]) {
            // Create new user
            const username = `${profile.displayName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${profile.id.slice(0, 6)}`;
            const result = await query(
              `INSERT INTO users (username, email, display_name, avatar_url, oauth_provider, oauth_id, email_verified)
               VALUES ($1, $2, $3, $4, 'google', $5, TRUE) RETURNING *`,
              [username, email, profile.displayName, avatarUrl, profile.id]
            );
            user = result;
          } else if (!user.rows[0].oauth_id) {
            await query('UPDATE users SET oauth_provider = $1, oauth_id = $2 WHERE id = $3', [
              'google', profile.id, user.rows[0].id
            ]);
          }

          done(null, user.rows[0]);
        } catch (err) {
          done(err);
        }
      }
    )
  );

  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

  router.get(
    '/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login?error=oauth_failed' }),
    (req, res) => {
      const token = generateToken(req.user.id);
      res.redirect(`/?token=${token}`);
    }
  );
}

// Configure GitHub OAuth
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: `${process.env.OAUTH_CALLBACK_URL}/api/auth/github/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const avatarUrl = profile.photos?.[0]?.value;

          let user = await query(
            'SELECT * FROM users WHERE oauth_provider = $1 AND oauth_id = $2',
            ['github', profile.id.toString()]
          );

          if (!user.rows[0]) {
            const username = `${profile.username || profile.displayName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_gh`;
            const result = await query(
              `INSERT INTO users (username, email, display_name, avatar_url, oauth_provider, oauth_id, email_verified)
               VALUES ($1, $2, $3, $4, 'github', $5, TRUE)
               ON CONFLICT (username) DO UPDATE SET oauth_provider = 'github', oauth_id = $5
               RETURNING *`,
              [username.slice(0, 32), email, profile.displayName || profile.username, avatarUrl, profile.id.toString()]
            );
            user = result;
          }

          done(null, user.rows[0]);
        } catch (err) {
          done(err);
        }
      }
    )
  );

  router.get('/github', passport.authenticate('github', { scope: ['user:email'], session: false }));

  router.get(
    '/github/callback',
    passport.authenticate('github', { session: false, failureRedirect: '/login?error=oauth_failed' }),
    (req, res) => {
      const token = generateToken(req.user.id);
      res.redirect(`/?token=${token}`);
    }
  );
}

module.exports = router;
