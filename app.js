// === State ===
const state = {
  rounds: [],
  currentRound: 0,
  totalScore: 0,
  results: [],
  guessLatLng: null,
  guessYear: 1900,
  mapPlaced: false,
  yearPicked: false
};

// === DOM Elements ===
const $ = (sel) => document.querySelector(sel);
const screens = {
  start: $('#screen-start'),
  round: $('#screen-round'),
  result: $('#screen-result'),
  summary: $('#screen-summary')
};

// === Maps ===
let gameMap = null;
let resultMap = null;
let guessMarker = null;

// === Init ===
document.addEventListener('DOMContentLoaded', () => {
  $('#btn-play').addEventListener('click', startGame);
  $('#btn-submit').addEventListener('click', submitGuess);
  $('#btn-next').addEventListener('click', nextRound);
  $('#btn-replay').addEventListener('click', () => { window.location.reload(); });

  initTimeline();
  initPhotoViewer();
});

// === Screen Navigation ===
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
  screens[name].style.animation = 'none';
  screens[name].offsetHeight;
  screens[name].style.animation = '';
}

// === Game Flow ===
function startGame() {
  state.currentRound = 0;
  state.totalScore = 0;
  state.results = [];
  // Les 5 rounds sont deja selectionnes par PHP
  state.rounds = ROUNDS_DATA;

  showScreen('round');
  loadRound();
}

function loadRound() {
  const round = state.rounds[state.currentRound];

  state.guessLatLng = null;
  state.guessYear = 2000;
  state.mapPlaced = false;
  state.yearPicked = false;
  updateSubmitBtn();
  resetPhotoViewer();

  $('#round-indicator').textContent = `Round ${state.currentRound + 1}/5`;
  $('#round-score').textContent = `Score: ${state.totalScore}`;
  $('#round-photo').src = round.image;

  setTimelineYear(2000);

  if (gameMap) {
    gameMap.remove();
  }
  gameMap = L.map('map', {
    center: [20, 0],
    zoom: 2,
    zoomControl: true
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
  }).addTo(gameMap);

  guessMarker = null;

  gameMap.on('click', (e) => {
    state.guessLatLng = e.latlng;
    state.mapPlaced = true;

    if (guessMarker) {
      guessMarker.setLatLng(e.latlng);
    } else {
      guessMarker = L.marker(e.latlng, {
        icon: L.divIcon({
          className: 'marker-guess',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        }),
        draggable: true
      }).addTo(gameMap);

      guessMarker.on('dragend', (ev) => {
        state.guessLatLng = ev.target.getLatLng();
      });
    }
    updateSubmitBtn();
  });

  setTimeout(() => gameMap.invalidateSize(), 100);
}

function updateSubmitBtn() {
  $('#btn-submit').disabled = !(state.mapPlaced && state.yearPicked);
}

function submitGuess() {
  const round = state.rounds[state.currentRound];

  const distKm = haversineDistance(
    state.guessLatLng.lat, state.guessLatLng.lng,
    round.lat, round.lng
  );
  const yearDiff = Math.abs(state.guessYear - round.year);

  const locationScore = Math.round(1000 * Math.exp(-distKm / 2000));
  const dateScore = Math.round(1000 * Math.exp(-yearDiff / 200));
  const totalRoundScore = locationScore + dateScore;

  state.totalScore += totalRoundScore;

  state.results.push({
    round,
    distKm,
    yearDiff,
    locationScore,
    dateScore,
    totalRoundScore,
    guessLatLng: { ...state.guessLatLng },
    guessYear: state.guessYear
  });

  showResult(state.results[state.results.length - 1]);
}

function showResult(result) {
  showScreen('result');

  $('#result-title').textContent = result.round.title;
  $('#result-description').textContent = result.round.description;
  $('#result-distance').textContent = formatDistance(result.distKm);
  $('#result-years').textContent = formatYearDiff(result.yearDiff);
  $('#result-location-pts').textContent = `+${result.locationScore} pts`;
  $('#result-date-pts').textContent = `+${result.dateScore} pts`;

  const totalEl = $('#result-total');
  totalEl.textContent = '0';
  totalEl.classList.remove('score-animated');
  totalEl.offsetHeight;
  totalEl.classList.add('score-animated');
  animateNumber(totalEl, 0, result.totalRoundScore, 800);

  if (state.currentRound >= 4) {
    $('#btn-next').textContent = 'Voir le résultat final';
  } else {
    $('#btn-next').textContent = 'Round suivant';
  }

  if (resultMap) {
    resultMap.remove();
  }

  setTimeout(() => {
    resultMap = L.map('result-map', { zoomControl: true });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
    }).addTo(resultMap);

    L.marker([result.guessLatLng.lat, result.guessLatLng.lng], {
      icon: L.divIcon({ className: 'marker-guess', iconSize: [20, 20], iconAnchor: [10, 10] })
    }).addTo(resultMap).bindPopup('Votre réponse');

    L.marker([result.round.lat, result.round.lng], {
      icon: L.divIcon({ className: 'marker-answer', iconSize: [20, 20], iconAnchor: [10, 10] })
    }).addTo(resultMap).bindPopup(result.round.title);

    L.polyline(
      [[result.guessLatLng.lat, result.guessLatLng.lng], [result.round.lat, result.round.lng]],
      { color: 'rgba(201, 168, 76, 0.4)', dashArray: '8, 8', weight: 2 }
    ).addTo(resultMap);

    const bounds = L.latLngBounds(
      [result.guessLatLng.lat, result.guessLatLng.lng],
      [result.round.lat, result.round.lng]
    );
    resultMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 8 });
  }, 50);
}

function nextRound() {
  state.currentRound++;
  if (state.currentRound >= 5) {
    showSummary();
  } else {
    showScreen('round');
    loadRound();
  }
}

function showSummary() {
  showScreen('summary');

  const scoreEl = $('#summary-score');
  scoreEl.textContent = '0';
  scoreEl.classList.remove('score-animated');
  scoreEl.offsetHeight;
  scoreEl.classList.add('score-animated');
  animateNumber(scoreEl, 0, state.totalScore, 1200);

  const tier = getTier(state.totalScore);
  $('#summary-tier').textContent = tier;

  const fillEl = document.getElementById('score-bar-fill');
  if (fillEl) {
    fillEl.style.width = '0%';
    setTimeout(() => {
      fillEl.style.width = (state.totalScore / 10000 * 100) + '%';
    }, 300);
  }

  const tbody = $('#summary-table tbody');
  tbody.innerHTML = '';
  state.results.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${r.round.title}</td>
      <td>${r.locationScore}</td>
      <td>${r.dateScore}</td>
      <td style="color: var(--accent); font-weight: 700">${r.totalRoundScore}</td>
    `;
    tbody.appendChild(tr);
  });
}

// === Timeline ===
const SEGMENTS = [
  [1970, 2025, 1.0]
];

function yearToPercent(year) {
  let accumulated = 0;
  for (const [start, end, width] of SEGMENTS) {
    if (year <= end) {
      const clamped = Math.max(year, start);
      const frac = (clamped - start) / (end - start);
      return (accumulated + frac * width) * 100;
    }
    accumulated += width;
  }
  return 100;
}

function percentToYear(pct) {
  const frac = pct / 100;
  let accumulated = 0;
  for (const [start, end, width] of SEGMENTS) {
    if (frac <= accumulated + width) {
      const localFrac = (frac - accumulated) / width;
      return Math.round(start + localFrac * (end - start));
    }
    accumulated += width;
  }
  return 2025;
}

function formatYear(year) {
  return `${year}`;
}

function setTimelineYear(year) {
  state.guessYear = year;
  const pct = yearToPercent(year);
  $('#timeline-thumb').style.left = pct + '%';
  $('#timeline-fill').style.width = pct + '%';
  $('#timeline-tooltip').textContent = formatYear(year);
}

function initTimeline() {
  const track = $('#timeline');

  function handlePointer(e) {
    const rect = track.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const year = percentToYear(pct);
    setTimelineYear(year);
    state.yearPicked = true;
    updateSubmitBtn();
  }

  let dragging = false;

  track.addEventListener('pointerdown', (e) => {
    dragging = true;
    track.setPointerCapture(e.pointerId);
    handlePointer(e);
  });

  track.addEventListener('pointermove', (e) => {
    if (dragging) handlePointer(e);
  });

  track.addEventListener('pointerup', () => { dragging = false; });
  track.addEventListener('pointercancel', () => { dragging = false; });
}

// === Utils ===
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString('fr-FR')} km`;
}

function formatYearDiff(diff) {
  if (diff === 0) return 'Exact !';
  if (diff === 1) return '1 an';
  return `${diff} ans`;
}

function getTier(score) {
  if (score >= 9000) return 'Historien Légendaire';
  if (score >= 7500) return 'Maître du Temps';
  if (score >= 5000) return 'Voyageur Temporel';
  if (score >= 3000) return 'Explorateur';
  if (score >= 1500) return 'Novice Curieux';
  return 'Touriste Perdu';
}

function animateNumber(el, from, to, duration) {
  const start = performance.now();
  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(from + (to - from) * eased).toLocaleString('fr-FR');
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// === Photo Viewer (Pan & Zoom like Google Maps) ===
const photo$ = { scale: 1, tx: 0, ty: 0, dragging: false, lx: 0, ly: 0 };

function initPhotoViewer() {
  const panel = $('.photo-panel');
  if (!panel) return;

  // Wheel zoom (zoom vers le curseur)
  panel.addEventListener('wheel', (e) => {
    e.preventDefault();
    const img = $('#round-photo');
    const rect = img.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const mx = e.clientX - cx;
    const my = e.clientY - cy;

    const old = photo$.scale;
    const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
    const ns = Math.max(1, Math.min(10, old * factor));
    const r = ns / old;

    photo$.tx = mx - (mx - photo$.tx) * r;
    photo$.ty = my - (my - photo$.ty) * r;
    photo$.scale = ns;

    if (ns === 1) { photo$.tx = 0; photo$.ty = 0; }
    constrainPhoto(img);
    applyPhoto(img, false);
  }, { passive: false });

  // Mouse drag
  panel.addEventListener('mousedown', (e) => {
    if (photo$.scale <= 1) return;
    photo$.dragging = true;
    photo$.lx = e.clientX;
    photo$.ly = e.clientY;
    panel.style.cursor = 'grabbing';
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!photo$.dragging) return;
    photo$.tx += e.clientX - photo$.lx;
    photo$.ty += e.clientY - photo$.ly;
    photo$.lx = e.clientX;
    photo$.ly = e.clientY;
    constrainPhoto($('#round-photo'));
    applyPhoto($('#round-photo'), true);
  });

  window.addEventListener('mouseup', () => {
    if (!photo$.dragging) return;
    photo$.dragging = false;
    const p = $('.photo-panel');
    if (p) p.style.cursor = photo$.scale > 1 ? 'grab' : '';
  });

  // Double-click : zoom x3 ou reset
  panel.addEventListener('dblclick', (e) => {
    e.preventDefault();
    const img = $('#round-photo');
    if (photo$.scale > 1) {
      photo$.scale = 1; photo$.tx = 0; photo$.ty = 0;
    } else {
      const rect = img.getBoundingClientRect();
      const mx = e.clientX - (rect.left + rect.width / 2);
      const my = e.clientY - (rect.top + rect.height / 2);
      const ns = 3;
      const r = ns / photo$.scale;
      photo$.tx = mx - (mx - photo$.tx) * r;
      photo$.ty = my - (my - photo$.ty) * r;
      photo$.scale = ns;
      constrainPhoto(img);
    }
    applyPhoto(img, false);
    panel.style.cursor = photo$.scale > 1 ? 'grab' : '';
  });

  // Touch: pinch-to-zoom + drag
  let lastDist = 0, lastTx = 0, lastTy = 0, touching = false;

  panel.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1 && photo$.scale > 1) {
      touching = true;
      lastTx = e.touches[0].clientX;
      lastTy = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      touching = false;
      lastDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: true });

  panel.addEventListener('touchmove', (e) => {
    const img = $('#round-photo');
    if (e.touches.length === 1 && touching) {
      e.preventDefault();
      photo$.tx += e.touches[0].clientX - lastTx;
      photo$.ty += e.touches[0].clientY - lastTy;
      lastTx = e.touches[0].clientX;
      lastTy = e.touches[0].clientY;
      constrainPhoto(img);
      applyPhoto(img, true);
    } else if (e.touches.length === 2) {
      e.preventDefault();
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      photo$.scale = Math.max(1, Math.min(10, photo$.scale * (d / lastDist)));
      if (photo$.scale === 1) { photo$.tx = 0; photo$.ty = 0; }
      constrainPhoto(img);
      applyPhoto(img, true);
      lastDist = d;
    }
  }, { passive: false });

  panel.addEventListener('touchend', () => { touching = false; });
}

function constrainPhoto(img) {
  if (!img || photo$.scale <= 1) return;
  const maxX = (img.offsetWidth * (photo$.scale - 1)) / 2;
  const maxY = (img.offsetHeight * (photo$.scale - 1)) / 2;
  photo$.tx = Math.max(-maxX, Math.min(maxX, photo$.tx));
  photo$.ty = Math.max(-maxY, Math.min(maxY, photo$.ty));
}

function applyPhoto(img, instant) {
  if (!img) return;
  img.style.transition = instant ? 'none' : 'transform 0.2s ease-out';
  img.style.transform = `translate(${photo$.tx}px, ${photo$.ty}px) scale(${photo$.scale})`;
  const p = $('.photo-panel');
  if (p && !photo$.dragging) p.style.cursor = photo$.scale > 1 ? 'grab' : '';
}

function resetPhotoViewer() {
  photo$.scale = 1; photo$.tx = 0; photo$.ty = 0;
  const img = $('#round-photo');
  if (img) { img.style.transition = 'none'; img.style.transform = ''; }
  const p = $('.photo-panel');
  if (p) p.style.cursor = '';
}
