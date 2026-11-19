import { sampleDocuments, sampleTasks, sampleSessions, sampleQuizzes } from '../data/sample-data.js';
import { storage } from './services/storage.js';
import { api } from './services/api.js';
import { createFeatureSuite } from './features.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const initialAuth = await api.getSession().catch(() => null);
storage.setScope(initialAuth?.user?.id || null);
let authUser = initialAuth?.user || null, pendingEmail = '';
const today = new Date();
let docs = storage.get('documents', sampleDocuments);
let tasks = storage.get('tasks', sampleTasks);
let sessions = storage.get('sessions', sampleSessions);
let quizScores = storage.get('scores', []);
let view = 'home', filter = 'All files', searchText = '', activeQuiz = null, quizIndex = 0, quizCorrect = 0;
const page = $('#page-content'), modal = $('#modal'), modalContent = $('#modal-content'), toastEl = $('#toast');

// Theme palettes definitions
const PRESET_PALETTES = {
  'slate-light': {
    name: 'Modern Slate (Light)',
    isDark: false,
    vars: {
      '--bg': '#eaeef6',
      '--surface': '#dce1ee',
      '--surface-2': '#cfd6e6',
      '--ink': '#141724',
      '--muted': '#585d73',
      '--line': '#000000',
      '--border-container': '#000000',
      '--purple': '#5f50e6',
      '--purple-2': '#d7d3fa'
    }
  },
  'midnight-dark': {
    name: 'Midnight Obsidian (Dark)',
    isDark: true,
    vars: {
      '--bg': '#141521',
      '--surface': '#1e202f',
      '--surface-2': '#282a3c',
      '--ink': '#f2f4fa',
      '--muted': '#9fa3ba',
      '--line': '#3a3d52',
      '--border-container': '#3a3d52',
      '--purple': '#7f73f4',
      '--purple-2': '#35324e'
    }
  },
  'emerald-forest': {
    name: 'Emerald Forest',
    isDark: false,
    vars: {
      '--bg': '#e5f4ec',
      '--surface': '#d2eade',
      '--surface-2': '#c0dece',
      '--ink': '#0d281e',
      '--muted': '#3d6153',
      '--line': '#000000',
      '--border-container': '#000000',
      '--purple': '#10b981',
      '--purple-2': '#bbf7d0'
    }
  },
  'sunset-warmth': {
    name: 'Sunset Amber',
    isDark: false,
    vars: {
      '--bg': '#faefe4',
      '--surface': '#f0ddd0',
      '--surface-2': '#e3cdbd',
      '--ink': '#2a1608',
      '--muted': '#6b4f39',
      '--line': '#000000',
      '--border-container': '#000000',
      '--purple': '#d97706',
      '--purple-2': '#fed7aa'
    }
  },
  'ocean-azure': {
    name: 'Ocean Azure',
    isDark: false,
    vars: {
      '--bg': '#e7effb',
      '--surface': '#d5e3f8',
      '--surface-2': '#c4d6f2',
      '--ink': '#0d1e38',
      '--muted': '#3b557a',
      '--line': '#000000',
      '--border-container': '#000000',
      '--purple': '#2563eb',
      '--purple-2': '#bfdbfe'
    }
  },
  'ruby-crimson': {
    name: 'Ruby Crimson',
    isDark: false,
    vars: {
      '--bg': '#fae8eb',
      '--surface': '#f3d4d9',
      '--surface-2': '#e5bfc6',
      '--ink': '#2b0b11',
      '--muted': '#69363f',
      '--line': '#000000',
      '--border-container': '#000000',
      '--purple': '#e11d48',
      '--purple-2': '#fecdd3'
    }
  }
};

let currentThemeId = storage.get('theme-palette-id', 'slate-light');
let customThemeVars = storage.get('theme-custom-vars', null);

function applyThemePalette(paletteId, customVars = null) {
  currentThemeId = paletteId;
  storage.set('theme-palette-id', paletteId);
  const root = document.documentElement;
  
  if (paletteId === 'custom' && customVars) {
    customThemeVars = customVars;
    storage.set('theme-custom-vars', customVars);
    for (const [k, v] of Object.entries(customVars)) {
      root.style.setProperty(k, v);
    }
    document.body.classList.toggle('dark', !!customVars.isDark);
    storage.set('dark', !!customVars.isDark);
    return;
  }

  const p = PRESET_PALETTES[paletteId] || PRESET_PALETTES['slate-light'];
  for (const [k, v] of Object.entries(p.vars)) {
    root.style.setProperty(k, v);
  }
  document.body.classList.toggle('dark', p.isDark);
  storage.set('dark', p.isDark);
}

// Ads & Monetization System
const SPONSOR_ADS = [
  {
    id: 'ad-1',
    sponsor: 'Chegg Study Boost',
    badge: '50% OFF',
    icon: '📚',
    title: 'Textbook Solutions & 24/7 Q&A',
    description: 'Step-by-step explanations for engineering & IT course textbooks.',
    cta: 'Claim Student Discount',
    url: 'https://chegg.com'
  },
  {
    id: 'ad-2',
    sponsor: 'Grammarly for Campus',
    badge: 'FREE TOOL',
    icon: '✍️',
    title: 'Write Papers with Confidence',
    description: 'Catch grammar slips, format academic citations and polish reports.',
    cta: 'Get Free Access',
    url: 'https://grammarly.com'
  },
  {
    id: 'ad-3',
    sponsor: 'GitHub Student Pack',
    badge: 'FREE $1k+ VALUE',
    icon: '💻',
    title: 'Free Developer & Cloud Tools',
    description: 'Get free domain, GitHub Copilot, DigitalOcean credits & JetBrains.',
    cta: 'Unlock Pack',
    url: 'https://education.github.com'
  },
  {
    id: 'ad-4',
    sponsor: 'Coursera Plus',
    badge: 'CERTIFIED',
    icon: '🎓',
    title: 'Google & IBM Certificates',
    description: 'Learn Python, Cloud & Data Science with recognized credentials.',
    cta: 'Start Free Trial',
    url: 'https://coursera.org'
  },
  {
    id: 'ad-5',
    sponsor: 'NordVPN Student Plan',
    badge: '70% OFF',
    icon: '🛡️',
    title: 'Campus Wi-Fi Security',
    description: 'Keep your research, passwords and connections completely private.',
    cta: 'Protect Device',
    url: 'https://nordvpn.com'
  }
];

let adIndex = 0;
let adRevenue = storage.get('ad-revenue', 0.00);
let adImpressions = storage.get('ad-impressions', 0);
let adClicks = storage.get('ad-clicks', 0);
let adsEnabled = storage.get('ads-enabled', true);
let adMinimized = storage.get('ad-minimized', false);
let adRotationTimer = null;

function renderAdWidget() {
  const container = $('#ad-popup');
  if (!container) return;
  if (!adsEnabled) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  if (adMinimized) {
    container.classList.add('minimized');
    container.innerHTML = `<button class="ad-pill-btn" id="ad-expand-btn"><span>📢</span> <span>Sponsored ($${adRevenue.toFixed(2)})</span></button>`;
    return;
  }

  container.classList.remove('minimized');
  const ad = SPONSOR_ADS[adIndex % SPONSOR_ADS.length];
  container.innerHTML = `
    <div class="ad-header">
      <div style="display:flex;align-items:center;gap:6px">
        <span class="ad-badge">${esc(ad.badge)}</span>
        <strong style="color:var(--ink);font-size:10px">${esc(ad.sponsor)}</strong>
      </div>
      <div class="ad-header-right">
        <button class="ad-revenue-btn" id="ad-revenue-trigger" title="View Ad Earnings & Monetization Settings">💰 $${adRevenue.toFixed(2)}</button>
        <button class="ad-ctrl-btn" id="ad-min-trigger" title="Minimize ad">−</button>
        <button class="ad-ctrl-btn" id="ad-close-trigger" title="Close ad">×</button>
      </div>
    </div>
    <div class="ad-body" id="ad-click-area">
      <div class="ad-icon-box">${ad.icon}</div>
      <div class="ad-content">
        <h4>${esc(ad.title)}</h4>
        <p>${esc(ad.description)}</p>
        <button class="ad-cta" type="button">${esc(ad.cta)} ↗</button>
      </div>
    </div>
    <div class="ad-footer">Ads generate revenue to keep EduAssist free for students</div>
  `;
}

function recordAdImpression() {
  if (!adsEnabled) return;
  adImpressions++;
  adRevenue += 0.005; // $5.00 CPM rate
  saveAdStats();
  const revPill = $('#ad-revenue-trigger');
  if (revPill) revPill.textContent = `💰 $${adRevenue.toFixed(2)}`;
}

function recordAdClick() {
  adClicks++;
  adRevenue += 0.50; // $0.50 CPC rate
  saveAdStats();
  toast(`🎉 Ad partner click recorded! Earned +$0.50 revenue (Total: $${adRevenue.toFixed(2)})`);
  renderAdWidget();
}

function saveAdStats() {
  storage.set('ad-revenue', Number(adRevenue.toFixed(3)));
  storage.set('ad-impressions', adImpressions);
  storage.set('ad-clicks', adClicks);
}

function startAdRotation() {
  if (adRotationTimer) clearInterval(adRotationTimer);
  recordAdImpression();
  renderAdWidget();
  adRotationTimer = setInterval(() => {
    if (adsEnabled && !adMinimized) {
      adIndex = (adIndex + 1) % SPONSOR_ADS.length;
      recordAdImpression();
      renderAdWidget();
    }
  }, 22000);
}

const features = createFeatureSuite({
  storage,
  esc,
  toast,
  getSessions: () => sessions,
  onSessionsChanged: () => {
    sessions = storage.get('sessions', sampleSessions);
    if (view === 'home' || view === 'planner') render();
  }
});

function save() {
  storage.set('documents', docs);
  storage.set('tasks', tasks);
  storage.set('sessions', sessions);
  storage.set('scores', quizScores);
}

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2800);
}

function openModal(html) {
  modalContent.innerHTML = html;
  if (!modal.open) modal.showModal();
}

function closeModal() {
  modal.close();
}

function syncAuthUi() {
  const button = $('#auth-button');
  if (button) button.textContent = authUser ? 'Log out' : 'Log in';
  $('#profile-name').textContent = authUser?.name || 'Guest mode';
  $('#profile-status').textContent = authUser ? 'Verified account' : 'Local student data';
  $('#profile-avatar').textContent = authUser ? authUser.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'ST' : 'ST';
}

function authModal(mode = 'login', data = {}) {
  pendingEmail = data.email || pendingEmail;
  const note = data.notice ? `<div class="auth-notice" role="status">${esc(data.notice)}</div>` : '';
  const error = data.error ? `<div class="auth-error" role="alert">${esc(data.error)}</div>` : '';
  let html = '';
  if (mode === 'register') {
    html = `<div class="auth-mark">✳</div><h2>Create your student account</h2><p>Register with your email and activate it using the code we send.</p>${note}${error}<form id="auth-form" data-mode="register"><div class="form-field"><label for="auth-name">Full name</label><input id="auth-name" name="name" autocomplete="name" required minlength="2" maxlength="80" placeholder="Your name"></div><div class="form-field"><label for="auth-email">Email address</label><input id="auth-email" name="email" type="email" autocomplete="email" required value="${esc(pendingEmail)}" placeholder="you@example.com"></div><div class="form-field"><label for="auth-password">Password</label><input id="auth-password" name="password" type="password" autocomplete="new-password" required minlength="10" placeholder="At least 10 characters"><small class="field-help">Use at least 10 characters.</small></div><div class="form-field"><label for="auth-confirm">Confirm password</label><input id="auth-confirm" name="confirm" type="password" autocomplete="new-password" required minlength="10"></div><button class="primary-button auth-submit">Create account &amp; send code</button></form><p class="auth-switch">Already registered? <button data-auth-action="show-login">Log in</button></p>`;
  } else if (mode === 'verify') {
    html = `<div class="auth-mark">✉</div><h2>Check your email</h2><p>Enter the six-digit verification code sent to <b>${esc(pendingEmail)}</b>. It expires after 10 minutes.</p>${note}${error}<form id="auth-form" data-mode="verify"><input type="hidden" name="email" value="${esc(pendingEmail)}"><div class="form-field"><label for="auth-code">Verification code</label><input id="auth-code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required placeholder="000000" class="verification-code"></div><button class="primary-button auth-submit">Verify and activate</button></form><p class="auth-switch">Didn’t receive it? <button data-auth-action="resend">Send a new code</button></p><p class="auth-switch"><button data-auth-action="show-login">Back to log in</button></p>`;
  } else {
    html = `<div class="auth-mark">✳</div><h2>Welcome back</h2><p>Log in to your verified Edu-Assist account.</p>${note}${error}<form id="auth-form" data-mode="login"><div class="form-field"><label for="auth-email">Email address</label><input id="auth-email" name="email" type="email" autocomplete="email" required value="${esc(pendingEmail)}" placeholder="you@example.com"></div><div class="form-field"><label for="auth-password">Password</label><input id="auth-password" name="password" type="password" autocomplete="current-password" required></div><button class="primary-button auth-submit">Log in</button></form><p class="auth-switch">New to Edu-Assist? <button data-auth-action="show-register">Create an account</button></p>`;
  }
  openModal(`<div class="auth-modal">${html}<p class="footer-note">Your academic data stays in this browser in this MVP.</p></div>`);
}

async function submitAuth(form) {
  const mode = form.dataset.mode, values = Object.fromEntries(new FormData(form).entries()), submit = $('.auth-submit', form);
  submit.disabled = true;
  submit.textContent = 'Please wait…';
  try {
    if (mode === 'register') {
      if (values.password !== values.confirm) throw new Error('The passwords do not match.');
      const result = await api.register({ name: values.name, email: values.email, password: values.password });
      pendingEmail = result.email || values.email;
      if (result.needsVerification) authModal('verify', { email: pendingEmail, notice: result.message });
      else authModal('login', { email: pendingEmail, notice: result.message });
    } else if (mode === 'verify') {
      const result = await api.verify({ email: values.email, code: values.code });
      authUser = result.user;
      storage.setScope(authUser.id);
      closeModal();
      toast('Email verified. Your account is active.');
      location.reload();
    } else {
      const result = await api.login({ email: values.email, password: values.password });
      authUser = result.user;
      storage.setScope(authUser.id);
      closeModal();
      toast('You are logged in.');
      location.reload();
    }
  } catch (error) {
    if (error.code === 'EMAIL_NOT_VERIFIED') {
      pendingEmail = error.email || values.email;
      authModal('verify', { email: pendingEmail, error: 'Verify your email address before logging in.' });
    } else {
      const message = error.message === 'Failed to fetch' ? 'Can’t reach account server.' : error.message || 'Could not complete request.';
      authModal(mode, { email: values.email || pendingEmail, error: message });
    }
  }
}

async function logout() {
  try {
    await api.logout();
    authUser = null;
    storage.setScope(null);
    location.reload();
  } catch (error) {
    toast(error.message || 'Could not log out.');
  }
}

function fileIcon(type) {
  return type === 'pdf' ? ['pdf', 'PDF'] : type === 'slides' ? ['notes', 'PPT'] : ['notes', 'DOC'];
}

function taskTag(task) {
  return task.tag === 'Practice' ? 'green' : task.tag === 'Assignment' ? 'orange' : '';
}

function taskProgress(task) {
  return Math.max(0, Math.min(100, Number.isFinite(Number(task.progress)) ? Number(task.progress) : (task.done ? 100 : 0)));
}

function renderTaskActivity(task, showTag = false) {
  const progress = taskProgress(task), status = progress === 100 ? 'Done' : progress === 0 ? 'Not started' : 'In progress';
  return `
    <div class="task-row ${progress === 100 ? 'done' : ''}">
      <input class="task-check" type="checkbox" data-task="${esc(task.id)}" aria-label="Mark ${esc(task.title)} done" ${progress === 100 ? 'checked' : ''}>
      <div class="task-detail">
        <strong>${esc(task.title)}</strong>
        <small>${esc(task.subject)} · ${esc(task.due)}</small>
        <div class="activity-progress-head">
          <span>${status}</span>
          <b>${progress}%</b>
        </div>
        <div class="progress-track activity-track">
          <div class="progress-fill" style="width:${progress}%"></div>
        </div>
        <input class="activity-progress" type="range" min="0" max="100" step="5" value="${progress}" data-progress-task="${esc(task.id)}" aria-label="Progress for ${esc(task.title)}">
      </div>
      ${showTag ? `<span class="tag ${taskTag(task)}">${esc(task.tag)}</span>` : ''}
    </div>
  `;
}

function renderSessionProgress(session, index) {
  const progress = Math.max(0, Math.min(100, Number(session.progress) || 0)), status = progress === 100 ? 'Done' : progress === 0 ? 'Not started' : 'In progress';
  return `
    <div class="session-progress">
      <div class="activity-progress-head">
        <span>${status}</span>
        <div style="display:flex;align-items:center;gap:6px">
          <b>${progress}%</b>
          <button class="topic-read-btn-inline ${progress === 100 ? 'done' : ''}" data-session-mark-done="${index}" title="Mark session as read & done">${progress === 100 ? '✓ Done' : 'Mark as Read'}</button>
        </div>
      </div>
      <div class="progress-track activity-track">
        <div class="progress-fill" style="width:${progress}%"></div>
      </div>
      <input class="activity-progress" type="range" min="0" max="100" step="5" value="${progress}" data-session-progress="${index}" aria-label="Progress for ${esc(session.title)}">
    </div>
  `;
}

function setView(next) {
  view = next;
  $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  $('#breadcrumb-current').textContent = ({
    home: 'Overview',
    documents: 'My documents',
    planner: 'Study planner',
    quizzes: 'Practice quizzes',
    ...features.labels
  })[view];
  $('#sidebar').classList.remove('open');
  render();
}

function render() {
  const featurePage = features.render(view);
  if (featurePage !== null) {
    page.innerHTML = featurePage;
    $('#doc-count').textContent = docs.length;
    return;
  }
  ({ home: renderHome, documents: renderDocuments, planner: renderPlanner, quizzes: renderQuizzes })[view]();
  $('#doc-count').textContent = docs.length;
}

function pageHeader(eyebrow, title, sub, button = '') {
  return `<div class="welcome-row"><div><div class="eyebrow">${eyebrow}</div><h1 class="page-title">${title}</h1><p class="page-subtitle">${sub}</p></div>${button}</div>`;
}

function renderHome() {
  const complete = tasks.filter(t => t.done).length;
  const currentScore = quizScores.length ? Math.round(quizScores.reduce((sum, q) => sum + q.percent, 0) / quizScores.length) : null;
  const readDocsCount = docs.filter(d => d.read || d.progress === 100).length;
  const docReadPercent = docs.length ? Math.round((readDocsCount / docs.length) * 100) : 0;

  page.innerHTML = `
    ${pageHeader(today.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), 'Good to see you, Lehlohonolo 👋', 'Your learning space is ready. Here’s a little progress for today.', '<button class="primary-button" data-action="upload">＋ Add document</button>')}
    <section class="stats-grid">
      <article class="stat-card">
        <div class="stat-top">Documents Studied <span class="stat-icon lilac">▤</span></div>
        <div class="stat-number">${readDocsCount}<span style="font-size:14px;color:var(--muted)"> / ${docs.length}</span></div>
        <div class="stat-foot"><b>${docReadPercent}%</b> read &amp; accessible</div>
      </article>
      <article class="stat-card">
        <div class="stat-top">Tasks completed <span class="stat-icon green">✓</span></div>
        <div class="stat-number">${complete}<span style="font-size:14px;color:var(--muted)"> / ${tasks.length}</span></div>
        <div class="stat-foot"><b>${tasks.length ? Math.round(complete / tasks.length * 100) : 0}%</b> of your task list</div>
      </article>
      <article class="stat-card">
        <div class="stat-top">Study sessions <span class="stat-icon orange">◷</span></div>
        <div class="stat-number">${sessions.length}</div>
        <div class="stat-foot">${sessions.filter(s => s.progress === 100).length} completed this week</div>
      </article>
      <article class="stat-card">
        <div class="stat-top">Quiz average <span class="stat-icon blue">◇</span></div>
        <div class="stat-number">${currentScore === null ? '—' : `${currentScore}%`}</div>
        <div class="stat-foot">${quizScores.length ? `${quizScores.length} quiz${quizScores.length === 1 ? '' : 'zes'} completed` : 'Try a practice quiz to begin'}</div>
      </article>
    </section>
    <section class="hero-card">
      <div class="hero-copy">
        <div class="hero-label">Your Interactive Study Companion</div>
        <h2>Make today a little more focused.</h2>
        <p>Ask a question, break down a tricky topic, or test yourself with live interactive guidance.</p>
        <button class="primary-button" data-action="assistant">Chat with study assistant <span>→</span></button>
      </div>
      <div class="hero-art"><div class="orbit"></div><div class="book"></div></div>
    </section>
    <section class="dashboard-grid">
      <div class="panel">
        <div class="panel-heading">
          <div><h2>Up next</h2><p>A few things to keep you moving</p></div>
          <button class="quiet-link" data-view="planner">View planner →</button>
        </div>
        <div class="task-list">${tasks.slice(0, 4).map(t => renderTaskActivity(t, true)).join('')}</div>
      </div>
      <div class="panel">
        <div class="panel-heading">
          <div><h2>Today’s plan</h2><p>Mark sessions as read &amp; done as you progress</p></div>
          <button class="quiet-link" data-action="add-session">＋ Add</button>
        </div>
        <div class="schedule-list">
          ${sessions.slice(0, 4).map((s, i) => `
            <div class="schedule-row">
              <span class="schedule-time">${esc(s.time)}</span>
              <div class="schedule-info">
                <strong>${esc(s.title)}</strong>
                <small>${esc(s.detail)}</small>
                ${renderSessionProgress(s, i)}
              </div>
              <span class="schedule-dot"></span>
            </div>
          `).join('') || '<p class="page-subtitle">No sessions planned yet. Add a study block to get started.</p>'}
        </div>
      </div>
    </section>
    <section class="panel">
      <div class="panel-heading">
        <div><h2>Recently added documents</h2><p>Your library materials with study progress</p></div>
        <button class="quiet-link" data-view="documents">All documents →</button>
      </div>
      <div class="doc-list">${docs.slice(0, 4).map(docRow).join('') || emptyDocuments()}</div>
    </section>
  `;
}

function docRow(doc) {
  const [cls, label] = fileIcon(doc.type);
  const prog = doc.progress || (doc.read ? 100 : 0);
  return `
    <div class="doc-row">
      <span class="file-icon ${cls}">${label}</span>
      <span class="doc-info">
        <strong>${esc(doc.name)}</strong>
        <small>${esc(doc.subject)} · ${esc(doc.size)} · ${doc.read ? '✓ Completed' : `${prog}% read`}</small>
      </span>
      <button class="topic-read-btn ${doc.read ? 'done' : ''}" data-read-doc="${esc(doc.id)}">${doc.read ? '✓ Read' : '📖 Read / Open'}</button>
      <button class="doc-action" data-delete-doc="${esc(doc.id)}" title="Remove document" aria-label="Remove ${esc(doc.name)}">···</button>
    </div>
  `;
}

function emptyDocuments() {
  return `
    <div class="empty-state">
      <div class="empty-icon">▤</div>
      <strong>No documents yet</strong>
      <p>Add notes or past papers to keep your study materials together.</p>
      <button class="secondary-button" data-action="upload">Add your first document</button>
    </div>
  `;
}

function renderDocuments() {
  const categories = ['All files', 'Notes', 'Question paper', 'Memorandum', 'Slides', 'Assignment'];
  const shown = docs.filter(doc => (filter === 'All files' || doc.kind === filter) && `${doc.name} ${doc.subject} ${doc.kind}`.toLowerCase().includes(searchText.toLowerCase()));
  
  page.innerHTML = `
    ${pageHeader('Your library', 'My documents', 'Keep lecture notes, past papers and uploaded course materials accessible for study sessions.', '<button class="primary-button" data-action="upload">＋ Upload documents</button>')}
    <div class="search-row">
      <div class="search-box">
        <span>⌕</span>
        <input id="doc-search" type="search" placeholder="Search documents or subjects…" value="${esc(searchText)}">
      </div>
      <button class="secondary-button" data-action="match">⇄ Match papers &amp; memos</button>
    </div>
    <div class="document-toolbar">
      ${categories.map(c => `<button class="filter-chip ${filter === c ? 'active' : ''}" data-filter="${esc(c)}">${esc(c)}</button>`).join('')}
      <span style="margin-left:auto;color:var(--muted);font-size:11px">${shown.length} file${shown.length === 1 ? '' : 's'}</span>
    </div>
    ${shown.length ? `
      <div class="doc-grid">
        ${shown.map(doc => {
          const [cls, label] = fileIcon(doc.type);
          const prog = doc.progress || (doc.read ? 100 : 0);
          return `
            <article class="doc-card">
              <div class="doc-card-top">
                <span class="file-icon ${cls}">${label}</span>
                <span class="tag ${doc.read ? 'green' : ''}">${doc.read ? '✓ Completed' : esc(doc.kind)}</span>
              </div>
              <h3 title="${esc(doc.name)}">${esc(doc.name)}</h3>
              <p>${esc(doc.subject)}</p>
              <div class="doc-progress-wrap">
                <div class="progress-track" title="${prog}% read">
                  <div class="progress-fill" style="width:${prog}%"></div>
                </div>
                <small>${doc.read ? '✓ Completed' : `${prog}% read`}</small>
              </div>
              <div class="doc-card-foot">
                <span>${esc(doc.size)} · ${esc(doc.date)}</span>
                <div style="display:flex;align-items:center;gap:6px">
                  <button class="primary-button small-btn" data-read-doc="${esc(doc.id)}" style="font-size:10px;padding:6px 10px">📖 Read / Open</button>
                  <button class="doc-action" data-delete-doc="${esc(doc.id)}" aria-label="Remove ${esc(doc.name)}">×</button>
                </div>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    ` : searchText ? '<div class="empty-state"><strong>No matching files</strong><p>Try another search or choose a different category.</p></div>' : emptyDocuments()}
    <p class="footer-note">All documents are stored locally in this browser. Click "Read / Open" on any document to read and study it.</p>
  `;

  $('#doc-search').addEventListener('input', e => {
    searchText = e.target.value;
    const pos = e.target.selectionStart;
    renderDocuments();
    const input = $('#doc-search');
    input.focus();
    input.setSelectionRange(pos, pos);
  });
}

function openDocumentReaderModal(doc) {
  const prog = doc.progress || (doc.read ? 100 : 0);
  const sampleFallbackText = `Study Guide & Chapter Content for: ${doc.name}\nSubject: ${doc.subject}\n\n1. Overview & Objectives:\nThis document covers fundamental syllabus topics for ${doc.subject}. Review key definitions, formulas, and diagrams before attempting self-check questions.\n\n2. Key Examination Focus Points:\n• Ensure you understand all core principles and avoid superficial memorisation.\n• When answering exam questions, state definitions clearly and provide real-world applications.\n\n3. Practical Recall Check:\nSummarize the main takeaway from this chapter in three concise sentences. Check your answers against past papers.`;
  const textContent = doc.content || sampleFallbackText;

  openModal(`
    <div class="reader-modal">
      <div class="reader-header">
        <div>
          <span class="tag ${doc.read ? 'green' : ''}">${doc.read ? '✓ Read' : esc(doc.kind)}</span>
          <h2 style="margin-top:6px">${esc(doc.name)}</h2>
          <small style="color:var(--muted)">${esc(doc.subject)} · ${esc(doc.size)} · ${esc(doc.date)}</small>
        </div>
      </div>
      <div class="reader-progress-box">
        <div class="activity-progress-head">
          <span>Reading progress</span>
          <b id="reader-prog-label">${doc.read ? '100% (Completed)' : `${prog}%`}</b>
        </div>
        <div class="progress-track">
          <div class="progress-fill" id="reader-prog-bar" style="width:${prog}%"></div>
        </div>
      </div>
      <div class="reader-content-box" id="reader-content-body">${esc(textContent)}</div>
      <div class="reader-footer">
        <button class="secondary-button" data-action="close">Close</button>
        <button class="mark-read-btn ${doc.read ? 'completed' : ''}" id="doc-mark-read" data-doc-id="${esc(doc.id)}">
          ${doc.read ? '✓ Already Read &amp; Completed' : '✓ Mark as Read (100%)'}
        </button>
      </div>
    </div>
  `);

  $('#doc-mark-read')?.addEventListener('click', () => {
    doc.read = true;
    doc.progress = 100;
    save();
    features.log('Marked document as read', `${doc.name} · 100%`);
    toast(`✓ "${doc.name}" marked as read! Progress updated to 100%.`);
    closeModal();
    render();
  });
}

function renderPlanner() {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - ((today.getDay() + 6) % 7) + i);
    return d;
  });

  page.innerHTML = `
    ${pageHeader('Build a steady rhythm', 'Study planner', 'Plan focused sessions and keep upcoming work in view.', '<button class="primary-button" data-action="add-session">＋ Plan a session</button>')}
    <div class="planner-layout">
      <div class="panel">
        <div class="panel-heading">
          <div><h2>This week</h2><p>Small blocks, steady progress</p></div>
          <span class="tag green">Week of ${today.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</span>
        </div>
        <div class="week-grid">
          ${days.map(d => `
            <div class="day-cell ${d.toDateString() === today.toDateString() ? 'today' : ''}">
              <small>${d.toLocaleDateString('en-ZA', { weekday: 'short' })}</small>
              <strong>${d.getDate()}</strong>
              ${sessions.length && d.getDay() === today.getDay() ? '<span class="day-mark"></span>' : ''}
            </div>
          `).join('')}
        </div>
        <div style="margin-top:22px">
          <div class="panel-heading">
            <div><h2>Upcoming sessions</h2><p>${sessions.length} planned · mark read at completion</p></div>
          </div>
          ${sessions.map((s, i) => `
            <div class="planner-task">
              <span class="planner-date">${esc(s.time)}</span>
              <div style="flex:1">
                <strong>${esc(s.title)}</strong>
                <small>${esc(s.detail)}</small>
                ${renderSessionProgress(s, i)}
              </div>
              <button class="doc-action" data-delete-session="${i}" aria-label="Remove session">×</button>
            </div>
          `).join('') || '<p class="page-subtitle">No sessions yet. Add one when you are ready to study.</p>'}
        </div>
      </div>
      <div>
        <div class="panel">
          <div class="panel-heading">
            <div><h2>Task list</h2><p>Update progress as you study</p></div>
            <button class="quiet-link" data-action="add-task">＋ Add task</button>
          </div>
          <div class="task-list">${tasks.map(t => renderTaskActivity(t)).join('')}</div>
        </div>
        <div class="panel" style="margin-top:15px">
          <div class="panel-heading">
            <div><h2>Your weekly focus</h2><p>Tasks marked complete</p></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:8px">
            <span>${tasks.filter(t => taskProgress(t) === 100).length} of ${tasks.length} complete</span>
            <b>${tasks.length ? Math.round(tasks.filter(t => taskProgress(t) === 100).length / tasks.length * 100) : 0}%</b>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${tasks.length ? Math.round(tasks.filter(t => taskProgress(t) === 100).length / tasks.length * 100) : 0}%"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderQuizzes() {
  const avg = quizScores.length ? Math.round(quizScores.reduce((a, q) => a + q.percent, 0) / quizScores.length) : 0;
  const quizCards = sampleQuizzes.map(q => {
    const last = quizScores.filter(result => result.title === q.title).at(-1), progress = last ? 100 : 0;
    return `
      <article class="quiz-card">
        <span class="stat-icon ${q.color}">${q.icon}</span>
        <h3>${esc(q.title)}</h3>
        <p>${esc(q.subject)} · Key concept questions and definitions.</p>
        <div class="quiz-progress">
          <div class="progress-track">
            <div class="progress-fill" style="width:${progress}%"></div>
          </div>
          <small>${last ? `Done · latest score ${last.percent}%` : 'Not started (0%)'}</small>
        </div>
        <button class="secondary-button" data-start-quiz="${q.id}">${last ? 'Practise again →' : 'Start quiz →'}</button>
        <div class="quiz-meta">
          <span>${q.questions} questions</span>
          <span>~${q.minutes} min</span>
        </div>
      </article>
    `;
  }).join('');

  page.innerHTML = `
    ${pageHeader('Learn by doing', 'Practice quizzes', 'Quick knowledge checks to spot strengths and automatically update your progress.')}
    ${activeQuiz ? renderQuizQuestion() : `
      <section class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
        <article class="stat-card">
          <div class="stat-top">Quizzes completed<span class="stat-icon lilac">◇</span></div>
          <div class="stat-number">${quizScores.length}</div>
          <div class="stat-foot">Practice at your own pace</div>
        </article>
        <article class="stat-card">
          <div class="stat-top">Average score<span class="stat-icon green">✓</span></div>
          <div class="stat-number">${quizScores.length ? avg + '%' : '—'}</div>
          <div class="stat-foot">Across completed quizzes</div>
        </article>
        <article class="stat-card">
          <div class="stat-top">Available quizzes<span class="stat-icon orange">▤</span></div>
          <div class="stat-number">${sampleQuizzes.length}</div>
          <div class="stat-foot">5 questions each</div>
        </article>
      </section>
      <div class="panel-heading" style="margin:24px 0 14px">
        <div><h2>Choose a subject</h2><p>Each quiz takes about five minutes</p></div>
      </div>
      <div class="quiz-grid">${quizCards}</div>
      ${quizScores.length ? `
        <div class="panel" style="margin-top:18px">
          <div class="panel-heading"><div><h2>Recent results</h2><p>Your latest practice records</p></div></div>
          ${quizScores.slice(-4).reverse().map(r => `
            <div class="planner-task">
              <span class="planner-date">${r.percent}%</span>
              <div>
                <strong>${esc(r.title)}</strong>
                <small>${esc(r.date)} · ${r.correct}/${r.total} correct</small>
              </div>
              <span class="tag ${r.percent >= 70 ? 'green' : 'orange'}">${r.percent >= 70 ? 'On track' : 'Keep practising'}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `}
  `;
}

function renderQuizQuestion() {
  const q = activeQuiz.questionsData[quizIndex];
  return `
    <div class="panel" style="max-width:700px;margin:0 auto">
      <div class="panel-heading">
        <div>
          <div class="eyebrow">${esc(activeQuiz.subject)}</div>
          <h2 style="margin-top:6px">Question ${quizIndex + 1} of ${activeQuiz.questions}</h2>
        </div>
        <button class="quiet-link" data-action="exit-quiz">Exit quiz</button>
      </div>
      <div class="quiz-progress">
        <div class="progress-track">
          <div class="progress-fill" style="width:${((quizIndex + 1) / activeQuiz.questions) * 100}%"></div>
        </div>
        <small>${Math.round(((quizIndex + 1) / activeQuiz.questions) * 100)}% · Question ${quizIndex + 1} of ${activeQuiz.questions}</small>
      </div>
      <h2 class="quiz-question">${esc(q.prompt)}</h2>
      <form id="answer-form">
        ${q.options.map((option, i) => `
          <label class="answer-option">
            <input type="radio" name="answer" value="${i}" required>
            <span>${esc(option)}</span>
          </label>
        `).join('')}
        <button class="primary-button" style="margin-top:16px" type="submit">
          ${quizIndex === activeQuiz.questions - 1 ? 'Finish quiz &amp; view score' : 'Next question →'}
        </button>
      </form>
    </div>
  `;
}

function uploadModal() {
  openModal(`
    <div class="upload-modal">
      <div class="upload-heading">
        <span class="upload-icon">↑</span>
        <div>
          <h2>Add study documents</h2>
          <p>Choose a file, specify subject and type. It will be immediately accessible in "My Documents".</p>
        </div>
      </div>
      <div class="upload-steps">
        <span><b>1</b> Choose files</span>
        <span><b>2</b> Add details</span>
        <span><b>3</b> Accessible in My Documents</span>
      </div>
      <form id="upload-form">
        <label class="upload-drop" id="upload-drop" for="file-input">
          <span class="upload-drop-icon">＋</span>
          <strong>Drop files here or browse</strong>
          <small>PDF, DOC, DOCX, PPT, PPTX or TXT · up to 20 MB per file</small>
          <input id="file-input" class="sr-only" type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.txt" aria-label="Choose study document files">
        </label>
        <div id="upload-error" class="upload-error" role="alert" hidden></div>
        <div class="selected-heading">
          <strong>Selected files</strong>
          <span id="file-count">0 files</span>
        </div>
        <div id="selected-files" class="selected-files" aria-live="polite">
          <div class="files-empty">Your chosen files will appear here.</div>
        </div>
        <div class="upload-field-grid">
          <div class="form-field">
            <label for="upload-subject">Subject</label>
            <input id="upload-subject" placeholder="e.g. Database Systems" required>
          </div>
          <div class="form-field">
            <label for="upload-kind">Document type</label>
            <select id="upload-kind">
              <option>Notes</option>
              <option>Question paper</option>
              <option>Memorandum</option>
              <option>Slides</option>
              <option>Assignment</option>
            </select>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="secondary-button" data-action="close">Cancel</button>
          <button class="primary-button" id="upload-submit" disabled>Add files to library</button>
        </div>
      </form>
    </div>
  `);

  let files = [];
  const fileInput = $('#file-input'), drop = $('#upload-drop'), selected = $('#selected-files'), errorBox = $('#upload-error'), submit = $('#upload-submit');
  const prettySize = size => size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;
  
  const updateSelection = () => {
    selected.innerHTML = files.length ? files.map((f, i) => `
      <div class="selected-file">
        <span class="file-icon ${f.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'notes'}">${esc(f.name.split('.').pop().toUpperCase())}</span>
        <span class="selected-file-copy">
          <strong>${esc(f.name)}</strong>
          <small>${prettySize(f.size)}</small>
        </span>
        <button type="button" class="remove-upload-file" data-remove-upload="${i}" aria-label="Remove ${esc(f.name)}">×</button>
      </div>
    `).join('') : '<div class="files-empty">Your chosen files will appear here.</div>';
    $('#file-count').textContent = `${files.length} file${files.length === 1 ? '' : 's'}`;
    submit.disabled = !files.length;
  };

  const addFiles = list => {
    errorBox.hidden = true;
    const valid = [], invalid = [];
    for (const file of list) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!['pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt'].includes(ext) || file.size > 20 * 1024 * 1024) invalid.push(file.name);
      else valid.push(file);
    }
    files = [...files, ...valid].slice(0, 10);
    if (invalid.length) errorBox.textContent = `Skipped unsupported or oversized files: ${invalid.join(', ')}. Choose supported files under 20 MB each.`;
    errorBox.hidden = !invalid.length;
    updateSelection();
  };

  fileInput.addEventListener('change', e => addFiles([...e.target.files]));
  selected.addEventListener('click', e => {
    const remove = e.target.closest('[data-remove-upload]');
    if (remove) {
      files.splice(Number(remove.dataset.removeUpload), 1);
      updateSelection();
    }
  });

  for (const eventName of ['dragenter', 'dragover']) drop.addEventListener(eventName, e => { e.preventDefault(); drop.classList.add('drag-over'); });
  for (const eventName of ['dragleave', 'drop']) drop.addEventListener(eventName, e => {
    e.preventDefault();
    drop.classList.remove('drag-over');
    if (eventName === 'drop') addFiles([...e.dataTransfer.files]);
  });

  $('#upload-form').addEventListener('submit', async e => {
    e.preventDefault();
    const subject = $('#upload-subject').value.trim(), kind = $('#upload-kind').value;
    if (!files.length) {
      errorBox.textContent = 'Choose at least one file first.';
      errorBox.hidden = false;
      return;
    }
    submit.disabled = true;
    submit.textContent = 'Processing files…';

    for (const f of files) {
      const ext = f.name.split('.').pop().toLowerCase();
      const type = ext === 'pdf' ? 'pdf' : ['ppt', 'pptx'].includes(ext) ? 'slides' : 'doc';
      let content = `Academic Material: ${f.name}\nSubject: ${subject}\nCategory: ${kind}\nSize: ${prettySize(f.size)}\n\nThis study document has been added to your local library. Click "Mark as Read" at the bottom once you have reviewed the key concepts.`;
      
      try {
        if (ext === 'txt') {
          content = await f.text();
        }
      } catch (err) {
        console.warn('Could not read file text:', err);
      }

      docs.unshift({
        id: crypto.randomUUID(),
        name: f.name,
        type,
        subject,
        size: prettySize(f.size),
        date: 'Just now',
        kind,
        progress: 0,
        read: false,
        content
      });
    }

    save();
    closeModal();
    // Requirement 1: Make accessible in "My Documents" screen immediately after upload
    setView('documents');
    toast(`✓ ${files.length} document${files.length === 1 ? '' : 's'} added! Click "Read / Open" to study.`);
  });
}

function openThemeModal() {
  const custom = customThemeVars || {
    bg: '#eaeef6',
    surface: '#dce1ee',
    border: '#000000',
    ink: '#141724',
    purple: '#5f50e6'
  };

  openModal(`
    <div style="padding:2px">
      <h2>Theme &amp; Palette Selection</h2>
      <p>Choose from curated color theme palettes, or customize the interface styling yourself.</p>
      <div class="palette-grid">
        ${Object.entries(PRESET_PALETTES).map(([id, p]) => `
          <div class="palette-card ${currentThemeId === id ? 'active' : ''}" data-palette-id="${esc(id)}">
            <div class="palette-preview">
              <span style="background:${p.vars['--bg']}"></span>
              <span style="background:${p.vars['--surface']};border:1px solid ${p.vars['--border-container']}"></span>
              <span style="background:${p.vars['--purple']}"></span>
            </div>
            <strong>${esc(p.name)}</strong>
            <small>${p.isDark ? 'Dark theme' : 'Light theme · black borders'}</small>
          </div>
        `).join('')}
      </div>
      <div class="custom-theme-box">
        <h3>🎨 Customise Your Own Palette</h3>
        <p style="font-size:10px;color:var(--muted);margin-bottom:10px">Pick custom colors for the background, widgets, borders, and accents.</p>
        <form id="custom-theme-form">
          <div class="custom-color-row">
            <label for="color-accent">Primary Accent</label>
            <input type="color" id="color-accent" value="${esc(custom.purple || '#5f50e6')}">
          </div>
          <div class="custom-color-row">
            <label for="color-bg">Background Color</label>
            <input type="color" id="color-bg" value="${esc(custom.bg || '#eaeef6')}">
          </div>
          <div class="custom-color-row">
            <label for="color-surface">Widget Surface Color</label>
            <input type="color" id="color-surface" value="${esc(custom.surface || '#dce1ee')}">
          </div>
          <div class="custom-color-row">
            <label for="color-border">Container Border Color</label>
            <input type="color" id="color-border" value="${esc(custom.border || '#000000')}">
          </div>
          <div class="custom-color-row">
            <label for="color-ink">Text &amp; Heading Color</label>
            <input type="color" id="color-ink" value="${esc(custom.ink || '#141724')}">
          </div>
          <div class="form-actions" style="margin-top:12px">
            <button type="button" class="secondary-button" id="reset-theme-btn">Reset to Default</button>
            <button type="submit" class="primary-button">Apply Custom Palette</button>
          </div>
        </form>
      </div>
    </div>
  `);

  $$('.palette-card').forEach(card => {
    card.addEventListener('click', () => {
      applyThemePalette(card.dataset.paletteId);
      closeModal();
      toast(`Theme updated to ${PRESET_PALETTES[card.dataset.paletteId].name}.`);
    });
  });

  $('#custom-theme-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const purple = $('#color-accent').value;
    const bg = $('#color-bg').value;
    const surface = $('#color-surface').value;
    const border = $('#color-border').value;
    const ink = $('#color-ink').value;
    
    // Determine luminance to set dark flag if needed
    const r = parseInt(bg.slice(1, 3), 16), g = parseInt(bg.slice(3, 5), 16), b = parseInt(bg.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const isDark = luminance < 0.5;

    const vars = {
      '--bg': bg,
      '--surface': surface,
      '--surface-2': surface,
      '--ink': ink,
      '--line': border,
      '--border-container': border,
      '--purple': purple,
      '--purple-2': purple + '33',
      isDark,
      purple,
      bg,
      surface,
      border,
      ink
    };

    applyThemePalette('custom', vars);
    closeModal();
    toast('Custom theme palette applied and saved!');
  });

  $('#reset-theme-btn')?.addEventListener('click', () => {
    applyThemePalette('slate-light');
    closeModal();
    toast('Reset to default Modern Slate theme.');
  });
}

function openAdSettingsModal() {
  const ctr = adImpressions ? ((adClicks / adImpressions) * 100).toFixed(1) : '0.0';
  openModal(`
    <div style="padding:2px">
      <h2>EduAssist Ad Network &amp; Revenue</h2>
      <p>Bottom-right pop-up ads display student-focused sponsors to generate platform revenue.</p>
      <div class="ad-stats-grid">
        <div class="ad-stat-box">
          <span>Total Ad Revenue</span>
          <strong style="color:#10b981">$${adRevenue.toFixed(2)}</strong>
        </div>
        <div class="ad-stat-box">
          <span>Ad Impressions</span>
          <strong>${adImpressions}</strong>
        </div>
        <div class="ad-stat-box">
          <span>Sponsor Clicks</span>
          <strong>${adClicks}</strong>
        </div>
        <div class="ad-stat-box">
          <span>Click-Through Rate</span>
          <strong>${ctr}%</strong>
        </div>
      </div>
      <div class="form-field">
        <label style="display:flex;align-items:center;gap:8px;font-size:12px">
          <input type="checkbox" id="ad-toggle-active" ${adsEnabled ? 'checked' : ''} style="width:auto">
          <span>Enable bottom-right pop-up ads and revenue generation</span>
        </label>
      </div>
      <div class="form-field">
        <label for="adsense-id">Google AdSense Publisher ID (Optional)</label>
        <input id="adsense-id" placeholder="pub-XXXXXXXXXXXXXXXX" value="${esc(storage.get('adsense-pub-id', ''))}">
        <small style="color:var(--muted)">Connect live Google AdSense tags for external ad loading.</small>
      </div>
      <div class="form-actions">
        <button class="secondary-button" data-action="close">Close</button>
        <button class="primary-button" id="save-ad-settings">Save Settings</button>
      </div>
    </div>
  `);

  $('#save-ad-settings')?.addEventListener('click', () => {
    adsEnabled = $('#ad-toggle-active').checked;
    storage.set('ads-enabled', adsEnabled);
    const pubId = $('#adsense-id').value.trim();
    if (pubId) storage.set('adsense-pub-id', pubId);
    else storage.remove('adsense-pub-id');
    closeModal();
    renderAdWidget();
    toast(adsEnabled ? 'Ads enabled! Loading bottom-right promotions.' : 'Ads disabled.');
  });
}

function addSessionModal() {
  openModal(`
    <h2>Plan a study session</h2>
    <p>Choose a topic and a time that works for you.</p>
    <form id="session-form">
      <div class="form-field">
        <label for="session-title">Topic or activity</label>
        <input id="session-title" required placeholder="e.g. Review database normalisation">
      </div>
      <div class="form-field">
        <label for="session-detail">Subject and duration</label>
        <input id="session-detail" placeholder="Database Systems · 30 min">
      </div>
      <div class="form-field">
        <label for="session-time">Start time</label>
        <input id="session-time" type="time" required value="15:00">
      </div>
      <div class="form-actions">
        <button type="button" class="secondary-button" data-action="close">Cancel</button>
        <button class="primary-button">Add session</button>
      </div>
    </form>
  `);
  $('#session-form').addEventListener('submit', e => {
    e.preventDefault();
    sessions.push({
      time: $('#session-time').value,
      title: $('#session-title').value.trim(),
      detail: $('#session-detail').value.trim() || 'Study session · 30 min',
      progress: 0
    });
    sessions.sort((a, b) => a.time.localeCompare(b.time));
    save();
    features.log('Planned a study session', sessions.at(-1)?.title || '');
    closeModal();
    render();
    toast('Study session added.');
  });
}

function addTaskModal() {
  openModal(`
    <h2>Add a study task</h2>
    <p>Break your study plan into a clear next step.</p>
    <form id="task-form">
      <div class="form-field">
        <label for="task-title">Task</label>
        <input id="task-title" required placeholder="e.g. Review chapter 4">
      </div>
      <div class="form-field">
        <label for="task-subject">Subject</label>
        <input id="task-subject" required placeholder="e.g. Computer Networks">
      </div>
      <div class="form-field">
        <label for="task-due">When</label>
        <input id="task-due" placeholder="e.g. Tomorrow">
      </div>
      <div class="form-actions">
        <button type="button" class="secondary-button" data-action="close">Cancel</button>
        <button class="primary-button">Add task</button>
      </div>
    </form>
  `);
  $('#task-form').addEventListener('submit', e => {
    e.preventDefault();
    tasks.unshift({
      id: crypto.randomUUID(),
      title: $('#task-title').value.trim(),
      subject: $('#task-subject').value.trim(),
      due: $('#task-due').value.trim() || 'No due date',
      tag: 'Study',
      done: false,
      progress: 0
    });
    save();
    features.log('Added a study task', tasks[0].title);
    closeModal();
    render();
    toast('Task added to your planner.');
  });
}

function matchPapers() {
  const papers = docs.filter(d => d.kind === 'Question paper'), memos = docs.filter(d => d.kind === 'Memorandum');
  const pairs = papers.map(p => ({ paper: p, memo: memos.find(m => m.subject === p.subject) || null }));
  openModal(`
    <h2>Question paper matcher</h2>
    <p>Pair question papers with memorandums using the subject label on each document.</p>
    ${pairs.length ? pairs.map(pair => `
      <div class="planner-task">
        <div style="flex:1">
          <strong>${esc(pair.paper.name)}</strong>
          <small>${esc(pair.paper.subject)}</small>
        </div>
        <span class="tag ${pair.memo ? 'green' : 'orange'}">${pair.memo ? 'Memo found' : 'No matching memo'}</span>
      </div>
    `).join('') : '<div class="empty-state"><strong>No question papers found</strong><p>Add a question paper to see matching memorandums here.</p></div>'}
    <div class="form-actions"><button class="primary-button" data-action="close">Done</button></div>
  `);
}

document.addEventListener('click', e => {
  const authAction = e.target.closest('[data-auth-action]')?.dataset.authAction;
  if (authAction === 'show-register') { authModal('register'); return; }
  if (authAction === 'show-login') { authModal('login'); return; }
  if (authAction === 'logout') { logout(); return; }
  if (authAction === 'resend') {
    api.resendCode({ email: pendingEmail }).then(result => authModal('verify', { email: pendingEmail, notice: result.message })).catch(error => authModal('verify', { email: pendingEmail, error: error.message }));
    return;
  }

  // Ad triggers
  if (e.target.closest('#ad-revenue-trigger')) {
    openAdSettingsModal();
    return;
  }
  if (e.target.closest('#ad-min-trigger')) {
    adMinimized = true;
    storage.set('ad-minimized', true);
    renderAdWidget();
    return;
  }
  if (e.target.closest('#ad-expand-btn')) {
    adMinimized = false;
    storage.set('ad-minimized', false);
    renderAdWidget();
    return;
  }
  if (e.target.closest('#ad-close-trigger')) {
    adMinimized = true;
    storage.set('ad-minimized', true);
    renderAdWidget();
    toast('Ad minimized to revenue pill.');
    return;
  }
  if (e.target.closest('#ad-click-area')) {
    recordAdClick();
    return;
  }

  // Read / Open document trigger (Requirement 1 & 2)
  const readDocBtn = e.target.closest('[data-read-doc]');
  if (readDocBtn) {
    const doc = docs.find(d => d.id === readDocBtn.dataset.readDoc);
    if (doc) openDocumentReaderModal(doc);
    return;
  }

  // Mark session as done / read trigger (Requirement 2)
  const sessionMarkBtn = e.target.closest('[data-session-mark-done]');
  if (sessionMarkBtn) {
    const idx = Number(sessionMarkBtn.dataset.sessionMarkDone);
    const s = sessions[idx];
    if (s) {
      s.progress = 100;
      save();
      features.log('Completed a study session', `${s.title} · 100%`);
      toast(`✓ Session "${s.title}" marked as read & done! Progress updated.`);
      render();
    }
    return;
  }

  if (features.onClick(e)) return;
  const nav = e.target.closest('[data-view]');
  if (nav) { setView(nav.dataset.view); return; }

  const action = e.target.closest('[data-action]')?.dataset.action;
  if (action === 'upload') uploadModal();
  else if (action === 'assistant') setView('assistant');
  else if (action === 'add-session') addSessionModal();
  else if (action === 'add-task') addTaskModal();
  else if (action === 'match') matchPapers();
  else if (action === 'close') closeModal();
  else if (action === 'exit-quiz') { activeQuiz = null; render(); }
  else if (action === 'reset-data') {
    if (confirm('Reset all Edu-Assist data saved in this browser?')) {
      Object.keys(localStorage).filter(k => k.startsWith('eduassist.')).forEach(k => localStorage.removeItem(k));
      location.reload();
    }
  }

  const filterButton = e.target.closest('[data-filter]');
  if (filterButton) { filter = filterButton.dataset.filter; renderDocuments(); }

  const del = e.target.closest('[data-delete-doc]');
  if (del) {
    docs = docs.filter(d => d.id !== del.dataset.deleteDoc);
    save();
    render();
    toast('Document removed from your library.');
  }

  const delSession = e.target.closest('[data-delete-session]');
  if (delSession) {
    sessions.splice(Number(delSession.dataset.deleteSession), 1);
    save();
    render();
    toast('Session removed.');
  }

  const start = e.target.closest('[data-start-quiz]');
  if (start) {
    activeQuiz = sampleQuizzes.find(q => q.id === start.dataset.startQuiz);
    quizIndex = 0;
    quizCorrect = 0;
    render();
  }
});

document.addEventListener('change', e => {
  if (features.onChange(e)) return;
  const progressControl = e.target.closest('[data-progress-task]');
  if (progressControl) {
    const task = tasks.find(t => t.id === progressControl.dataset.progressTask);
    if (task) {
      task.progress = Number(progressControl.value);
      task.done = task.progress === 100;
      save();
      features.log(task.done ? 'Completed a study task' : 'Updated activity progress', `${task.title} · ${task.progress}%`);
      render();
    }
    return;
  }
  const sessionControl = e.target.closest('[data-session-progress]');
  if (sessionControl) {
    const session = sessions[Number(sessionControl.dataset.sessionProgress)];
    if (session) {
      session.progress = Number(sessionControl.value);
      save();
      features.log(session.progress === 100 ? 'Completed a study session' : 'Updated session progress', `${session.title} · ${session.progress}%`);
      render();
    }
    return;
  }
  const box = e.target.closest('[data-task]');
  if (box) {
    const task = tasks.find(t => t.id === box.dataset.task);
    if (task) {
      task.done = box.checked;
      task.progress = box.checked ? 100 : 0;
    }
    save();
    features.log(box?.checked ? 'Completed a study task' : 'Reopened a study task', task?.title || '');
    render();
  }
});

document.addEventListener('input', e => {
  const slider = e.target.closest('[data-progress-task],[data-session-progress]');
  if (!slider) return;
  const detail = slider.closest('.task-detail, .session-progress'), progress = Number(slider.value);
  $('.activity-track .progress-fill', detail).style.width = `${progress}%`;
  $('.activity-progress-head span', detail).textContent = progress === 100 ? 'Done' : progress === 0 ? 'Not started' : 'In progress';
  $('.activity-progress-head b', detail).textContent = `${progress}%`;
});

document.addEventListener('submit', e => {
  if (features.onSubmit(e)) return;
  if (e.target.id === 'auth-form') {
    e.preventDefault();
    submitAuth(e.target);
    return;
  }
  if (e.target.id === 'answer-form') {
    e.preventDefault();
    const selected = $('input[name="answer"]:checked', e.target);
    if (!selected) {
      toast('Choose an answer to continue.');
      return;
    }
    if (Number(selected.value) === activeQuiz.questionsData[quizIndex].answer) quizCorrect++;
    quizIndex++;
    if (quizIndex >= activeQuiz.questions) {
      const finishedQuiz = activeQuiz, correct = quizCorrect, percent = Math.round(correct / finishedQuiz.questions * 100);
      quizScores.push({
        title: finishedQuiz.title,
        percent,
        correct,
        total: finishedQuiz.questions,
        date: new Date().toLocaleDateString('en-ZA')
      });
      save();
      features.log('Completed a practice quiz', `${finishedQuiz.title} · ${percent}%`);
      activeQuiz = null;
      render();
      openModal(`
        <div style="text-align:center;padding:14px 0">
          <span class="stat-icon ${percent >= 70 ? 'green' : 'orange'}" style="margin:auto;width:48px;height:48px;font-size:22px">${percent >= 70 ? '✓' : '◇'}</span>
          <h2 style="margin:16px 0 5px">${percent >= 70 ? 'Nice work!' : 'Good practice!'}</h2>
          <p>You got <b>${correct} of ${finishedQuiz.questions}</b> correct (${percent}%). Practice makes progress.</p>
          <div style="margin:16px 0">
            <button class="mark-read-btn" id="quiz-mark-read-btn" style="margin:auto">✓ Mark Quiz as Read &amp; Completed (100%)</button>
          </div>
          <div class="confidence-row" style="justify-content:center">
            <span>How did that topic feel?</span>
            <button class="confidence-chip" data-feature-action="confidence" data-value="got-it" data-topic="${esc(finishedQuiz.subject)}" data-module-code="${esc(finishedQuiz.subject)}">Got it</button>
            <button class="confidence-chip" data-feature-action="confidence" data-value="unsure" data-topic="${esc(finishedQuiz.subject)}" data-module-code="${esc(finishedQuiz.subject)}">Unsure</button>
            <button class="confidence-chip" data-feature-action="confidence" data-value="need-help" data-topic="${esc(finishedQuiz.subject)}" data-module-code="${esc(finishedQuiz.subject)}">Need help</button>
          </div>
          <div class="form-actions" style="justify-content:center">
            <button class="primary-button" data-action="close">Back to quizzes</button>
          </div>
        </div>
      `);
      $('#quiz-mark-read-btn')?.addEventListener('click', () => {
        closeModal();
        toast('✓ Quiz marked as read & completed! Progress bar updated.');
        render();
      });
    } else {
      render();
    }
  }
});

$('#modal-close').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
$('#mobile-menu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

// Requirement 6: Mode button opens theme palettes & custom theme picker
$('#theme-toggle').addEventListener('click', () => openThemeModal());

$('#help-button').addEventListener('click', () => openModal(`
  <h2>Welcome to Edu-Assist</h2>
  <p>Your study space brings documents, study plans, past-paper practice, interactive study chat and learning progress together.</p>
  <div class="form-actions">
    <button class="secondary-button" data-action="reset-data">Reset data</button>
    <button class="primary-button" data-action="close">Got it</button>
  </div>
`));

$('#auth-button').addEventListener('click', () => authUser ? logout() : authModal('login'));
$('#profile-button').addEventListener('click', () => authUser ? openModal(`
  <h2>${esc(authUser.name)}</h2>
  <p>${esc(authUser.email)} · Verified student account</p>
  <div class="form-actions">
    <button class="secondary-button" data-action="close">Close</button>
    <button class="primary-button" data-auth-action="logout">Log out</button>
  </div>
`) : authModal('login'));

$('#top-low-data').addEventListener('click', () => {
  document.body.classList.toggle('low-data');
  storage.set('low-data', document.body.classList.contains('low-data'));
  toast(`Low-data view ${document.body.classList.contains('low-data') ? 'on' : 'off'}.`);
  if (['map', 'stream'].includes(view)) render();
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}

$('#today-label').textContent = today.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

// Initialize theme palette
applyThemePalette(currentThemeId, customThemeVars);
syncAuthUi();
render();
startAdRotation();

