/* ============================================================
   TimeGuessr — Full Game Engine
   ============================================================ */

// === Sound Engine (Web Audio API) ===
const sfx = {
  ctx: null, enabled: true,
  init() { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
  ensure() { if (!this.ctx) this.init(); if (this.ctx.state === 'suspended') this.ctx.resume(); },
  play(type) {
    if (!this.enabled) return; this.ensure(); if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = () => this.ctx.createOscillator();
    const g = () => this.ctx.createGain();
    const connect = (osc, gain) => { osc.connect(gain); gain.connect(this.ctx.destination); return { osc, gain }; };
    try { this['_' + type]?.(t, o, g, connect); } catch(e) {}
  },
  _click(t,o,g,c) { const{osc,gain}=c(o(),g()); osc.frequency.setValueAtTime(800,t); gain.gain.setValueAtTime(.08,t); gain.gain.exponentialRampToValueAtTime(.001,t+.04); osc.start(t); osc.stop(t+.04); },
  _place(t,o,g,c) { const{osc,gain}=c(o(),g()); osc.frequency.setValueAtTime(400,t); osc.frequency.exponentialRampToValueAtTime(700,t+.08); gain.gain.setValueAtTime(.1,t); gain.gain.exponentialRampToValueAtTime(.001,t+.1); osc.start(t); osc.stop(t+.1); },
  _submit(t,o,g,c) { const{osc,gain}=c(o(),g()); osc.frequency.setValueAtTime(500,t); osc.frequency.exponentialRampToValueAtTime(900,t+.15); gain.gain.setValueAtTime(.08,t); gain.gain.exponentialRampToValueAtTime(.001,t+.2); osc.start(t); osc.stop(t+.2); },
  _good(t,o,g,c) { [523,659].forEach((f,i)=>{ const{osc,gain}=c(o(),g()); osc.type='triangle'; osc.frequency.setValueAtTime(f,t+i*.12); gain.gain.setValueAtTime(.1,t+i*.12); gain.gain.exponentialRampToValueAtTime(.001,t+i*.12+.3); osc.start(t+i*.12); osc.stop(t+i*.12+.3); }); },
  _great(t,o,g,c) { [523,659,784].forEach((f,i)=>{ const{osc,gain}=c(o(),g()); osc.type='triangle'; osc.frequency.setValueAtTime(f,t+i*.1); gain.gain.setValueAtTime(.1,t+i*.1); gain.gain.exponentialRampToValueAtTime(.001,t+i*.1+.35); osc.start(t+i*.1); osc.stop(t+i*.1+.35); }); },
  _bad(t,o,g,c) { const{osc,gain}=c(o(),g()); osc.type='sawtooth'; osc.frequency.setValueAtTime(300,t); osc.frequency.exponentialRampToValueAtTime(150,t+.25); gain.gain.setValueAtTime(.06,t); gain.gain.exponentialRampToValueAtTime(.001,t+.3); osc.start(t); osc.stop(t+.3); },
  _tick(t,o,g,c) { const{osc,gain}=c(o(),g()); osc.frequency.setValueAtTime(1000,t); gain.gain.setValueAtTime(.04,t); gain.gain.exponentialRampToValueAtTime(.001,t+.02); osc.start(t); osc.stop(t+.02); },
  _warn(t,o,g,c) { const{osc,gain}=c(o(),g()); osc.frequency.setValueAtTime(880,t); gain.gain.setValueAtTime(.08,t); gain.gain.exponentialRampToValueAtTime(.001,t+.15); osc.start(t); osc.stop(t+.15); },
  _streak(t,o,g,c) { [440,554,659,880].forEach((f,i)=>{ const{osc,gain}=c(o(),g()); osc.type='triangle'; osc.frequency.setValueAtTime(f,t+i*.06); gain.gain.setValueAtTime(.08,t+i*.06); gain.gain.exponentialRampToValueAtTime(.001,t+i*.06+.2); osc.start(t+i*.06); osc.stop(t+i*.06+.2); }); },
};

// === Config ===
const DIFF = {
  easy:   { locDiv:3000, dateDiv:300, timerSec:90, hintCost:0,   hints:3 },
  normal: { locDiv:2000, dateDiv:200, timerSec:60, hintCost:200, hints:3 },
  expert: { locDiv:1000, dateDiv:100, timerSec:30, hintCost:0,   hints:0 },
};
const ROUNDS_PER_GAME = 5;
const STREAK_THRESHOLD = 1200;
const CONTINENTS = {
  'Europe':    {lat:[35,72],lng:[-25,45]},
  'Asie':      {lat:[0,60],lng:[45,180]},
  'Afrique':   {lat:[-35,37],lng:[-20,55]},
  'Amérique N':{lat:[10,72],lng:[-170,-50]},
  'Amérique S':{lat:[-56,13],lng:[-82,-34]},
  'Océanie':   {lat:[-50,0],lng:[110,180]},
};

// === State ===
const state = {
  mode: 'classic', difficulty: 'normal', category: 'all',
  rounds: [], currentRound: 0, totalScore: 0, results: [],
  guessLatLng: null, guessYear: 2000, mapPlaced: false, yearPicked: false,
  timerInterval: null, timeLeft: 0,
  hintsLeft: 3, hintsUsedThisRound: 0,
  streak: 0, bestStreak: 0,
  duelPlayer: 1, duelP1Results: [], duelP2Results: [],
  duelP1Name: 'Joueur 1', duelP2Name: 'Joueur 2',
};

// === DOM ===
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const screens = {};
['start','round','result','summary','leaderboard','stats','duel-switch','duel-summary'].forEach(n => screens[n] = $(`#screen-${n}`));

let gameMap = null, resultMap = null, guessMarker = null;

// === Init ===
document.addEventListener('DOMContentLoaded', () => {
  // Mode selection
  $$('.mode-card').forEach(c => c.addEventListener('click', () => {
    $$('.mode-card').forEach(x => x.classList.remove('active'));
    c.classList.add('active');
    state.mode = c.dataset.mode;
    sfx.play('click');
    $('#duel-names').classList.toggle('hidden', state.mode !== 'duel');
    $('#daily-status').textContent = state.mode === 'daily' ? getDailyStatus() : '';
  }));

  // Difficulty
  $$('[data-diff]').forEach(p => p.addEventListener('click', () => {
    $$('[data-diff]').forEach(x => x.classList.remove('active'));
    p.classList.add('active');
    state.difficulty = p.dataset.diff;
    sfx.play('click');
  }));

  // Category
  $$('[data-cat]').forEach(p => p.addEventListener('click', () => {
    if (p.disabled) return;
    $$('[data-cat]').forEach(x => x.classList.remove('active'));
    p.classList.add('active');
    state.category = p.dataset.cat;
    sfx.play('click');
  }));

  // Leaderboard tabs
  $$('[data-lb]').forEach(p => p.addEventListener('click', () => {
    $$('[data-lb]').forEach(x => x.classList.remove('active'));
    p.classList.add('active');
    renderLeaderboard(p.dataset.lb);
    sfx.play('click');
  }));

  // Buttons
  $('#btn-play').addEventListener('click', startGame);
  $('#btn-submit').addEventListener('click', submitGuess);
  $('#btn-next').addEventListener('click', nextRound);
  $('#btn-replay').addEventListener('click', () => location.reload());
  $('#btn-hint').addEventListener('click', useHint);
  $('#btn-leaderboard').addEventListener('click', () => { showScreen('leaderboard'); renderLeaderboard('classic'); });
  $('#btn-stats').addEventListener('click', () => { showScreen('stats'); renderStats(); });
  $('#btn-lb-back').addEventListener('click', () => showScreen('start'));
  $('#btn-stats-back').addEventListener('click', () => showScreen('start'));
  $('#btn-share').addEventListener('click', openShareModal);
  $('#btn-close-share').addEventListener('click', () => $('#share-modal').classList.add('hidden'));
  $('#btn-copy-share').addEventListener('click', copyShare);
  $('#btn-duel-continue').addEventListener('click', duelContinue);
  $('#btn-duel-replay').addEventListener('click', () => location.reload());

  // Sound toggle
  const st = $('#sound-toggle');
  sfx.enabled = localStorage.getItem('tg_sound') !== 'false';
  st.classList.toggle('muted', !sfx.enabled);
  st.addEventListener('click', () => {
    sfx.enabled = !sfx.enabled;
    localStorage.setItem('tg_sound', sfx.enabled);
    st.classList.toggle('muted', !sfx.enabled);
    sfx.play('click');
  });

  initTimeline();
  initPhotoViewer();
  updateCategoryButtons();
});

function showScreen(name) {
  Object.values(screens).forEach(s => { if(s) s.classList.remove('active'); });
  if (screens[name]) { screens[name].classList.add('active'); screens[name].style.animation='none'; screens[name].offsetHeight; screens[name].style.animation=''; }
}

// === Category management ===
function updateCategoryButtons() {
  const cats = {};
  ALL_ROUNDS.forEach(r => { cats[r.category] = (cats[r.category]||0)+1; });
  $$('[data-cat]').forEach(btn => {
    const cat = btn.dataset.cat;
    if (cat === 'all') return;
    const count = cats[cat] || 0;
    if (count < ROUNDS_PER_GAME) { btn.disabled = true; btn.title = `Pas assez de photos (${count}/${ROUNDS_PER_GAME})`; }
    else { btn.disabled = false; btn.title = ''; }
  });
}

// === Round Selection ===
function selectRounds() {
  let pool = [...ALL_ROUNDS];
  if (state.category !== 'all') pool = pool.filter(r => r.category === state.category);
  if (state.mode === 'daily') return seededShuffle(pool, hashDate(todayStr())).slice(0, ROUNDS_PER_GAME);
  return shuffle(pool).slice(0, ROUNDS_PER_GAME);
}
function shuffle(arr) { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
function seededShuffle(arr,seed) { const a=[...arr]; let s=seed; for(let i=a.length-1;i>0;i--){s=(s*1103515245+12345)&0x7fffffff;const j=s%(i+1);[a[i],a[j]]=[a[j],a[i]];} return a; }
function hashDate(str) { let h=0; for(let i=0;i<str.length;i++){h=((h<<5)-h)+str.charCodeAt(i);h|=0;} return Math.abs(h); }
function todayStr() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

// === Daily Challenge ===
function getDailyStatus() {
  const data = JSON.parse(localStorage.getItem('tg_daily')||'{}');
  if (data.date === todayStr() && data.completed) return `Déjà joué aujourd'hui : ${data.score.toLocaleString('fr-FR')} pts`;
  return '';
}
function isDailyCompleted() {
  const data = JSON.parse(localStorage.getItem('tg_daily')||'{}');
  return data.date === todayStr() && data.completed;
}
function saveDailyResult(score) {
  localStorage.setItem('tg_daily', JSON.stringify({ date: todayStr(), completed: true, score }));
}

// === Game Flow ===
function startGame() {
  if (state.mode === 'daily' && isDailyCompleted()) { $('#daily-status').textContent = 'Vous avez déjà joué le défi du jour !'; return; }
  sfx.play('click');
  state.currentRound = 0; state.totalScore = 0; state.results = [];
  state.streak = 0; state.bestStreak = 0;
  const dc = DIFF[state.difficulty];
  state.hintsLeft = dc.hints;

  if (state.mode === 'duel') {
    state.duelP1Name = $('#duel-p1-input').value.trim() || 'Joueur 1';
    state.duelP2Name = $('#duel-p2-input').value.trim() || 'Joueur 2';
    state.duelPlayer = 1; state.duelP1Results = []; state.duelP2Results = [];
  }

  state.rounds = selectRounds();
  if (state.rounds.length < ROUNDS_PER_GAME) { alert('Pas assez de photos pour cette catégorie.'); return; }

  showScreen('round');
  loadRound();
}

function loadRound() {
  const round = state.rounds[state.currentRound];
  const dc = DIFF[state.difficulty];
  state.guessLatLng = null; state.guessYear = 2000; state.mapPlaced = false; state.yearPicked = false;
  state.hintsUsedThisRound = 0;
  updateSubmitBtn();
  resetPhotoViewer();

  // Header
  const label = state.mode === 'duel' ? `${state.duelPlayer===1?state.duelP1Name:state.duelP2Name} - ` : '';
  $('#round-indicator').textContent = `${label}Round ${state.currentRound+1}/${ROUNDS_PER_GAME}`;
  $('#round-score').textContent = `Score: ${state.totalScore}`;
  $('#round-photo').src = round.image;
  setTimelineYear(2000);

  // Streak
  const streakEl = $('#round-streak');
  if (state.streak >= 2) { streakEl.classList.remove('hidden'); streakEl.textContent = `x${state.streak}`; }
  else { streakEl.classList.add('hidden'); }

  // Timer
  const timerEl = $('#round-timer');
  clearInterval(state.timerInterval);
  if (state.mode === 'chrono' || state.difficulty === 'expert') {
    state.timeLeft = dc.timerSec;
    timerEl.classList.remove('hidden','warning');
    timerEl.textContent = state.timeLeft;
    state.timerInterval = setInterval(() => {
      state.timeLeft--;
      timerEl.textContent = state.timeLeft;
      if (state.timeLeft <= 10) { timerEl.classList.add('warning'); sfx.play('warn'); }
      if (state.timeLeft <= 0) { clearInterval(state.timerInterval); autoSubmit(); }
    }, 1000);
  } else {
    timerEl.classList.add('hidden');
  }

  // Hints
  const hintBtn = $('#btn-hint');
  if (dc.hints > 0) { hintBtn.classList.remove('hidden'); $('#hint-count').textContent = state.hintsLeft; }
  else { hintBtn.classList.add('hidden'); }
  $('#hint-overlay').classList.add('hidden');

  // Map
  if (gameMap) gameMap.remove();
  gameMap = L.map('map', { center:[20,0], zoom:2, zoomControl:true });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
  }).addTo(gameMap);
  guessMarker = null;
  gameMap.on('click', e => {
    state.guessLatLng = e.latlng; state.mapPlaced = true;
    sfx.play('place');
    if (guessMarker) guessMarker.setLatLng(e.latlng);
    else {
      guessMarker = L.marker(e.latlng, { icon:L.divIcon({className:'marker-guess',iconSize:[20,20],iconAnchor:[10,10]}), draggable:true }).addTo(gameMap);
      guessMarker.on('dragend', ev => { state.guessLatLng = ev.target.getLatLng(); });
    }
    updateSubmitBtn();
  });
  setTimeout(() => gameMap.invalidateSize(), 100);
}

function autoSubmit() {
  if (!state.mapPlaced) { state.guessLatLng = {lat:0,lng:0}; state.mapPlaced = true; }
  if (!state.yearPicked) { state.yearPicked = true; }
  submitGuess();
}

function updateSubmitBtn() { $('#btn-submit').disabled = !(state.mapPlaced && state.yearPicked); }

// === Hints ===
function useHint() {
  if (state.hintsLeft <= 0) return;
  const round = state.rounds[state.currentRound];
  const dc = DIFF[state.difficulty];
  state.hintsLeft--; state.hintsUsedThisRound++;
  $('#hint-count').textContent = state.hintsLeft;
  sfx.play('click');

  let text = '';
  const hintNum = dc.hints - state.hintsLeft;
  if (hintNum === 1) { text = `Continent : ${getContinent(round.lat, round.lng)}`; }
  else if (hintNum === 2) { const dec = Math.floor(round.year/10)*10; text = `Décennie : ${dec}s`; }
  else if (hintNum === 3) { text = `Catégorie : ${round.category}`; }

  $('#hint-text').textContent = text;
  $('#hint-overlay').classList.remove('hidden');
  setTimeout(() => $('#hint-overlay').classList.add('hidden'), 4000);
}

function getContinent(lat,lng) {
  for (const [name,b] of Object.entries(CONTINENTS)) {
    if (lat>=b.lat[0]&&lat<=b.lat[1]&&lng>=b.lng[0]&&lng<=b.lng[1]) return name;
  }
  return 'Inconnu';
}

// === Scoring ===
function submitGuess() {
  clearInterval(state.timerInterval);
  sfx.play('submit');
  const round = state.rounds[state.currentRound];
  const dc = DIFF[state.difficulty];
  const distKm = haversineDistance(state.guessLatLng.lat,state.guessLatLng.lng,round.lat,round.lng);
  const yearDiff = Math.abs(state.guessYear - round.year);
  let locationScore = Math.round(1000 * Math.exp(-distKm / dc.locDiv));
  let dateScore = Math.round(1000 * Math.exp(-yearDiff / dc.dateDiv));

  // Time bonus (chrono/expert)
  let timeBonus = 0;
  if (state.mode === 'chrono' || state.difficulty === 'expert') {
    const maxT = dc.timerSec;
    timeBonus = Math.round((locationScore + dateScore) * 0.3 * (state.timeLeft / maxT));
  }

  // Hint penalty
  const hintPenalty = state.hintsUsedThisRound * dc.hintCost;
  let totalRoundScore = Math.max(0, locationScore + dateScore + timeBonus - hintPenalty);

  // Streak
  if (totalRoundScore >= STREAK_THRESHOLD) { state.streak++; if(state.streak>state.bestStreak) state.bestStreak=state.streak; }
  else state.streak = 0;

  // Streak bonus
  let streakMultiplier = 1;
  if (state.streak >= 5) streakMultiplier = 1.5;
  else if (state.streak >= 4) streakMultiplier = 1.3;
  else if (state.streak >= 3) streakMultiplier = 1.2;
  else if (state.streak >= 2) streakMultiplier = 1.1;
  totalRoundScore = Math.round(totalRoundScore * streakMultiplier);

  state.totalScore += totalRoundScore;
  const result = { round, distKm, yearDiff, locationScore, dateScore, timeBonus, hintPenalty, totalRoundScore,
    guessLatLng:{...state.guessLatLng}, guessYear:state.guessYear, streak:state.streak, streakMultiplier };
  state.results.push(result);
  showResult(result);
}

// === Result Screen ===
function showResult(result) {
  showScreen('result');

  // Sound
  if (result.totalRoundScore >= 1800) sfx.play('great');
  else if (result.totalRoundScore >= STREAK_THRESHOLD) sfx.play('good');
  else sfx.play('bad');
  if (result.streak >= 2) setTimeout(() => sfx.play('streak'), 600);

  // Photo thumb
  $('#result-photo-thumb').src = result.round.image;
  $('#result-title').textContent = result.round.title;
  $('#result-description').textContent = result.round.description;
  $('#result-distance').textContent = formatDistance(result.distKm);
  $('#result-years').textContent = formatYearDiff(result.yearDiff);
  $('#result-location-pts').textContent = `+${result.locationScore} pts`;
  $('#result-date-pts').textContent = `+${result.dateScore} pts`;

  // Time bonus card
  const statTime = $('#stat-time');
  if (result.timeBonus > 0) { statTime.classList.remove('hidden'); $('#result-time-bonus').textContent = `+${result.timeBonus}`; }
  else statTime.classList.add('hidden');

  // Total
  const totalEl = $('#result-total');
  totalEl.textContent = '0'; totalEl.classList.remove('score-animated'); totalEl.offsetHeight; totalEl.classList.add('score-animated');
  animateNumber(totalEl, 0, result.totalRoundScore, 800);

  // Streak message
  const streakMsg = $('#result-streak-msg');
  if (result.streak >= 2) {
    streakMsg.classList.remove('hidden');
    streakMsg.textContent = `Streak x${result.streak} ! (bonus x${result.streakMultiplier})`;
  } else streakMsg.classList.add('hidden');

  // Next button text
  const isLast = state.currentRound >= ROUNDS_PER_GAME - 1;
  const isDuelSwitch = state.mode === 'duel' && state.duelPlayer === 1 && isLast;
  if (isDuelSwitch) $('#btn-next').textContent = 'Tour suivant';
  else if (isLast) $('#btn-next').textContent = 'Voir le résultat final';
  else $('#btn-next').textContent = 'Round suivant';

  // Animated result map
  if (resultMap) resultMap.remove();
  setTimeout(() => {
    resultMap = L.map('result-map', { zoomControl:true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution:'&copy; OSM &copy; CARTO'
    }).addTo(resultMap);

    // Start centered on guess
    resultMap.setView([result.guessLatLng.lat, result.guessLatLng.lng], 5);
    L.marker([result.guessLatLng.lat,result.guessLatLng.lng], {
      icon:L.divIcon({className:'marker-guess',iconSize:[20,20],iconAnchor:[10,10]})
    }).addTo(resultMap).bindPopup('Votre réponse');

    // Animate line + fly to bounds
    setTimeout(() => {
      animateLine(resultMap,
        [result.guessLatLng.lat,result.guessLatLng.lng],
        [result.round.lat,result.round.lng], 800);
      const bounds = L.latLngBounds([result.guessLatLng.lat,result.guessLatLng.lng],[result.round.lat,result.round.lng]);
      resultMap.flyToBounds(bounds, { padding:[50,50], maxZoom:8, duration:1.2 });
    }, 400);

    // Answer marker after line draws
    setTimeout(() => {
      L.marker([result.round.lat,result.round.lng], {
        icon:L.divIcon({className:'marker-answer',iconSize:[20,20],iconAnchor:[10,10]})
      }).addTo(resultMap).bindPopup(result.round.title);
    }, 1300);
  }, 50);
}

function animateLine(map, from, to, duration) {
  const steps = 40;
  const points = [from];
  const polyline = L.polyline(points, { color:'rgba(201,168,76,0.5)', dashArray:'8,8', weight:2 }).addTo(map);
  let step = 0;
  const interval = setInterval(() => {
    step++;
    const t = step / steps;
    points.push([from[0]+(to[0]-from[0])*t, from[1]+(to[1]-from[1])*t]);
    polyline.setLatLngs(points);
    if (step >= steps) clearInterval(interval);
  }, duration / steps);
}

// === Next Round / Summary ===
function nextRound() {
  sfx.play('click');
  state.currentRound++;

  if (state.mode === 'duel' && state.duelPlayer === 1 && state.currentRound >= ROUNDS_PER_GAME) {
    // Switch to player 2
    state.duelP1Results = [...state.results];
    state.results = []; state.currentRound = 0; state.totalScore = 0;
    state.streak = 0; state.hintsLeft = DIFF[state.difficulty].hints;
    state.duelPlayer = 2;
    $('#duel-next-player').textContent = state.duelP2Name;
    showScreen('duel-switch');
    return;
  }

  if (state.currentRound >= ROUNDS_PER_GAME) {
    if (state.mode === 'duel') { state.duelP2Results = [...state.results]; showDuelSummary(); }
    else showSummary();
  } else {
    showScreen('round');
    loadRound();
  }
}

function duelContinue() {
  sfx.play('click');
  showScreen('round');
  loadRound();
}

// === Summary ===
function showSummary() {
  showScreen('summary');
  const maxScore = ROUNDS_PER_GAME * 2000;
  $('#summary-max-val').textContent = maxScore.toLocaleString('fr-FR');

  const scoreEl = $('#summary-score');
  scoreEl.textContent = '0'; scoreEl.classList.remove('score-animated'); scoreEl.offsetHeight; scoreEl.classList.add('score-animated');
  animateNumber(scoreEl, 0, state.totalScore, 1200);
  $('#summary-tier').textContent = getTier(state.totalScore);

  const fillEl = $('#score-bar-fill');
  fillEl.style.width = '0%';
  setTimeout(() => { fillEl.style.width = (state.totalScore/maxScore*100)+'%'; }, 300);

  const tbody = $('#summary-table tbody');
  tbody.innerHTML = '';
  state.results.forEach((r,i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td>${r.round.title}</td><td>${r.locationScore}</td><td>${r.dateScore}</td><td style="color:var(--accent);font-weight:700">${r.totalRoundScore}</td>`;
    tbody.appendChild(tr);
  });

  // Save to leaderboard & stats
  saveToLeaderboard(state.totalScore, state.mode, state.difficulty);
  saveToStats(state.totalScore, state.mode, state.bestStreak);
  if (state.mode === 'daily') saveDailyResult(state.totalScore);
}

// === Duel Summary ===
function showDuelSummary() {
  showScreen('duel-summary');
  const p1Total = state.duelP1Results.reduce((s,r) => s+r.totalRoundScore, 0);
  const p2Total = state.duelP2Results.reduce((s,r) => s+r.totalRoundScore, 0);

  $('#duel-p1-name').textContent = state.duelP1Name;
  $('#duel-p2-name').textContent = state.duelP2Name;
  $('#duel-p1-score').textContent = p1Total.toLocaleString('fr-FR');
  $('#duel-p2-score').textContent = p2Total.toLocaleString('fr-FR');
  $('#duel-th-p1').textContent = state.duelP1Name;
  $('#duel-th-p2').textContent = state.duelP2Name;

  const p1Card = $('#duel-p1-card'), p2Card = $('#duel-p2-card');
  p1Card.classList.remove('winner'); p2Card.classList.remove('winner');
  if (p1Total > p2Total) { p1Card.classList.add('winner'); $('#duel-winner').textContent = `${state.duelP1Name} remporte le duel !`; }
  else if (p2Total > p1Total) { p2Card.classList.add('winner'); $('#duel-winner').textContent = `${state.duelP2Name} remporte le duel !`; }
  else $('#duel-winner').textContent = 'Égalité parfaite !';

  const tbody = $('#duel-table tbody');
  tbody.innerHTML = '';
  for (let i = 0; i < ROUNDS_PER_GAME; i++) {
    const r1 = state.duelP1Results[i], r2 = state.duelP2Results[i];
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td>${r1.round.title}</td>
      <td style="color:${r1.totalRoundScore>=r2.totalRoundScore?'var(--accent)':'var(--text-dim)'};font-weight:700">${r1.totalRoundScore}</td>
      <td style="color:${r2.totalRoundScore>=r1.totalRoundScore?'var(--accent)':'var(--text-dim)'};font-weight:700">${r2.totalRoundScore}</td>`;
    tbody.appendChild(tr);
  }
  sfx.play(p1Total !== p2Total ? 'great' : 'good');
}

// === Share ===
function openShareModal() {
  sfx.play('click');
  const maxScore = ROUNDS_PER_GAME * 2000;
  let text = `TimeGuessr - ${todayStr()}\n`;
  text += `${getTier(state.totalScore)}\n`;
  text += `${state.totalScore.toLocaleString('fr-FR')} / ${maxScore.toLocaleString('fr-FR')}\n\n`;
  state.results.forEach((r,i) => {
    const pct = r.totalRoundScore / 2000;
    const filled = Math.round(pct * 10);
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled);
    text += `R${i+1}: ${bar} ${r.totalRoundScore.toLocaleString('fr-FR')}\n`;
  });
  text += `\nMode: ${state.mode} | ${state.difficulty}`;
  $('#share-text').textContent = text;
  $('#share-modal').classList.remove('hidden');
  $('#copy-feedback').classList.add('hidden');
}

function copyShare() {
  navigator.clipboard.writeText($('#share-text').textContent).then(() => {
    $('#copy-feedback').classList.remove('hidden');
    sfx.play('good');
    setTimeout(() => $('#copy-feedback').classList.add('hidden'), 2000);
  });
}

// === Leaderboard (localStorage) ===
function getLeaderboard() { return JSON.parse(localStorage.getItem('tg_leaderboard')||'[]'); }
function saveToLeaderboard(score, mode, diff) {
  const lb = getLeaderboard();
  lb.push({ score, mode, difficulty: diff, date: todayStr() });
  lb.sort((a,b) => b.score - a.score);
  localStorage.setItem('tg_leaderboard', JSON.stringify(lb.slice(0,50)));
}
function renderLeaderboard(modeFilter) {
  const lb = getLeaderboard().filter(e => e.mode === modeFilter);
  const tbody = $('#lb-table tbody');
  tbody.innerHTML = '';
  $('#lb-empty').classList.toggle('hidden', lb.length > 0);
  $('#lb-table').classList.toggle('hidden', lb.length === 0);
  lb.slice(0,15).forEach((e,i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td style="font-weight:700">${e.score.toLocaleString('fr-FR')}</td><td>${e.difficulty}</td><td>${e.date}</td>`;
    tbody.appendChild(tr);
  });
}

// === Stats (localStorage) ===
function getStats() { return JSON.parse(localStorage.getItem('tg_stats')||'{"games":0,"totalScore":0,"bestScore":0,"bestStreak":0,"history":[]}'); }
function saveToStats(score, mode, bestStreak) {
  const s = getStats();
  s.games++; s.totalScore += score;
  if (score > s.bestScore) s.bestScore = score;
  if (bestStreak > s.bestStreak) s.bestStreak = bestStreak;
  s.history.unshift({ score, mode, date: todayStr() });
  s.history = s.history.slice(0, 20);
  localStorage.setItem('tg_stats', JSON.stringify(s));
}
function renderStats() {
  const s = getStats();
  $('#stats-games').textContent = s.games;
  $('#stats-avg').textContent = s.games ? Math.round(s.totalScore/s.games).toLocaleString('fr-FR') : '0';
  $('#stats-best').textContent = s.bestScore.toLocaleString('fr-FR');
  $('#stats-streak').textContent = s.bestStreak;
  const hist = $('#stats-history');
  hist.innerHTML = '';
  $('#stats-empty').classList.toggle('hidden', s.history.length > 0);
  s.history.forEach(h => {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `<div><span class="history-score">${h.score.toLocaleString('fr-FR')}</span> <span class="history-meta">${h.mode}</span></div><span class="history-meta">${h.date}</span>`;
    hist.appendChild(div);
  });
}

// === Timeline ===
const SEGMENTS = [[1970, 2025, 1.0]];

function yearToPercent(year) {
  let acc=0; for(const[s,e,w]of SEGMENTS){if(year<=e){const c=Math.max(year,s);return(acc+(c-s)/(e-s)*w)*100;}acc+=w;} return 100;
}
function percentToYear(pct) {
  const f=pct/100; let acc=0; for(const[s,e,w]of SEGMENTS){if(f<=acc+w){return Math.round(s+(f-acc)/w*(e-s));}acc+=w;} return 2025;
}
function setTimelineYear(year) {
  state.guessYear=year; const pct=yearToPercent(year);
  $('#timeline-thumb').style.left=pct+'%'; $('#timeline-fill').style.width=pct+'%'; $('#timeline-tooltip').textContent=year;
}
function initTimeline() {
  const track=$('#timeline'); let dragging=false;
  function handle(e){const r=track.getBoundingClientRect();const x=(e.clientX||e.touches?.[0]?.clientX||0)-r.left;const p=Math.max(0,Math.min(100,x/r.width*100));setTimelineYear(percentToYear(p));state.yearPicked=true;updateSubmitBtn();}
  track.addEventListener('pointerdown',e=>{dragging=true;track.setPointerCapture(e.pointerId);handle(e);sfx.play('tick');});
  track.addEventListener('pointermove',e=>{if(dragging)handle(e);});
  track.addEventListener('pointerup',()=>{dragging=false;}); track.addEventListener('pointercancel',()=>{dragging=false;});
}

// === Photo Viewer ===
const pv={s:1,tx:0,ty:0,dragging:false,lx:0,ly:0};
function initPhotoViewer(){
  const panel=$('.photo-panel'); if(!panel)return;
  panel.addEventListener('wheel',e=>{e.preventDefault();const img=$('#round-photo');const r=img.getBoundingClientRect();const cx=r.left+r.width/2,cy=r.top+r.height/2;const mx=e.clientX-cx,my=e.clientY-cy;
    const old=pv.s;const ns=Math.max(1,Math.min(10,old*(e.deltaY<0?1.18:1/1.18)));const ratio=ns/old;pv.tx=mx-(mx-pv.tx)*ratio;pv.ty=my-(my-pv.ty)*ratio;pv.s=ns;if(ns===1){pv.tx=0;pv.ty=0;}constrain(img);applyPV(img,false);},{passive:false});
  panel.addEventListener('mousedown',e=>{if(pv.s<=1)return;pv.dragging=true;pv.lx=e.clientX;pv.ly=e.clientY;panel.style.cursor='grabbing';e.preventDefault();});
  window.addEventListener('mousemove',e=>{if(!pv.dragging)return;pv.tx+=e.clientX-pv.lx;pv.ty+=e.clientY-pv.ly;pv.lx=e.clientX;pv.ly=e.clientY;constrain($('#round-photo'));applyPV($('#round-photo'),true);});
  window.addEventListener('mouseup',()=>{if(!pv.dragging)return;pv.dragging=false;const p=$('.photo-panel');if(p)p.style.cursor=pv.s>1?'grab':'';});
  panel.addEventListener('dblclick',e=>{e.preventDefault();const img=$('#round-photo');if(pv.s>1){pv.s=1;pv.tx=0;pv.ty=0;}else{const r=img.getBoundingClientRect();const mx=e.clientX-(r.left+r.width/2),my=e.clientY-(r.top+r.height/2);const ns=3,ratio=ns/pv.s;pv.tx=mx-(mx-pv.tx)*ratio;pv.ty=my-(my-pv.ty)*ratio;pv.s=ns;constrain(img);}applyPV(img,false);panel.style.cursor=pv.s>1?'grab':'';});
  let ld=0,ltx=0,lty=0,touching=false;
  panel.addEventListener('touchstart',e=>{if(e.touches.length===1&&pv.s>1){touching=true;ltx=e.touches[0].clientX;lty=e.touches[0].clientY;}else if(e.touches.length===2){touching=false;ld=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);}},{passive:true});
  panel.addEventListener('touchmove',e=>{const img=$('#round-photo');if(e.touches.length===1&&touching){e.preventDefault();pv.tx+=e.touches[0].clientX-ltx;pv.ty+=e.touches[0].clientY-lty;ltx=e.touches[0].clientX;lty=e.touches[0].clientY;constrain(img);applyPV(img,true);}else if(e.touches.length===2){e.preventDefault();const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);pv.s=Math.max(1,Math.min(10,pv.s*(d/ld)));if(pv.s===1){pv.tx=0;pv.ty=0;}constrain(img);applyPV(img,true);ld=d;}},{passive:false});
  panel.addEventListener('touchend',()=>{touching=false;});
}
function constrain(img){if(!img||pv.s<=1)return;const mx=(img.offsetWidth*(pv.s-1))/2,my=(img.offsetHeight*(pv.s-1))/2;pv.tx=Math.max(-mx,Math.min(mx,pv.tx));pv.ty=Math.max(-my,Math.min(my,pv.ty));}
function applyPV(img,instant){if(!img)return;img.style.transition=instant?'none':'transform .2s ease-out';img.style.transform=`translate(${pv.tx}px,${pv.ty}px) scale(${pv.s})`;const p=$('.photo-panel');if(p&&!pv.dragging)p.style.cursor=pv.s>1?'grab':'';}
function resetPhotoViewer(){pv.s=1;pv.tx=0;pv.ty=0;const img=$('#round-photo');if(img){img.style.transition='none';img.style.transform='';}const p=$('.photo-panel');if(p)p.style.cursor='';}

// === Utils ===
function haversineDistance(lat1,lng1,lat2,lng2){const R=6371,toR=d=>d*Math.PI/180,dLat=toR(lat2-lat1),dLng=toR(lng2-lng1),a=Math.sin(dLat/2)**2+Math.cos(toR(lat1))*Math.cos(toR(lat2))*Math.sin(dLng/2)**2;return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}
function formatDistance(km){if(km<1)return`${Math.round(km*1000)} m`;if(km<100)return`${km.toFixed(1)} km`;return`${Math.round(km).toLocaleString('fr-FR')} km`;}
function formatYearDiff(d){if(d===0)return'Exact !';if(d===1)return'1 an';return`${d} ans`;}
function getTier(s){if(s>=9000)return'Historien Légendaire';if(s>=7500)return'Maître du Temps';if(s>=5000)return'Voyageur Temporel';if(s>=3000)return'Explorateur';if(s>=1500)return'Novice Curieux';return'Touriste Perdu';}
function animateNumber(el,from,to,dur){const st=performance.now();(function tick(now){const p=Math.min((now-st)/dur,1);const e=1-Math.pow(1-p,3);el.textContent=Math.round(from+(to-from)*e).toLocaleString('fr-FR');if(p<1)requestAnimationFrame(tick);})(performance.now());}
