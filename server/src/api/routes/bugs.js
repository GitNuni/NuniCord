const express = require('express');
const router = express.Router();
const { query } = require('../../db');
const { authenticate } = require('../middleware/auth');

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS bug_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      device_info JSONB,
      status TEXT DEFAULT 'open',
      admin_notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  tableReady = true;
}

// Submit a bug report
router.post('/', authenticate, async (req, res) => {
  try {
    await ensureTable();
    const { title, description, device_info } = req.body;
    if (!title?.trim() || !description?.trim()) {
      return res.status(400).json({ error: 'Title and description are required' });
    }
    const result = await query(
      `INSERT INTO bug_reports (user_id, title, description, device_info)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, title.trim(), description.trim(), device_info ? JSON.stringify(device_info) : null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Bug report POST error:', err);
    res.status(500).json({ error: 'Failed to submit bug report' });
  }
});

// Get all bug reports (admin only)
router.get('/', authenticate, async (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin only' });
  try {
    await ensureTable();
    const result = await query(
      `SELECT br.*, u.username, u.display_name, u.email
       FROM bug_reports br
       LEFT JOIN users u ON u.id = br.user_id
       ORDER BY br.created_at DESC
       LIMIT 200`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bug reports' });
  }
});

// Update bug report status / admin notes (admin only)
router.patch('/:id', authenticate, async (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin only' });
  try {
    const { status, admin_notes } = req.body;
    const result = await query(
      `UPDATE bug_reports
       SET status = COALESCE($1, status), admin_notes = COALESCE($2, admin_notes)
       WHERE id = $3 RETURNING *`,
      [status || null, admin_notes ?? null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update bug report' });
  }
});

module.exports = router;
