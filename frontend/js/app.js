/* ===== STATE ===== */
let currentView = 'active';
let todos = [];
let completedTodos = [];
let calendarTodos = [];
let calendarDate = new Date();
let calendarSelected = null;
let editingId = null;
let detailId = null;

/* ===== DOM REFS ===== */
const $ = (id) => document.getElementById(id);

const authScreen    = $('auth-screen');
const app           = $('app');
const loginForm     = $('login-form');
const regForm       = $('register-form');
const loginError    = $('login-error');
const regError      = $('reg-error');
const authTabs      = document.querySelectorAll('.auth-tab');
const navItems      = document.querySelectorAll('.nav-item');
const pageTitle     = $('page-title');
const todoCount     = $('todo-count');
const todoList      = $('todo-list');
const completedList = $('completed-list');
const newTodoBtn    = $('new-todo-btn');
const exportBtn     = $('export-btn');
const todoModal     = $('todo-modal');
const detailModal   = $('detail-modal');
const todoForm      = $('todo-form');
const toast         = $('toast');

/* ===== INIT ===== */
(async () => {
  if (api.token) {
    try {
      const { user } = await api.me();
      showApp(user);
    } catch {
      api.setToken(null);
    }
  }
})();

/* ===== AUTH TABS ===== */
authTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    authTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    $('login-form').classList.toggle('hidden', tab.dataset.tab !== 'login');
    $('register-form').classList.toggle('hidden', tab.dataset.tab !== 'register');
  });
});

/* ===== LOGIN ===== */
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  try {
    const { token, user } = await api.login($('login-email').value, $('login-password').value);
    api.setToken(token);
    showApp(user);
  } catch (err) {
    loginError.textContent = err.message;
  }
});

/* ===== REGISTER ===== */
regForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  regError.textContent = '';
  try {
    const { token, user } = await api.register($('reg-username').value, $('reg-email').value, $('reg-password').value);
    api.setToken(token);
    showApp(user);
  } catch (err) {
    regError.textContent = err.message;
  }
});

/* ===== LOGOUT ===== */
$('logout-btn').addEventListener('click', () => {
  api.setToken(null);
  localStorage.removeItem('tf_view');
  app.classList.add('hidden');
  authScreen.classList.remove('hidden');
  showToast('Ausgeloggt', 'success');
});

/* ===== SHOW APP ===== */
function showApp(user) {
  authScreen.classList.add('hidden');
  app.classList.remove('hidden');
  $('user-name').textContent = user.username;
  $('user-avatar').textContent = user.username[0].toUpperCase();
  const savedView = localStorage.getItem('tf_view') || 'active';
  loadView(savedView);
}

/* ===== NAVIGATION ===== */
navItems.forEach(item => {
  item.addEventListener('click', () => {
    navItems.forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    loadView(item.dataset.view);
    // Close mobile sidebar
    document.querySelector('.sidebar').classList.remove('open');
  });
});

function loadView(view) {
  currentView = view;
  localStorage.setItem('tf_view', view);
  ['active','completed','calendar'].forEach(v => {
    $('view-' + v).classList.toggle('hidden', v !== view);
  });
  navItems.forEach(n => n.classList.toggle('active', n.dataset.view === view));
  const titles = { active: 'Aufgaben', completed: 'Erledigt', calendar: 'Kalender' };
  pageTitle.textContent = titles[view];
  exportBtn.classList.toggle('hidden', view === 'calendar');
  if (view === 'active') loadTodos();
  else if (view === 'completed') loadCompleted();
  else loadCalendar();
}

/* ===== LOAD DATA ===== */
async function loadTodos() {
  try { todos = await api.getTodos(); renderTodos(); }
  catch (err) { showToast(err.message, 'error'); }
}
async function loadCompleted() {
  try { completedTodos = await api.getCompleted(); renderCompleted(); }
  catch (err) { showToast(err.message, 'error'); }
}
async function loadCalendar() {
  try {
    calendarTodos = await api.getCalendar();
    renderCalendar();
    // Auto-select today if it has todos
    const today = new Date();
    const hasTodayTodos = calendarTodos.some(t => {
      const d = new Date(t.dueDate);
      return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    });
    if (hasTodayTodos) selectCalDay(today);
  }
  catch (err) { showToast(err.message, 'error'); }
}

/* ===== RENDER ===== */
function renderTodos() {
  todoList.innerHTML = '';
  if (todos.length === 0) {
    todoList.innerHTML = '<div class="empty-state"><div class="empty-icon">◈</div><p>Keine offenen Aufgaben</p><span>Erstelle deine erste Aufgabe</span></div>';
    todoCount.textContent = '0'; return;
  }
  todoCount.textContent = todos.length;
  todos.forEach(t => todoList.appendChild(createTodoCard(t, false)));
}

function renderCompleted() {
  completedList.innerHTML = '';
  if (completedTodos.length === 0) {
    completedList.innerHTML = '<div class="empty-state"><div class="empty-icon">◉</div><p>Noch nichts erledigt</p><span>Erledigte Aufgaben erscheinen hier</span></div>';
    todoCount.textContent = '0'; return;
  }
  todoCount.textContent = completedTodos.length;
  completedTodos.forEach(t => completedList.appendChild(createTodoCard(t, true)));
}

function createTodoCard(todo, isCompleted) {
  const card = document.createElement('div');
  card.className = 'todo-card' + (isCompleted ? ' completed-card' : '');
  card.dataset.id = todo._id;

  const cb = document.createElement('div');
  cb.className = 'todo-checkbox' + (isCompleted ? ' checked' : '');
  
  if (!isCompleted) {
    cb.addEventListener('click', async (e) => {
      e.stopPropagation();
      await completeTodoAnimated(todo._id, card, cb);
    });
  }
  card.appendChild(cb);

  const info = document.createElement('div');
  info.className = 'todo-info';
  const title = document.createElement('div');
  title.className = 'todo-title';
  title.textContent = todo.title;
  info.appendChild(title);

  if (todo.dueDate) {
    const dueDate = new Date(todo.dueDate);
    const isOverdue = !isCompleted && dueDate < new Date();
    const due = document.createElement('div');
    due.className = 'todo-due' + (isOverdue ? ' overdue' : '');
    const opts = { day: '2-digit', month: '2-digit', year: 'numeric' };
    if (todo.hasTime) { opts.hour = '2-digit'; opts.minute = '2-digit'; }
    due.innerHTML = '<span class="todo-due-icon">📅</span> ' + dueDate.toLocaleString('de-CH', opts);
    info.appendChild(due);
  }
  card.appendChild(info);

  if (isCompleted) {
    const restore = document.createElement('button');
    restore.className = 'todo-restore-btn';
    restore.textContent = 'Wiederherstellen';
    restore.addEventListener('click', async (e) => { e.stopPropagation(); await restoreTodo(todo._id); });
    card.appendChild(restore);
  }

  card.addEventListener('click', () => openDetail(todo));
  return card;
}

/* ===== CHECK ANIMATION ===== */
async function completeTodoAnimated(id, card, cb) {
  // Prevent double-click
  cb.style.pointerEvents = 'none';

  // Animate checkbox fill
  cb.classList.add('checking');
  cb.innerHTML = `<svg class="check-svg" viewBox="0 0 36 36">
    <circle class="check-bg" cx="18" cy="18" r="16" fill="#2563eb" opacity="0"/>
    <polyline class="check-mark" points="10,18 15,23 26,12" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="30" stroke-dashoffset="30"/>
  </svg>`;

  // Animate SVG elements
  const bg = cb.querySelector('.check-bg');
  const mark = cb.querySelector('.check-mark');
  bg.animate([{opacity:0,r:6},{opacity:1,r:16}], {duration:250, fill:'forwards', easing:'cubic-bezier(0.34,1.56,0.64,1)'});
  mark.animate([{'stroke-dashoffset':30},{'stroke-dashoffset':0}], {duration:300, delay:120, fill:'forwards', easing:'ease-out'});

  // Particle burst
  spawnParticles(cb);

  // Scale pulse on card
  card.animate([{transform:'scale(1)'},{transform:'scale(1.015)'},{transform:'scale(1)'}], {duration:300, easing:'ease-in-out'});

  await new Promise(r => setTimeout(r, 550));

  // Slide & fade out
  const h = card.offsetHeight;
  card.animate([
    {opacity:1, maxHeight: h+'px', marginBottom:'10px', transform:'translateX(0)'},
    {opacity:0, maxHeight:'0px',   marginBottom:'0px',  transform:'translateX(60px)'}
  ], {duration:320, fill:'forwards', easing:'cubic-bezier(0.4,0,1,1)'});

  await new Promise(r => setTimeout(r, 330));

  try {
    await api.completeTodo(id);
    showToast('Erledigt! 🎉', 'success');
    await loadTodos();
  } catch (err) {
    showToast(err.message, 'error');
    await loadTodos();
  }
}

function spawnParticles(origin) {
  const rect = origin.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const colors = ['#3b82f6','#60a5fa','#93c5fd','#2563eb','#bfdbfe','#dbeafe','#1d4ed8'];
  for (let i = 0; i < 14; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const angle = (i / 14) * 360 + Math.random() * 15;
    const dist = 28 + Math.random() * 44;
    const rad = (angle * Math.PI) / 180;
    const tx = Math.cos(rad) * dist;
    const ty = Math.sin(rad) * dist;
    const size = 4 + Math.random() * 7;
    const shape = Math.random() > 0.4 ? '50%' : '2px';
    p.style.cssText = `left:${cx}px;top:${cy}px;width:${size}px;height:${size}px;background:${colors[i%colors.length]};border-radius:${shape};--tx:${tx}px;--ty:${ty}px;`;
    document.body.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  }
}

/* ===== ACTIONS ===== */
async function restoreTodo(id) {
  try { await api.restoreTodo(id); showToast('Aufgabe wiederhergestellt'); await loadCompleted(); }
  catch (err) { showToast(err.message, 'error'); }
}

/* ===== MODAL ===== */
newTodoBtn.addEventListener('click', () => openModal());

function openModal(todo = null) {
  editingId = todo?._id || null;
  $('modal-title').textContent = todo ? 'Aufgabe bearbeiten' : 'Neue Aufgabe';
  $('modal-submit').textContent = todo ? 'Speichern' : 'Erstellen';
  $('todo-title').value = todo?.title || '';
  $('todo-desc').value  = todo?.description || '';
  $('todo-edit-id').value = todo?._id || '';
  if (todo?.dueDate) {
    const d = new Date(todo.dueDate);
    $('todo-date').value = d.toISOString().split('T')[0];
    $('todo-time').value = todo.hasTime ? String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0') : '';
  } else {
    $('todo-date').value = '';
    $('todo-time').value = '';
  }
  todoModal.classList.remove('hidden');
  setTimeout(() => $('todo-title').focus(), 50);
}

function closeModal() { todoModal.classList.add('hidden'); }
$('modal-close').addEventListener('click', closeModal);
$('modal-cancel').addEventListener('click', closeModal);
todoModal.addEventListener('click', (e) => { if (e.target === todoModal) closeModal(); });

todoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = $('todo-title').value.trim();
  const description = $('todo-desc').value.trim();
  const dateStr = $('todo-date').value;
  const timeStr = $('todo-time').value;
  let dueDate = null, hasTime = false;
  if (dateStr) {
    dueDate = new Date(timeStr ? dateStr+'T'+timeStr : dateStr+'T12:00:00').toISOString();
    hasTime = !!timeStr;
  }
  try {
    if (editingId) { await api.updateTodo(editingId, { title, description, dueDate, hasTime }); showToast('Aufgabe aktualisiert'); }
    else { await api.createTodo({ title, description, dueDate, hasTime }); showToast('Aufgabe erstellt', 'success'); }
    closeModal();
    if (currentView === 'active') await loadTodos();
    else if (currentView === 'completed') await loadCompleted();
    else await loadCalendar();
  } catch (err) { showToast(err.message, 'error'); }
});

/* ===== DETAIL ===== */
function openDetail(todo) {
  detailId = todo._id;
  $('detail-title').textContent = todo.title;
  const meta = $('detail-meta');
  meta.innerHTML = '';
  if (todo.dueDate) {
    const d = new Date(todo.dueDate);
    const opts = { day:'2-digit', month:'2-digit', year:'numeric' };
    if (todo.hasTime) { opts.hour='2-digit'; opts.minute='2-digit'; }
    const isOverdue = !todo.completed && d < new Date();
    const badge = document.createElement('span');
    badge.className = 'detail-badge' + (isOverdue ? ' overdue' : '');
    badge.textContent = '📅 ' + d.toLocaleString('de-CH', opts);
    meta.appendChild(badge);
  }
  if (todo.completed) {
    const b = document.createElement('span');
    b.className = 'detail-badge'; b.textContent = '✓ Erledigt';
    meta.appendChild(b);
  }
  $('detail-desc').textContent = todo.description || 'Keine Beschreibung vorhanden.';
  $('detail-complete-btn').classList.toggle('hidden', todo.completed);
  $('detail-edit-btn').classList.toggle('hidden', todo.completed);
  detailModal.classList.remove('hidden');
}

function closeDetail() { detailModal.classList.add('hidden'); }
$('detail-close').addEventListener('click', closeDetail);
detailModal.addEventListener('click', (e) => { if (e.target === detailModal) closeDetail(); });

$('detail-complete-btn').addEventListener('click', async () => {
    try {
    await api.completeTodo(detailId);
    showToast('Aufgabe erledigt! 🎉', 'success');
    closeDetail();
    if (currentView === 'active') await loadTodos();
    else if (currentView === 'completed') await loadCompleted();
    else await loadCalendar();
  } catch (err) { showToast(err.message, 'error'); }
});

$('detail-edit-btn').addEventListener('click', () => {
  const todo = [...todos, ...completedTodos].find(t => t._id === detailId);
  if (todo) { closeDetail(); openModal(todo); }
});

$('detail-delete-btn').addEventListener('click', async () => {
  if (!confirm('Aufgabe wirklich löschen?')) return;
  try {
    await api.deleteTodo(detailId);
    showToast('Aufgabe gelöscht');
    closeDetail();
    if (currentView === 'active') await loadTodos();
    else if (currentView === 'completed') await loadCompleted();
    else await loadCalendar();
  } catch (err) { showToast(err.message, 'error'); }
});

/* ===== EXPORT ===== */
exportBtn.addEventListener('click', () => {
  api.exportPdf(currentView === 'completed' ? 'completed' : 'active');
  showToast('PDF wird erstellt…');
});

/* ===== CALENDAR ===== */
function renderCalendar() {
  const grid = $('calendar-grid');
  grid.innerHTML = '';
  $('cal-month-label').textContent = calendarDate.toLocaleString('de-CH', { month:'long', year:'numeric' });
  ['Mo','Di','Mi','Do','Fr','Sa','So'].forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-day-name'; el.textContent = d;
    grid.appendChild(el);
  });
  const year = calendarDate.getFullYear(), month = calendarDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month+1, 0);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  for (let i = 0; i < startWeekday; i++) {
    const e = document.createElement('div'); e.className='cal-day empty'; grid.appendChild(e);
  }
  const today = new Date();
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dayDate = new Date(year, month, d);
    const el = document.createElement('div');
    el.className = 'cal-day';
    if (today.getDate()===d && today.getMonth()===month && today.getFullYear()===year) el.classList.add('today');
    const hasTodos = calendarTodos.some(t => {
      const td = new Date(t.dueDate);
      return td.getDate()===d && td.getMonth()===month && td.getFullYear()===year;
    });
    if (hasTodos) el.classList.add('has-todos');
    if (calendarSelected) {
      const s = calendarSelected;
      if (s.getDate()===d && s.getMonth()===month && s.getFullYear()===year) el.classList.add('selected');
    }
    el.textContent = d;
    el.addEventListener('click', () => selectCalDay(dayDate));
    grid.appendChild(el);
  }
}

function selectCalDay(date) {
  calendarSelected = date;
  $('cal-selected-date').textContent = date.toLocaleDateString('de-CH', { weekday:'long', day:'numeric', month:'long' });
  const dayTodos = calendarTodos.filter(t => {
    const td = new Date(t.dueDate);
    return td.getDate()===date.getDate() && td.getMonth()===date.getMonth() && td.getFullYear()===date.getFullYear();
  });
  const list = $('cal-day-todos');
  list.innerHTML = '';
  if (dayTodos.length === 0) {
    list.innerHTML = '<p class="cal-no-todos">Keine Aufgaben an diesem Tag</p>';
  } else {
    dayTodos.forEach(t => {
      const item = document.createElement('div');
      item.className = 'cal-todo-item' + (t.completed ? ' cal-completed' : '');
      const td = new Date(t.dueDate);
      const timeStr = t.hasTime ? td.toLocaleTimeString('de-CH', { hour:'2-digit', minute:'2-digit' }) : 'Ganzer Tag';
      item.innerHTML = '<div class="cal-todo-title">'+(t.completed?'✓ ':'')+t.title+'</div><div class="cal-todo-time">🕐 '+timeStr+'</div>';
      item.addEventListener('click', () => openDetail(t));
      list.appendChild(item);
    });
  }
  renderCalendar();
}

$('cal-prev').addEventListener('click', () => {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth()-1, 1); renderCalendar();
});
$('cal-next').addEventListener('click', () => {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth()+1, 1); renderCalendar();
});

/* ===== TOAST ===== */
let toastTimer;
function showToast(msg, type='') {
  toast.textContent = msg;
  toast.className = 'toast'+(type?' '+type:'');
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3000);
}

/* ===== MOBILE MENU TOGGLE ===== */
const menuToggle = $('menu-toggle');
const sidebar = document.querySelector('.sidebar');
if (menuToggle) {
  menuToggle.addEventListener('click', (e) => { e.stopPropagation(); sidebar.classList.toggle('open'); });
  document.addEventListener('click', (e) => {
    if (sidebar.classList.contains('open') && !sidebar.contains(e.target)) sidebar.classList.remove('open');
  });
}
