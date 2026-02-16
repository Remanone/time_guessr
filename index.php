<?php
$rounds = [
    [
        'id' => 1,
        'title' => 'Libération de Paris',
        'description' => 'Les Champs-Élysées envahis par la foule lors de la Libération de Paris le 26 août 1944.',
        'year' => 1944,
        'lat' => 48.8698,
        'lng' => 2.3078,
        'image' => 'images/01.jpg'
    ],
    [
        'id' => 2,
        'title' => 'Tremblement de terre de San Francisco',
        'description' => 'Les ruines de San Francisco après le séisme dévastateur du 18 avril 1906.',
        'year' => 1906,
        'lat' => 37.7749,
        'lng' => -122.4194,
        'image' => 'images/02.jpg'
    ],
    [
        'id' => 3,
        'title' => 'Varsovie en ruines',
        'description' => 'La capitale polonaise Varsovie presque entièrement détruite, photographiée en janvier 1945.',
        'year' => 1945,
        'lat' => 52.2297,
        'lng' => 21.0122,
        'image' => 'images/03.jpg'
    ],
    [
        'id' => 4,
        'title' => 'Acqua Alta à Venise',
        'description' => 'La place Saint-Marc à Venise inondée lors d\'un épisode d\'acqua alta.',
        'year' => 2004,
        'lat' => 45.4341,
        'lng' => 12.3388,
        'image' => 'images/04.jpg'
    ],
    [
        'id' => 5,
        'title' => 'Rues de La Havane',
        'description' => 'Une rue typique de La Havane, Cuba, avec ses bâtiments colorés et ses voitures vintage.',
        'year' => 2010,
        'lat' => 23.1136,
        'lng' => -82.3666,
        'image' => 'images/05.jpg'
    ],
    [
        'id' => 6,
        'title' => 'Place Rouge, Moscou',
        'description' => 'Vue panoramique de la Place Rouge à Moscou avec le Kremlin et la cathédrale Saint-Basile.',
        'year' => 2020,
        'lat' => 55.7539,
        'lng' => 37.6208,
        'image' => 'images/06.jpg'
    ],
    [
        'id' => 7,
        'title' => 'Berlin, Potsdamer Platz en ruines',
        'description' => 'La Potsdamer Platz à Berlin dévastée après les bombardements de la Seconde Guerre mondiale en 1945.',
        'year' => 1945,
        'lat' => 52.5096,
        'lng' => 13.3761,
        'image' => 'images/07.jpg'
    ],
    [
        'id' => 8,
        'title' => 'Broadway, New York',
        'description' => 'Vue de Broadway depuis Dey Street à New York en 1900, avec les tramways et les immeubles de l\'époque.',
        'year' => 1900,
        'lat' => 40.7094,
        'lng' => -74.0073,
        'image' => 'images/08.jpg'
    ],
    [
        'id' => 9,
        'title' => 'Panorama d\'Istanbul',
        'description' => 'Vue panoramique d\'Istanbul avec ses mosquées et le Bosphore.',
        'year' => 2015,
        'lat' => 41.0082,
        'lng' => 28.9784,
        'image' => 'images/09.jpg'
    ],
    [
        'id' => 10,
        'title' => 'Construction du Sydney Harbour Bridge',
        'description' => 'Le Sydney Harbour Bridge en cours de construction vers 1930, vu depuis le port.',
        'year' => 1930,
        'lat' => -33.8523,
        'lng' => 151.2108,
        'image' => 'images/10.jpg'
    ],
    [
        'id' => 11,
        'title' => 'Piccadilly Circus, Londres',
        'description' => 'Piccadilly Circus au cœur de Londres en 1960, avec ses enseignes lumineuses.',
        'year' => 1960,
        'lat' => 51.5100,
        'lng' => -0.1345,
        'image' => 'images/11.jpg'
    ],
    [
        'id' => 12,
        'title' => 'Rue du Caire, Égypte',
        'description' => 'Une scène de rue au Caire montrant la mosquée de Qaitbay, début du XXe siècle.',
        'year' => 1920,
        'lat' => 30.0444,
        'lng' => 31.2357,
        'image' => 'images/12.jpg'
    ],
    [
        'id' => 13,
        'title' => 'Jemaa el-Fna, Marrakech',
        'description' => 'La célèbre place Jemaa el-Fna à Marrakech de nuit, avec ses étals et ses animations.',
        'year' => 2012,
        'lat' => 31.6258,
        'lng' => -7.9891,
        'image' => 'images/13.jpg'
    ],
    [
        'id' => 14,
        'title' => 'Capitole de La Havane',
        'description' => 'Le Capitole national de La Havane avec des voitures américaines classiques.',
        'year' => 2015,
        'lat' => 23.1353,
        'lng' => -82.3596,
        'image' => 'images/14.jpg'
    ],
    [
        'id' => 15,
        'title' => 'Damrak, Amsterdam',
        'description' => 'Le canal du Damrak à Amsterdam vu depuis le Nieuwe Brug, début du XXe siècle.',
        'year' => 1900,
        'lat' => 52.3759,
        'lng' => 4.8975,
        'image' => 'images/15.jpg'
    ],
];

// Melanger et prendre 5 rounds
shuffle($rounds);
$gameRounds = array_slice($rounds, 0, 5);
$roundsJson = json_encode($gameRounds, JSON_UNESCAPED_UNICODE);
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TimeGuessr</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <link rel="stylesheet" href="style.css">
</head>
<body>

  <!-- Ecran Start -->
  <div id="screen-start" class="screen active">
    <div class="start-container">
      <h1 class="title">Time<span class="accent">Guessr</span></h1>
      <p class="subtitle">Devinez le lieu et l'époque de photos historiques</p>
      <div class="rules">
        <div class="rule-item">
          <span class="rule-icon">5</span>
          <span>rounds par partie</span>
        </div>
        <div class="rule-item">
          <span class="rule-icon">10K</span>
          <span>points maximum</span>
        </div>
        <div class="rule-item">
          <span class="rule-icon">&oplus;</span>
          <span>Lieu + Date à deviner</span>
        </div>
      </div>
      <button id="btn-play" class="btn-primary">Jouer</button>
    </div>
  </div>

  <!-- Ecran Round -->
  <div id="screen-round" class="screen">
    <div class="round-header">
      <span id="round-indicator" class="round-indicator">Round 1/5</span>
      <span id="round-score" class="round-score">Score: 0</span>
    </div>
    <div class="round-layout">
      <div class="photo-panel">
        <img id="round-photo" class="round-photo" src="" alt="Photo historique">
      </div>
      <div class="controls-panel">
        <div id="map" class="map-container"></div>
        <div class="timeline-section">
          <div class="timeline-labels">
            <span>3000 av. J-C</span>
            <span>500 av. J-C</span>
            <span>500</span>
            <span>1500</span>
            <span>1800</span>
            <span>1950</span>
            <span>2025</span>
          </div>
          <div id="timeline" class="timeline-track">
            <div id="timeline-thumb" class="timeline-thumb"></div>
            <div id="timeline-fill" class="timeline-fill"></div>
          </div>
          <div id="timeline-tooltip" class="timeline-tooltip">1900</div>
        </div>
        <button id="btn-submit" class="btn-primary btn-submit" disabled>Valider</button>
      </div>
    </div>
  </div>

  <!-- Ecran Result -->
  <div id="screen-result" class="screen">
    <div class="result-container">
      <div class="result-top">
        <div id="result-map" class="result-map"></div>
      </div>
      <div class="result-details">
        <h2 id="result-title" class="result-title"></h2>
        <p id="result-description" class="result-description"></p>
        <div class="result-stats">
          <div class="stat-card">
            <span class="stat-label">Distance</span>
            <span id="result-distance" class="stat-value">0 km</span>
            <span id="result-location-pts" class="stat-pts">+0 pts</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Écart</span>
            <span id="result-years" class="stat-value">0 ans</span>
            <span id="result-date-pts" class="stat-pts">+0 pts</span>
          </div>
          <div class="stat-card stat-card-total">
            <span class="stat-label">Total</span>
            <span id="result-total" class="stat-value accent">0</span>
            <span class="stat-pts">/ 2 000 pts</span>
          </div>
        </div>
        <button id="btn-next" class="btn-primary">Round suivant</button>
      </div>
    </div>
  </div>

  <!-- Ecran Summary -->
  <div id="screen-summary" class="screen">
    <div class="summary-container">
      <h2 class="summary-title">Partie terminée !</h2>
      <div id="summary-score" class="summary-score">0</div>
      <div class="summary-max">/ 10 000</div>
      <div id="summary-tier" class="summary-tier"></div>
      <table id="summary-table" class="summary-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Lieu</th>
            <th>Lieu pts</th>
            <th>Date pts</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
      <button id="btn-replay" class="btn-primary">Rejouer</button>
    </div>
  </div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    // Rounds injectes par PHP (5 rounds aleatoires)
    const ROUNDS_DATA = <?= $roundsJson ?>;
  </script>
  <script src="app.js"></script>
</body>
</html>
