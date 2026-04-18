// ===== STATE =====
let currentUser = null;
let currentRole = 'student';
let allRooms = [];
let selectedRoomId = null;

// ===== AUTH =====
function setRole(role) {
  currentRole = role;
  document.getElementById('toggle-student').classList.toggle('active', role === 'student');
  document.getElementById('toggle-admin').classList.toggle('active', role === 'admin');
}

function login() {
  const user = document.getElementById('username').value.trim();
  const pass = document.getElementById('password').value.trim();
  const err = document.getElementById('login-error');

  err.classList.add('hidden');

  if (!user || !pass) {
    err.textContent = 'Please enter username and password.';
    err.classList.remove('hidden');
    return;
  }

  if (currentRole === 'admin') {
    if (user === 'admin' && pass === 'admin1234') {
      currentUser = { name: 'Admin', id: 'ADMIN', role: 'admin' };
    } else {
      err.textContent = 'Invalid admin credentials.';
      err.classList.remove('hidden');
      return;
    }
  } else {
    if (!pass.toUpperCase().startsWith('RA')) {
      err.textContent = 'Student password must start with RA (your student ID).';
      err.classList.remove('hidden');
      return;
    }
    currentUser = { name: user, id: pass.toUpperCase(), role: 'student' };
  }

  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('user-chip').textContent = currentUser.name;
  document.getElementById('role-badge').textContent = currentRole === 'admin' ? 'Admin' : 'Student';

  loadRooms();
}

function logout() {
  currentUser = null;
  allRooms = [];
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  document.getElementById('login-error').classList.add('hidden');
}

// ===== API =====
async function loadRooms() {
  try {
    const res = await fetch('/api/rooms');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    allRooms = await res.json();
    renderAll();
  } catch (e) {
    console.error('Failed to load rooms:', e);
    document.getElementById('stats-grid').innerHTML =
      '<p style="color:var(--red)">Failed to load rooms. Is the server running?</p>';
  }
}

// ===== NAVIGATION =====
function navigate(page, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById('page-' + page).classList.add('active');
  if (el) el.classList.add('active');

  const titles = {
    'dashboard': 'Dashboard',
    'all-rooms': 'All Rooms',
    'reports': 'Reports',
    'my-room': 'My Room'
  };
  document.getElementById('page-title').textContent = titles[page] || page;

  if (page === 'all-rooms') renderAllRooms();
  if (page === 'reports') renderReports();
  if (page === 'my-room') renderMyRoom();

  return false;
}

// ===== RENDER =====
function renderAll() {
  renderStats();
  renderDashRooms();
}

function renderStats() {
  const vacant = allRooms.filter(r => r.status === 'vacant').length;
  const partial = allRooms.filter(r => r.status === 'partial').length;
  const occupied = allRooms.filter(r => r.status === 'occupied').length;
  const totalStudents = allRooms.reduce((s, r) => s + r.occupied, 0);

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Total Rooms</div>
      <div class="stat-value">${allRooms.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Vacant</div>
      <div class="stat-value green">${vacant}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Partial</div>
      <div class="stat-value yellow">${partial}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Occupied</div>
      <div class="stat-value red">${occupied}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Students</div>
      <div class="stat-value">${totalStudents}</div>
    </div>
  `;
}

function roomCardHTML(room, showActions = true) {
  const isAdmin = currentUser && currentUser.role === 'admin';
  const myRoom = currentUser && room.students.some(s => s.id === currentUser.id);
  const studentsHTML = room.students.map(s =>
    `<div class="student-item">👤 ${s.name} <span style="color:var(--text2);font-size:0.78rem">(${s.id})</span></div>`
  ).join('');

  let actionsHTML = '';
  if (showActions) {
    const canBook = !room.students.some(s => s.id === currentUser?.id) && room.status !== 'occupied';
    actionsHTML = `<div class="room-actions">
      <button class="btn-book" ${room.status === 'occupied' || myRoom ? 'disabled' : ''} onclick="openBook(${room.id})">
        ${myRoom ? 'Your Room' : room.status === 'occupied' ? 'Full' : 'Book'}
      </button>
      ${isAdmin ? `<button class="btn-vacate" onclick="vacateRoom(${room.id})">Vacate</button>` : ''}
    </div>`;
  }

  return `
    <div class="room-card ${room.status}">
      <div class="room-header">
        <div class="room-number">Room ${room.id}</div>
        <div class="room-status ${room.status}">${room.status}</div>
      </div>
      <div class="room-type">${room.type}</div>
      <div class="room-capacity">Capacity: ${room.occupied}/${room.capacity}</div>
      ${room.students.length > 0 ? `<div class="room-students">${studentsHTML}</div>` : ''}
      ${actionsHTML}
    </div>
  `;
}

function renderDashRooms() {
  const grid = document.getElementById('dash-rooms-grid');
  grid.innerHTML = allRooms.map(r => roomCardHTML(r)).join('');
}

function renderAllRooms() {
  const grid = document.getElementById('all-rooms-grid');
  grid.innerHTML = allRooms.map(r => roomCardHTML(r)).join('');
}

function renderReports() {
  const singles = allRooms.filter(r => r.type === 'Single');
  const doubles = allRooms.filter(r => r.type === 'Double');
  const triples = allRooms.filter(r => r.type === 'Triple');

  const row = (label, val) => `
    <div class="report-row">
      <span>${label}</span>
      <span>${val}</span>
    </div>`;

  document.getElementById('reports-wrap').innerHTML = `
    <div class="report-section">
      <h4>Occupancy Summary</h4>
      ${row('Total Rooms', allRooms.length)}
      ${row('Vacant Rooms', allRooms.filter(r=>r.status==='vacant').length)}
      ${row('Partially Occupied', allRooms.filter(r=>r.status==='partial').length)}
      ${row('Fully Occupied', allRooms.filter(r=>r.status==='occupied').length)}
      ${row('Total Students Housed', allRooms.reduce((s,r)=>s+r.occupied, 0))}
    </div>
    <div class="report-section">
      <h4>By Room Type</h4>
      ${row('Singles (Rooms 1–8)', `${singles.filter(r=>r.status!=='vacant').length}/${singles.length} occupied`)}
      ${row('Doubles (Rooms 9–16)', `${doubles.filter(r=>r.occupied>0).length}/${doubles.length} booked`)}
      ${row('Triples (Rooms 17–20)', `${triples.filter(r=>r.occupied>0).length}/${triples.length} booked`)}
    </div>
    <div class="report-section">
      <h4>All Bookings</h4>
      ${allRooms.flatMap(r => r.students.map(s =>
        row(`Room ${r.id} (${r.type})`, `${s.name} — ${s.id}`)
      )).join('') || '<div class="report-row"><span>No bookings yet</span></div>'}
    </div>
  `;
}

function renderMyRoom() {
  const el = document.getElementById('my-room-content');
  if (!currentUser || currentUser.role === 'admin') {
    el.innerHTML = '<p style="color:var(--text2)">Admins do not have assigned rooms.</p>';
    return;
  }

  const room = allRooms.find(r => r.students.some(s => s.id === currentUser.id));
  if (!room) {
    el.innerHTML = `
      <div class="my-room-card">
        <h3>No Room Assigned</h3>
        <p style="color:var(--text2)">You haven't booked a room yet. Go to <strong>All Rooms</strong> to book one.</p>
      </div>`;
    return;
  }

  const roommates = room.students.filter(s => s.id !== currentUser.id);
  el.innerHTML = `
    <div class="my-room-card">
      <h3>🏠 Room ${room.id}</h3>
      <div class="my-room-detail"><span>Type</span><span>${room.type}</span></div>
      <div class="my-room-detail"><span>Capacity</span><span>${room.capacity}</span></div>
      <div class="my-room-detail"><span>Occupants</span><span>${room.occupied}</span></div>
      <div class="my-room-detail"><span>Status</span><span style="color:var(--green);text-transform:capitalize">${room.status}</span></div>
      ${roommates.length > 0 ? `
        <div class="my-room-detail" style="flex-direction:column;gap:6px">
          <span>Roommates</span>
          ${roommates.map(s => `<span>${s.name} (${s.id})</span>`).join('')}
        </div>` : ''}
    </div>`;
}

// ===== BOOKING =====
function openBook(roomId) {
  selectedRoomId = roomId;
  document.getElementById('modal-room-id').textContent = roomId;
  document.getElementById('book-name').value = currentUser?.name || '';
  document.getElementById('book-error').classList.add('hidden');
  document.getElementById('book-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('book-modal').classList.add('hidden');
  selectedRoomId = null;
}

async function confirmBook() {
  const name = document.getElementById('book-name').value.trim();
  const errEl = document.getElementById('book-error');
  errEl.classList.add('hidden');

  if (!name) {
    errEl.textContent = 'Please enter your name.';
    errEl.classList.remove('hidden');
    return;
  }

  try {
    const res = await fetch('/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_id: selectedRoomId,
        student_name: name,
        student_id: currentUser.id
      })
    });

    const data = await res.json();

    if (data.error) {
      errEl.textContent = data.error;
      errEl.classList.remove('hidden');
      return;
    }

    closeModal();
    await loadRooms();

  } catch (e) {
    errEl.textContent = 'Network error. Please try again.';
    errEl.classList.remove('hidden');
  }
}

async function vacateRoom(roomId) {
  if (!confirm(`Vacate Room ${roomId}? This removes all students.`)) return;

  try {
    const res = await fetch('/api/vacate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_id: roomId, student_id: 'ADMIN' })
    });

    const data = await res.json();
    if (data.error) { alert(data.error); return; }

    await loadRooms();

  } catch (e) {
    alert('Network error.');
  }
}

// Close modal on overlay click
document.getElementById('book-modal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});
