require('dotenv').config();

const express      = require('express');
const rateLimit    = require('express-rate-limit');

const interactionsRouter = require('./routes/interactions');
const adminRouter        = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());

// ── Rate limiting  ────────────────────────────────────────────────────────────
//  Protects against brute-force / abuse.
//  Adjust window / max to suit your traffic.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max:      200,              // max requests per IP per window
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests. Please slow down.' },
});
app.use(limiter);

// ── Health check (no auth required) ──────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/interactions', interactionsRouter);
app.use('/admin',        adminRouter);

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'An unexpected error occurred.' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀  Interactions API running on port ${PORT}`);
});
