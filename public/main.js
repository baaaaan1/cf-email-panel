// main.js - front-end interactions for Cloudflare Email Panel SPA
async function api(path, opts) {
  const res = await fetch(path, Object.assign({headers:{'Content-Type':'application/json'}}, opts));
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || res.statusText);
  }
  return res.json();
}

async function refreshAll() {
  try {
    const h = await api('/health');
    document.getElementById('live-destinations').textContent = h.destinations;
    document.getElementById('live-rules').textContent = h.rules;
    document.getElementById('healthResult').textContent = JSON.stringify(h, null, 2);

    const dests = await api('/api/destinations');
    renderDestinations(dests);
    const rules = await api('/api/rules');
    renderRules(rules);
  } catch (e) {
    M.toast({html: 'Refresh failed: ' + e.message, classes: 'red darken-1'});
  }
}

function renderDestinations(dests) {
  const tb = document.getElementById('dest-table'); tb.innerHTML='';
  dests.forEach(d => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(d.email)}</td><td><code>${escapeHtml(d.id)}</code></td><td>${d.verified?'<span class="green-text">verified</span>':'<span class="orange-text">pending</span>'}</td><td><a class="waves-effect waves-light btn red" data-id="${escapeHtml(d.id)}">Delete</a></td>`;
    tb.appendChild(tr);
  });
  tb.querySelectorAll('a[data-id]').forEach(btn => btn.addEventListener('click', async (ev)=>{
    const id = ev.currentTarget.getAttribute('data-id');
    if (!confirm('Delete destination?')) return;
    try { await api('/api/destinations/'+encodeURIComponent(id), {method:'DELETE'}); M.toast({html:'Deleted', classes:'green'}); refreshAll(); } catch(e){ M.toast({html:'Delete failed: '+e.message, classes:'red'}); }
  }));
}

function renderRules(rules) {
  const tb = document.getElementById('rules-table'); tb.innerHTML='';
  rules.forEach(r => {
    const alias = (r.matchers && r.matchers[0] && r.matchers[0].value) || '';
    const dest = (r.actions && r.actions[0] && r.actions[0].value) || '';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><code>${escapeHtml(r.id)}</code></td><td>${escapeHtml(alias)}</td><td>${Array.isArray(dest)?escapeHtml(dest.join(', ')):escapeHtml(dest)}</td><td>${r.enabled?'<i class="material-icons green-text">check_circle</i>':'<i class="material-icons red-text">cancel</i>'}</td><td><a class="waves-effect waves-light btn red" data-id="${escapeHtml(r.id)}">Delete</a></td>`;
    tb.appendChild(tr);
  });
  tb.querySelectorAll('a[data-id]').forEach(btn => btn.addEventListener('click', async (ev)=>{
    const id = ev.currentTarget.getAttribute('data-id');
    if (!confirm('Delete rule?')) return;
    try { await api('/api/rules/'+encodeURIComponent(id), {method:'DELETE'}); M.toast({html:'Rule deleted', classes:'green'}); refreshAll(); } catch(e){ M.toast({html:'Delete failed: '+e.message, classes:'red'}); }
  }));
}

function escapeHtml(s){ return String(s||'').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c]); }

document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('btn-health').addEventListener('click', ()=>refreshAll());
  document.getElementById('btn-refresh').addEventListener('click', ()=>refreshAll());
  document.getElementById('add-dest').addEventListener('click', async ()=>{
    const email = document.getElementById('dest-email').value.trim(); if(!email){ M.toast({html:'Email required', classes:'orange'}); return; }
    try{ await api('/api/destinations', {method:'POST', body: JSON.stringify({email})}); M.toast({html:'Destination created', classes:'green'}); document.getElementById('dest-email').value=''; refreshAll(); }catch(e){ M.toast({html:'Create failed: '+e.message, classes:'red'}); }
  });
  refreshAll();
});
