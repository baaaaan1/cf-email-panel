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
  const fromEmail = ruleElement.querySelector('.rule-from').textContent.trim();
  const toEmail = ruleElement.querySelector('.rule-to').textContent.replace('→ ', '').trim();
  document.getElementById('modalTitle').textContent = 'Edit Rule';
  document.getElementById('saveBtn').innerHTML = '<span class="material-icons">save</span> Update Rule';
  document.getElementById('fromEmail').value = fromEmail;
  document.getElementById('toEmail').value = toEmail;
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
}

async function saveRule(event) {
  event.preventDefault();
  const fromEmail = document.getElementById('fromEmail').value.trim();
  const toEmail = document.getElementById('toEmail').value.trim();
  const ruleType = document.getElementById('ruleType').value;
  if (ruleType !== 'forward') { showNotification('Only Forward is supported for now', 'error'); return; }
  try {
    if (editingRuleId) {
      await api('/api/rules/' + encodeURIComponent(editingRuleId), { method: 'PUT', body: JSON.stringify({ customEmail: fromEmail, destinationId: toEmail }) });
      showNotification('Rule updated successfully!', 'success');
    } else {
      await api('/api/rules', { method: 'POST', body: JSON.stringify({ customEmail: fromEmail, destinationIdManual: toEmail }) });
      showNotification('Rule created successfully!', 'success');
    }
    closeRuleModal();
    await loadRules();
  } catch (e) { showNotification('Save failed: ' + e.message, 'error'); }
}

function createRuleElement(rule) {
  const alias = (rule.matchers && rule.matchers[0] && rule.matchers[0].value) || '';
  const action = rule.actions && rule.actions[0] || {};
  const to = Array.isArray(action.value) ? action.value.join(', ') : (action.value || (action.type === 'drop' ? '/dev/null' : ''));
  const isActive = !!rule.enabled;
  const div = document.createElement('div');
  div.className = 'email-rule';
  div.setAttribute('data-id', rule.id);
  div.innerHTML = `
    <div class="rule-info">
      <div class="rule-from">${alias}</div>
      <div class="rule-to">→ ${to}</div>
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

  // Close modal buttons
  const closeBtn = document.getElementById('btn-modal-close');
  const cancelBtn = document.getElementById('btn-cancel');
  if (closeBtn) closeBtn.addEventListener('click', closeRuleModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeRuleModal);

  // Form submit
  const ruleForm = document.getElementById('ruleForm');
  if (ruleForm) ruleForm.addEventListener('submit', saveRule);

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
