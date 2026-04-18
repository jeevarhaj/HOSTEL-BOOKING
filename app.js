const API_BASE = "http://10.3.54.32:8080";

let currentUser   = null;
let allRooms      = [];
let bookingRoomId = null;
let refreshTimer  = null;

// ── AUTH ──────────────────────────────────────
function login() {
  const u   = document.getElementById('username').value.trim();
  const p   = document.getElementById('password').value.trim();
  const err = document.getElementById('login-error');
  if (!u || !p) { showErr(err, 'Fill all fields.'); return; }
  if (u === 'admin' && p === 'admin1234') {
    currentUser = { username: u, role: 'admin', id: 'ADMIN' };
  } else if (p.startsWith('RA')) {
    currentUser = { username: u, role: 'student', id: p };
  } else {
    showErr(err, 'Invalid credentials. Student password must start with RA.'); return;
  }
  err.classList.add('hidden');
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('role-badge').textContent = currentUser.role === 'admin' ? 'Admin' : 'Student';
  document.getElementById('user-chip').textContent  = u;
  applyRoleNav();
  startRefresh();
  navigate('dashboard', document.querySelector('[data-page="dashboard"]'));
}

function applyRoleNav() {
  document.getElementById('nav-my-room').style.display  = currentUser.role === 'admin'   ? 'none' : '';
  document.getElementById('nav-reports').style.display  = currentUser.role === 'student' ? 'none' : '';
}

function logout() {
  clearInterval(refreshTimer);
  currentUser = null; allRooms = [];
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
}

// ── NAVIGATION ────────────────────────────────
function navigate(page, el) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');
  const titles = { dashboard:'Dashboard','all-rooms':'All Rooms', reports:'Reports','my-room':'My Room' };
  document.getElementById('page-title').textContent = titles[page] || page;
  loadPage(page);
  return false;
}

// ── DATA FETCH ────────────────────────────────
async function fetchRooms() {
  try {
    const res  = await fetch(`${API_BASE}/api/rooms`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) { console.error('fetchRooms error:', e); return []; }
}

async function loadPage(page) {
  allRooms = await fetchRooms();
  console.log('loadPage:', page, 'rooms:', allRooms.length);
  if      (page === 'dashboard') renderDashboard();
  else if (page === 'all-rooms') renderAllRooms();
  else if (page === 'reports')   renderReports();
  else if (page === 'my-room')   renderMyRoom();
}

// ── HELPERS ───────────────────────────────────
function roomStatusClass(r) {
  if (r.status === 'occupied') return 'occupied';
  if (r.status === 'partial')  return 'partial';
  return 'vacant';
}

function roomLabel(r) {
  const cap = r.capacity, occ = r.occupied || 0;
  if (cap === 1) return occ ? 'Occupied' : 'Vacant';
  return `${cap} Sharing (${occ}/${cap} filled)`;
}

function vacantSlots(r) { return (r.capacity || 0) - (r.occupied || 0); }

// ── DASHBOARD ─────────────────────────────────
function renderDashboard() {
  const total    = allRooms.length;
  const fullyOcc = allRooms.filter(r => r.status === 'occupied').length;
  const partial  = allRooms.filter(r => r.status === 'partial').length;
  const vacant   = allRooms.filter(r => r.status === 'vacant').length;
  const totalOcc = allRooms.reduce((s, r) => s + (r.occupied || 0), 0);
  const totalCap = allRooms.reduce((s, r) => s + (r.capacity || 0), 0);
  const pct      = totalCap ? Math.round(totalOcc / totalCap * 100) : 0;

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card blue" ><div class="stat-icon">🏠</div><div class="stat-label">Total Rooms</div><div class="stat-value">${total}</div></div>
    <div class="stat-card green"><div class="stat-icon">✓</div><div class="stat-label">Vacant</div><div class="stat-value">${vacant}</div></div>
    <div class="stat-card red"  ><div class="stat-icon">👤</div><div class="stat-label">Full</div><div class="stat-value">${fullyOcc}</div></div>
    <div class="stat-card amber"><div class="stat-icon">⚡</div><div class="stat-label">Partial / Occupancy</div><div class="stat-value">${partial} · ${pct}%</div></div>`;

  document.getElementById('dash-rooms-grid').innerHTML =
    allRooms.map(r => roomCard(r, false)).join('');
}

// ── ALL ROOMS ─────────────────────────────────
function renderAllRooms() {
  document.getElementById('all-rooms-grid').innerHTML =
    allRooms.map(r => roomCard(r, true)).join('');
}

// ── ROOM CARD ─────────────────────────────────
function roomCard(r, showActions) {
  const isAdmin = currentUser.role === 'admin';
  const sc      = roomStatusClass(r);
  const slots   = vacantSlots(r);
  const label   = roomLabel(r);
  const students = Array.isArray(r.students) ? r.students : [];

  let studentsHtml = '';
  if (students.length > 0) {
    const canSee = isAdmin || students.some(s => s.id === currentUser.id);
    if (canSee) {
      studentsHtml = students.map(s =>
        `<div class="room-student">👤 ${s.name} <span style="opacity:.5;font-size:11px">${s.id}</span></div>`
      ).join('');
    }
  }

  let actions = '';
  if (showActions) {
  if (isAdmin) {
    // ✅ ADMIN
    if (students.length > 0) {
      actions = `<div class="room-actions">
        <button class="btn-vacate" onclick="vacateRoom(${r.id})">Vacate All</button>
      </div>`;
    }
  } else {
    // ✅ STUDENT

    const alreadyBooked = allRooms.some(room =>
      (room.students || []).some(s => s.id === currentUser.id)
    );

    if (!alreadyBooked && slots > 0) {
      actions = `<div class="room-actions">
        <button class="btn-book" onclick="openBook(${r.id})">
          Book (${slots} slot${slots > 1 ? 's' : ''} left)
        </button>
      </div>`;
    }
  }
}
  
  return `
    <div class="room-card ${sc}">
      <div class="room-number">Room ${r.id}</div>
      <div class="room-type">${r.type} · Cap: ${r.capacity}</div>
      <span class="room-status ${sc}">${label}</span>
      <div class="room-vacant-info">${slots > 0 ? `Vacant slots: ${slots}` : 'Full'}</div>
      ${studentsHtml}
      ${actions}
    </div>`;
}

// ── REPORTS ───────────────────────────────────
function renderReports() {
  const total    = allRooms.length;
  const totalOcc = allRooms.reduce((s, r) => s + (r.occupied || 0), 0);
  const totalCap = allRooms.reduce((s, r) => s + (r.capacity || 0), 0);
  const fullyOcc = allRooms.filter(r => r.status === 'occupied').length;
  const partial  = allRooms.filter(r => r.status === 'partial').length;
  const vacant   = allRooms.filter(r => r.status === 'vacant').length;
  const pct      = totalCap ? Math.round(totalOcc / totalCap * 100) : 0;

  const byType = {};
  allRooms.forEach(r => {
    if (!byType[r.type]) byType[r.type] = { rooms: 0, occ: 0, cap: 0 };
    byType[r.type].rooms++;
    byType[r.type].occ += (r.occupied || 0);
    byType[r.type].cap += (r.capacity || 0);
  });

  const typeRows = Object.entries(byType).map(([t, d]) =>
    `<div class="report-row">
      <span class="report-label">${t} (${d.rooms} rooms)</span>
      <span class="report-val">${d.occ}/${d.cap} beds</span>
    </div>`).join('');

  const allStudents = allRooms.flatMap(r =>
    (Array.isArray(r.students) ? r.students : []).map(s => ({ ...s, roomId: r.id })));

  const studentRows = allStudents.length
    ? allStudents.map(s =>
        `<div class="report-row">
          <span class="report-label">Room ${s.roomId} · ${s.name}</span>
          <span class="report-val" style="font-size:12px;color:var(--text2)">${s.id}</span>
        </div>`).join('')
    : `<div class="report-row"><span class="report-label" style="color:var(--text3)">No students assigned</span></div>`;

  document.getElementById('reports-wrap').innerHTML = `
    <div class="report-card">
      <h4>Overview</h4>
      <div class="report-row"><span class="report-label">Total Rooms</span><span class="report-val">${total}</span></div>
      <div class="report-row"><span class="report-label">Fully Occupied</span><span class="report-val" style="color:var(--red)">${fullyOcc}</span></div>
      <div class="report-row"><span class="report-label">Partially Filled</span><span class="report-val" style="color:var(--amber)">${partial}</span></div>
      <div class="report-row"><span class="report-label">Vacant</span><span class="report-val" style="color:var(--green)">${vacant}</span></div>
      <div class="report-row"><span class="report-label">Beds Filled</span><span class="report-val">${totalOcc}/${totalCap}</span></div>
      <div class="report-bar"><div class="report-bar-fill" style="width:${pct}%"></div></div>
      <div style="font-size:12px;color:var(--text3);margin-top:6px">${pct}% beds occupied</div>
    </div>
    <div class="report-card"><h4>By Room Type</h4>${typeRows}</div>
    <div class="report-card"><h4>Students (${allStudents.length})</h4>${studentRows}</div>`;
}

// ── MY ROOM ───────────────────────────────────
function renderMyRoom() {
  const myRooms = allRooms.filter(r =>
    Array.isArray(r.students) && r.students.some(s => s.id === currentUser.id));
  const el = document.getElementById('my-room-content');

  if (myRooms.length === 0) {
    el.innerHTML = `<div class="my-room-empty">
      <div class="big-icon">🔑</div>
      <h3>No Room Booked</h3>
      <p>Head to <strong>All Rooms</strong> to book a room.</p>
    </div>`;
    return;
  }

  el.innerHTML = `
    <div class="section-header"><h3>Your Booked Room(s)</h3></div>
    <div class="rooms-grid">${myRooms.map(r => {
      const sc = roomStatusClass(r);
      const label = roomLabel(r);
      const roommates = r.students.filter(s => s.id !== currentUser.id);
      return `<div class="room-card ${sc}">
        <div class="room-number">Room ${r.id}</div>
        <div class="room-type">${r.type} · Cap: ${r.capacity}</div>
        <span class="room-status ${sc}">${label}</span>
        <div class="room-student" style="margin-top:10px">You: ${currentUser.username}</div>
        ${roommates.map(s => `<div class="room-student">👤 ${s.name}</div>`).join('')}
        <div class="room-actions">
  <!-- No vacate option for students -->
</div>
      </div>`;
    }).join('')}</div>`;
}

// ── MODAL ─────────────────────────────────────
function openBook(id) {
  bookingRoomId = id;
  document.getElementById('modal-room-id').textContent = id;
  document.getElementById('book-name').value = currentUser.username;
  document.getElementById('book-error').classList.add('hidden');
  document.getElementById('book-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('book-modal').classList.add('hidden');
  bookingRoomId = null;
}

async function confirmBook() {
  const name = document.getElementById('book-name').value.trim();
  const err  = document.getElementById('book-error');
  if (!name) { showErr(err, 'Enter your name.'); return; }
  try {
    const res  = await fetch(`${API_BASE}/api/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_id: bookingRoomId, student_name: name, student_id: currentUser.id })
    });
    const data = await res.json();
    if (data.error) { showErr(err, data.error); return; }
    closeModal();
    await loadPage('all-rooms');
    navigate('my-room', document.getElementById('nav-my-room'));
  } catch { showErr(err, 'Network error.'); }
}

// ── VACATE ────────────────────────────────────
async function vacateRoom(id) {
  if (!confirm(`Vacate ALL students from Room ${id}?`)) return;
  try {
    await fetch(`${API_BASE}/api/vacate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_id: id, student_id: "ADMIN" })
    });
    loadPage('all-rooms');
  } catch { alert('Network error.'); }
}

async function vacateStudent(id) {
  if (!confirm(`Leave Room ${id}?`)) return;
  try {
    await fetch(`${API_BASE}/api/vacate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_id: id, student_id: currentUser.id })
    });
    loadPage('my-room');
  } catch { alert('Network error.'); }
}

// ── UTILS ─────────────────────────────────────
function startRefresh() {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    const active = document.querySelector('.page.active');
    if (active) loadPage(active.id.replace('page-', ''));
  }, 15000);
}

function showErr(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !document.getElementById('login-screen').classList.contains('hidden')) login();
  if (e.key === 'Escape') closeModal();
});
