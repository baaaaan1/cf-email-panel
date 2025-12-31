/**
 * Cloudflare Email Routing Panel — API server (Express + Axios)
 * Serves static UI from /public and exposes JSON endpoints under /api
 */

const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(express.json());
// Minimal request logger to help diagnose routing issues
app.use((req, _res, next) => { try { console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`); } catch {} finally { next(); } });

const PORT = process.env.PORT || 3000;

if (!process.env.CF_API_TOKEN || !process.env.CF_ACCOUNT_ID || !process.env.CF_ZONE_ID) {
  console.warn('[WARN] Missing .env: CF_API_TOKEN, CF_ACCOUNT_ID, CF_ZONE_ID. Please configure via Settings.');
}
if (!process.env.CF_D1_DATABASE_ID) {
  console.warn('[WARN] Missing .env: CF_D1_DATABASE_ID. Inbox features will be disabled.');
}

const cf = axios.create({
  baseURL: 'https://api.cloudflare.com/client/v4',
  headers: { Authorization: `Bearer ${process.env.CF_API_TOKEN || ''}` }
});

function updateCfToken() {
  cf.defaults.headers['Authorization'] = `Bearer ${process.env.CF_API_TOKEN || ''}`;
}

// ------------- CF helpers -------------
async function listDestinations() {
  const res = await cf.get(`/accounts/${process.env.CF_ACCOUNT_ID}/email/routing/addresses`, { params: { per_page: 100 } });
  return res.data.result || [];
}
async function createDestination(email) {
  const res = await cf.post(`/accounts/${process.env.CF_ACCOUNT_ID}/email/routing/addresses`, { email });
  return res.data.result;
}
async function deleteDestination(id) {
  const res = await cf.delete(`/accounts/${process.env.CF_ACCOUNT_ID}/email/routing/addresses/${id}`);
  return res.data.result;
}
async function listRules() {
  const res = await cf.get(`/zones/${process.env.CF_ZONE_ID}/email/routing/rules`, { params: { per_page: 100 } });
  return res.data.result || [];
}
async function getRule(ruleId) {
  const res = await cf.get(`/zones/${process.env.CF_ZONE_ID}/email/routing/rules/${ruleId}`);
  return res.data.result;
}
async function createRule(customEmail, destinationInput, type = 'forward') {
  let actions;
  if (type === 'worker') {
    actions = [{ type: 'worker', value: [destinationInput] }];
  } else if (type === 'drop') {
    actions = [{ type: 'drop' }];
  } else {
    const value = await resolveDestinationArray(destinationInput);
    actions = [{ type: 'forward', value }];
  }
  const body = {
    name: `route:${customEmail}`,
    enabled: true,
    matchers: [{ type: 'literal', field: 'to', value: customEmail }],
    actions
  };
  const res = await cf.post(`/zones/${process.env.CF_ZONE_ID}/email/routing/rules`, body);
  return res.data.result;
}
async function updateRule(ruleId, { customEmail, destinationId, enabled, type }) {
  const current = await getRule(ruleId);
  let actions = current.actions;
  
  // Handle type/destination updates
  const targetType = type || (actions[0] && actions[0].type) || 'forward';
  if (type || destinationId) {
    if (targetType === 'drop') {
      actions = [{ type: 'drop' }];
    } else if (targetType === 'worker') {
      const val = destinationId || (actions[0] && actions[0].value && actions[0].value[0]);
      if (val) actions = [{ type: 'worker', value: [val] }];
    } else {
      // forward
      const val = destinationId || (actions[0] && actions[0].value && actions[0].value[0]);
      if (val && destinationId) { // Only resolve if explicitly updating destination
        const value = await resolveDestinationArray(destinationId);
        actions = [{ type: 'forward', value }];
      }
    }
  }
  const body = {
    name: current.name || (customEmail ? `route:${customEmail}` : undefined),
    enabled: typeof enabled === 'boolean' ? enabled : !!current.enabled,
    matchers: customEmail ? [{ type: 'literal', field: 'to', value: customEmail }] : current.matchers,
    actions
  };
  const res = await cf.put(`/zones/${process.env.CF_ZONE_ID}/email/routing/rules/${ruleId}`, body);
  return res.data.result;
}
async function deleteRule(ruleId) {
  const res = await cf.delete(`/zones/${process.env.CF_ZONE_ID}/email/routing/rules/${ruleId}`);
  return res.data.result;
}

async function resolveDestinationArray(input) {
  if (!input) throw new Error('destination required');
  if (/@/.test(input)) return [String(input).trim().toLowerCase()];
  const r = await cf.get(`/accounts/${process.env.CF_ACCOUNT_ID}/email/routing/addresses/${input}`);
  if (!r.data || !r.data.result || !r.data.result.email) throw new Error('destination not found: ' + input);
  if (r.data.result.verified === false) throw new Error('destination not verified: ' + r.data.result.email);
  return [String(r.data.result.email).trim().toLowerCase()];
}

async function queryD1(sql, params = []) {
  if (!process.env.CF_D1_DATABASE_ID) throw new Error('D1 Database ID not configured');
  if (process.env.CF_D1_DATABASE_ID.includes('REPLACE')) throw new Error('D1 Database ID is invalid (placeholder detected)');
  const res = await cf.post(`/accounts/${process.env.CF_ACCOUNT_ID}/d1/database/${process.env.CF_D1_DATABASE_ID}/query`, {
    sql,
    params
  });
  return (res.data.result && res.data.result[0] && res.data.result[0].results) || [];
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
    const type = String(req.body.type || 'forward').trim();
    
    if (!customEmail) return res.status(400).json({ error: 'customEmail required' });
    if (type !== 'drop' && !destInput) return res.status(400).json({ error: 'destination required' });
    
    res.json(await createRule(customEmail, destInput, type));
  } catch (e) { res.status(500).json({ error: eToMessage(e) }); }
});
app.put('/api/rules/:id', async (req, res) => {
  try {
    const customEmail = String(req.body.customEmail || '').trim();
    const destinationId = String(req.body.destinationId || '').trim();
    const type = req.body.type ? String(req.body.type).trim() : undefined;
    const enabledVal = String(req.body.enabled ?? '').toLowerCase();
    const enabled = enabledVal === 'true' ? true : enabledVal === 'false' ? false : undefined;
    res.json(await updateRule(req.params.id, { customEmail, destinationId, enabled, type }));
  } catch (e) { res.status(500).json({ error: eToMessage(e) }); }
});
app.delete('/api/rules/:id', async (req, res) => {
  try { await deleteRule(req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: eToMessage(e) }); }
});

// Inbox
app.get('/api/inbox', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const sql = `SELECT id, sender, recipient, subject, created_at FROM emails ORDER BY id DESC LIMIT ? OFFSET ?`;
    res.json(await queryD1(sql, [limit, offset]));
  } catch (e) { res.status(500).json({ error: eToMessage(e) }); }
});
app.get('/api/inbox/:id', async (req, res) => {
  try {
    const sql = `SELECT * FROM emails WHERE id = ?`;
    const rows = await queryD1(sql, [req.params.id]);
    if (!rows || !rows.length) return res.status(404).json({ error: 'Message not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: eToMessage(e) }); }
});
app.delete('/api/inbox/:id', async (req, res) => {
  try { await queryD1(`DELETE FROM emails WHERE id = ?`, [req.params.id]); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: eToMessage(e) }); }
});

// Init DB
app.post('/api/inbox/init', async (_req, res) => {
  try {
    const schemaPath = path.join(__dirname, 'worker', 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await queryD1(sql);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: eToMessage(e) }); }
});

// Configuration
app.get('/api/config', (_req, res) => {
  res.json({
    account_id: process.env.CF_ACCOUNT_ID || '',
    zone_id: process.env.CF_ZONE_ID || '',
    d1_database_id: process.env.CF_D1_DATABASE_ID || '',
    has_token: !!process.env.CF_API_TOKEN
  });
});

app.post('/api/config', (req, res) => {
  const { account_id, zone_id, api_token, d1_database_id } = req.body;
  
  if (account_id !== undefined) process.env.CF_ACCOUNT_ID = account_id;
  if (zone_id !== undefined) process.env.CF_ZONE_ID = zone_id;
  if (d1_database_id !== undefined) process.env.CF_D1_DATABASE_ID = d1_database_id;
  if (api_token) process.env.CF_API_TOKEN = api_token;

  try {
    const envPath = path.join(__dirname, '.env');
    let content = '';
    if (fs.existsSync(envPath)) content = fs.readFileSync(envPath, 'utf8');
    
    const updateKey = (key, val) => {
      const regex = new RegExp(`^${key}=.*`, 'm');
      if (regex.test(content)) content = content.replace(regex, `${key}=${val}`);
      else content += `\n${key}=${val}`;
    };

    if (account_id !== undefined) updateKey('CF_ACCOUNT_ID', account_id);
    if (zone_id !== undefined) updateKey('CF_ZONE_ID', zone_id);
    if (d1_database_id !== undefined) updateKey('CF_D1_DATABASE_ID', d1_database_id);
    if (api_token) updateKey('CF_API_TOKEN', api_token);

    fs.writeFileSync(envPath, content.trim() + '\n');
    updateCfToken();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
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
    const resp = await cf.put(`/zones/${process.env.CF_ZONE_ID}/email/routing/rules/catch_all`, body);
    if (!resp.data || !resp.data.success) throw new Error(JSON.stringify(resp.data && (resp.data.errors || resp.data)));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: eToMessage(e) }); }
});

// Health
app.get('/health', async (_req, res) => {
  try {
    const [d, r] = await Promise.all([listDestinations(), listRules()]);
    res.json({ ok: true, destinations: d.length, rules: r.length });
  }
  catch (e) { res.status(500).json({ ok: false, error: eToMessage(e) }); }
});

// ------------- Static files -------------
app.use(express.static(path.join(__dirname, 'public')));

// Root -> SPA fallback (exclude API/health). Use RegExp to avoid path-to-regexp quirks
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get(/^(?!\/api)(?!\/health).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Email Routing Panel listening on http://localhost:${PORT}`);
});
