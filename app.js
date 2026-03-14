/* ═══════════════════════════════════════════
   KYN LUX — App Logic
   Part of the KYN Protocol
═══════════════════════════════════════════ */

'use strict';

// ─── STATE ───────────────────────────────────────────────────────────────────
let spfVal     = 0;
let timerIv    = null;
let sessStart  = null;
let sessParams = null;
let userLat    = null;
let userLon    = null;

let profile = {
  age: 35, sex: 'male', goal: 'general',
  deficient: 'no', skin: 1
};

let circPrefs = {
  morning: { remind: 10 },
  midday:  { remind: 15 },
  sunset:  { remind: 20 }
};

let sessions = [];

const RING_CIRC = 226.2; // 2πr where r=36
const DAILY_VD_BASE = 8800;
const DAILY_NO_BASE = 18;   // μmol
const DAILY_SE_BASE = 80;   // %

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  updateComputedPreview();
  setInitialTime();
  registerServiceWorker();
});

function setInitialTime() {
  const now  = new Date();
  const hh   = String(now.getHours()).padStart(2, '0');
  const mm   = String(now.getMinutes()).padStart(2, '0');
  const el   = document.getElementById('start-time');
  if (el) el.value = `${hh}:${mm}`;
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// ─── STORAGE ─────────────────────────────────────────────────────────────────
function loadFromStorage() {
  // Profile
  try {
    const sp = localStorage.getItem('kyn_lux_profile');
    if (sp) {
      profile = { ...profile, ...JSON.parse(sp) };
      applyProfileToUI();
    }
  } catch (e) {}

  // Sessions
  try {
    sessions = JSON.parse(localStorage.getItem('kyn_lux_sessions') || '[]');
  } catch (e) { sessions = []; }

  // Circadian
  try {
    const sc = localStorage.getItem('kyn_lux_circ');
    if (sc) {
      const d = JSON.parse(sc);
      if (d.morning) {
        circPrefs.morning.remind = d.morning.remind || 10;
        setEl('tog-morning', 'checked', d.morning.enabled);
        setVal('wake-time', d.morning.wake || '06:30');
        setVal('morning-target', d.morning.target || '07:00');
        restoreRemindPill('morning', circPrefs.morning.remind);
      }
      if (d.midday) {
        circPrefs.midday.remind = d.midday.remind || 15;
        setEl('tog-midday', 'checked', d.midday.enabled);
        setVal('midday-target', d.midday.target || '12:00');
        restoreRemindPill('midday', circPrefs.midday.remind);
      }
      if (d.sunset) {
        circPrefs.sunset.remind = d.sunset.remind || 20;
        setEl('tog-sunset', 'checked', d.sunset.enabled);
        setVal('sunset-time', d.sunset.sunset || '19:30');
        setVal('sunset-target', d.sunset.target || '19:15');
        restoreRemindPill('sunset', circPrefs.sunset.remind);
      }
    }
  } catch (e) {}
}

function applyProfileToUI() {
  setVal('p-age', profile.age);
  setVal('p-sex', profile.sex);
  setVal('p-goal', profile.goal);
  setVal('p-deficient', profile.deficient);
  // Skin cards
  document.querySelectorAll('#profile-skin-grid .skin-card').forEach((c, i) => {
    c.classList.toggle('active', i + 1 === parseInt(profile.skin));
  });
}

function saveProfile() {
  profile.age       = parseInt(document.getElementById('p-age').value) || 35;
  profile.sex       = document.getElementById('p-sex').value;
  profile.goal      = document.getElementById('p-goal').value;
  profile.deficient = document.getElementById('p-deficient').value;
  localStorage.setItem('kyn_lux_profile', JSON.stringify(profile));
  updateComputedPreview();
  renderBaselineCards();
  updateTargetsPage();
}

function saveCirc() {
  const data = {
    morning: {
      enabled: getChecked('tog-morning'),
      wake:    getVal('wake-time'),
      target:  getVal('morning-target'),
      remind:  circPrefs.morning.remind
    },
    midday: {
      enabled: getChecked('tog-midday'),
      target:  getVal('midday-target'),
      remind:  circPrefs.midday.remind
    },
    sunset: {
      enabled: getChecked('tog-sunset'),
      sunset:  getVal('sunset-time'),
      target:  getVal('sunset-target'),
      remind:  circPrefs.sunset.remind
    }
  };
  localStorage.setItem('kyn_lux_circ', JSON.stringify(data));
}

function saveSessions() {
  localStorage.setItem('kyn_lux_sessions', JSON.stringify(sessions.slice(0, 90)));
}

// ─── TARGET COMPUTATION ───────────────────────────────────────────────────────
function computeTargets(p) {
  const age  = parseInt(p.age) || 35;
  const sex  = p.sex  || 'male';
  const goal = p.goal || 'general';
  const def  = p.deficient || 'no';
  const skin = parseInt(p.skin) || 1;

  // ── Vitamin D ──
  let vd = DAILY_VD_BASE;
  if      (age >= 70) vd *= 1.40;
  else if (age >= 60) vd *= 1.28;
  else if (age >= 50) vd *= 1.15;
  else if (age < 18)  vd *= 0.80;
  // Skin: darker = more exposure needed
  const skinMod = [0, 1.0, 1.10, 1.22, 1.40, 1.65, 2.00];
  vd *= skinMod[skin];
  if (def === 'yes') vd *= 1.25;
  else if (def === 'low') vd *= 1.10;
  if (goal === 'bone')   vd *= 1.15;
  if (goal === 'immune') vd *= 1.10;
  if (sex === 'female')  vd *= 0.95;
  vd = Math.round(vd / 100) * 100;

  // ── Nitric Oxide ──
  let no = DAILY_NO_BASE;
  if      (age >= 70) no *= 1.50;
  else if (age >= 60) no *= 1.30;
  else if (age >= 50) no *= 1.15;
  if (goal === 'cardio')   no *= 1.30;
  if (goal === 'athletic') no *= 1.20;
  if (sex === 'female')    no *= 0.90;
  no = Math.round(no * 10) / 10;

  // ── Serotonin ──
  let se = DAILY_SE_BASE;
  if (goal === 'depression') se  = 90;
  if (goal === 'athletic')   se  = 75;
  if (sex === 'female')      se  = Math.min(100, se + 8);
  if (age >= 60)             se  = Math.min(100, se + 5);
  if (age < 25)              se  = 70;
  se = Math.round(se);

  return { vd, no, se };
}

// ─── PROFILE UI ───────────────────────────────────────────────────────────────
function setProfileSkin(el, n) {
  profile.skin = n;
  document.querySelectorAll('#profile-skin-grid .skin-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  updateComputedPreview();
}

function updateComputedPreview() {
  const t   = computeTargets(profile);
  const age = parseInt(profile.age) || 35;
  const grp = age < 30 ? '18–29' : age < 50 ? '30–49' : age < 65 ? '50–64' : '65+';
  const el  = document.getElementById('computed-targets-preview');
  if (!el) return;
  el.innerHTML = `
    <div class="targets-preview">
      <div class="tp-label">Your targets · Age group ${grp}</div>
      <div class="tp-grid">
        <div class="tp-cell">
          <div class="tp-val" style="color:var(--sun)">${(t.vd / 1000).toFixed(1)}k</div>
          <div class="tp-unit">IU / day</div>
          <div class="tp-name" style="color:var(--sun)">Vitamin D</div>
        </div>
        <div class="tp-cell">
          <div class="tp-val" style="color:#AFA9EC">${t.no}</div>
          <div class="tp-unit">μmol / day</div>
          <div class="tp-name" style="color:#AFA9EC">Nitric Oxide</div>
        </div>
        <div class="tp-cell">
          <div class="tp-val" style="color:#97C459">${t.se}%</div>
          <div class="tp-unit">lift / day</div>
          <div class="tp-name" style="color:#97C459">Serotonin</div>
        </div>
      </div>
    </div>`;
}

function renderBaselineCards() {
  const el = document.getElementById('baseline-cards');
  if (!el) return;
  const t   = computeTargets(profile);
  const age = parseInt(profile.age) || 35;
  const sex = profile.sex;
  const goal = profile.goal;
  const goalLabels = {
    general:'General Wellness', depression:'Mood / Depression',
    cardio:'Cardiovascular', bone:'Bone Density',
    immune:'Immune', athletic:'Athletic'
  };
  const ageMod_vd = age >= 70 ? '+40%' : age >= 60 ? '+28%' : age >= 50 ? '+15%' : age < 18 ? '−20%' : 'None';
  const ageMod_no = age >= 70 ? '+50% (NOS decline)' : age >= 60 ? '+30%' : age >= 50 ? '+15%' : 'None';
  const ageMod_se = age >= 60 ? '+5% (lower synthesis)' : age < 25 ? '−10% (efficient baseline)' : 'None';
  const skinMods  = ['', '+0%', '+10%', '+22%', '+40%', '+65%', '+100%'];
  const ageNote   = age >= 60
    ? 'Age 60+ increases all targets significantly due to reduced NOS enzyme function and skin thickness.'
    : age >= 50
    ? 'Age 50+ applies moderate target adjustments for skin thinning and kidney conversion changes.'
    : age < 25
    ? 'Under 25: slightly lower targets — younger physiology is at peak synthesis efficiency.'
    : 'Standard adult range — no major age adjustments applied.';

  el.innerHTML = `
    <div class="baseline-card">
      <div class="bc-head">
        <div class="bc-icon" style="background:var(--sun-light)">🧬</div>
        <div><div class="bc-title">Vitamin D</div><div class="bc-sub">Daily sun production target</div></div>
      </div>
      <div class="bc-row"><span class="bc-lbl">Meta-analysis base</span><span class="bc-val vd">8,800 IU</span></div>
      <div class="bc-row"><span class="bc-lbl">Your target</span><span class="bc-val vd">${t.vd.toLocaleString()} IU</span></div>
      <div class="bc-row"><span class="bc-lbl">Age modifier</span><span class="bc-val vd">${ageMod_vd}</span></div>
      <div class="bc-row"><span class="bc-lbl">Skin type modifier</span><span class="bc-val vd">${skinMods[profile.skin]}</span></div>
      <div class="bc-row"><span class="bc-lbl">Sex</span><span class="bc-val vd">${sex === 'female' ? '−5% (female)' : 'Standard'}</span></div>
      <div class="bc-row"><span class="bc-lbl">Goal</span><span class="bc-val vd">${goalLabels[goal]}</span></div>
    </div>
    <div class="baseline-card">
      <div class="bc-head">
        <div class="bc-icon" style="background:var(--purple-light)">💨</div>
        <div><div class="bc-title">Nitric Oxide</div><div class="bc-sub">Daily cardiovascular threshold</div></div>
      </div>
      <div class="bc-row"><span class="bc-lbl">Cardiovascular base</span><span class="bc-val no">18 μmol</span></div>
      <div class="bc-row"><span class="bc-lbl">Your target</span><span class="bc-val no">${t.no} μmol</span></div>
      <div class="bc-row"><span class="bc-lbl">Age modifier</span><span class="bc-val no">${ageMod_no}</span></div>
      <div class="bc-row"><span class="bc-lbl">Goal modifier</span><span class="bc-val no">${goal === 'cardio' ? '+30% (cardio)' : goal === 'athletic' ? '+20% (athletic)' : 'None'}</span></div>
    </div>
    <div class="baseline-card">
      <div class="bc-head">
        <div class="bc-icon" style="background:var(--green-light)">🧠</div>
        <div><div class="bc-title">Serotonin</div><div class="bc-sub">Daily mood sufficiency target</div></div>
      </div>
      <div class="bc-row"><span class="bc-lbl">Base target</span><span class="bc-val se">80% lift</span></div>
      <div class="bc-row"><span class="bc-lbl">Your target</span><span class="bc-val se">${t.se}%</span></div>
      <div class="bc-row"><span class="bc-lbl">Sex modifier</span><span class="bc-val se">${sex === 'female' ? '+8% (female sensitivity)' : 'Standard'}</span></div>
      <div class="bc-row"><span class="bc-lbl">Age modifier</span><span class="bc-val se">${ageMod_se}</span></div>
      <div class="bc-row"><span class="bc-lbl">Goal modifier</span><span class="bc-val se">${goal === 'depression' ? '+10% (mood support)' : goal === 'athletic' ? '−5%' : 'None'}</span></div>
    </div>
    <div class="age-note">${ageNote}</div>`;
}

// ─── TARGETS PAGE ─────────────────────────────────────────────────────────────
function updateTargetsPage() {
  const t     = computeTargets(profile);
  const today = new Date().toDateString();
  const ts    = sessions.filter(s => new Date(s.time).toDateString() === today);
  const totVD = ts.reduce((a, s) => a + s.iu, 0);
  const totNO = ts.reduce((a, s) => a + s.no, 0);
  const totSE = ts.length ? Math.max(...ts.map(s => s.se)) : 0;

  setInner('t-vd-curr', totVD.toLocaleString() + ' IU');
  setInner('t-vd-goal', 'of ' + t.vd.toLocaleString() + ' IU');
  setStyle('t-vd-bar',  'width', Math.min(100, totVD / t.vd * 100) + '%');
  setInner('t-no-curr', totNO.toFixed(1) + ' μmol');
  setInner('t-no-goal', 'of ' + t.no + ' μmol');
  setStyle('t-no-bar',  'width', Math.min(100, totNO / t.no * 100) + '%');
  setInner('t-se-curr', totSE + '%');
  setInner('t-se-goal', 'of ' + t.se + '% lift');
  setStyle('t-se-bar',  'width', Math.min(100, totSE / t.se * 100) + '%');
  setInner('target-date', new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }));
}

// ─── LOCATION ─────────────────────────────────────────────────────────────────
function getLocation() {
  if (!navigator.geolocation) {
    setInner('loc-txt', 'Geolocation not supported on this device');
    return;
  }
  document.getElementById('loc-btn').textContent = '...';
  navigator.geolocation.getCurrentPosition(
    pos => {
      userLat = pos.coords.latitude;
      userLon = pos.coords.longitude;
      const la = Math.abs(userLat).toFixed(2) + (userLat >= 0 ? '°N' : '°S');
      const lo = Math.abs(userLon).toFixed(2) + (userLon >= 0 ? '°E' : '°W');
      setInner('loc-txt', la + ' · ' + lo);
      setInner('loc-sub', 'Location active — UV calibrated to your coordinates');
      const strip = document.getElementById('loc-strip');
      strip.style.background    = 'var(--green-light)';
      strip.style.borderColor   = 'rgba(59,109,17,.2)';
      document.getElementById('loc-txt').style.color = 'var(--green)';
      const btn = document.getElementById('loc-btn');
      btn.style.background = 'var(--green)';
      btn.textContent = '✓ Active';
    },
    () => {
      document.getElementById('loc-btn').textContent = 'Retry';
      setInner('loc-txt', 'Location unavailable — using default (lat 35°N)');
    }
  );
}

// ─── SOLAR MATH ───────────────────────────────────────────────────────────────
function getSolarElevation(hour, lat) {
  const decl = 15; // approx mid-year
  const ha   = (hour - 12) * 15;
  const lR   = (lat || 35) * Math.PI / 180;
  const dR   = decl * Math.PI / 180;
  const hR   = ha   * Math.PI / 180;
  const sinEl = Math.sin(lR) * Math.sin(dR) + Math.cos(lR) * Math.cos(dR) * Math.cos(hR);
  return Math.asin(sinEl) * 180 / Math.PI;
}

function getUVIndex(elevation) {
  if (elevation <= 0)  return 0;
  if (elevation < 15)  return 1;
  if (elevation < 25)  return 2;
  if (elevation < 35)  return 4;
  if (elevation < 45)  return 6;
  if (elevation < 55)  return 8;
  return 10;
}

// ─── RATE CALCULATION ─────────────────────────────────────────────────────────
function computeRates(p) {
  const skinBase  = [0, 1800, 1400, 1100, 800, 500, 300][p.skin];
  const elevation = getSolarElevation(p.hour, p.lat);
  const uv        = getUVIndex(elevation);
  const uvF       = uv / 6;
  const spfF      = p.spf > 0 ? 1 / (p.spf * 0.9) : 1.0;
  const moveF     = p.move    ? 1.12 : 1.0;
  const fatF      = p.fat     ? 1.20 : 1.0;
  const defF      = p.deficient ? 1.10 : 1.0;
  const refF      = p.ref     ? 1.15 : 1.0;
  const cloudF    = p.cloud;

  const vdPerSec  = skinBase * p.exp * uvF * spfF * moveF * fatF * defF * refF * cloudF / 3600;
  const noPerSec  = 12 * p.exp * uvF * cloudF * refF / 3600;

  return {
    vdPerSec, noPerSec,
    uv, elevation: Math.round(elevation),
    movePct: p.move ? '+12%' : '+0%',
    fatPct:  p.fat  ? '+20%' : '+0%'
  };
}

function seFromSeconds(sec, uv) {
  const max = Math.min(30, uv * 3);
  return Math.min(max, max * (1 - Math.exp(-sec / 900)));
}

// ─── SESSION ──────────────────────────────────────────────────────────────────
function setSpf(el, n) {
  spfVal = n;
  document.querySelectorAll('#spf-pills .pill').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

function buildSessParams() {
  const tv      = document.getElementById('start-time').value;
  const [h, m]  = tv.split(':').map(Number);
  return {
    dur:      parseInt(document.getElementById('duration').value) || 20,
    skin:     profile.skin,
    exp:      parseFloat(document.getElementById('exposure').value),
    spf:      spfVal,
    move:     document.getElementById('tog-move').checked,
    fat:      document.getElementById('tog-fat').checked,
    ref:      document.getElementById('tog-reflect').checked,
    deficient: profile.deficient === 'yes',
    cloud:    parseFloat(document.getElementById('cloud').value),
    hour:     h + m / 60,
    lat:      userLat,
    startTime: tv
  };
}

function startSession() {
  sessParams = buildSessParams();
  sessStart  = Date.now();

  const screen = document.getElementById('sess-screen');
  screen.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';

  // Build boost tags
  const tags = [
    { on: sessParams.move, label: 'Active movement' },
    { on: sessParams.fat,  label: 'Fat meal' },
    { on: sessParams.ref,  label: 'Reflective surface' }
  ];
  document.getElementById('boost-strip').innerHTML =
    tags.map(t => `<span class="btag ${t.on ? 'on' : ''}">${t.label}</span>`).join('');

  // Reset ring
  document.getElementById('ring-fill').style.strokeDashoffset = RING_CIRC;
  document.getElementById('ring-pct').textContent = '0%';
  document.getElementById('timer-lbl').textContent = 'Session in progress';

  timerIv = setInterval(tickSession, 1000);
  tickSession(); // immediate first tick
}

function tickSession() {
  const elapsed = (Date.now() - sessStart) / 1000;
  const rates   = computeRates(sessParams);
  const vd      = rates.vdPerSec * elapsed;
  const no      = rates.noPerSec * elapsed;
  const se      = seFromSeconds(elapsed, rates.uv);
  const projVD  = rates.vdPerSec * sessParams.dur * 60;

  // Timer display
  const mm = Math.floor(elapsed / 60);
  const ss = Math.floor(elapsed % 60);
  setInner('timer-val', pad(mm) + ':' + pad(ss));

  // Progress ring
  const pct    = Math.min(100, elapsed / (sessParams.dur * 60) * 100);
  const offset = RING_CIRC - (RING_CIRC * pct / 100);
  document.getElementById('ring-fill').style.strokeDashoffset = offset;
  setInner('ring-pct', Math.round(pct) + '%');

  // Nutrient cards
  setInner('lv-vd',      Math.round(vd).toLocaleString());
  setInner('lv-vd-rate', '+' + Math.round(rates.vdPerSec * 60) + ' IU / min');
  setInner('lv-vd-proj', Math.round(projVD).toLocaleString() + ' IU');
  setInner('lv-no',      (Math.round(no * 10) / 10).toFixed(1));
  setInner('lv-no-rate', '+' + (Math.round(rates.noPerSec * 60 * 10) / 10).toFixed(1) + ' / min');
  setInner('lv-se',      Math.round(se) + '%');
  setInner('lv-se-rate', se >= 28 ? 'Peak reached' : se > 15 ? 'Rising strongly' : 'Building...');

  // Target progress bars
  const t     = computeTargets(profile);
  const today = new Date().toDateString();
  const ts    = sessions.filter(s => new Date(s.time).toDateString() === today);
  const prevVD = ts.reduce((a, s) => a + s.iu, 0);
  const prevNO = ts.reduce((a, s) => a + s.no, 0);
  const vdPct  = Math.min(100, Math.round((prevVD + vd) / t.vd * 100));
  const noPct  = Math.min(100, Math.round((prevNO + no) / t.no * 100));
  const sePct  = Math.min(100, Math.round(se / t.se * 100));
  setStyle('st-vd', 'width', vdPct + '%'); setInner('st-vd-txt', vdPct + '%');
  setStyle('st-no', 'width', noPct + '%'); setInner('st-no-txt', noPct + '%');
  setStyle('st-se', 'width', sePct + '%'); setInner('st-se-txt', sePct + '%');

  if (elapsed >= sessParams.dur * 60) {
    setInner('timer-lbl', 'Session complete! ✓');
  }
}

function stopSession() {
  clearInterval(timerIv);
  timerIv = null;

  const elapsed = (Date.now() - sessStart) / 1000;
  const rates   = computeRates(sessParams);
  const result  = {
    iu:      Math.round(rates.vdPerSec * elapsed),
    no:      parseFloat((rates.noPerSec * elapsed).toFixed(2)),
    se:      Math.round(seFromSeconds(elapsed, rates.uv)),
    uv:      rates.uv,
    angle:   rates.elevation,
    params:  sessParams,
    time:    new Date().toISOString(),
    elapsed: Math.round(elapsed)
  };

  sessions.unshift(result);
  saveSessions();

  document.getElementById('sess-screen').setAttribute('hidden', '');
  document.body.style.overflow = '';

  goTabDirect('targets');
  updateTargetsPage();
  renderBaselineCards();
}

// ─── HISTORY ──────────────────────────────────────────────────────────────────
function renderHistory() {
  const el = document.getElementById('history-list');
  if (!sessions.length) {
    el.innerHTML = `
      <div class="empty">
        <div class="empty-sun">☀</div>
        <p>No sessions yet.</p>
        <p class="empty-sub">Start your first session to begin tracking.</p>
      </div>`;
    return;
  }
  el.innerHTML = sessions.map(s => {
    const d   = new Date(s.time);
    const ds  = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const min = Math.round(s.elapsed / 60);
    const tags = [
      s.params?.move && '<span class="stag g">Active</span>',
      s.params?.fat  && '<span class="stag g">Fat meal</span>',
      s.params?.ref  && '<span class="stag s">Reflective</span>',
      s.params?.spf > 0 && `<span class="stag s">SPF ${s.params.spf}</span>`
    ].filter(Boolean).join('');
    return `
      <div class="sess-card">
        <div class="sess-date">${ds} · ${s.params?.startTime || ''}</div>
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <div>
            <span class="sess-iu">${s.iu.toLocaleString()}</span>
            <span style="font-size:11px;color:var(--muted)"> IU</span>
          </div>
          <div class="sess-meta">
            UV ${s.uv} · ${s.angle}° · ${min} min<br>
            <span style="color:var(--purple)">NO ${s.no}μmol</span> ·
            <span style="color:var(--green)">Se +${s.se}%</span>
          </div>
        </div>
        ${tags ? `<div style="margin-top:6px">${tags}</div>` : ''}
      </div>`;
  }).join('');
}

// ─── CIRCADIAN ────────────────────────────────────────────────────────────────
function toggleCirc(which) {
  const body = document.getElementById(which + '-body');
  body.style.display = body.style.display === 'block' ? 'none' : 'block';
}

function setRemind(which, min, el) {
  circPrefs[which].remind = min;
  document.querySelectorAll(`#${which}-remind .remind-pill`).forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  saveCirc();
}

function restoreRemindPill(which, min) {
  const container = document.getElementById(which + '-remind');
  if (!container) return;
  container.querySelectorAll('.remind-pill').forEach(btn => {
    const btnMin = parseInt(btn.textContent);
    btn.classList.toggle('active', btnMin === min);
  });
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
function goTab(t, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + t).classList.add('active');
  if (el) el.classList.add('active');
  onTabEnter(t);
}

function goTabDirect(t) {
  const tabMap  = { profile: 0, session: 1, targets: 2, circadian: 3, history: 4, science: 5 };
  const tabs    = document.querySelectorAll('.tab');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  tabs.forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + t).classList.add('active');
  if (tabs[tabMap[t]]) tabs[tabMap[t]].classList.add('active');
  onTabEnter(t);
}

function onTabEnter(t) {
  if (t === 'history') renderHistory();
  if (t === 'targets') { updateTargetsPage(); renderBaselineCards(); }
  if (t === 'profile') updateComputedPreview();
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function pad(n)             { return String(n).padStart(2, '0'); }
function setInner(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }
function setStyle(id, prop, val) { const el = document.getElementById(id); if (el) el.style[prop] = val; }
function setVal(id, val)    { const el = document.getElementById(id); if (el) el.value = val; }
function setEl(id, prop, val) { const el = document.getElementById(id); if (el) el[prop] = val; }
function getVal(id)         { const el = document.getElementById(id); return el ? el.value : ''; }
function getChecked(id)     { const el = document.getElementById(id); return el ? el.checked : false; }
