'use strict';
/* PawHope – role-based Pet Adoption Platform (frontend only, localStorage) */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2800); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const EMOJI = { Dog: '🐕', Cat: '🐈', Rabbit: '🐇', Bird: '🦜' };

/* ---------- Seed data ---------- */
const SEED_USERS = [
  { id: 'u1', name: 'Shelter Admin', email: 'admin@pawhope.com', phone: '9000000001', pw: 'admin123', role: 'staff' },
  { id: 'u2', name: 'Demo Adopter', email: 'user@pawhope.com', phone: '9000000002', pw: 'user123', role: 'adopter' }
];
const SEED_PETS = [
  ['Bruno', 'Dog', 'Labrador', 3, 'Male', 'Available', 'Friendly, loves fetch and kids.'],
  ['Misty', 'Cat', 'Persian', 2, 'Female', 'Available', 'Calm lap cat, litter trained.'],
  ['Coco', 'Dog', 'Indie', 0.5, 'Female', 'Available', 'Playful puppy, fully vaccinated.'],
  ['Snowy', 'Rabbit', 'Holland Lop', 1, 'Female', 'Available', 'Gentle and loves carrots.'],
  ['Kiwi', 'Bird', 'Budgerigar', 1, 'Male', 'Pending', 'Chirpy, can mimic a few words.'],
  ['Rocky', 'Dog', 'German Shepherd', 5, 'Male', 'Adopted', 'Well trained guard dog.'],
  ['Tom', 'Cat', 'Tabby', 4, 'Male', 'Available', 'Independent explorer.'],
  ['Harshi', 'Cat', 'Munchkin', 1.5, 'Female', 'Available', 'Cute, affectionate and curious about Harsh.']
].map((p, i) => ({ id: 'p' + (i + 1), name: p[0], species: p[1], breed: p[2], age: p[3], gender: p[4], status: p[5], desc: p[6], created: Date.now() - i * 86400000 }));

let users = store.get('ph2_users', null) || (store.set('ph2_users', SEED_USERS), SEED_USERS);
let pets = store.get('ph2_pets', null) || (store.set('ph2_pets', SEED_PETS), SEED_PETS);
let reqs = store.get('ph2_reqs', []);
let notifs = store.get('ph2_notifs', []);
let favs = store.get('ph2_favs', {});
let session = store.get('ph2_session', null);   // user id
const save = () => { store.set('ph2_users', users); store.set('ph2_pets', pets); store.set('ph2_reqs', reqs); store.set('ph2_notifs', notifs); store.set('ph2_favs', favs); };
const me = () => users.find(u => u.id === session);
const isStaff = () => me()?.role === 'staff';
function notify(userId, text) { notifs.unshift({ id: uid(), userId, text, at: Date.now(), read: false }); save(); renderNotifCount(); }

/* ---------- Auth ---------- */
const msgEl = $('#authMsg'); const say = (t, ok) => { msgEl.className = 'msg ' + (ok ? 'ok' : 'err'); msgEl.textContent = t; };
document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === t));
  $('#loginForm').hidden = t.dataset.t !== 'login'; $('#regForm').hidden = t.dataset.t !== 'register'; say('');
});
$('#regForm').role.onchange = e => $('#codeRow').hidden = e.target.value !== 'staff';
function validate(form) { let ok = true; form.querySelectorAll('input:not([type=checkbox]):not([type=hidden]),select,textarea').forEach(el => { if (el.closest('[hidden]')) return; const v = el.checkValidity(); el.classList.toggle('bad', !v); if (!v) ok = false; }); return ok; }
$('#loginForm').onsubmit = e => {
  e.preventDefault(); const f = e.target;
  if (!validate(f)) return say('Enter a valid email and a password of at least 6 characters.');
  const u = users.find(x => x.email.toLowerCase() === f.email.value.trim().toLowerCase() && x.pw === f.pw.value);
  if (!u) return say('Incorrect email or password.');
  session = u.id; store.set('ph2_session', session); f.reset(); say(''); boot();
};
$('#regForm').onsubmit = e => {
  e.preventDefault(); const f = e.target;
  if (!validate(f)) return say('Please fix the highlighted fields.');
  if (users.some(x => x.email.toLowerCase() === f.email.value.trim().toLowerCase())) return say('That email is already registered.');
  if (f.role.value === 'staff' && f.code.value.trim() !== 'SHELTER2026') return say('Invalid staff code.');
  const u = { id: uid(), name: f.name.value.trim(), email: f.email.value.trim(), phone: f.phone.value, pw: f.pw.value, role: f.role.value };
  users.push(u); save(); session = u.id; store.set('ph2_session', session); f.reset(); say(''); notify(u.id, 'Welcome to PawHope, ' + u.name + '!'); boot();
};
$('#logout').onclick = () => { session = null; store.set('ph2_session', null); $('#drawer').hidden = true; boot(); };

/* ---------- Navigation ---------- */
const TABS = { adopter: [['dashboard', 'Dashboard'], ['browse', 'Browse Pets'], ['requests', 'My Requests']],
               staff: [['dashboard', 'Dashboard'], ['browse', 'Browse Pets'], ['manage', 'Manage Pets'], ['requests', 'Requests'], ['users', 'Users'], ['reports', 'Reports']] };
let view = 'dashboard';
function go(v) {
  const allowed = session ? TABS[me().role].map(t => t[0]) : ['auth'];
  if (!allowed.includes(v)) v = allowed[0];
  view = v;
  document.querySelectorAll('.view').forEach(s => s.hidden = s.id !== v);
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  $('#nav').classList.remove('open');
  ({ dashboard: renderDash, browse: renderBrowse, requests: renderReqs, manage: renderManage, users: renderUsers, reports: renderReports })[v]?.();
}
$('#nav').onclick = e => { if (e.target.dataset.v) go(e.target.dataset.v); };
$('#menuBtn').onclick = () => $('#nav').classList.toggle('open');
function boot() {
  const u = session && me(); if (!u) session = null;
  $('#nav').hidden = $('#userBox').hidden = !u;
  if (u) { $('#nav').innerHTML = TABS[u.role].map(t => `<button data-v="${t[0]}">${t[1]}</button>`).join(''); $('#whoami').textContent = `${u.name} (${u.role === 'staff' ? 'Staff' : 'Adopter'})`; renderNotifCount(); }
  go(u ? 'dashboard' : 'auth');
}

/* ---------- Dashboard ---------- */
function bars(el, data) { const mx = Math.max(1, ...Object.values(data)); $(el).innerHTML = '<div class="bars">' + Object.entries(data).map(([k, v]) => `<div class="b"><span>${esc(k)}</span><div class="t"><i style="width:${v / mx * 100}%"></i></div><b>${v}</b></div>`).join('') + '</div>'; }
const count = (arr, fn) => arr.reduce((o, x) => { const k = fn(x); o[k] = (o[k] || 0) + 1; return o; }, {});
function myReqs() { return isStaff() ? reqs : reqs.filter(r => r.userId === session); }
function renderDash() {
  const rs = myReqs();
  const k = isStaff()
    ? [[pets.length, 'Total pets'], [pets.filter(p => p.status === 'Available').length, 'Available'], [reqs.filter(r => r.status === 'Pending').length, 'Pending requests'], [pets.filter(p => p.status === 'Adopted').length, 'Adopted']]
    : [[pets.filter(p => p.status === 'Available').length, 'Pets available'], [rs.length, 'My requests'], [rs.filter(r => r.status === 'Approved' || r.status === 'Completed').length, 'Approved'], [Object.keys(favs[session] || {}).length, 'Favourites']];
  $('#kpis').innerHTML = k.map(x => `<div class="kpi"><b>${x[0]}</b><span>${x[1]}</span></div>`).join('');
  const st = { Pending: 0, Approved: 0, Rejected: 0, Completed: 0, Cancelled: 0, ...count(rs, r => r.status) };
  bars('#statusChart', st);
  $('#recent').innerHTML = rs.length ? [...rs].sort((a, b) => b.at - a.at).slice(0, 5).map(r => `<p>${esc(r.petName)} – ${esc(r.userName)} <span class="badge ${r.status}">${r.status}</span></p>`).join('') : '<p>No requests yet. Browse pets to get started!</p>';
}

/* ---------- Browse & favourites ---------- */
$('#fSpecies').innerHTML = '<option value="">All species</option>' + Object.keys(EMOJI).map(s => `<option>${s}</option>`).join('');
['q', 'fSpecies', 'fStatus', 'fSort', 'fFav'].forEach(id => $('#' + id).addEventListener('input', renderBrowse));
const GRAD = [['#ffe3d3','#ffc9ad'],['#dff1e6','#b9e0c9'],['#fff1c9','#ffdf94'],['#e6e3fb','#cfc9f3'],['#ffdfe5','#ffc2cf'],['#dcefff','#b8dcf7'],['#f1e6da','#e2cbb3'],['#e3f4d9','#c5e6ae']];
const grad = id => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; const g = GRAD[h % GRAD.length]; return `background:linear-gradient(150deg,${g[0]},${g[1]})`; };
function renderBrowse() {
  const q = $('#q').value.trim().toLowerCase(), sp = $('#fSpecies').value, st = $('#fStatus').value, so = $('#fSort').value, fv = $('#fFav').checked;
  const mf = favs[session] || {};
  let l = pets.filter(p => (!q || (p.name + ' ' + p.breed).toLowerCase().includes(q)) && (!sp || p.species === sp) && (!st || p.status === st) && (!fv || mf[p.id]));
  l.sort((a, b) => so === 'name' ? a.name.localeCompare(b.name) : so === 'age' ? a.age - b.age : b.created - a.created);
  $('#petGrid').innerHTML = l.length ? l.map(p => { const sent = reqs.some(r => r.petId === p.id && r.userId === session && r.status === 'Pending');
    return `<article class="pet"><div class="art" style="${grad(p.id)}"><span class="em">${EMOJI[p.species] || '🐾'}</span><span class="badge ${p.status}">${p.status}</span>
      <button class="fav ${mf[p.id] ? 'on' : ''}" data-fav="${p.id}" aria-label="Favourite">${mf[p.id] ? '♥' : '♡'}</button></div>
      <div class="pbody"><h3>${esc(p.name)}</h3><div class="chips2"><span>${esc(p.species)}</span><span>${esc(p.breed)}</span><span>${p.age} yr</span><span>${esc(p.gender)}</span></div>
      <p>${esc(p.desc)}</p>
      ${isStaff() ? '' : `<button class="btn full" data-req="${p.id}" ${p.status !== 'Available' || sent ? 'disabled' : ''}>${p.status !== 'Available' ? 'Not available' : sent ? 'Request sent ✓' : 'Adopt me 🐾'}</button>`}</div></article>`; }).join('') : '<p>No pets match your filters.</p>';
}
document.addEventListener('click', e => {
  const fv = e.target.closest('[data-fav]'); if (fv) { favs[session] = favs[session] || {}; const id = fv.dataset.fav; favs[session][id] ? delete favs[session][id] : favs[session][id] = 1; save(); renderBrowse(); return; }
  const rq = e.target.closest('[data-req]'); if (rq) openReqModal(rq.dataset.req);
});

/* ---------- Adoption request workflow ---------- */
function openReqModal(petId) {
  const p = pets.find(x => x.id === petId);
  $('#modalBody').innerHTML = `<h3>Adopt ${esc(p.name)} ${EMOJI[p.species] || ''}</h3><form id="rf" novalidate>
    <label>Home type<select name="home" required><option value="">Select…</option><option>Apartment</option><option>House</option><option>House with garden</option></select></label>
    <label>Have you owned pets before?<select name="exp" required><option value="">Select…</option><option>Yes</option><option>No</option></select></label>
    <label>Why would you be a great home? (min 15 chars)<textarea name="why" rows="3" required minlength="15"></textarea></label>
    <div class="row"><button class="btn" type="submit">Send request</button><button class="btn ghost" type="button" id="rfX">Cancel</button></div></form>`;
  $('#modal').hidden = false; $('#rfX').onclick = () => $('#modal').hidden = true;
  $('#rf').onsubmit = ev => { ev.preventDefault(); if (!validate(ev.target)) return;
    const u = me(), f = ev.target;
    reqs.push({ id: uid(), petId, petName: p.name, userId: u.id, userName: u.name, home: f.home.value, exp: f.exp.value, why: f.why.value.trim(), status: 'Pending', at: Date.now() });
    p.status = 'Pending'; save();
    notify(u.id, `Your request for ${p.name} was submitted.`);
    users.filter(x => x.role === 'staff').forEach(s => notify(s.id, `${u.name} requested to adopt ${p.name}.`));
    $('#modal').hidden = true; toast('Request sent!'); renderBrowse(); };
}
function renderReqs() {
  $('#reqTitle').textContent = isStaff() ? 'Adoption Requests' : 'My Requests';
  const l = [...myReqs()].sort((a, b) => b.at - a.at);
  $('#reqTable').innerHTML = '<tr><th>Pet</th><th>Applicant</th><th>Details</th><th>Date</th><th>Status</th><th>Action</th></tr>' +
    (l.length ? l.map(r => `<tr><td>${esc(r.petName)}</td><td>${esc(r.userName)}</td><td><small>${esc(r.home)} • Prior pets: ${esc(r.exp)}<br>${esc(r.why)}</small></td><td>${new Date(r.at).toLocaleDateString()}</td><td><span class="badge ${r.status}">${r.status}</span></td>
      <td>${isStaff() ? (r.status === 'Pending' ? `<button class="btn sm" data-act="Approved" data-id="${r.id}">Approve</button><button class="btn sm red" data-act="Rejected" data-id="${r.id}">Reject</button>` : r.status === 'Approved' ? `<button class="btn sm" data-act="Completed" data-id="${r.id}">Mark adopted</button>` : '—')
        : (r.status === 'Pending' ? `<button class="btn sm red" data-act="Cancelled" data-id="${r.id}">Cancel</button>` : '—')}</td></tr>`).join('') : '<tr><td colspan="6">No requests to show.</td></tr>');
}
$('#reqTable').onclick = e => { const b = e.target.closest('[data-act]'); if (!b) return;
  const r = reqs.find(x => x.id === b.dataset.id), p = pets.find(x => x.id === r.petId), a = b.dataset.act; r.status = a;
  if (a === 'Rejected' || a === 'Cancelled') { if (!reqs.some(x => x.petId === p.id && x.status === 'Pending')) p.status = 'Available'; }
  if (a === 'Approved') p.status = 'Pending';
  if (a === 'Completed') p.status = 'Adopted';
  save();
  const msgs = { Approved: `Great news! Your request for ${p.name} was approved. Visit the shelter to complete adoption.`, Rejected: `Sorry, your request for ${p.name} was not approved.`, Completed: `Adoption of ${p.name} is complete. Congratulations! 🎉`, Cancelled: `You cancelled your request for ${p.name}.` };
  notify(r.userId, msgs[a]); toast(`Request ${a.toLowerCase()}`); renderReqs(); };

/* ---------- Manage pets (CRUD) ---------- */
const pf = $('#petForm');
function renderManage() {
  $('#petTable').innerHTML = '<tr><th>Name</th><th>Species</th><th>Breed</th><th>Age</th><th>Status</th><th>Actions</th></tr>' +
    pets.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.species)}</td><td>${esc(p.breed)}</td><td>${p.age}</td><td><span class="badge ${p.status}">${p.status}</span></td>
    <td><button class="btn sm" data-edit="${p.id}">Edit</button><button class="btn sm red" data-del="${p.id}">Delete</button></td></tr>`).join('');
}
pf.onsubmit = e => { e.preventDefault();
  if (!validate(pf)) { $('#petMsg').className = 'msg err'; $('#petMsg').textContent = 'Please fix the highlighted fields.'; return; }
  const dup = pets.find(p => p.id !== pf.id.value && p.name.toLowerCase() === pf.name.value.trim().toLowerCase() && p.breed.toLowerCase() === pf.breed.value.trim().toLowerCase());
  if (dup) { $('#petMsg').className = 'msg err'; $('#petMsg').textContent = 'Duplicate: a pet with this name and breed already exists.'; return; }
  const d = { name: pf.name.value.trim(), species: pf.species.value, breed: pf.breed.value.trim(), age: +pf.age.value, gender: pf.gender.value, status: pf.status.value, desc: pf.desc.value.trim() };
  if (pf.id.value) { Object.assign(pets.find(p => p.id === pf.id.value), d); toast('Pet updated'); }
  else { pets.unshift({ id: uid(), created: Date.now(), ...d }); toast('Pet added'); }
  save(); clearPetForm(); renderManage(); };
function clearPetForm() { pf.reset(); pf.id.value = ''; $('#petFormTitle').textContent = 'Add a pet'; $('#petMsg').textContent = ''; pf.querySelectorAll('.bad').forEach(x => x.classList.remove('bad')); }
$('#petCancel').onclick = clearPetForm;
$('#petTable').onclick = e => {
  const ed = e.target.closest('[data-edit]'), dl = e.target.closest('[data-del]');
  if (ed) { const p = pets.find(x => x.id === ed.dataset.edit); pf.id.value = p.id; ['name', 'species', 'breed', 'age', 'gender', 'status'].forEach(k => pf[k].value = p[k]); pf.desc.value = p.desc; $('#petFormTitle').textContent = 'Edit ' + p.name; pf.scrollIntoView({ behavior: 'smooth' }); }
  if (dl && confirm('Delete this pet and its requests?')) { const id = dl.dataset.del; pets = pets.filter(p => p.id !== id); reqs = reqs.filter(r => r.petId !== id); save(); renderManage(); toast('Pet deleted'); }
};

/* ---------- Users (CRUD for staff) ---------- */
function renderUsers() {
  $('#userTable').innerHTML = '<tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Requests</th><th>Actions</th></tr>' +
    users.map(u => `<tr><td>${esc(u.name)}${u.id === session ? ' (you)' : ''}</td><td>${esc(u.email)}</td><td>${esc(u.phone)}</td><td><span class="badge">${u.role === 'staff' ? 'Staff' : 'Adopter'}</span></td><td>${reqs.filter(r => r.userId === u.id).length}</td>
    <td>${u.id === session ? '—' : `<button class="btn sm ghost" data-role="${u.id}">Make ${u.role === 'staff' ? 'adopter' : 'staff'}</button><button class="btn sm red" data-udel="${u.id}">Delete</button>`}</td></tr>`).join('');
}
$('#userTable').onclick = e => {
  const r = e.target.closest('[data-role]'), d = e.target.closest('[data-udel]');
  if (r) { const u = users.find(x => x.id === r.dataset.role); u.role = u.role === 'staff' ? 'adopter' : 'staff'; save(); notify(u.id, `Your role was changed to ${u.role}.`); toast('Role updated'); renderUsers(); }
  if (d && confirm('Delete this user and their requests?')) { const id = d.dataset.udel; users = users.filter(x => x.id !== id); reqs = reqs.filter(x => x.userId !== id); delete favs[id]; save(); toast('User deleted'); renderUsers(); }
};

/* ---------- Reports ---------- */
function renderReports() {
  bars('#repSpecies', count(pets, p => p.species)); bars('#repStatus', count(pets, p => p.status)); bars('#repReq', Object.keys(reqs).length ? count(reqs, r => r.status) : { 'No requests': 0 });
}
$('#csv').onclick = () => {
  const q = v => '"' + String(v).replace(/"/g, '""') + '"';
  const rows = [['Name', 'Species', 'Breed', 'Age', 'Gender', 'Status'], ...pets.map(p => [p.name, p.species, p.breed, p.age, p.gender, p.status])].map(r => r.map(q).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows], { type: 'text/csv' })); a.download = 'pets.csv'; a.click(); URL.revokeObjectURL(a.href);
};

/* ---------- Notifications ---------- */
const myNotifs = () => notifs.filter(n => n.userId === session);
function renderNotifCount() { $('#notifCount').textContent = myNotifs().filter(n => !n.read).length; }
function renderNotifs() { const l = myNotifs(); $('#notifList').innerHTML = l.length ? l.map(n => `<div class="n ${n.read ? '' : 'unread'}">${esc(n.text)}<small>${new Date(n.at).toLocaleString()}</small></div>`).join('') : '<p>No notifications.</p>'; }
$('#notifBtn').onclick = () => { renderNotifs(); $('#drawer').hidden = false; };
$('#closeDrawer').onclick = () => $('#drawer').hidden = true;
$('#markRead').onclick = () => { myNotifs().forEach(n => n.read = true); save(); renderNotifs(); renderNotifCount(); };
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') e.target.hidden = true; });

boot();

/* ---------- Theme (light / dark) ---------- */
(function () {
  let t = 'dark';
  try { t = localStorage.getItem('ph2_theme') || 'dark'; } catch {}
  const apply = () => { document.documentElement.dataset.theme = t; $('#themeBtn').textContent = t === 'dark' ? '☀️' : '🌙'; };
  apply();
  $('#themeBtn').onclick = () => { t = t === 'dark' ? 'light' : 'dark'; try { localStorage.setItem('ph2_theme', t); } catch {} apply(); };
})();
