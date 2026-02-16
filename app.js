// === State ===
const state = {
  allRounds: [],
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
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('rounds.json');
    state.allRounds = await res.json();
  } catch (e) {
    console.error('Erreur chargement rounds.json:', e);
    return;
  }

  $('#btn-play').addEventListener('click', startGame);
  $('#btn-submit').addEventListener('click', submitGuess);
  $('#btn-next').addEventListener('click', nextRound);
  $('#btn-replay').addEventListener('click', startGame);

  initTimeline();
});

// === Screen Navigation ===
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
  // Re-trigger animation
  screens[name].style.animation = 'none';
  screens[name].offsetHeight; // force reflow
  screens[name].style.animation = '';
}

// === Game Flow ===
function startGame() {
  state.currentRound = 0;
  state.totalScore = 0;
  state.results = [];

  // Pick 5 random rounds
  const shuffled = [...state.allRounds].sort(() => Math.random() - 0.5);
  state.rounds = shuffled.slice(0, 5);

  showScreen('round');
  loadRound();
}

function loadRound() {
  const round = state.rounds[state.currentRound];

  // Reset state
  state.guessLatLng = null;
  state.guessYear = 1900;
  state.mapPlaced = false;
  state.yearPicked = false;
  updateSubmitBtn();

  // Update UI
  $('#round-indicator').textContent = `Round ${state.currentRound + 1}/5`;
  $('#round-score').textContent = `Score: ${state.totalScore}`;
  $('#round-photo').src = round.image;

  // Reset timeline
  setTimelineYear(1900);

  // Init or reset map
  if (gameMap) {
    gameMap.remove();
  }
  gameMap = L.map('map', {
    center: [20, 0],
    zoom: 2,
    zoomControl: true
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
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

  // Force map resize
  setTimeout(() => gameMap.invalidateSize(), 100);
}

function updateSubmitBtn() {
  $('#btn-submit').disabled = !(state.mapPlaced && state.yearPicked);
}

function submitGuess() {
  const round = state.rounds[state.currentRound];

  // Calculate scores
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

  // Animate total
  const totalEl = $('#result-total');
  totalEl.textContent = '0';
  totalEl.classList.remove('score-animated');
  totalEl.offsetHeight;
  totalEl.classList.add('score-animated');
  animateNumber(totalEl, 0, result.totalRoundScore, 800);

  // Update button text
  if (state.currentRound >= 4) {
    $('#btn-next').textContent = 'Voir le resultat final';
  } else {
    $('#btn-next').textContent = 'Round suivant';
  }

  // Init result map
  if (resultMap) {
    resultMap.remove();
  }

  setTimeout(() => {
    resultMap = L.map('result-map', {
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(resultMap);

    // Guess marker (red)
    const guessM = L.marker([result.guessLatLng.lat, result.guessLatLng.lng], {
      icon: L.divIcon({
        className: 'marker-guess',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      })
    }).addTo(resultMap).bindPopup('Votre reponse');

    // Answer marker (green)
    const answerM = L.marker([result.round.lat, result.round.lng], {
      icon: L.divIcon({
        className: 'marker-answer',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      })
    }).addTo(resultMap).bindPopup(result.round.title);

    // Dashed line
    L.polyline(
      [[result.guessLatLng.lat, result.guessLatLng.lng], [result.round.lat, result.round.lng]],
      { color: '#ffffff40', dashArray: '8, 8', weight: 2 }
    ).addTo(resultMap);

    // Fit bounds
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

  // Animate score
  const scoreEl = $('#summary-score');
  scoreEl.textContent = '0';
  scoreEl.classList.remove('score-animated');
  scoreEl.offsetHeight;
  scoreEl.classList.add('score-animated');
  animateNumber(scoreEl, 0, state.totalScore, 1200);

  // Tier
  const tier = getTier(state.totalScore);
  $('#summary-tier').textContent = tier;

  // Table
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
// Non-linear scale segments: [startYear, endYear, widthFraction]
const SEGMENTS = [
  [-3000, -500, 0.10],
  [-500, 500, 0.10],
  [500, 1500, 0.15],
  [1500, 1800, 0.20],
  [1800, 1950, 0.25],
  [1950, 2025, 0.20]
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
  if (year < 0) return `${Math.abs(year)} av. J-C`;
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

  track.addEventListener('pointerup', () => {
    dragging = false;
  });

  track.addEventListener('pointercancel', () => {
    dragging = false;
  });
}

// === Math / Utils ===
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
  if (score >= 9000) return 'Historien Legendaire';
  if (score >= 7500) return 'Maitre du Temps';
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
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(from + (to - from) * eased).toLocaleString('fr-FR');
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
