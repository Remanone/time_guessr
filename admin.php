<?php
session_start();

// --- Config ---
define('ADMIN_PASS_HASH', '$2y$12$/fgNGJ.DDT6b8BP/ltXYHOtAz.l2QcSlYvKETfDtHXoEkhSXo4FLu'); // "timeguessr2025"
define('ROUNDS_FILE', __DIR__ . '/data/rounds.json');
define('IMAGES_DIR', __DIR__ . '/images/');
define('MAX_IMAGE_SIZE', 5 * 1024 * 1024); // 5 MB
define('ALLOWED_TYPES', ['image/jpeg', 'image/png', 'image/webp']);
define('CATEGORIES', ['monuments', 'villes', 'evenements']);

// --- CSRF ---
function csrfToken(): string {
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}
function verifyCsrf(): bool {
    return isset($_POST['csrf']) && hash_equals($_SESSION['csrf'] ?? '', $_POST['csrf']);
}

// --- Rounds helpers ---
function loadRounds(): array {
    if (!file_exists(ROUNDS_FILE)) return [];
    $data = json_decode(file_get_contents(ROUNDS_FILE), true);
    return is_array($data) ? $data : [];
}
function saveRounds(array $rounds): void {
    // Re-index IDs
    $id = 1;
    foreach ($rounds as &$r) $r['id'] = $id++;
    unset($r);
    file_put_contents(ROUNDS_FILE, json_encode($rounds, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}
function nextImageName(): string {
    $existing = glob(IMAGES_DIR . '*.{jpg,jpeg,png,webp}', GLOB_BRACE);
    $max = 0;
    foreach ($existing as $f) {
        $base = pathinfo($f, PATHINFO_FILENAME);
        if (is_numeric($base) && (int)$base > $max) $max = (int)$base;
    }
    return str_pad($max + 1, 2, '0', STR_PAD_LEFT);
}

// --- Auth ---
$authError = '';
if (isset($_POST['action']) && $_POST['action'] === 'login') {
    if (password_verify($_POST['password'] ?? '', ADMIN_PASS_HASH)) {
        $_SESSION['admin'] = true;
        header('Location: admin.php');
        exit;
    }
    $authError = 'Mot de passe incorrect';
}
if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: admin.php');
    exit;
}
$loggedIn = !empty($_SESSION['admin']);

// --- Actions (authenticated) ---
$msg = '';
$msgType = '';
if ($loggedIn && $_SERVER['REQUEST_METHOD'] === 'POST' && verifyCsrf()) {
    $action = $_POST['action'] ?? '';

    // Add round
    if ($action === 'add') {
        $title = trim($_POST['title'] ?? '');
        $desc  = trim($_POST['description'] ?? '');
        $year  = (int)($_POST['year'] ?? 2000);
        $lat   = (float)($_POST['lat'] ?? 0);
        $lng   = (float)($_POST['lng'] ?? 0);
        $cat   = $_POST['category'] ?? 'villes';

        if (!$title || !$desc || $year < 1970 || $year > 2025) {
            $msg = 'Champs invalides. Titre et description requis, année entre 1970-2025.';
            $msgType = 'error';
        } elseif (!in_array($cat, CATEGORIES)) {
            $msg = 'Catégorie invalide.';
            $msgType = 'error';
        } elseif (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
            $msg = 'Image requise.';
            $msgType = 'error';
        } elseif ($_FILES['image']['size'] > MAX_IMAGE_SIZE) {
            $msg = 'Image trop lourde (max 5 Mo).';
            $msgType = 'error';
        } elseif (!in_array($_FILES['image']['type'], ALLOWED_TYPES)) {
            $msg = 'Format accepté : JPG, PNG, WebP.';
            $msgType = 'error';
        } else {
            $ext = match($_FILES['image']['type']) {
                'image/jpeg' => 'jpg',
                'image/png'  => 'png',
                'image/webp' => 'webp',
                default      => 'jpg',
            };
            $imgName = nextImageName() . '.' . $ext;
            $destPath = IMAGES_DIR . $imgName;
            if (move_uploaded_file($_FILES['image']['tmp_name'], $destPath)) {
                $rounds = loadRounds();
                $rounds[] = [
                    'id'          => count($rounds) + 1,
                    'title'       => $title,
                    'description' => $desc,
                    'year'        => $year,
                    'lat'         => $lat,
                    'lng'         => $lng,
                    'image'       => 'images/' . $imgName,
                    'category'    => $cat,
                ];
                saveRounds($rounds);
                $msg = "Round ajouté : $title";
                $msgType = 'success';
            } else {
                $msg = "Erreur lors de l'upload de l'image.";
                $msgType = 'error';
            }
        }
    }

    // Delete round
    if ($action === 'delete') {
        $delId = (int)($_POST['delete_id'] ?? 0);
        $rounds = loadRounds();
        $found = false;
        foreach ($rounds as $i => $r) {
            if ($r['id'] === $delId) {
                // Delete image file
                $imgPath = __DIR__ . '/' . $r['image'];
                if (file_exists($imgPath)) unlink($imgPath);
                unset($rounds[$i]);
                $found = true;
                break;
            }
        }
        if ($found) {
            saveRounds(array_values($rounds));
            $msg = 'Round supprimé.';
            $msgType = 'success';
        } else {
            $msg = 'Round introuvable.';
            $msgType = 'error';
        }
    }

    // Edit round
    if ($action === 'edit') {
        $editId = (int)($_POST['edit_id'] ?? 0);
        $rounds = loadRounds();
        foreach ($rounds as &$r) {
            if ($r['id'] === $editId) {
                if (!empty(trim($_POST['title'] ?? '')))       $r['title'] = trim($_POST['title']);
                if (!empty(trim($_POST['description'] ?? ''))) $r['description'] = trim($_POST['description']);
                if (!empty($_POST['year']))                    $r['year'] = max(1970, min(2025, (int)$_POST['year']));
                if (isset($_POST['lat']))                      $r['lat'] = (float)$_POST['lat'];
                if (isset($_POST['lng']))                      $r['lng'] = (float)$_POST['lng'];
                if (!empty($_POST['category']) && in_array($_POST['category'], CATEGORIES)) $r['category'] = $_POST['category'];

                // Optional image replacement
                if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
                    if ($_FILES['image']['size'] <= MAX_IMAGE_SIZE && in_array($_FILES['image']['type'], ALLOWED_TYPES)) {
                        $ext = match($_FILES['image']['type']) {
                            'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', default => 'jpg',
                        };
                        $imgName = nextImageName() . '.' . $ext;
                        $destPath = IMAGES_DIR . $imgName;
                        if (move_uploaded_file($_FILES['image']['tmp_name'], $destPath)) {
                            // Remove old image
                            $oldPath = __DIR__ . '/' . $r['image'];
                            if (file_exists($oldPath)) unlink($oldPath);
                            $r['image'] = 'images/' . $imgName;
                        }
                    }
                }
                $msg = "Round modifié : " . $r['title'];
                $msgType = 'success';
                break;
            }
        }
        unset($r);
        saveRounds($rounds);
    }
}

$rounds = $loggedIn ? loadRounds() : [];
$csrf = $loggedIn ? csrfToken() : '';
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin — TimeGuessr</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Figtree:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
    :root {
      --bg: #0b0a08; --surface: #13120e; --surface-2: #1b1914; --surface-3: #242018;
      --border: rgba(201,168,76,.10); --border-strong: rgba(201,168,76,.25);
      --accent: #c9a84c; --accent-bright: #e0c06a; --accent-soft: rgba(201,168,76,.08); --accent-glow: rgba(201,168,76,.25);
      --text: #e8e0d0; --text-dim: #7d7567; --text-bright: #f5f0e8;
      --red: #c05040; --green: #6ab070;
      --radius: 10px; --radius-sm: 6px;
      --font-display: 'Instrument Serif', Georgia, serif;
      --font-body: 'Figtree', system-ui, sans-serif;
    }
    *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
    html { font-size:16px; -webkit-font-smoothing:antialiased; }
    body { font-family:var(--font-body); background:var(--bg); color:var(--text); min-height:100vh; line-height:1.5; }
    body::after { content:''; position:fixed; inset:0; pointer-events:none; z-index:10000; opacity:.03;
      background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }

    .accent { color:var(--accent); }

    /* Layout */
    .admin-wrap { max-width:960px; margin:0 auto; padding:32px 24px 60px; }
    .admin-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:32px; flex-wrap:wrap; gap:12px; }
    .admin-title { font-family:var(--font-display); font-size:2rem; color:var(--text-bright); }
    .admin-nav { display:flex; gap:12px; align-items:center; }
    .admin-nav a { color:var(--text-dim); text-decoration:none; font-size:.85rem; padding:6px 14px; border-radius:var(--radius-sm); transition:color .2s, background .2s; }
    .admin-nav a:hover { color:var(--accent); background:var(--accent-soft); }
    .badge { font-size:.7rem; background:var(--accent-soft); color:var(--accent); padding:3px 10px; border-radius:12px; font-weight:700; border:1px solid var(--border); }

    /* Login */
    .login-box { max-width:380px; margin:120px auto 0; text-align:center; }
    .login-box h1 { font-family:var(--font-display); font-size:2.5rem; color:var(--text-bright); margin-bottom:4px; }
    .login-box p { color:var(--text-dim); font-size:.9rem; margin-bottom:28px; }
    .login-form { display:flex; flex-direction:column; gap:14px; }
    .login-form input { font-family:var(--font-body); background:var(--surface); border:1px solid var(--border); color:var(--text); padding:12px 16px; border-radius:var(--radius-sm); font-size:.95rem; outline:none; transition:border-color .2s; width:100%; text-align:center; letter-spacing:.5px; }
    .login-form input:focus { border-color:var(--accent); }
    .login-error { color:var(--red); font-size:.85rem; font-weight:600; }

    /* Buttons */
    .btn { font-family:var(--font-body); padding:10px 24px; border-radius:var(--radius-sm); font-size:.88rem; font-weight:700; cursor:pointer; border:none; transition:all .2s; }
    .btn-gold { background:var(--accent); color:var(--bg); }
    .btn-gold:hover { background:var(--accent-bright); transform:translateY(-1px); box-shadow:0 6px 20px var(--accent-glow); }
    .btn-outline { background:transparent; color:var(--accent); border:1px solid var(--accent); }
    .btn-outline:hover { background:var(--accent-soft); }
    .btn-danger { background:transparent; color:var(--red); border:1px solid var(--red); font-size:.78rem; padding:6px 14px; }
    .btn-danger:hover { background:rgba(192,80,64,.1); }
    .btn-sm { padding:7px 16px; font-size:.8rem; }

    /* Messages */
    .msg { padding:12px 18px; border-radius:var(--radius-sm); font-size:.88rem; font-weight:600; margin-bottom:24px; border:1px solid; }
    .msg-success { color:var(--green); border-color:var(--green); background:rgba(106,176,112,.08); }
    .msg-error { color:var(--red); border-color:var(--red); background:rgba(192,80,64,.08); }

    /* Section */
    .section { margin-bottom:36px; }
    .section-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:8px; }
    .section-title { font-family:var(--font-display); font-size:1.3rem; color:var(--text-bright); }

    /* Add form */
    .add-form { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:24px; display:none; }
    .add-form.open { display:block; animation:slideDown .3s ease; }
    @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    .form-group { display:flex; flex-direction:column; gap:5px; }
    .form-group.full { grid-column:1/-1; }
    .form-label { font-size:.72rem; text-transform:uppercase; letter-spacing:1.5px; color:var(--text-dim); font-weight:600; }
    .form-input { font-family:var(--font-body); background:var(--surface-2); border:1px solid var(--border); color:var(--text); padding:10px 14px; border-radius:var(--radius-sm); font-size:.88rem; outline:none; transition:border-color .2s; }
    .form-input:focus { border-color:var(--accent); }
    .form-input::placeholder { color:var(--text-dim); opacity:.6; }
    textarea.form-input { resize:vertical; min-height:70px; }
    select.form-input { cursor:pointer; }
    select.form-input option { background:var(--surface-2); color:var(--text); }
    .form-hint { font-size:.72rem; color:var(--text-dim); }
    .form-map { width:100%; height:220px; border-radius:var(--radius-sm); border:1px solid var(--border); overflow:hidden; margin-top:4px; }
    .form-coords { display:flex; gap:10px; margin-top:6px; font-size:.82rem; color:var(--text-dim); }
    .form-coords span { font-weight:600; color:var(--accent); }
    .form-actions { display:flex; gap:10px; margin-top:18px; }

    /* Rounds list */
    .round-card { display:grid; grid-template-columns:80px 1fr auto; gap:16px; align-items:center; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:14px 18px; margin-bottom:10px; transition:border-color .2s; }
    .round-card:hover { border-color:var(--border-strong); }
    .round-img { width:80px; height:56px; object-fit:cover; border-radius:var(--radius-sm); border:1px solid var(--border); }
    .round-info h3 { font-family:var(--font-display); font-size:1.05rem; color:var(--text-bright); margin-bottom:2px; }
    .round-meta { font-size:.78rem; color:var(--text-dim); display:flex; gap:16px; flex-wrap:wrap; }
    .round-meta b { color:var(--text); font-weight:600; }
    .round-actions { display:flex; gap:8px; flex-shrink:0; }

    /* Edit modal */
    .modal-bg { position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,.7); display:none; align-items:center; justify-content:center; padding:20px; }
    .modal-bg.active { display:flex; animation:fadeIn .3s ease; }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
    .modal-box { background:var(--surface); border:1px solid var(--border-strong); border-radius:var(--radius); padding:28px; max-width:560px; width:100%; max-height:90vh; overflow-y:auto; }
    .modal-box h3 { font-family:var(--font-display); font-size:1.3rem; color:var(--text-bright); margin-bottom:18px; }

    /* Stats bar */
    .stats-bar { display:flex; gap:12px; margin-bottom:24px; flex-wrap:wrap; }
    .mini-stat { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-sm); padding:12px 18px; text-align:center; flex:1; min-width:100px; }
    .mini-stat-val { font-family:var(--font-display); font-size:1.5rem; color:var(--accent); display:block; line-height:1; }
    .mini-stat-label { font-size:.68rem; color:var(--text-dim); text-transform:uppercase; letter-spacing:1.5px; font-weight:600; margin-top:4px; }

    /* Leaflet overrides */
    .leaflet-container { background:#0d0c0a; font-family:var(--font-body); }
    .leaflet-control-zoom a { background:var(--surface-2)!important; color:var(--text)!important; border-color:var(--border)!important; }
    .leaflet-control-zoom a:hover { background:var(--surface-3)!important; }
    .leaflet-control-attribution { background:rgba(11,10,8,.75)!important; color:var(--text-dim)!important; font-size:.6rem!important; }

    /* Responsive */
    @media(max-width:700px) {
      .form-grid { grid-template-columns:1fr; }
      .round-card { grid-template-columns:60px 1fr; gap:10px; }
      .round-img { width:60px; height:42px; }
      .round-actions { grid-column:1/-1; justify-content:flex-end; }
      .stats-bar { flex-direction:column; }
    }
  </style>
</head>
<body>

<?php if (!$loggedIn): ?>
<!-- ===== LOGIN ===== -->
<div class="login-box">
  <h1>Time<span class="accent">Guessr</span></h1>
  <p>Interface d'administration</p>
  <form method="post" class="login-form">
    <input type="hidden" name="action" value="login">
    <input type="password" name="password" placeholder="Mot de passe" autofocus>
    <?php if ($authError): ?><div class="login-error"><?= htmlspecialchars($authError) ?></div><?php endif; ?>
    <button type="submit" class="btn btn-gold">Connexion</button>
  </form>
</div>

<?php else: ?>
<!-- ===== ADMIN PANEL ===== -->
<div class="admin-wrap">
  <div class="admin-header">
    <div>
      <div class="admin-title">Time<span class="accent">Guessr</span> Admin</div>
    </div>
    <div class="admin-nav">
      <span class="badge"><?= count($rounds) ?> rounds</span>
      <a href="index.php">Voir le jeu</a>
      <a href="?logout=1">Déconnexion</a>
    </div>
  </div>

  <?php if ($msg): ?>
  <div class="msg msg-<?= $msgType ?>"><?= htmlspecialchars($msg) ?></div>
  <?php endif; ?>

  <!-- Stats -->
  <div class="stats-bar">
    <div class="mini-stat">
      <span class="mini-stat-val"><?= count($rounds) ?></span>
      <div class="mini-stat-label">Rounds</div>
    </div>
    <div class="mini-stat">
      <?php
        $cats = array_count_values(array_column($rounds, 'category'));
      ?>
      <span class="mini-stat-val"><?= $cats['monuments'] ?? 0 ?></span>
      <div class="mini-stat-label">Monuments</div>
    </div>
    <div class="mini-stat">
      <span class="mini-stat-val"><?= $cats['villes'] ?? 0 ?></span>
      <div class="mini-stat-label">Villes</div>
    </div>
    <div class="mini-stat">
      <span class="mini-stat-val"><?= $cats['evenements'] ?? 0 ?></span>
      <div class="mini-stat-label">Événements</div>
    </div>
  </div>

  <!-- Add Round Section -->
  <div class="section">
    <div class="section-head">
      <div class="section-title">Ajouter un round</div>
      <button class="btn btn-outline btn-sm" id="toggle-add">+ Nouveau</button>
    </div>
    <div class="add-form" id="add-form">
      <form method="post" enctype="multipart/form-data">
        <input type="hidden" name="action" value="add">
        <input type="hidden" name="csrf" value="<?= $csrf ?>">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Titre</label>
            <input type="text" name="title" class="form-input" placeholder="Ex: Tour Eiffel, Paris" required>
          </div>
          <div class="form-group">
            <label class="form-label">Année</label>
            <input type="number" name="year" class="form-input" min="1970" max="2025" value="2000" required>
          </div>
          <div class="form-group full">
            <label class="form-label">Description</label>
            <textarea name="description" class="form-input" placeholder="Décrivez brièvement la photo..." required></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Catégorie</label>
            <select name="category" class="form-input">
              <option value="monuments">Monuments</option>
              <option value="villes">Villes</option>
              <option value="evenements">Événements</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Image</label>
            <input type="file" name="image" accept="image/jpeg,image/png,image/webp" class="form-input" required>
            <span class="form-hint">JPG, PNG ou WebP — max 5 Mo</span>
          </div>
          <div class="form-group full">
            <label class="form-label">Position (cliquez sur la carte)</label>
            <div class="form-map" id="add-map"></div>
            <div class="form-coords">
              Lat: <span id="add-lat-display">0.000</span> — Lng: <span id="add-lng-display">0.000</span>
            </div>
            <input type="hidden" name="lat" id="add-lat" value="0">
            <input type="hidden" name="lng" id="add-lng" value="0">
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-gold">Ajouter</button>
          <button type="button" class="btn btn-outline" onclick="document.getElementById('add-form').classList.remove('open')">Annuler</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Rounds List -->
  <div class="section">
    <div class="section-head">
      <div class="section-title">Tous les rounds</div>
    </div>

    <?php if (empty($rounds)): ?>
      <p style="color:var(--text-dim);font-style:italic;padding:24px 0;">Aucun round. Ajoutez-en un !</p>
    <?php endif; ?>

    <?php foreach ($rounds as $r): ?>
    <div class="round-card">
      <img src="<?= htmlspecialchars($r['image']) ?>" alt="" class="round-img">
      <div class="round-info">
        <h3><?= htmlspecialchars($r['title']) ?></h3>
        <div class="round-meta">
          <span><b><?= $r['year'] ?></b></span>
          <span><?= ucfirst($r['category']) ?></span>
          <span><?= number_format($r['lat'], 4) ?>, <?= number_format($r['lng'], 4) ?></span>
        </div>
      </div>
      <div class="round-actions">
        <button class="btn btn-outline btn-sm" onclick="openEdit(<?= htmlspecialchars(json_encode($r, JSON_HEX_APOS | JSON_HEX_QUOT)) ?>)">Modifier</button>
        <form method="post" style="display:inline" onsubmit="return confirm('Supprimer ce round ?')">
          <input type="hidden" name="action" value="delete">
          <input type="hidden" name="csrf" value="<?= $csrf ?>">
          <input type="hidden" name="delete_id" value="<?= $r['id'] ?>">
          <button type="submit" class="btn btn-danger btn-sm">Supprimer</button>
        </form>
      </div>
    </div>
    <?php endforeach; ?>
  </div>
</div>

<!-- Edit Modal -->
<div class="modal-bg" id="edit-modal">
  <div class="modal-box">
    <h3>Modifier le round</h3>
    <form method="post" enctype="multipart/form-data" id="edit-form">
      <input type="hidden" name="action" value="edit">
      <input type="hidden" name="csrf" value="<?= $csrf ?>">
      <input type="hidden" name="edit_id" id="edit-id">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Titre</label>
          <input type="text" name="title" id="edit-title" class="form-input" required>
        </div>
        <div class="form-group">
          <label class="form-label">Année</label>
          <input type="number" name="year" id="edit-year" class="form-input" min="1970" max="2025" required>
        </div>
        <div class="form-group full">
          <label class="form-label">Description</label>
          <textarea name="description" id="edit-desc" class="form-input" required></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Catégorie</label>
          <select name="category" id="edit-cat" class="form-input">
            <option value="monuments">Monuments</option>
            <option value="villes">Villes</option>
            <option value="evenements">Événements</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Nouvelle image (optionnel)</label>
          <input type="file" name="image" accept="image/jpeg,image/png,image/webp" class="form-input">
          <span class="form-hint">Laisser vide pour garder l'image actuelle</span>
        </div>
        <div class="form-group full">
          <label class="form-label">Position (cliquez sur la carte)</label>
          <div class="form-map" id="edit-map"></div>
          <div class="form-coords">
            Lat: <span id="edit-lat-display">0.000</span> — Lng: <span id="edit-lng-display">0.000</span>
          </div>
          <input type="hidden" name="lat" id="edit-lat" value="0">
          <input type="hidden" name="lng" id="edit-lng" value="0">
        </div>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-gold">Enregistrer</button>
        <button type="button" class="btn btn-outline" onclick="closeEdit()">Annuler</button>
      </div>
    </form>
  </div>
</div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILES_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

// --- Add map ---
const addMap = L.map('add-map', { scrollWheelZoom: true }).setView([30, 10], 2);
L.tileLayer(TILES, { attribution: TILES_ATTR, maxZoom: 18 }).addTo(addMap);
let addMarker = null;
addMap.on('click', e => {
  const { lat, lng } = e.latlng;
  if (addMarker) addMarker.setLatLng(e.latlng);
  else addMarker = L.circleMarker(e.latlng, { radius: 7, color: '#c9a84c', fillColor: '#c9a84c', fillOpacity: .9, weight: 2 }).addTo(addMap);
  document.getElementById('add-lat').value = lat.toFixed(6);
  document.getElementById('add-lng').value = lng.toFixed(6);
  document.getElementById('add-lat-display').textContent = lat.toFixed(4);
  document.getElementById('add-lng-display').textContent = lng.toFixed(4);
});

// Toggle add form
document.getElementById('toggle-add').addEventListener('click', () => {
  const f = document.getElementById('add-form');
  f.classList.toggle('open');
  if (f.classList.contains('open')) {
    setTimeout(() => addMap.invalidateSize(), 100);
  }
});

// --- Edit modal ---
let editMap, editMarker;
function openEdit(round) {
  document.getElementById('edit-id').value = round.id;
  document.getElementById('edit-title').value = round.title;
  document.getElementById('edit-desc').value = round.description;
  document.getElementById('edit-year').value = round.year;
  document.getElementById('edit-cat').value = round.category;
  document.getElementById('edit-lat').value = round.lat;
  document.getElementById('edit-lng').value = round.lng;
  document.getElementById('edit-lat-display').textContent = round.lat.toFixed(4);
  document.getElementById('edit-lng-display').textContent = round.lng.toFixed(4);

  document.getElementById('edit-modal').classList.add('active');

  setTimeout(() => {
    if (!editMap) {
      editMap = L.map('edit-map', { scrollWheelZoom: true }).setView([round.lat, round.lng], 5);
      L.tileLayer(TILES, { attribution: TILES_ATTR, maxZoom: 18 }).addTo(editMap);
      editMap.on('click', e => {
        const { lat, lng } = e.latlng;
        if (editMarker) editMarker.setLatLng(e.latlng);
        else editMarker = L.circleMarker(e.latlng, { radius: 7, color: '#c9a84c', fillColor: '#c9a84c', fillOpacity: .9, weight: 2 }).addTo(editMap);
        document.getElementById('edit-lat').value = lat.toFixed(6);
        document.getElementById('edit-lng').value = lng.toFixed(6);
        document.getElementById('edit-lat-display').textContent = lat.toFixed(4);
        document.getElementById('edit-lng-display').textContent = lng.toFixed(4);
      });
    } else {
      editMap.setView([round.lat, round.lng], 5);
    }
    editMap.invalidateSize();

    if (editMarker) editMarker.setLatLng([round.lat, round.lng]);
    else editMarker = L.circleMarker([round.lat, round.lng], { radius: 7, color: '#c9a84c', fillColor: '#c9a84c', fillOpacity: .9, weight: 2 }).addTo(editMap);
  }, 150);
}

function closeEdit() {
  document.getElementById('edit-modal').classList.remove('active');
}

// Close modal on backdrop click
document.getElementById('edit-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeEdit();
});

// Close modal on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeEdit();
});
</script>
<?php endif; ?>
</body>
</html>
