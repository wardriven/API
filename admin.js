const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { v4: uuidv4 } = require('uuid');

/**
 * Admin routes – protected by the ADMIN_SECRET environment variable.
 * These are NOT protected by the regular API-key middleware.
 *
 * Supply the admin secret via the X-Admin-Secret header.
 */
function requireAdmin(req, res, next) {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Invalid or missing admin secret.' });
  }
  next();
}

router.use(requireAdmin);

// ── GET /admin/keys  –  List all API keys ────────────────────────────────────

router.get('/keys', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, api_key, label, is_active, created_at, last_used FROM api_keys ORDER BY id'
    );
    return res.json(rows);
  } catch (err) {
    console.error('GET /admin/keys error:', err);
    res.status(500).json({ error: 'Failed to list API keys.' });
  }
});

// ── POST /admin/keys  –  Generate a new API key ───────────────────────────────
//  Body: { "label": "Client name or description" }

router.post('/keys', async (req, res) => {
  const { label } = req.body;
  if (!label) return res.status(400).json({ error: 'label is required.' });

  const newKey = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, ''); // 64-char hex

  try {
    const [result] = await db.execute(
      'INSERT INTO api_keys (api_key, label) VALUES (?, ?)',
      [newKey, label]
    );

    return res.status(201).json({
      message:  'API key created. Store it safely — it will not be shown again.',
      id:       result.insertId,
      label,
      api_key:  newKey,
    });
  } catch (err) {
    console.error('POST /admin/keys error:', err);
    res.status(500).json({ error: 'Failed to create API key.' });
  }
});

// ── PATCH /admin/keys/:id/revoke  –  Revoke (deactivate) a key ───────────────

router.patch('/keys/:id/revoke', async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id.' });

  try {
    const [result] = await db.execute(
      'UPDATE api_keys SET is_active = 0 WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'API key not found.' });
    }

    return res.json({ message: `API key ${id} revoked.` });
  } catch (err) {
    console.error('PATCH /admin/keys/:id/revoke error:', err);
    res.status(500).json({ error: 'Failed to revoke API key.' });
  }
});

// ── PATCH /admin/keys/:id/activate  –  Re-activate a key ────────────────────

router.patch('/keys/:id/activate', async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id.' });

  try {
    const [result] = await db.execute(
      'UPDATE api_keys SET is_active = 1 WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'API key not found.' });
    }

    return res.json({ message: `API key ${id} activated.` });
  } catch (err) {
    console.error('PATCH /admin/keys/:id/activate error:', err);
    res.status(500).json({ error: 'Failed to activate API key.' });
  }
});

// ── DELETE /admin/keys/:id  –  Permanently delete a key ──────────────────────

router.delete('/keys/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id.' });

  try {
    const [result] = await db.execute(
      'DELETE FROM api_keys WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'API key not found.' });
    }

    return res.json({ message: `API key ${id} permanently deleted.` });
  } catch (err) {
    console.error('DELETE /admin/keys/:id error:', err);
    res.status(500).json({ error: 'Failed to delete API key.' });
  }
});

module.exports = router;
