const express    = require('express');
const router     = express.Router();
const db         = require('../db');
const requireApiKey = require('../middleware/auth');

// All interaction routes require a valid API key
router.use(requireApiKey);

// ── Helpers ───────────────────────────────────────────────────────────────────

function validationError(res, message) {
  return res.status(400).json({ error: message });
}

function parseDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// ── POST /interactions  –  Create a new interaction ──────────────────────────

router.post('/', async (req, res) => {
  const {
    user_id,
    interaction_type,
    company_name,
    contact_person,
    interaction_details,
    interaction_time,
  } = req.body;

  // Validate required fields
  if (!user_id)             return validationError(res, 'user_id is required.');
  if (!interaction_type)    return validationError(res, 'interaction_type is required.');
  if (!company_name)        return validationError(res, 'company_name is required.');
  if (!contact_person)      return validationError(res, 'contact_person is required.');
  if (!interaction_details) return validationError(res, 'interaction_details is required.');
  if (!interaction_time)    return validationError(res, 'interaction_time is required.');

  const dt = parseDateTime(interaction_time);
  if (!dt) return validationError(res, 'interaction_time must be a valid ISO-8601 date/time string.');

  try {
    const [result] = await db.execute(
      `INSERT INTO interactions
         (user_id, interaction_type, company_name, contact_person, interaction_details, interaction_time, api_key_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user_id, interaction_type, company_name, contact_person, interaction_details, dt, req.apiKey.id]
    );

    return res.status(201).json({
      message: 'Interaction created.',
      id:      result.insertId,
    });
  } catch (err) {
    console.error('POST /interactions error:', err);
    res.status(500).json({ error: 'Failed to create interaction.' });
  }
});

// ── GET /interactions  –  Retrieve interactions (with optional filters) ───────
//
//  Query params (all optional):
//    user_id           – exact match
//    company_name      – exact match
//    interaction_type  – exact match
//    contact_person    – exact match
//    from              – ISO-8601 start of date range
//    to                – ISO-8601 end   of date range
//    limit             – max rows (default 100, max 1000)
//    offset            – pagination offset (default 0)

router.get('/', async (req, res) => {
  const {
    user_id,
    company_name,
    interaction_type,
    contact_person,
    from,
    to,
    limit  = 100,
    offset = 0,
  } = req.query;

  const conditions = [];
  const params     = [];

  if (user_id) {
    conditions.push('user_id = ?');
    params.push(user_id);
  }
  if (company_name) {
    conditions.push('company_name = ?');
    params.push(company_name);
  }
  if (interaction_type) {
    conditions.push('interaction_type = ?');
    params.push(interaction_type);
  }
  if (contact_person) {
    conditions.push('contact_person = ?');
    params.push(contact_person);
  }
  if (from) {
    const dt = parseDateTime(from);
    if (!dt) return validationError(res, 'from must be a valid ISO-8601 date/time string.');
    conditions.push('interaction_time >= ?');
    params.push(dt);
  }
  if (to) {
    const dt = parseDateTime(to);
    if (!dt) return validationError(res, 'to must be a valid ISO-8601 date/time string.');
    conditions.push('interaction_time <= ?');
    params.push(dt);
  }

  const safeLimit  = Math.min(Math.max(parseInt(limit)  || 100, 1), 1000);
  const safeOffset = Math.max(parseInt(offset) || 0, 0);

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    // Total count for pagination metadata
    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total FROM interactions ${where}`,
      params
    );
    const total = countRows[0].total;

    // Actual data
    const [rows] = await db.execute(
      `SELECT
         id, user_id, interaction_type, company_name, contact_person,
         interaction_details, interaction_time, created_at, updated_at
       FROM interactions
       ${where}
       ORDER BY interaction_time DESC
       LIMIT ? OFFSET ?`,
      [...params, safeLimit, safeOffset]
    );

    return res.json({
      total,
      limit:  safeLimit,
      offset: safeOffset,
      data:   rows,
    });
  } catch (err) {
    console.error('GET /interactions error:', err);
    res.status(500).json({ error: 'Failed to retrieve interactions.' });
  }
});

// ── GET /interactions/:id  –  Retrieve a single interaction ──────────────────

router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return validationError(res, 'Invalid id.');

  try {
    const [rows] = await db.execute(
      `SELECT id, user_id, interaction_type, company_name, contact_person,
              interaction_details, interaction_time, created_at, updated_at
       FROM interactions WHERE id = ? LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Interaction not found.' });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error('GET /interactions/:id error:', err);
    res.status(500).json({ error: 'Failed to retrieve interaction.' });
  }
});

// ── PUT /interactions/:id  –  Update an interaction ──────────────────────────

router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return validationError(res, 'Invalid id.');

  const allowed = ['user_id','interaction_type','company_name','contact_person','interaction_details','interaction_time'];
  const updates = [];
  const params  = [];

  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      if (field === 'interaction_time') {
        const dt = parseDateTime(req.body[field]);
        if (!dt) return validationError(res, 'interaction_time must be a valid ISO-8601 date/time string.');
        updates.push(`${field} = ?`);
        params.push(dt);
      } else {
        updates.push(`${field} = ?`);
        params.push(req.body[field]);
      }
    }
  }

  if (updates.length === 0) {
    return validationError(res, 'No valid fields provided for update.');
  }

  params.push(id);

  try {
    const [result] = await db.execute(
      `UPDATE interactions SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Interaction not found.' });
    }

    return res.json({ message: 'Interaction updated.', id });
  } catch (err) {
    console.error('PUT /interactions/:id error:', err);
    res.status(500).json({ error: 'Failed to update interaction.' });
  }
});

// ── DELETE /interactions/:id  –  Delete an interaction ───────────────────────

router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return validationError(res, 'Invalid id.');

  try {
    const [result] = await db.execute(
      'DELETE FROM interactions WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Interaction not found.' });
    }

    return res.json({ message: 'Interaction deleted.', id });
  } catch (err) {
    console.error('DELETE /interactions/:id error:', err);
    res.status(500).json({ error: 'Failed to delete interaction.' });
  }
});

module.exports = router;
