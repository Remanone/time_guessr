<?php
$roundsFile = __DIR__ . '/data/rounds.json';
$rounds = file_exists($roundsFile)
    ? json_decode(file_get_contents($roundsFile), true)
    : [];
$roundsJson = json_encode($rounds, JSON_UNESCAPED_UNICODE);
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TimeGuessr</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <link rel="stylesheet" href="style.css">
</head>
<body>

  <!-- ========== START SCREEN ========== -->
  <div id="screen-start" class="screen active">
    <div class="start-container">
      <div class="deco-row"><div class="deco-line"></div><span class="deco-diamond">&#9670;</span><div class="deco-line"></div></div>
      <h1 class="title">Time<span class="accent">Guessr</span></h1>
      <p class="subtitle">Devinez le lieu et l'époque de photos historiques</p>

      <div class="section-label">Mode de jeu</div>
      <div class="mode-grid">
        <button class="mode-card active" data-mode="classic">
          <span class="mode-icon">&#9654;</span>
          <span class="mode-name">Classique</span>
          <span class="mode-desc">5 rounds, pas de limite</span>
        </button>
        <button class="mode-card" data-mode="chrono">
          <span class="mode-icon">&#9201;</span>
          <span class="mode-name">Chrono</span>
          <span class="mode-desc">Temps limité par round</span>
        </button>
        <button class="mode-card" data-mode="daily">
          <span class="mode-icon">&#9788;</span>
          <span class="mode-name">Défi Quotidien</span>
          <span class="mode-desc">Même photos pour tous</span>
        </button>
        <button class="mode-card" data-mode="duel">
          <span class="mode-icon">&#9876;</span>
          <span class="mode-name">Duel</span>
          <span class="mode-desc">2 joueurs, même photos</span>
        </button>
      </div>
      <div id="daily-status" class="daily-status"></div>

      <div id="duel-names" class="duel-names hidden">
        <input type="text" id="duel-p1-input" class="input-field" placeholder="Joueur 1" maxlength="20">
        <span class="duel-vs-small">VS</span>
        <input type="text" id="duel-p2-input" class="input-field" placeholder="Joueur 2" maxlength="20">
      </div>

      <div class="section-label">Difficulté</div>
      <div class="pill-group" id="diff-group">
        <button class="pill" data-diff="easy">Facile</button>
        <button class="pill active" data-diff="normal">Normal</button>
        <button class="pill" data-diff="expert">Expert</button>
      </div>

      <div class="section-label">Catégorie</div>
      <div class="pill-group" id="cat-group">
        <button class="pill active" data-cat="all">Toutes</button>
        <button class="pill" data-cat="monuments">Monuments</button>
        <button class="pill" data-cat="villes">Villes</button>
        <button class="pill" data-cat="evenements" disabled title="Pas assez de photos (4/5)">Événements</button>
      </div>

      <button id="btn-play" class="btn-primary btn-play">Jouer</button>

      <div class="start-nav">
        <button id="btn-leaderboard" class="btn-link">Classement</button>
        <button id="btn-stats" class="btn-link">Statistiques</button>
      </div>

      <div class="deco-row"><div class="deco-line"></div><span class="deco-diamond">&#9670;</span><div class="deco-line"></div></div>
    </div>
    <a href="admin.php" class="btn-admin" title="Panneau d'administrateur">&#9881; Admin</a>
    <button id="sound-toggle" class="sound-toggle" title="Sons">&#9835;</button>
  </div>

  <!-- ========== ROUND SCREEN ========== -->
  <div id="screen-round" class="screen">
    <div class="round-header">
      <div class="round-left">
        <span id="round-indicator" class="round-indicator">Round 1/5</span>
        <span id="round-streak" class="round-streak hidden"></span>
      </div>
      <div id="round-timer" class="round-timer hidden">60</div>
      <span id="round-score" class="round-score">Score: 0</span>
    </div>
    <div class="round-layout">
      <div class="photo-panel">
        <img id="round-photo" class="round-photo" src="" alt="Photo historique">
        <div class="photo-vignette"></div>
        <button id="btn-hint" class="btn-hint hidden">
          <span class="hint-icon">?</span>
          <span id="hint-count">3</span>
        </button>
        <div id="hint-overlay" class="hint-overlay hidden">
          <span id="hint-text"></span>
        </div>
      </div>
      <div class="controls-panel">
        <div id="map" class="map-container"></div>
        <div class="timeline-section">
          <div class="timeline-labels">
            <span>1970</span><span>1980</span><span>1990</span><span>2000</span><span>2010</span><span>2025</span>
          </div>
          <div id="timeline" class="timeline-track">
            <div id="timeline-fill" class="timeline-fill"></div>
            <div id="timeline-thumb" class="timeline-thumb"></div>
          </div>
          <div id="timeline-tooltip" class="timeline-tooltip">2000</div>
        </div>
        <button id="btn-submit" class="btn-primary btn-submit" disabled>Valider</button>
      </div>
    </div>
  </div>

  <!-- ========== RESULT SCREEN ========== -->
  <div id="screen-result" class="screen">
    <div class="result-container">
      <div class="result-top">
        <div id="result-map" class="result-map"></div>
      </div>
      <div class="result-details">
        <div class="result-header-row">
          <img id="result-photo-thumb" class="result-thumb" src="" alt="">
          <div>
            <h2 id="result-title" class="result-title"></h2>
            <p id="result-description" class="result-description"></p>
          </div>
        </div>
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
          <div id="stat-time" class="stat-card hidden">
            <span class="stat-label">Bonus temps</span>
            <span id="result-time-bonus" class="stat-value accent">+0</span>
            <span class="stat-pts">pts</span>
          </div>
          <div class="stat-card stat-total">
            <span class="stat-label">Total round</span>
            <span id="result-total" class="stat-value accent">0</span>
            <span class="stat-pts">/ 2 000 pts</span>
          </div>
        </div>
        <div id="result-streak-msg" class="streak-msg hidden"></div>
        <button id="btn-next" class="btn-primary">Round suivant</button>
      </div>
    </div>
  </div>

  <!-- ========== SUMMARY SCREEN ========== -->
  <div id="screen-summary" class="screen">
    <div class="summary-container">
      <div class="deco-row"><div class="deco-line"></div><span class="deco-diamond">&#9670;</span><div class="deco-line"></div></div>
      <h2 class="summary-title">Partie terminée</h2>
      <div class="score-display">
        <div id="summary-score" class="summary-score">0</div>
        <div class="summary-max">/ <span id="summary-max-val">10 000</span></div>
      </div>
      <div class="score-bar"><div id="score-bar-fill" class="score-bar-fill"></div></div>
      <div id="summary-tier" class="summary-tier"></div>
      <table id="summary-table" class="summary-table">
        <thead><tr><th>#</th><th>Lieu</th><th>Lieu</th><th>Date</th><th>Total</th></tr></thead>
        <tbody></tbody>
      </table>
      <div class="summary-actions">
        <button id="btn-share" class="btn-secondary">Partager</button>
        <button id="btn-replay" class="btn-primary">Rejouer</button>
      </div>
    </div>
    <!-- Share Modal -->
    <div id="share-modal" class="modal hidden">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Partager le résultat</h3>
          <button id="btn-close-share" class="btn-close">&times;</button>
        </div>
        <pre id="share-text" class="share-text"></pre>
        <button id="btn-copy-share" class="btn-primary btn-small">Copier</button>
        <span id="copy-feedback" class="copy-feedback hidden">Copié !</span>
      </div>
    </div>
  </div>

  <!-- ========== LEADERBOARD SCREEN ========== -->
  <div id="screen-leaderboard" class="screen">
    <div class="page-container">
      <button class="btn-back" id="btn-lb-back">&larr; Retour</button>
      <h2 class="page-title">Classement</h2>
      <div class="pill-group" id="lb-tabs">
        <button class="pill active" data-lb="classic">Classique</button>
        <button class="pill" data-lb="chrono">Chrono</button>
        <button class="pill" data-lb="daily">Quotidien</button>
      </div>
      <table class="lb-table" id="lb-table">
        <thead><tr><th>#</th><th>Score</th><th>Difficulté</th><th>Date</th></tr></thead>
        <tbody></tbody>
      </table>
      <p id="lb-empty" class="empty-msg">Aucun score enregistré</p>
    </div>
  </div>

  <!-- ========== STATS SCREEN ========== -->
  <div id="screen-stats" class="screen">
    <div class="page-container">
      <button class="btn-back" id="btn-stats-back">&larr; Retour</button>
      <h2 class="page-title">Statistiques</h2>
      <div class="stats-grid">
        <div class="stat-big"><span class="stat-big-value" id="stats-games">0</span><span class="stat-big-label">Parties</span></div>
        <div class="stat-big"><span class="stat-big-value" id="stats-avg">0</span><span class="stat-big-label">Score moyen</span></div>
        <div class="stat-big"><span class="stat-big-value accent" id="stats-best">0</span><span class="stat-big-label">Meilleur score</span></div>
        <div class="stat-big"><span class="stat-big-value" id="stats-streak">0</span><span class="stat-big-label">Meilleur streak</span></div>
      </div>
      <h3 class="section-title">Historique récent</h3>
      <div id="stats-history" class="stats-history"></div>
      <p id="stats-empty" class="empty-msg">Aucune partie jouée</p>
    </div>
  </div>

  <!-- ========== DUEL SWITCH SCREEN ========== -->
  <div id="screen-duel-switch" class="screen">
    <div class="center-container">
      <h2 class="page-title">Au tour de</h2>
      <div id="duel-next-player" class="duel-big-name"></div>
      <p class="subtitle">Passez l'appareil au joueur suivant</p>
      <button class="btn-primary" id="btn-duel-continue">C'est parti !</button>
    </div>
  </div>

  <!-- ========== DUEL SUMMARY SCREEN ========== -->
  <div id="screen-duel-summary" class="screen">
    <div class="page-container">
      <h2 class="page-title">Résultat du Duel</h2>
      <div class="duel-comparison">
        <div class="duel-player" id="duel-p1-card">
          <div class="duel-player-name" id="duel-p1-name">Joueur 1</div>
          <div class="duel-player-score" id="duel-p1-score">0</div>
        </div>
        <div class="duel-vs">VS</div>
        <div class="duel-player" id="duel-p2-card">
          <div class="duel-player-name" id="duel-p2-name">Joueur 2</div>
          <div class="duel-player-score" id="duel-p2-score">0</div>
        </div>
      </div>
      <div id="duel-winner" class="duel-winner"></div>
      <table id="duel-table" class="summary-table">
        <thead><tr><th>#</th><th>Lieu</th><th id="duel-th-p1">J1</th><th id="duel-th-p2">J2</th></tr></thead>
        <tbody></tbody>
      </table>
      <button class="btn-primary" id="btn-duel-replay">Rejouer</button>
    </div>
  </div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>const ALL_ROUNDS = <?= $roundsJson ?>;</script>
  <script src="app.js"></script>
</body>
</html>
