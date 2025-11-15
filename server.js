/**
 * Cloudflare Email Routing Panel — API server (Express + Axios)
 * Serves static UI from /public and exposes JSON endpoints under /api
 */

const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
// Minimal request logger to help diagnose routing issues
app.use((req, _res, next) => { try { console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`); } catch {} finally { next(); } });

const PORT = process.env.PORT || 3000;
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_ZONE_ID = process.env.CF_ZONE_ID;

if (!CF_API_TOKEN || !CF_ACCOUNT_ID || !CF_ZONE_ID) {
  console.error('[FATAL] Missing .env: CF_API_TOKEN, CF_ACCOUNT_ID, CF_ZONE_ID');
  process.exit(1);
}

const cf = axios.create({
  baseURL: 'https://api.cloudflare.com/client/v4',
  headers: { Authorization: `Bearer ${CF_API_TOKEN}` }
});

// ------------- CF helpers -------------
async function listDestinations() {
  const res = await cf.get(`/accounts/${CF_ACCOUNT_ID}/email/routing/addresses`, { params: { per_page: 100 } });
  return res.data.result || [];
}
async function createDestination(email) {
  const res = await cf.post(`/accounts/${CF_ACCOUNT_ID}/email/routing/addresses`, { email });
  return res.data.result;
}
async function deleteDestination(id) {
  const res = await cf.delete(`/accounts/${CF_ACCOUNT_ID}/email/routing/addresses/${id}`);
  return res.data.result;
}
async function listRules() {
  const res = await cf.get(`/zones/${CF_ZONE_ID}/email/routing/rules`, { params: { per_page: 100 } });
  return res.data.result || [];
}
async function getRule(ruleId) {
  const res = await cf.get(`/zones/${CF_ZONE_ID}/email/routing/rules/${ruleId}`);
  return res.data.result;
}
async function createRule(customEmail, destinationInput) {
  const value = await resolveDestinationArray(destinationInput);
  const body = {
    name: `route:${customEmail}`,
    enabled: true,
    matchers: [{ type: 'literal', field: 'to', value: customEmail }],
    actions: [{ type: 'forward', value }]
  };
  const res = await cf.post(`/zones/${CF_ZONE_ID}/email/routing/rules`, body);
  return res.data.result;
}
async function updateRule(ruleId, { customEmail, destinationId, enabled }) {
  const current = await getRule(ruleId);
  let actions = current.actions;
  if (destinationId) {
    const value = await resolveDestinationArray(destinationId);
    actions = [{ type: 'forward', value }];
  }
  const body = {
    name: current.name || (customEmail ? `route:${customEmail}` : undefined),
    enabled: typeof enabled === 'boolean' ? enabled : !!current.enabled,
    matchers: customEmail ? [{ type: 'literal', field: 'to', value: customEmail }] : current.matchers,
    actions
  };
  const res = await cf.put(`/zones/${CF_ZONE_ID}/email/routing/rules/${ruleId}`, body);
  return res.data.result;
}
async function deleteRule(ruleId) {
  const res = await cf.delete(`/zones/${CF_ZONE_ID}/email/routing/rules/${ruleId}`);
  return res.data.result;
}

async function resolveDestinationArray(input) {
  if (!input) throw new Error('destination required');
  if (/@/.test(input)) return [String(input).trim().toLowerCase()];
  const r = await cf.get(`/accounts/${CF_ACCOUNT_ID}/email/routing/addresses/${input}`);
  if (!r.data || !r.data.result || !r.data.result.email) throw new Error('destination not found: ' + input);
  if (r.data.result.verified === false) throw new Error('destination not verified: ' + r.data.result.email);
  return [String(r.data.result.email).trim().toLowerCase()];
}

function eToMessage(e) {
  if (e && e.response && e.response.data) {
    try {
      const d = e.response.data;
      if (d.errors && d.errors.length) return JSON.stringify(d.errors, null, 2);
      return JSON.stringify(d, null, 2);
    } catch {}
  }
  return String((e && (e.message || e)) || e);
}

// ------------- Static files -------------
app.use(express.static(path.join(__dirname, 'public')));

// ------------- JSON APIs -------------
// Destinations
app.get('/api/destinations', async (_req, res) => {
  try { res.json(await listDestinations()); } catch (e) { res.status(500).json({ error: eToMessage(e) }); }
});
app.post('/api/destinations', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim();
    if (!email) return res.status(400).json({ error: 'email required' });
    res.json(await createDestination(email));
  } catch (e) { res.status(500).json({ error: eToMessage(e) }); }
});
app.delete('/api/destinations/:id', async (req, res) => {
  try { await deleteDestination(req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: eToMessage(e) }); }
});

// Rules
app.get('/api/rules', async (_req, res) => {
  try { res.json(await listRules()); } catch (e) { res.status(500).json({ error: eToMessage(e) }); }
});
app.post('/api/rules', async (req, res) => {
  try {
    const customEmail = String(req.body.customEmail || '').trim();
    let destInput = String(req.body.destinationIdManual || '').trim();
    if (!destInput) destInput = String(req.body.destinationId || '').trim();
    if (!customEmail) return res.status(400).json({ error: 'customEmail required' });
    if (!destInput) return res.status(400).json({ error: 'destination required' });
    res.json(await createRule(customEmail, destInput));
  } catch (e) { res.status(500).json({ error: eToMessage(e) }); }
});
app.put('/api/rules/:id', async (req, res) => {
  try {
    const customEmail = String(req.body.customEmail || '').trim();
    const destinationId = String(req.body.destinationId || '').trim();
    const enabledVal = String(req.body.enabled ?? '').toLowerCase();
    const enabled = enabledVal === 'true' ? true : enabledVal === 'false' ? false : undefined;
    res.json(await updateRule(req.params.id, { customEmail, destinationId, enabled }));
  } catch (e) { res.status(500).json({ error: eToMessage(e) }); }
});
app.delete('/api/rules/:id', async (req, res) => {
  try { await deleteRule(req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: eToMessage(e) }); }
});

// Catch‑all
app.post('/api/catch-all', async (req, res) => {
  try {
    const action = String(req.body.action || '').trim();
    const destinationId = String(req.body.destinationId || '').trim();
    let body;
    if (action === 'disabled') body = { enabled: false };
    else if (action === 'drop') body = { enabled: true, action: { type: 'drop' } };
    else if (action === 'forward' || action === 'forward_to') {
      if (!destinationId) return res.status(400).json({ error: 'destination required for forward' });
      const value = await resolveDestinationArray(destinationId);
      body = { enabled: true, action: { type: 'forward', value } };
    } else return res.status(400).json({ error: 'unknown action' });
    const resp = await cf.put(`/zones/${CF_ZONE_ID}/email/routing/rules/catch_all`, body);
    if (!resp.data || !resp.data.success) throw new Error(JSON.stringify(resp.data && (resp.data.errors || resp.data)));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: eToMessage(e) }); }
});

// Health
app.get('/health', async (_req, res) => {
  try { const [d, r] = await Promise.all([listDestinations(), listRules()]); res.json({ ok: true, destinations: d.length, rules: r.length }); }
  catch (e) { res.status(500).json({ ok: false, error: eToMessage(e) }); }
});

// Root -> SPA fallback (exclude API/health). Use RegExp to avoid path-to-regexp quirks
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get(/^(?!\/api)(?!\/health).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Email Routing Panel listening on http://localhost:${PORT}`);
});
