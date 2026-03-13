const express = require('express');
const { query } = require('../../db');
const { authenticate } = require('../middleware/auth');
const logger = require('../../utils/logger');

const router = express.Router();

// Ensure table exists
async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS server_sounds (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label VARCHAR(100) NOT NULL,
      data TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_server_sounds_server ON server_sounds(server_id)');
}
ensureTable().catch(e => logger.error('server_sounds table error:', e));

// GET /sounds/:serverId — list sounds for a server
router.get('/:serverId', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT ss.id, ss.label, ss.data, ss.created_at, u.display_name as uploader_name
       FROM server_sounds ss
       JOIN users u ON u.id = ss.uploaded_by
       WHERE ss.server_id = $1
       ORDER BY ss.created_at ASC`,
      [req.params.serverId]
    );
    res.json(result.rows);
  } catch (err) {
    logger.error('Get sounds error:', err);
    res.status(500).json({ error: 'Failed to get sounds' });
  }
});

// POST /sounds/:serverId — upload a sound (base64 data URL)
router.post('/:serverId', authenticate, async (req, res) => {
  try {
    const { label, data } = req.body;
    if (!label || !data) return res.status(400).json({ error: 'label and data required' });
    if (data.length > 4 * 1024 * 1024) return res.status(400).json({ error: 'Sound too large (max 3MB)' });

    // Verify member
    const member = await query(
      'SELECT id FROM server_members WHERE server_id = $1 AND user_id = $2',
      [req.params.serverId, req.user.id]
    );
    if (!member.rows[0]) return res.status(403).json({ error: 'Not a member' });

    const result = await query(
      'INSERT INTO server_sounds (server_id, uploaded_by, label, data) VALUES ($1, $2, $3, $4) RETURNING id, label, created_at',
      [req.params.serverId, req.user.id, label.trim(), data]
    );
    const sound = result.rows[0];

    // Notify all users in the server
    const io = req.app.get('io');
    if (io) io.to(`server:${req.params.serverId}`).emit('SOUND_CREATE', {
      ...sound, data, server_id: req.params.serverId, uploader_name: req.user.display_name || req.user.username,
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error('Upload sound error:', err);
    res.status(500).json({ error: 'Failed to upload sound' });
  }
});

// DELETE /sounds/:serverId/:soundId
router.delete('/:serverId/:soundId', authenticate, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM server_sounds WHERE id = $1 AND server_id = $2 AND (uploaded_by = $3 OR $4) RETURNING id',
      [req.params.soundId, req.params.serverId, req.user.id, req.user.is_admin]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Sound not found' });

    const io = req.app.get('io');
    if (io) io.to(`server:${req.params.serverId}`).emit('SOUND_DELETE', {
      id: req.params.soundId, server_id: req.params.serverId,
    });

    res.json({ id: req.params.soundId });
  } catch (err) {
    logger.error('Delete sound error:', err);
    res.status(500).json({ error: 'Failed to delete sound' });
  }
});

module.exports = router;
