/**
 * Cloudflare Email Routing Panel — Rebuild (Stable, CommonJS)
 * Stack: Node.js + Express 5 + Axios + dotenv
 *
 * ✅ Destinations: list/create/delete
 * ✅ Rules: list/create/update/delete, toggle enabled
 * ✅ Catch‑all: disabled/forward_to/drop
 * ✅ Safer HTML (no fragile template literals)
 * ✅ Health check: GET /health
 *
 * Quick start:
 *   npm i express axios dotenv
 *   node server.js
 *
 * .env
 *   PORT=3000
 *   CF_API_TOKEN=cf_...
 *   CF_ACCOUNT_ID=................................
 *   CF_ZONE_ID=................................
 */

const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

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

// ---------------- Helpers (CF API) ----------------
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
  // destinationInput can be an email (contains @) or a destination id
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

// ---------------- HTML Views (no template literals) ----------------
function layout(title, body) {
// Serve SPA and provide JSON API endpoints under /api
app.use(express.static(__dirname + '/public'));

// API: Destinations
app.get('/api/destinations', async (req, res) => {
  try {
    const d = await listDestinations();
    res.json(d);
  } catch (e) {
    res.status(500).json({ error: eToMessage(e) });
  }
});
app.post('/api/destinations', async (req, res) => {
  try {
    const email = (req.body.email || '').trim();
    if (!email) return res.status(400).json({ error: 'email required' });
    const r = await createDestination(email);
    res.json(r);
  } catch (e) { res.status(500).json({ error: eToMessage(e) }); }
});
app.delete('/api/destinations/:id', async (req, res) => {
  try { await deleteDestination(req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: eToMessage(e) }); }
});

// API: Rules
app.get('/api/rules', async (req, res) => {
  try { const r = await listRules(); res.json(r); } catch (e) { res.status(500).json({ error: eToMessage(e) }); }
});
app.post('/api/rules', async (req, res) => {
  try {
    const customEmail = (req.body.customEmail || '').trim();
    let destInput = (req.body.destinationIdManual || '').trim();
    if (!destInput) destInput = (req.body.destinationId || '').trim();
    if (!customEmail) return res.status(400).json({ error: 'customEmail required' });
    if (!destInput) return res.status(400).json({ error: 'destination required' });
    const r = await createRule(customEmail, destInput);
    res.json(r);
  } catch (e) { res.status(500).json({ error: eToMessage(e) }); }
});
app.put('/api/rules/:id', async (req, res) => {
  try {
    const customEmail = (req.body.customEmail || '').trim();
    const destinationId = (req.body.destinationId || '').trim();
    const enabledVal = String(req.body.enabled || '').toLowerCase();
    const enabled = enabledVal === 'true' ? true : enabledVal === 'false' ? false : undefined;
    const r = await updateRule(req.params.id, { customEmail, destinationId, enabled });
    res.json(r);
  } catch (e) { res.status(500).json({ error: eToMessage(e) }); }
});
app.delete('/api/rules/:id', async (req, res) => { try { await deleteRule(req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: eToMessage(e) }); } });

// Catch-all API
app.post('/api/catch-all', async (req, res) => {
  try {
    const action = (req.body.action || '').trim();
    const destinationId = (req.body.destinationId || '').trim();
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

// root serve index.html
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});
  + '  <p class="opacity-80 mb-4">Add / edit / delete custom routes and destinations. Destinations must be verified by email before rules go active.</p>'
  + body
    + '</div>'
    + '<script>'
    + '  (function(){'
    + '    const tg=document.getElementById("themeToggle");'
    + '    try{const saved=localStorage.getItem("theme"); if(saved) document.documentElement.setAttribute("data-theme", saved);}catch(e){}'
    + '    if(tg) tg.addEventListener("change", function(){ const cur=document.documentElement.getAttribute("data-theme"); const next = cur === "business" ? "light" : "business"; document.documentElement.setAttribute("data-theme", next); try{localStorage.setItem("theme", next);}catch(e){} });'
    + '    setTimeout(function(){ document.querySelectorAll(".toast .alert").forEach(function(el){ el.classList.add("hidden"); }); }, 3500);'
    + '    async function checkHealth(showToast){'
    + '      var btn = document.getElementById("healthBtn"); if(btn) btn.disabled = true;'
    + '      try{'
    + '        var r = await fetch("/health");'
    + '        var j = await r.json();'
    + '        var hr = document.getElementById("healthResult");'
    + '        if(hr) hr.innerHTML = "<div class=\"health-json\">" + JSON.stringify(j, null, 2) + "</div>";'
    + '        if(showToast) showSnackbar(j.ok ? "Health OK" : "Health ERROR", j.ok ? "#16a34a" : "#dc2626");'
    + '        var destEl = document.getElementById("live-destinations"); var rulesEl = document.getElementById("live-rules"); if(destEl) destEl.textContent = j.destinations; if(rulesEl) rulesEl.textContent = j.rules;'
    + '      }catch(e){ var hr = document.getElementById("healthResult"); if(hr) hr.textContent = String(e); showSnackbar("Health fetch failed", "#dc2626"); }'
    + '      finally{ if(btn) btn.disabled = false; }'
    + '    }'
    + '    function showSnackbar(text, bg){ bg = bg || "#111"; var s = document.createElement("div"); s.className = "snackbar"; s.style.background = bg; s.textContent = text; document.body.appendChild(s); setTimeout(function(){ s.style.opacity = 1; }, 10); setTimeout(function(){ s.style.transition = "opacity .35s"; s.style.opacity = 0; setTimeout(function(){ s.remove(); }, 400); }, 3000); }'
    + '    document.addEventListener("DOMContentLoaded", function(){ var hb = document.getElementById("healthBtn"); if(hb) hb.addEventListener("click", function(){ checkHealth(true); }); });'
    + '    window.checkHealth = checkHealth;'
    + '  })();'
    + '</script>'
    + '</body>'
    + '</html>';
}

function indexPage({ msg, err, destinations, rules }) {
  const verified = destinations.filter(d => d.verified);

  // rows: destinations
  const destRows = destinations.map(d => (
    '<tr>'
    + '<td>' + escapeHtml(d.email) + '</td>'
    + '<td><code class="kbd kbd-sm">' + escapeHtml(d.id) + '</code></td>'
    + '<td>' + (d.verified ? '<div class="badge badge-success">verified</div>' : '<div class="badge badge-warning">pending</div>') + '</td>'
    + '<td class="text-right">'
    + '<form class="inline" method="post" action="/destinations/' + encodeURIComponent(d.id) + '?_method=DELETE" onsubmit="return confirm(\'Delete destination ' + escapeAttr(d.email) + '?\')">'
    + '<button class="btn btn-error btn-sm" type="submit">Delete</button>'
    + '</form>'
    + '</td>'
    + '</tr>'
  )).join('');

  // rows: rules
  const ruleRows = rules.map(r => {
    const alias = (r.matchers && r.matchers[0] && r.matchers[0].value) || '';
    const dest = (r.actions && r.actions[0] && r.actions[0].value) || '';
    return (
      '<tr>'
      + '<td><code class="kbd kbd-sm">' + escapeHtml(r.id) + '</code></td>'
      + '<td>' + escapeHtml(alias) + '</td>'
      + '<td>' + (Array.isArray(dest) ? escapeHtml(dest.join(', ')) : escapeHtml(dest)) + '</td>'
      + '<td>' + (r.enabled ? '<span class="text-success">✔</span>' : '<span class="text-error">✖</span>') + '</td>'
      + '<td class="text-right">'
      + '<details class="collapse bg-base-200 inline-block w-full max-w-xl">'
      + '  <summary class="collapse-title text-sm font-medium cursor-pointer">Edit</summary>'
      + '  <div class="collapse-content">'
      + '    <form method="post" action="/rules/' + encodeURIComponent(r.id) + '?_method=PUT" class="grid md:grid-cols-2 gap-3">'
      + '      <label class="form-control"><span class="label-text">Custom address</span><input class="input input-bordered" name="customEmail" value="' + escapeAttr(alias) + '" required /></label>'
      + '      <label class="form-control"><span class="label-text">Destination ID / Email</span><input class="input input-bordered" name="destinationId" value="' + escapeAttr(Array.isArray(dest) ? dest[0] : String(dest)) + '" required /></label>'
      + '      <label class="form-control"><span class="label-text">Enabled</span>'
      + '        <select name="enabled" class="select select-bordered">'
      + '          <option value="true"' + (r.enabled ? ' selected' : '') + '>true</option>'
      + '          <option value="false"' + (!r.enabled ? ' selected' : '') + '>false</option>'
      + '        </select>'
      + '      </label>'
      + '      <div class="mt-2 flex gap-2">'
      + '        <button class="btn btn-primary btn-sm" type="submit">Update</button>'
      + '      </div>'
      + '    </form>'
      + '    <form class="mt-2" method="post" action="/rules/' + encodeURIComponent(r.id) + '?_method=DELETE" onsubmit="return confirm(\'Delete rule?\')">'
      + '      <button class="btn btn-error btn-sm" type="submit">Delete</button>'
      + '    </form>'
      + '  </div>'
      + '</details>'
      + '</td>'
      + '</tr>'
    );
  }).join('');

  // destination options (verified only)
  const destOptions = verified.map(d => '<option value="' + escapeAttr(d.id) + '">' + escapeHtml(d.email) + ' — ' + escapeHtml(d.id) + '</option>').join('');

  // toast banners
  const banner = (msg ? '<div class="toast toast-top toast-center"><div class="alert alert-success"><span>' + escapeHtml(msg) + '</span></div></div>' : '')
               + (err ? '<div class="toast toast-top toast-center"><div class="alert alert-error"><span><b>Error:</b> ' + escapeHtml(err) + '</span></div></div>' : '');

  const liveCard = '<div class="card bg-base-100 shadow mb-6"><div class="card-body">'
    + '<h2 class="card-title">Live status <span class="material-icons" style="font-size:1.1rem;vertical-align:middle;margin-left:.3rem">pulse</span></h2>'
    + '<div class="flex items-center gap-4">'
    + '<div><div class="text-sm opacity-70">Destinations</div><div id="live-destinations" class="material-badge">' + escapeHtml(String(destinations.length)) + '</div></div>'
    + '<div><div class="text-sm opacity-70">Rules</div><div id="live-rules" class="material-badge">' + escapeHtml(String(rules.length)) + '</div></div>'
    + '<div class="ml-auto"> <button id="healthBtn" class="btn btn-primary material-btn"><span class="material-icons">health_and_safety</span> Check health</button></div>'
    + '</div>'
    + '<div id="healthResult" class="mt-3"></div>'
    + '</div></div>';

  const body = banner + liveCard
    // Destinations card
    + '<div class="card bg-base-100 shadow mb-6"><div class="card-body">'
    + '<h2 class="card-title">Destinations</h2>'
    + '<form class="flex gap-2 items-center" method="post" action="/destinations">'
    + '  <input class="input input-bordered w-full max-w-xs" name="email" placeholder="dest@example.com" required />'
    + '  <button class="btn btn-primary" type="submit">Add destination</button>'
    + '</form>'
    + '<p class="opacity-70">Setelah menambah, cek inbox dan klik <em>Verify email address</em> dari Cloudflare. Hanya <b>verified</b> yang muncul di dropdown pembuatan rule.</p>'
    + '<div class="overflow-x-auto"><table class="table table-zebra"><thead><tr><th>Email</th><th>ID</th><th>Status</th><th></th></tr></thead><tbody>' + destRows + '</tbody></table></div>'
    + '</div></div>'

    // Create rule card
    + '<div class="card bg-base-100 shadow mb-6"><div class="card-body">'
    + '<h2 class="card-title">Create custom address (alias) → destination rule</h2>'
    + '<form method="post" action="/rules" class="grid md:grid-cols-2 gap-3">'
    + '  <label class="form-control"><span class="label-text">Custom address (alias di zone)</span><input class="input input-bordered w-full" name="customEmail" placeholder="sales@yourzone.tld" required /></label>'
    + '  <label class="form-control"><span class="label-text">Destination (verified)</span><select class="select select-bordered w-full" name="destinationId"' + (verified.length ? '' : ' disabled') + '>' + (destOptions || '<option>Belum ada verified destination</option>') + '</select></label>'
    + '  <label class="form-control md:col-span-2"><span class="label-text">atau Destination ID / Email (opsional)</span><input class="input input-bordered w-full" name="destinationIdManual" placeholder="dest-xxxxxxxx atau email@tujuan.com" /></label>'
    + '  <div class="md:col-span-2"><button class="btn btn-primary" type="submit">Create rule</button></div>'
    + '</form>'
    + '</div></div>'

    // Rules table
    + '<div class="card bg-base-100 shadow mb-6"><div class="card-body">'
    + '<h2 class="card-title">Rules</h2>'
    + '<div class="overflow-x-auto"><table class="table table-zebra"><thead><tr><th>ID</th><th>Custom address</th><th>Destination</th><th>Enabled</th><th class="text-right">Actions</th></tr></thead><tbody>' + ruleRows + '</tbody></table></div>'
    + '</div></div>'

    // Catch‑all card
    + '<div class="card bg-base-100 shadow"><div class="card-body">'
    + '<h2 class="card-title">Catch‑all</h2>'
    + '<form method="post" action="/catch-all" class="flex flex-wrap gap-2 items-end">'
    + '  <label class="form-control w-44"><span class="label-text">Action</span><select name="action" class="select select-bordered"><option value="disabled">disabled</option><option value="forward">forward to</option><option value="drop">drop</option></select></label>'
    + '  <label class="form-control grow min-w-[220px]"><span class="label-text">Destination email/ID (if forward)</span><input name="destinationId" class="input input-bordered" placeholder="dest-xxxxxxxx atau email@tujuan.com" /></label>'
    + '  <button class="btn btn-primary" type="submit">Save</button>'
    + '</form>'
    + '<p class="opacity-70">Catch‑all berlaku untuk alamat yang tidak match rule literal.</p>'
    + '</div></div>';

  return layout('Cloudflare Email Routing Panel', body);
}

// ---------------- Method override (?_method=PUT/DELETE) ----------------
app.use(function methodOverride(req, _res, next) {
  if (req.method === 'POST' && req.query && req.query._method) {
    req.method = String(req.query._method).toUpperCase();
  }
  next();
});

// ---------------- Routes ----------------
app.get('/', async (req, res) => {
  try {
    const [destinations, rules] = await Promise.all([listDestinations(), listRules()]);
    res.send(indexPage({ msg: req.query.msg || '', err: req.query.err || '', destinations, rules }));
  } catch (e) {
    res.status(500).send(layout('Error', '<pre>' + escapeHtml(eToMessage(e)) + '</pre>'));
  }
});

// Destinations
app.post('/destinations', async (req, res) => {
  try {
    const email = (req.body.email || '').trim();
    if (!email) throw new Error('email required');
    await createDestination(email);
    res.redirect('/?msg=' + encodeURIComponent('Destination created. Verify from inbox: ' + email));
  } catch (e) {
    res.redirect('/?err=' + encodeURIComponent(eToMessage(e)));
  }
});

app.delete('/destinations/:id', async (req, res) => {
  try {
    await deleteDestination(req.params.id);
    res.redirect('/?msg=' + encodeURIComponent('Destination deleted.'));
  } catch (e) {
    res.redirect('/?err=' + encodeURIComponent(eToMessage(e)));
  }
});

// Rules
app.post('/rules', async (req, res) => {
  try {
    const customEmail = (req.body.customEmail || '').trim();
    let destInput = (req.body.destinationIdManual || '').trim();
    if (!destInput) destInput = (req.body.destinationId || '').trim();
    if (!customEmail) throw new Error('customEmail required');
    if (!destInput) throw new Error('destination (email or id) required');
    await createRule(customEmail, destInput);
    res.redirect('/?msg=' + encodeURIComponent('Rule created for ' + customEmail));
  } catch (e) {
    res.redirect('/?err=' + encodeURIComponent(eToMessage(e)));
  }
});

app.put('/rules/:id', async (req, res) => {
  try {
    const customEmail = (req.body.customEmail || '').trim();
    const destinationId = (req.body.destinationId || '').trim();
    const enabledVal = String(req.body.enabled || '').toLowerCase();
    const enabled = enabledVal === 'true' ? true : enabledVal === 'false' ? false : undefined;
    await updateRule(req.params.id, { customEmail, destinationId, enabled });
    res.redirect('/?msg=' + encodeURIComponent('Rule updated'));
  } catch (e) {
    res.redirect('/?err=' + encodeURIComponent(eToMessage(e)));
  }
});

app.delete('/rules/:id', async (req, res) => {
  try {
    await deleteRule(req.params.id);
    res.redirect('/?msg=' + encodeURIComponent('Rule deleted'));
  } catch (e) {
    res.redirect('/?err=' + encodeURIComponent(eToMessage(e)));
  }
});

// Catch‑all
app.post('/catch-all', async (req, res) => {
  try {
    const action = (req.body.action || '').trim();
    const destinationId = (req.body.destinationId || '').trim();

    let body;
    if (action === 'disabled') {
      body = { enabled: false };
    } else if (action === 'drop') {
      body = { enabled: true, action: { type: 'drop' } };
    } else if (action === 'forward_to' || action === 'forward') {
      if (!destinationId) throw new Error('destinationId/email required for forward');
      const value = await resolveDestinationArray(destinationId);
      body = { enabled: true, action: { type: 'forward', value } };
    } else {
      throw new Error('unknown action');
    }

    const resp = await cf.put(`/zones/${CF_ZONE_ID}/email/routing/rules/catch_all`, body);
    if (!resp.data || !resp.data.success) throw new Error(JSON.stringify(resp.data && (resp.data.errors || resp.data)));
    res.redirect('/?msg=' + encodeURIComponent('Catch‑all updated'));
  } catch (e) {
    res.redirect('/?err=' + encodeURIComponent(eToMessage(e)));
  }
});

// Health check
app.get('/health', async (_req, res) => {
  try {
    const [d, r] = await Promise.all([listDestinations(), listRules()]);
    res.json({ ok: true, destinations: d.length, rules: r.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: eToMessage(e) });
  }
});

app.listen(PORT, () => {
  console.log(`Email Routing Panel listening on http://localhost:${PORT}`);
});

// ---------------- Utils ----------------
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
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (s) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s];
  });
}
function escapeAttr(str) {
  return String(str).replace(/[&<>"']/g, function (s) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s];
  });
}
async function resolveDestinationArray(input) {
  // Accept email or destination id, return array of emails as required by API
  if (!input) throw new Error('destination required');
  if (/@/.test(input)) return [String(input).trim().toLowerCase()];
  // try fetch the destination by id
  const r = await cf.get(`/accounts/${CF_ACCOUNT_ID}/email/routing/addresses/${input}`);
  if (!r.data || !r.data.result || !r.data.result.email) throw new Error('destination not found: ' + input);
  if (r.data.result.verified === false) throw new Error('destination not verified: ' + r.data.result.email);
  return [String(r.data.result.email).trim().toLowerCase()];
}
