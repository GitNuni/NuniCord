const { query } = require('../../db');
const { Permissions, hasPermission } = require('../../utils/permissions');

/**
 * Returns the computed permission bits for a user in a server.
 * Server owner always gets full permissions.
 */
async function getUserServerPermissions(userId, serverId) {
  // Check server ownership
  const server = await query('SELECT owner_id FROM servers WHERE id = $1', [serverId]);
  if (!server.rows[0]) return 0n;
  if (server.rows[0].owner_id === userId) return BigInt('0xFFFFFFFFFFFF');

  // Get the user's server_member record
  const member = await query(
    'SELECT sm.id FROM server_members sm WHERE sm.server_id = $1 AND sm.user_id = $2',
    [serverId, userId]
  );
  if (!member.rows[0]) return 0n;

  // Get all roles for this server with the user's role assignments
  const roles = await query(
    `SELECT r.id, r.permissions, r.is_default,
            (mr.member_id IS NOT NULL) AS has_role
     FROM roles r
     LEFT JOIN member_roles mr ON mr.role_id = r.id AND mr.member_id = $1
     WHERE r.server_id = $2`,
    [member.rows[0].id, serverId]
  );

  let permissions = 0n;
  for (const role of roles.rows) {
    if (role.is_default || role.has_role) {
      permissions |= BigInt(role.permissions);
    }
  }

  return permissions;
}

/**
 * Middleware factory — requires a specific permission in the server.
 * Expects req.user (from authenticate) and req.body.server_id or req.params.serverId.
 * For channel-level routes, pass a function to extract serverId from req.
 */
function requirePermission(permission, getServerId) {
  return async (req, res, next) => {
    try {
      const serverId = typeof getServerId === 'function'
        ? await getServerId(req)
        : (req.body.server_id || req.params.serverId);

      if (!serverId) return res.status(400).json({ error: 'Server ID required' });

      const perms = await getUserServerPermissions(req.user.id, serverId);

      if (hasPermission(perms, Permissions.ADMINISTRATOR) || hasPermission(perms, permission)) {
        return next();
      }

      return res.status(403).json({ error: 'You do not have permission to do that.' });
    } catch (err) {
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

module.exports = { requirePermission, getUserServerPermissions };
