// main.js - Modern UI interactions for Cloudflare Email Panel
// Default configuration
const defaultConfig = {
  panel_title: 'Cloudflare Email Panel',
  welcome_message: 'Manage your email routing settings'
};

// Simple fetch helper
async function api(path, opts) {
  const res = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts));
  if (!res.ok) throw new Error((await res.text()) || res.statusText);
  return res.json();
}

// Theme management
function toggleTheme() {
  const body = document.body;
  const themeIcon = document.getElementById('theme-icon');
  const themeText = document.getElementById('theme-text');
  body.classList.toggle('dark-mode');
  const isDark = body.classList.contains('dark-mode');
  themeIcon.textContent = isDark ? 'light_mode' : 'dark_mode';
  themeText.textContent = isDark ? 'Light Mode' : 'Dark Mode';
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function loadTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    document.getElementById('theme-icon').textContent = 'light_mode';
    document.getElementById('theme-text').textContent = 'Light Mode';
  }
}

// Rule management state
let editingRuleElement = null;
let editingRuleId = null;

function showAddRuleDialog() {
  editingRuleElement = null;
  editingRuleId = null;
  document.getElementById('modalTitle').textContent = 'Add New Rule';
  document.getElementById('saveBtn').innerHTML = '<span class="material-icons">save</span> Save Rule';
  clearRuleForm();
  document.getElementById('ruleModal').classList.add('active');
}

function populateEditRule(ruleElement) {
  editingRuleElement = ruleElement;
  editingRuleId = ruleElement.getAttribute('data-id');
  const type = ruleElement.getAttribute('data-type') || 'forward';
  const dest = ruleElement.getAttribute('data-value') || '';
  const fromEmail = ruleElement.querySelector('.rule-from').textContent.trim();
  
  document.getElementById('modalTitle').textContent = 'Edit Rule';
  document.getElementById('saveBtn').innerHTML = '<span class="material-icons">save</span> Update Rule';
  document.getElementById('fromEmail').value = fromEmail;
  document.getElementById('toEmail').value = dest;
  document.getElementById('ruleType').value = type;
  document.getElementById('ruleType').dispatchEvent(new Event('change')); // Trigger UI update
  document.getElementById('ruleModal').classList.add('active');
}

function closeRuleModal() {
  document.getElementById('ruleModal').classList.remove('active');
  editingRuleElement = null;
  editingRuleId = null;
}

function clearRuleForm() {
  document.getElementById('ruleForm').reset();
  document.getElementById('priority').value = '5';
  document.getElementById('ruleType').dispatchEvent(new Event('change'));
}

async function saveRule(event) {
  event.preventDefault();
  const fromEmail = document.getElementById('fromEmail').value.trim();
  const toEmail = document.getElementById('toEmail').value.trim();
  const ruleType = document.getElementById('ruleType').value;
  try {
    if (editingRuleId) {
      await api('/api/rules/' + encodeURIComponent(editingRuleId), { method: 'PUT', body: JSON.stringify({ customEmail: fromEmail, destinationId: toEmail, type: ruleType }) });
      showNotification('Rule updated successfully!', 'success');
    } else {
      await api('/api/rules', { method: 'POST', body: JSON.stringify({ customEmail: fromEmail, destinationIdManual: toEmail, type: ruleType }) });
      showNotification('Rule created successfully!', 'success');
    }
    closeRuleModal();
    await loadRules();
  } catch (e) { showNotification('Save failed: ' + e.message, 'error'); }
}

function createRuleElement(rule) {
  const alias = (rule.matchers && rule.matchers[0] && rule.matchers[0].value) || '';
  const action = rule.actions && rule.actions[0] || {};
  const type = action.type || 'forward';
  const val = Array.isArray(action.value) ? action.value[0] : (action.value || '');
  
  let toDisplay = '';
  if (type === 'drop') toDisplay = 'Drop (Delete)';
  else if (type === 'worker') toDisplay = `Worker: ${val}`;
  else toDisplay = `→ ${val}`;

  const isActive = !!rule.enabled;
  const div = document.createElement('div');
  div.className = 'email-rule';
  div.setAttribute('data-id', rule.id);
  div.setAttribute('data-type', type);
  div.setAttribute('data-value', val);
  div.innerHTML = `
    <div class="rule-info">
      <div class="rule-from">${alias}</div>
      <div class="rule-to">${toDisplay}</div>
    </div>
    <div class="rule-actions">
      <div class="rule-status ${isActive ? 'active' : 'inactive'}">${isActive ? 'Active' : 'Inactive'}</div>
      <button class="rule-action-btn" data-action="copy" title="Copy Email">
        <span class="material-icons">content_copy</span>
      </button>
      <button class="rule-action-btn" data-action="toggle" title="Toggle Status">
        <span class="material-icons">${isActive ? 'power_settings_new' : 'power_off'}</span>
      </button>
      <button class="rule-action-btn" data-action="edit" title="Edit Rule">
        <span class="material-icons">edit_note</span>
      </button>
      <button class="rule-action-btn" data-action="delete" title="Delete Rule">
        <span class="material-icons">delete_outline</span>
      </button>
    </div>`;
  return div;
}

async function loadRules() {
  try {
    const rules = await api('/api/rules');
    const container = document.getElementById('rules-container');
    container.innerHTML = '';
    rules.forEach(r => container.appendChild(createRuleElement(r)));
    updateStatsFromRules(rules);
  } catch (e) { showNotification('Load rules failed: ' + e.message, 'error'); }
}

function updateStatsFromRules(rules) {
  const total = rules.length;
  const active = rules.filter(r => r.enabled).length;
  document.getElementById('stat-total-rules').textContent = total;
  document.getElementById('stat-active-rules').textContent = active;
}

async function handleToggle(ruleElement, button) {
  const id = ruleElement.getAttribute('data-id');
  const statusElement = ruleElement.querySelector('.rule-status');
  const iconElement = button.querySelector('.material-icons');
  const willEnable = statusElement.classList.contains('inactive');
  try {
    await api('/api/rules/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify({ enabled: willEnable }) });
    statusElement.classList.toggle('active', willEnable);
    statusElement.classList.toggle('inactive', !willEnable);
    statusElement.textContent = willEnable ? 'Active' : 'Inactive';
    iconElement.textContent = willEnable ? 'power_settings_new' : 'power_off';
    const rules = Array.from(document.querySelectorAll('.email-rule')).map(el => ({ enabled: el.querySelector('.rule-status').classList.contains('active') }));
    updateStatsFromRules(rules);
    showNotification(willEnable ? 'Rule activated' : 'Rule deactivated', 'success');
  } catch (e) { showNotification('Toggle failed: ' + e.message, 'error'); }
}

async function handleDelete(ruleElement, button) {
  const id = ruleElement.getAttribute('data-id');
  const original = button.innerHTML;
  button.innerHTML = '<span class="material-icons">hourglass_empty</span>';
  button.disabled = true;
  try {
    await api('/api/rules/' + encodeURIComponent(id), { method: 'DELETE' });
    ruleElement.remove();
    const rules = Array.from(document.querySelectorAll('.email-rule')).map(el => ({ enabled: el.querySelector('.rule-status').classList.contains('active') }));
    updateStatsFromRules(rules);
    showNotification('Rule deleted', 'success');
  } catch (e) {
    showNotification('Delete failed: ' + e.message, 'error');
    button.innerHTML = original;
    button.disabled = false;
  }
}

async function handleCopy(ruleElement) {
  const email = ruleElement.querySelector('.rule-from').textContent.trim();
  try {
    await navigator.clipboard.writeText(email);
    showNotification('Email copied to clipboard', 'success');
  } catch (e) {
    showNotification('Failed to copy: ' + e.message, 'error');
  }
}

// API Status Check (uses /health when available)
async function checkApiStatus(buttonEl) {
  const button = buttonEl;
  const originalContent = button.innerHTML;
  button.innerHTML = '<span class="material-icons">hourglass_empty</span> Checking...';
  button.disabled = true;
  try {
    const h = await api('/health');
    const overallStatus = h.ok ? 'success' : 'error';
    updateApiStatus(overallStatus, h);
    showNotification('API status updated', h.ok ? 'success' : 'error');
  } catch (e) {
    updateApiStatus('error');
    showNotification('Health failed: ' + e.message, 'error');
  } finally {
    button.innerHTML = originalContent;
    button.disabled = false;
  }
}

function updateApiStatus(overallStatus = 'success', data = null) {
  const container = document.getElementById('api-status');
  const now = new Date();
  const timeString = now.toLocaleTimeString();
  const cfApi = container.children[0];
  const cfIcon = cfApi.querySelector('.api-status-icon');
  const cfDesc = cfApi.querySelector('.api-status-desc');
  const cfBadge = cfApi.querySelector('.api-status-badge');
  if (overallStatus === 'error') {
    cfIcon.className = 'api-status-icon error';
    cfIcon.innerHTML = '<span class="material-icons">cloud_off</span>';
    cfDesc.textContent = `Connection failed • Last checked: ${timeString}`;
    cfBadge.className = 'api-status-badge error';
    cfBadge.textContent = 'Offline';
  } else {
    cfIcon.className = 'api-status-icon success';
    cfIcon.innerHTML = '<span class="material-icons">cloud_done</span>';
    cfDesc.textContent = `Connected • Last checked: ${timeString}`;
    cfBadge.className = 'api-status-badge success';
    cfBadge.textContent = 'Online';
  }
}

// Inbox Management
let inboxPage = 0;
const inboxLimit = 20;
let currentEmailData = null;

async function loadInbox(page = 0) {
  const list = document.getElementById('inbox-list');
  list.innerHTML = '<div style="text-align: center; padding: 20px;">Loading...</div>';
  
  try {
    const emails = await api(`/api/inbox?limit=${inboxLimit}&offset=${page * inboxLimit}`);
    renderInbox(emails);
    inboxPage = page;
    
    document.getElementById('btn-inbox-prev').disabled = inboxPage === 0;
    document.getElementById('btn-inbox-next').disabled = emails.length < inboxLimit;
  } catch (e) {
    let msg = e.message;
    if (msg.includes('Cannot GET')) {
      msg = 'Server endpoint not found. Please restart your server.';
    } else if (msg.includes('Invalid uuid') || msg.includes('databaseId')) {
      msg = 'Invalid D1 Database ID. Please configure it in Settings.';
    } else if (msg.includes('no such table')) {
      list.innerHTML = `
        <div style="text-align: center; padding: 20px; display: flex; flex-direction: column; align-items: center; gap: 16px;">
          <div style="color: var(--text-secondary-light);">Database table not found.</div>
          <button class="btn" id="btn-init-db">Initialize Database</button>
        </div>`;
      document.getElementById('btn-init-db').onclick = initInboxDb;
      return;
    }
    list.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--error);">Failed to load inbox: ${msg}</div>`;
  }
}

async function initInboxDb() {
  const btn = document.getElementById('btn-init-db');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons" style="font-size: 16px; animation: spin 1s linear infinite;">refresh</span> Initializing...';
  }
  
  try {
    await api('/api/inbox/init', { method: 'POST' });
    showNotification('Database initialized successfully!', 'success');
    loadInbox(0);
  } catch (e) {
    showNotification('Init failed: ' + e.message, 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'Initialize Database';
    }
  }
}

function renderInbox(emails) {
  const list = document.getElementById('inbox-list');
  list.innerHTML = '';
  
  if (!emails || emails.length === 0) {
    list.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary-light);">No messages found</div>';
    return;
  }
  
  emails.forEach(email => {
    const el = document.createElement('div');
    el.className = 'email-item';
    const initial = (email.sender || '?')[0];
    const date = new Date(email.created_at).toLocaleString();
    
    el.innerHTML = `
      <div class="email-avatar">${initial}</div>
      <div class="email-info">
        <div class="email-sender">${email.sender}</div>
        <div class="email-subject">${email.subject}</div>
      </div>
      <div class="email-date">${date}</div>
    `;
    el.addEventListener('click', () => openEmail(email.id));
    list.appendChild(el);
  });
}

async function openEmail(id) {
  const modal = document.getElementById('emailModal');
  const container = document.getElementById('emailBodyContainer');
  
  // Reset UI
  container.innerHTML = '<div style="padding: 20px; text-align: center;">Loading content...</div>';
  document.getElementById('emailSubject').textContent = 'Loading...';
  document.getElementById('emailSender').textContent = '';
  document.getElementById('emailDate').textContent = '';
  document.getElementById('emailRecipient').textContent = '';
  modal.classList.add('active');
  
  try {
    const email = await api(`/api/inbox/${id}`);
    currentEmailData = email;
    
    document.getElementById('emailSubject').textContent = email.subject;
    document.getElementById('emailSender').textContent = `From: ${email.sender}`;
    document.getElementById('emailRecipient').textContent = `To: ${email.recipient}`;
    document.getElementById('emailDate').textContent = new Date(email.created_at).toLocaleString();
    
    // Default to HTML view
    renderEmailBody('html');
    
    // Setup delete button
    const deleteBtn = document.getElementById('btn-email-delete');
    deleteBtn.onclick = () => deleteEmail(id);
    
  } catch (e) {
    container.innerHTML = `<div style="padding: 20px; color: var(--error);">Error loading email: ${e.message}</div>`;
  }
}

function renderEmailBody(type) {
  const container = document.getElementById('emailBodyContainer');
  const btnHtml = document.getElementById('btn-view-html');
  const btnText = document.getElementById('btn-view-text');
  
  if (type === 'html') {
    btnHtml.classList.add('active');
    btnText.classList.remove('active');
    const iframe = document.createElement('iframe');
    iframe.className = 'email-body-iframe';
    // Use srcdoc for security and isolation
    iframe.srcdoc = currentEmailData.html_body || '<div style="font-family: sans-serif; padding: 20px; color: #666;">No HTML content</div>';
    container.innerHTML = '';
    container.appendChild(iframe);
  } else {
    btnHtml.classList.remove('active');
    btnText.classList.add('active');
    const div = document.createElement('div');
    div.className = 'email-body-text';
    div.textContent = currentEmailData.text_body || '(No text content)';
    container.innerHTML = '';
    container.appendChild(div);
  }
}

async function deleteEmail(id) {
  if (!confirm('Are you sure you want to delete this email?')) return;
  try {
    await api(`/api/inbox/${id}`, { method: 'DELETE' });
    document.getElementById('emailModal').classList.remove('active');
    loadInbox(inboxPage);
    showNotification('Email deleted', 'success');
  } catch (e) {
    showNotification('Failed to delete: ' + e.message, 'error');
  }
}

// Settings Management
async function openSettings() {
  const modal = document.getElementById('settingsModal');
  const accountInput = document.getElementById('cfgAccountId');
  const zoneInput = document.getElementById('cfgZoneId');
  const tokenInput = document.getElementById('cfgApiToken');
  let config = { account_id: '', zone_id: '', has_token: false };
  
  try {
    config = await api('/api/config');
  } catch (e) {
    showNotification('Could not load config: ' + e.message, 'warning');
  }

  accountInput.value = config.account_id || '';
  zoneInput.value = config.zone_id || '';
  tokenInput.value = ''; // Don't show token
  tokenInput.placeholder = config.has_token ? '******** (Set to update)' : 'Enter API Token';
  modal.classList.add('active');
}

async function saveSettings(e) {
  e.preventDefault();
  const body = {
    account_id: document.getElementById('cfgAccountId').value.trim(),
    zone_id: document.getElementById('cfgZoneId').value.trim(),
    api_token: document.getElementById('cfgApiToken').value.trim()
  };
  try {
    await api('/api/config', { method: 'POST', body: JSON.stringify(body) });
    showNotification('Configuration saved!', 'success');
    document.getElementById('settingsModal').classList.remove('active');
    checkApiStatus(document.getElementById('btn-check-status')); // Refresh status
  } catch (err) {
    showNotification('Save failed: ' + err.message, 'error');
  }
}

function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <span class="material-icons">${type === 'success' ? 'check_circle' : 'error'}</span>
    ${message}
  `;
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function initTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Toggle tabs
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      // Toggle views
      document.querySelectorAll('.view-section').forEach(v => v.style.display = 'none');
      const targetId = tab.getAttribute('data-target');
      document.getElementById(targetId).style.display = 'block';
    });
  });
}

// Element SDK configuration (optional)
async function onConfigChange(config) {
  const panelTitle = config.panel_title || defaultConfig.panel_title;
  const welcomeMessage = config.welcome_message || defaultConfig.welcome_message;
  document.getElementById('panel-title').textContent = panelTitle;
  document.getElementById('welcome-message').textContent = welcomeMessage;
}
function mapToCapabilities(_config) { return { recolorables: [], borderables: [], fontEditable: undefined, fontSizeable: undefined }; }
function mapToEditPanelValues(config) { return new Map([["panel_title", config.panel_title || defaultConfig.panel_title],["welcome_message", config.welcome_message || defaultConfig.welcome_message]]); }

// Wire up events after DOM is ready
document.addEventListener('DOMContentLoaded', function () {
  // Theme
  loadTheme();
  initTabs();
  const themeBtn = document.getElementById('btn-theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
  
  // Settings
  const settingsBtn = document.getElementById('btn-settings');
  const settingsModal = document.getElementById('settingsModal');
  const settingsForm = document.getElementById('settingsForm');
  if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
  if (settingsForm) settingsForm.addEventListener('submit', saveSettings);
  document.getElementById('btn-settings-close')?.addEventListener('click', () => settingsModal.classList.remove('active'));
  document.getElementById('btn-settings-cancel')?.addEventListener('click', () => settingsModal.classList.remove('active'));

  // Element SDK
  if (window.elementSdk) {
    window.elementSdk.init({ defaultConfig, onConfigChange, mapToCapabilities, mapToEditPanelValues });
  }

  // API Status check button
  const checkBtn = document.getElementById('btn-check-status');
  if (checkBtn) checkBtn.addEventListener('click', (e) => checkApiStatus(e.currentTarget));

  // Open modal buttons
  const addRuleBtn = document.getElementById('btn-add-rule');
  const addFabBtn = document.getElementById('btn-fab-add');
  if (addRuleBtn) addRuleBtn.addEventListener('click', showAddRuleDialog);
  if (addFabBtn) addFabBtn.addEventListener('click', showAddRuleDialog);

  // Inbox events
  const inboxTab = document.querySelector('[data-target="view-inbox"]');
  if (inboxTab) inboxTab.addEventListener('click', () => loadInbox(0));
  
  document.getElementById('btn-refresh-inbox')?.addEventListener('click', () => loadInbox(inboxPage));
  document.getElementById('btn-inbox-prev')?.addEventListener('click', () => loadInbox(inboxPage - 1));
  document.getElementById('btn-inbox-next')?.addEventListener('click', () => loadInbox(inboxPage + 1));
  
  document.getElementById('btn-email-close')?.addEventListener('click', () => document.getElementById('emailModal').classList.remove('active'));
  document.getElementById('btn-email-close-action')?.addEventListener('click', () => document.getElementById('emailModal').classList.remove('active'));
  document.getElementById('btn-view-html')?.addEventListener('click', () => renderEmailBody('html'));
  document.getElementById('btn-view-text')?.addEventListener('click', () => renderEmailBody('text'));

  // Close modal buttons
  const closeBtn = document.getElementById('btn-modal-close');
  const cancelBtn = document.getElementById('btn-cancel');
  if (closeBtn) closeBtn.addEventListener('click', closeRuleModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeRuleModal);

  // Form submit
  const ruleForm = document.getElementById('ruleForm');
  if (ruleForm) ruleForm.addEventListener('submit', saveRule);

  // Rule Type change handler
  const ruleTypeSelect = document.getElementById('ruleType');
  if (ruleTypeSelect) {
    ruleTypeSelect.addEventListener('change', function() {
      const type = this.value;
      const destInput = document.getElementById('toEmail');
      const destGroup = destInput.closest('.form-group');
      const destLabel = destGroup.querySelector('.form-label');
      
      if (type === 'drop') {
        destGroup.style.display = 'none';
        destInput.required = false;
      } else {
        destGroup.style.display = 'block';
        destInput.required = true;
        if (type === 'worker') {
          destLabel.textContent = 'Worker Name';
          destInput.placeholder = 'e.g., inbox-worker';
          destInput.type = 'text';
          if (!destInput.value || destInput.value.includes('@')) {
            destInput.value = 'inbox-worker';
          }
        } else {
          destLabel.textContent = 'Forward To';
          destInput.placeholder = 'e.g., admin@company.com';
          destInput.type = 'email';
        }
      }
    });
  }

  // Delegate rule actions
  const rulesContainer = document.getElementById('rules-container');
  if (rulesContainer) {
    rulesContainer.addEventListener('click', async (e) => {
      const btn = e.target.closest('button.rule-action-btn');
      if (!btn) return;
      const ruleElement = btn.closest('.email-rule');
      const action = btn.getAttribute('data-action');
      if (action === 'toggle') return handleToggle(ruleElement, btn);
      if (action === 'edit') return populateEditRule(ruleElement);
      if (action === 'delete') return handleDelete(ruleElement, btn);
      if (action === 'copy') return handleCopy(ruleElement);
    });
  }

  // Initial data
  loadRules();
});
