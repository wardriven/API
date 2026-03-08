const db = require('../db');

/**
 * Middleware – validates the X-API-Key header against the api_keys table.
 * Attaches the matching row to req.apiKey so downstream handlers can use it.
 */
async function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];

  if (!key) {
    return res.status(401).json({
      error: 'Missing API key. Supply it via the X-API-Key header.',
    });
  }

  try {
    const [rows] = await db.execute(
      'SELECT id, label, is_active FROM api_keys WHERE api_key = ? LIMIT 1',
      [key]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid API key.' });
    }

    const record = rows[0];

    if (!record.is_active) {
      return res.status(403).json({ error: 'API key has been revoked.' });
    }

    // Update last_used timestamp (non-blocking – fire and forget)
    db.execute('UPDATE api_keys SET last_used = NOW() WHERE id = ?', [record.id])
      .catch(() => {}); // swallow – not critical

    req.apiKey = record;   // { id, label, is_active }
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Internal server error during authentication.' });
  }
}

module.exports = requireApiKey;
