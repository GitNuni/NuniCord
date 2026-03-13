const express = require('express');
const { body, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { query, transaction } = require('../../db');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { DEFAULT_PERMISSIONS, Permissions } = require('../../utils/permissions');
const logger = require('../../utils/logger');
const { getFullMessage } = require('./messages');

const router = express.Router();

function generateInviteCode() {
  return uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase();
}

// GET /servers — list user's servers
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT s.*, sm.nickname, sm.joined_at as member_joined_at,
              json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url) as owner
       FROM servers s
       JOIN server_members sm ON sm.server_id = s.id AND sm.user_id = $1
       JOIN users u ON u.id = s.owner_id
       ORDER BY sm.joined_at ASC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    logger.error('List servers error:', err);
    res.status(500).json({ error: 'Failed to list servers' });
  }
});

// POST /servers — create server
router.post(
  '/',
  authenticate,
  [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 chars'),
    body('description').optional().trim().isLength({ max: 512 }),
    body('icon_url').optional().isURL(),
  ],
  validate,
  async (req, res) => {
    try {
      const { name, description, icon_url } = req.body;

      const result = await transaction(async (client) => {
        const inviteCode = generateInviteCode();

        // Create server
        const serverResult = await client.query(
          `INSERT INTO servers (name, description, icon_url, owner_id, invite_code)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [name, description, icon_url, req.user.id, inviteCode]
        );
        const server = serverResult.rows[0];

        // Create @everyone role
        const everyoneRole = await client.query(
          `INSERT INTO roles (server_id, name, permissions, is_default, position)
           VALUES ($1, '@everyone', $2, TRUE, 0) RETURNING *`,
          [server.id, DEFAULT_PERMISSIONS.toString()]
        );

        // Create admin role
        await client.query(
          `INSERT INTO roles (server_id, name, color, permissions, hoist, position)
           VALUES ($1, 'Admin', '#FF5555', $2, TRUE, 100) RETURNING *`,
          [server.id, (Permissions.ADMINISTRATOR).toString()]
        );

        // Create default category
        const categoryResult = await client.query(
          `INSERT INTO categories (server_id, name, position) VALUES ($1, 'General', 0) RETURNING *`,
          [server.id]
        );

        // Create general channel
        const channelResult = await client.query(
          `INSERT INTO channels (server_id, category_id, name, type, position)
           VALUES ($1, $2, 'general', 'text', 0) RETURNING *`,
          [server.id, categoryResult.rows[0].id]
        );

        // Create voice channel
        await client.query(
          `INSERT INTO channels (server_id, category_id, name, type, position)
           VALUES ($1, $2, 'General', 'voice', 1)`,
          [server.id, categoryResult.rows[0].id]
        );

        // Set system channel
        await client.query(
          'UPDATE servers SET system_channel_id = $1 WHERE id = $2',
          [channelResult.rows[0].id, server.id]
        );

        // Join server as owner
        const memberResult = await client.query(
          `INSERT INTO server_members (server_id, user_id) VALUES ($1, $2) RETURNING *`,
          [server.id, req.user.id]
        );

        return { ...server, system_channel_id: channelResult.rows[0].id };
      });

      res.status(201).json(result);
    } catch (err) {
      logger.error('Create server error:', err);
      res.status(500).json({ error: 'Failed to create server' });
    }
  }
);

// GET /servers/:serverId
router.get('/:serverId', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT s.*,
              json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url) as owner,
              (SELECT json_agg(r ORDER BY r.position DESC)
               FROM roles r WHERE r.server_id = s.id) as roles,
              (SELECT json_agg(cat ORDER BY cat.position ASC)
               FROM categories cat WHERE cat.server_id = s.id) as categories,
              (SELECT json_agg(ch ORDER BY ch.position ASC)
               FROM channels ch WHERE ch.server_id = s.id AND ch.type != 'dm' AND ch.type != 'group_dm') as channels
       FROM servers s
       JOIN users u ON u.id = s.owner_id
       JOIN server_members sm ON sm.server_id = s.id AND sm.user_id = $2
       WHERE s.id = $1`,
      [req.params.serverId, req.user.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Server not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Get server error:', err);
    res.status(500).json({ error: 'Failed to get server' });
  }
});

// PATCH /servers/:serverId
router.patch(
  '/:serverId',
  authenticate,
  [
    body('name').optional().trim().isLength({ min: 2, max: 100 }),
    body('description').optional().trim().isLength({ max: 512 }),
    body('theme').optional().trim().isLength({ max: 32 }),
    body('system_channel_id').optional({ nullable: true }).custom(v => !v || /^[0-9a-f-]{36}$/.test(v)).withMessage('Invalid channel ID'),
  ],
  validate,
  async (req, res) => {
    try {
      const server = await query(
        'SELECT * FROM servers WHERE id = $1 AND owner_id = $2',
        [req.params.serverId, req.user.id]
      );
      if (!server.rows[0]) return res.status(403).json({ error: 'Forbidden' });

      const { name, description, icon_url, banner_url, theme, system_channel_id } = req.body;
      const result = await query(
        `UPDATE servers SET
          name = COALESCE($1, name),
          description = COALESCE($2, description),
          icon_url = COALESCE($3, icon_url),
          banner_url = COALESCE($4, banner_url),
          theme = COALESCE($5, theme),
          system_channel_id = CASE WHEN $7::boolean THEN $6::uuid ELSE system_channel_id END,
          updated_at = NOW()
         WHERE id = $8 RETURNING *`,
        [name, description, icon_url, banner_url, theme,
         system_channel_id || null,
         'system_channel_id' in req.body,
         req.params.serverId]
      );
      res.json(result.rows[0]);
    } catch (err) {
      logger.error('Update server error:', err);
      res.status(500).json({ error: 'Failed to update server' });
    }
  }
);

// DELETE /servers/:serverId
router.delete('/:serverId', authenticate, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM servers WHERE id = $1 AND owner_id = $2 RETURNING id',
      [req.params.serverId, req.user.id]
    );
    if (!result.rows[0]) return res.status(403).json({ error: 'Forbidden' });
    res.json({ message: 'Server deleted' });
  } catch (err) {
    logger.error('Delete server error:', err);
    res.status(500).json({ error: 'Failed to delete server' });
  }
});

// POST /servers/:serverId/leave
router.post('/:serverId/leave', authenticate, async (req, res) => {
  try {
    const server = await query('SELECT owner_id FROM servers WHERE id = $1', [req.params.serverId]);
    if (!server.rows[0]) return res.status(404).json({ error: 'Server not found' });
    if (server.rows[0].owner_id === req.user.id) {
      return res.status(400).json({ error: 'Owner cannot leave. Transfer ownership or delete the server.' });
    }
    await query('DELETE FROM server_members WHERE server_id = $1 AND user_id = $2', [
      req.params.serverId,
      req.user.id,
    ]);
    res.json({ message: 'Left server' });
  } catch (err) {
    logger.error('Leave server error:', err);
    res.status(500).json({ error: 'Failed to leave server' });
  }
});

// GET /servers/:serverId/voice — current voice states grouped by channel
router.get('/:serverId/voice', authenticate, async (req, res) => {
  try {
    const member = await query(
      'SELECT id FROM server_members WHERE server_id = $1 AND user_id = $2',
      [req.params.serverId, req.user.id]
    );
    if (!member.rows[0]) return res.status(403).json({ error: 'Not a member' });

    const result = await query(
      `SELECT vs.user_id, vs.channel_id, vs.self_mute, vs.self_deaf, vs.self_video, vs.self_stream,
              u.username, u.display_name, u.avatar_url
       FROM voice_states vs
       JOIN users u ON u.id = vs.user_id
       WHERE vs.server_id = $1`,
      [req.params.serverId]
    );

    // Group by channel_id
    const byChannel = {};
    for (const row of result.rows) {
      if (!byChannel[row.channel_id]) byChannel[row.channel_id] = [];
      byChannel[row.channel_id].push(row);
    }
    res.json(byChannel);
  } catch (err) {
    logger.error('Voice states error:', err);
    res.status(500).json({ error: 'Failed to get voice states' });
  }
});

// GET /servers/:serverId/members
router.get('/:serverId/members', authenticate, async (req, res) => {
  try {
    const { limit = 100, after } = req.query;

    // Verify membership
    const member = await query(
      'SELECT id FROM server_members WHERE server_id = $1 AND user_id = $2',
      [req.params.serverId, req.user.id]
    );
    if (!member.rows[0]) return res.status(403).json({ error: 'Not a member' });

    const result = await query(
      `SELECT sm.*, u.username, u.display_name, u.avatar_url, u.status, u.custom_status,
              COALESCE(json_agg(r ORDER BY r.position DESC) FILTER (WHERE r.id IS NOT NULL), '[]') as roles
       FROM server_members sm
       JOIN users u ON u.id = sm.user_id
       LEFT JOIN member_roles mr ON mr.member_id = sm.id
       LEFT JOIN roles r ON r.id = mr.role_id
       WHERE sm.server_id = $1
       ${after ? 'AND sm.joined_at > (SELECT joined_at FROM server_members WHERE id = $3)' : ''}
       GROUP BY sm.id, u.username, u.display_name, u.avatar_url, u.status, u.custom_status
       ORDER BY sm.joined_at ASC
       LIMIT $2`,
      after
        ? [req.params.serverId, Math.min(parseInt(limit), 1000), after]
        : [req.params.serverId, Math.min(parseInt(limit), 1000)]
    );
    res.json(result.rows);
  } catch (err) {
    logger.error('List members error:', err);
    res.status(500).json({ error: 'Failed to list members' });
  }
});

// POST /servers/join/:code — join via invite
router.post('/join/:code', authenticate, async (req, res) => {
  try {
    const invite = await query(
      `SELECT i.*, s.id as server_id, s.name as server_name, s.icon_url
       FROM invites i
       JOIN servers s ON s.id = i.server_id
       WHERE i.code = $1 AND i.is_revoked = FALSE
       AND (i.expires_at IS NULL OR i.expires_at > NOW())
       AND (i.max_uses = 0 OR i.uses < i.max_uses)`,
      [req.params.code]
    );

    if (!invite.rows[0]) {
      return res.status(404).json({ error: 'Invalid or expired invite' });
    }

    const inv = invite.rows[0];

    // Check if already a member
    const existing = await query(
      'SELECT id FROM server_members WHERE server_id = $1 AND user_id = $2',
      [inv.server_id, req.user.id]
    );
    if (existing.rows[0]) {
      return res.json({ server_id: inv.server_id, already_member: true });
    }

    await transaction(async (client) => {
      await client.query(
        'INSERT INTO server_members (server_id, user_id) VALUES ($1, $2)',
        [inv.server_id, req.user.id]
      );
      await client.query('UPDATE invites SET uses = uses + 1 WHERE id = $1', [inv.id]);
    });

    // Post join announcement if system_channel_id is set
    try {
      const serverRow = await query(
        'SELECT system_channel_id FROM servers WHERE id = $1',
        [inv.server_id]
      );
      const systemChannelId = serverRow.rows[0]?.system_channel_id;
      if (systemChannelId) {
        const displayName = req.user.display_name || req.user.username;
        const announcementContent = `**${displayName}** just joined the server!`;
        const msgResult = await query(
          `INSERT INTO messages (channel_id, author_id, content, type)
           VALUES ($1, $2, $3, 'member_join') RETURNING *`,
          [systemChannelId, req.user.id, announcementContent]
        );
        await query('UPDATE channels SET last_message_id = $1, updated_at = NOW() WHERE id = $2',
          [msgResult.rows[0].id, systemChannelId]);
        const fullMsg = await getFullMessage(msgResult.rows[0].id, req.user.id);
        if (fullMsg) {
          const io = req.app.get('io');
          if (io) {
            io.to(`server:${inv.server_id}`).emit('MESSAGE_CREATE', fullMsg);
          }
        }
      }
    } catch (announcErr) {
      logger.warn('Join announcement failed:', announcErr.message);
    }

    res.json({ server_id: inv.server_id, server_name: inv.server_name });
  } catch (err) {
    logger.error('Join server error:', err);
    res.status(500).json({ error: 'Failed to join server' });
  }
});

// GET /servers/:serverId/invites
router.get('/:serverId/invites', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT i.*,
              json_build_object('id', u.id, 'username', u.username, 'avatar_url', u.avatar_url) as created_by_user
       FROM invites i
       JOIN users u ON u.id = i.created_by
       WHERE i.server_id = $1 AND i.is_revoked = FALSE
       ORDER BY i.created_at DESC`,
      [req.params.serverId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list invites' });
  }
});

// POST /servers/:serverId/invites
router.post(
  '/:serverId/invites',
  authenticate,
  [
    body('max_uses').optional().isInt({ min: 0 }),
    body('expires_in').optional().isInt({ min: 0 }),
    body('channel_id').optional().isUUID(),
  ],
  validate,
  async (req, res) => {
    try {
      const member = await query(
        'SELECT id FROM server_members WHERE server_id = $1 AND user_id = $2',
        [req.params.serverId, req.user.id]
      );
      if (!member.rows[0]) return res.status(403).json({ error: 'Not a member' });

      const { max_uses = 0, expires_in, channel_id } = req.body;
      const code = generateInviteCode();
      const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : null;

      const result = await query(
        `INSERT INTO invites (code, server_id, channel_id, created_by, max_uses, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [code, req.params.serverId, channel_id || null, req.user.id, max_uses, expiresAt]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      logger.error('Create invite error:', err);
      res.status(500).json({ error: 'Failed to create invite' });
    }
  }
);

// GET /servers/:serverId/roles
router.get('/:serverId/roles', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM roles WHERE server_id = $1 ORDER BY position DESC',
      [req.params.serverId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list roles' });
  }
});

// POST /servers/:serverId/roles
router.post(
  '/:serverId/roles',
  authenticate,
  [
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
    body('permissions').optional().isString(),
    body('hoist').optional().isBoolean(),
    body('mentionable').optional().isBoolean(),
  ],
  validate,
  async (req, res) => {
    try {
      const { name, color = '#99AAB5', permissions = '0', hoist = false, mentionable = false } = req.body;

      // Get max position
      const pos = await query(
        'SELECT COALESCE(MAX(position), 0) + 1 as pos FROM roles WHERE server_id = $1',
        [req.params.serverId]
      );

      const result = await query(
        `INSERT INTO roles (server_id, name, color, permissions, hoist, mentionable, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [req.params.serverId, name, color, permissions, hoist, mentionable, pos.rows[0].pos]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      logger.error('Create role error:', err);
      res.status(500).json({ error: 'Failed to create role' });
    }
  }
);

// PATCH /servers/:serverId/members/:userId
router.patch(
  '/:serverId/members/:userId',
  authenticate,
  async (req, res) => {
    try {
      const { nickname, roles } = req.body;

      const result = await query(
        `UPDATE server_members SET
          nickname = COALESCE($1, nickname)
         WHERE server_id = $2 AND user_id = $3 RETURNING *`,
        [nickname, req.params.serverId, req.params.userId]
      );

      if (!result.rows[0]) return res.status(404).json({ error: 'Member not found' });

      // Update roles if provided
      if (roles && Array.isArray(roles)) {
        await query('DELETE FROM member_roles WHERE member_id = $1', [result.rows[0].id]);
        for (const roleId of roles) {
          await query(
            'INSERT INTO member_roles (member_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [result.rows[0].id, roleId]
          );
        }
      }

      res.json(result.rows[0]);
    } catch (err) {
      logger.error('Update member error:', err);
      res.status(500).json({ error: 'Failed to update member' });
    }
  }
);

// DELETE /servers/:serverId/members/:userId — kick
router.delete('/:serverId/members/:userId', authenticate, async (req, res) => {
  try {
    const server = await query(
      'SELECT owner_id FROM servers WHERE id = $1',
      [req.params.serverId]
    );
    if (!server.rows[0]) return res.status(404).json({ error: 'Server not found' });

    // Must be owner or admin
    const actingMember = await query(
      `SELECT sm.*, bool_or(r.permissions::bigint & ${Permissions.KICK_MEMBERS} > 0 OR r.permissions::bigint & ${Permissions.ADMINISTRATOR} > 0) as can_kick
       FROM server_members sm
       LEFT JOIN member_roles mr ON mr.member_id = sm.id
       LEFT JOIN roles r ON r.id = mr.role_id
       WHERE sm.server_id = $1 AND sm.user_id = $2
       GROUP BY sm.id`,
      [req.params.serverId, req.user.id]
    );

    if (!actingMember.rows[0]?.can_kick && server.rows[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await query('DELETE FROM server_members WHERE server_id = $1 AND user_id = $2', [
      req.params.serverId,
      req.params.userId,
    ]);
    res.json({ message: 'Member kicked' });
  } catch (err) {
    logger.error('Kick member error:', err);
    res.status(500).json({ error: 'Failed to kick member' });
  }
});

module.exports = router;
