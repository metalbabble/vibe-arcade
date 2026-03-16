// Face Invaders — Space Invaders-inspired arcade game

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

// ── Canvas / layout constants ────────────────────────────────────────────────
const W        = 600;
const H        = 660;
const HEADER_H = 60;

canvas.width  = W;
canvas.height = H;

// ── Invader grid constants ───────────────────────────────────────────────────
const INV_COLS = 11;   // columns of invaders
const INV_ROWS = 5;    // rows of invaders
const INV_CX   = 46;   // center-to-center horizontal spacing
const INV_CY   = 42;   // center-to-center vertical spacing
const INV_W    = 32;   // drawn face width  (for hit-test half-extents)
const INV_H    = 28;   // drawn face height

const STEP_X   = 6;    // pixels moved horizontally each tick
const STEP_Y   = 20;   // pixels dropped when reversing direction

// Formation origin: x/y of the top-left invader's centre
const START_FORM_X = Math.round((W - (INV_COLS - 1) * INV_CX) / 2);
const START_FORM_Y = HEADER_H + 36;

// ── Shield constants ─────────────────────────────────────────────────────────
const SH_BLK_W = 9;    // shield block width
const SH_BLK_H = 6;    // shield block height
const SH_COLS  = 8;    // blocks per row
const SH_ROWS  = 5;    // blocks per column
const SH_Y     = H - 130;
const SH_XS    = [100, 300, 500]; // centre-x of each of the 3 shields

// ── Player constants ─────────────────────────────────────────────────────────
const PLAYER_Y     = H - 44;
const PLAYER_W     = 36;
const PLAYER_SPEED = 280;  // px/sec

// ── Bullet constants ─────────────────────────────────────────────────────────
const PBULLET_SPEED   = 520;  // player bullet, px/sec upward
const EBULLET_SPEED   = 200;  // enemy bullet, px/sec downward
const PBULLET_COOLDOWN = 450; // ms between player shots

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:      '#0a0a0f',
  player:  '#00ccff',
  pBullet: '#ffee22',
  eBullet: '#ff4444',
  shield:  '#22aa44',
  text:    '#ffffff',
  accent:  '#7c3aed',
  score:   '#44ff88',
  dim:     '#555555',
  ground:  '#2a2a3a',
  // face colours by type (top→bottom)
  face:    ['#ff6644', '#ee44cc', '#44ddff'],
};

// ── Audio ────────────────────────────────────────────────────────────────────
let actx;
function getActx() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  return actx;
}
function tone(freq, toFreq, dur, type = 'square', vol = 0.14) {
  const a = getActx();
  const o = a.createOscillator();
  const g = a.createGain();
  o.connect(g); g.connect(a.destination);
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime);
  if (toFreq !== freq)
    o.frequency.exponentialRampToValueAtTime(toFreq, a.currentTime + dur);
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
  o.start(); o.stop(a.currentTime + dur);
}

const sndShoot  = () => tone(880, 220, 0.08, 'square',   0.10);
const sndHit    = () => tone(440, 110, 0.13, 'sawtooth', 0.22);
const sndEShoot = () => tone(160,  80, 0.10, 'sawtooth', 0.11);
const sndDie    = () => {
  tone(320,  40, 0.50, 'sawtooth', 0.28);
  tone(160,  35, 0.80, 'sawtooth', 0.18);
};
const sndLevel  = () =>
  [392, 523, 659, 784].forEach((f, i) =>
    setTimeout(() => tone(f, f, 0.15, 'square', 0.13), i * 110));

let marchTick = 0;
function sndMarch() {
  const freqs = [80, 100, 120, 100];
  tone(freqs[marchTick % 4], freqs[marchTick % 4], 0.045, 'square', 0.08);
  marchTick++;
}

// ── Game state ───────────────────────────────────────────────────────────────
let score, lives, level;
let invaders;      // [row][col] = { alive, type }
let formX, formY;  // formation top-left invader centre
let formDirX;      // 1 or -1
let alive;         // count of living invaders
let animFrame;     // 0 or 1 for the two-frame face animation
let playerX;
let playerBullets; // { x, y }[]
let enemyBullets;  // { x, y }[]
let shields;       // [{ x, y, blocks: bool[][] }]
let nextStepAt;    // timestamp for next march step
let lastPBullet;
let lastEShot;
let eShotInterval; // ms between enemy shots
let state;         // 'start' | 'playing' | 'dying' | 'levelup' | 'gameover'
let stateTimer;

// ── Helpers ──────────────────────────────────────────────────────────────────
function stepInterval() {
  // Speeds up as fewer invaders remain; also gets faster each level
  const base = Math.max(150, 850 - (level - 1) * 75);
  const ratio = alive / (INV_COLS * INV_ROWS);
  return Math.max(55, base * ratio);
}

// ── Init / level setup ───────────────────────────────────────────────────────
function newGame() {
  score = 0; lives = 3; level = 1;
  setupLevel();
  state = 'start';
}

function setupLevel() {
  formX    = START_FORM_X;
  formY    = START_FORM_Y;
  formDirX = 1;
  animFrame = 0;
  marchTick = 0;
  nextStepAt = 0;
  lastPBullet = 0;
  lastEShot   = 0;
  eShotInterval = Math.max(350, 1500 - (level - 1) * 100);

  alive = INV_COLS * INV_ROWS;
  invaders = Array.from({ length: INV_ROWS }, (_, row) =>
    Array.from({ length: INV_COLS }, () => ({
      alive: true,
      type: row === 0 ? 0 : row <= 2 ? 1 : 2,
    }))
  );

  shields = SH_XS.map(cx => ({
    x: Math.round(cx - SH_COLS * SH_BLK_W / 2),
    y: SH_Y,
    blocks: Array.from({ length: SH_ROWS }, (_, r) =>
      Array.from({ length: SH_COLS }, (_, c) => {
        // Arch-shaped shield: clip top-middle corners
        if (r === 0 && (c < 2 || c >= SH_COLS - 2)) return false;
        if (r === 1 && (c < 1 || c >= SH_COLS - 1)) return false;
        // Notch at bottom-centre (player can shoot through)
        if (r >= SH_ROWS - 2 && c >= 2 && c < SH_COLS - 2) return false;
        return true;
      })
    ),
  }));

  playerX       = W / 2;
  playerBullets = [];
  enemyBullets  = [];
}

function respawnAfterDeath() {
  playerX       = W / 2;
  playerBullets = [];
  enemyBullets  = [];
  state = 'playing';
}

// ── Input ────────────────────────────────────────────────────────────────────
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if ((e.code === 'Space' || e.code === 'Enter') &&
      (state === 'start' || state === 'gameover')) {
    newGame();
    state = 'playing';
  }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

// ── Update ───────────────────────────────────────────────────────────────────
function updatePlayer(dt) {
  if (keys['ArrowLeft'])  playerX = Math.max(PLAYER_W / 2,     playerX - PLAYER_SPEED * dt);
  if (keys['ArrowRight']) playerX = Math.min(W - PLAYER_W / 2, playerX + PLAYER_SPEED * dt);
}

function tryPlayerShoot(now) {
  if (!keys['Space'] && !keys['KeyZ']) return;
  if (now - lastPBullet < PBULLET_COOLDOWN) return;
  lastPBullet = now;
  playerBullets.push({ x: playerX, y: PLAYER_Y - 18 });
  sndShoot();
}

function updatePlayerBullets(dt) {
  for (const b of playerBullets) b.y -= PBULLET_SPEED * dt;
  playerBullets = playerBullets.filter(b => b.y >= HEADER_H);
}

function updateEnemyBullets(dt) {
  for (const b of enemyBullets) b.y += EBULLET_SPEED * dt;
  enemyBullets = enemyBullets.filter(b => b.y <= H);
}

function tryEnemyShoot(now) {
  if (alive === 0) return;
  if (now - lastEShot < eShotInterval) return;
  lastEShot = now;

  // Bottom-most alive invader in each column is a potential shooter
  const shooters = [];
  for (let col = 0; col < INV_COLS; col++) {
    for (let row = INV_ROWS - 1; row >= 0; row--) {
      if (invaders[row][col].alive) {
        shooters.push({ row, col });
        break;
      }
    }
  }
  if (!shooters.length) return;

  const s  = shooters[Math.floor(Math.random() * shooters.length)];
  const bx = formX + s.col * INV_CX;
  const by = formY + s.row * INV_CY + INV_H / 2 + 2;
  enemyBullets.push({ x: bx, y: by });
  sndEShoot();
}

function marchInvaders(now) {
  if (now < nextStepAt) return;
  nextStepAt = now + stepInterval();

  sndMarch();
  animFrame = 1 - animFrame;

  // Determine left/right extent of alive invaders for edge detection
  let minCol = INV_COLS - 1, maxCol = 0;
  let anyAlive = false;
  for (let row = 0; row < INV_ROWS; row++) {
    for (let col = 0; col < INV_COLS; col++) {
      if (!invaders[row][col].alive) continue;
      anyAlive = true;
      if (col < minCol) minCol = col;
      if (col > maxCol) maxCol = col;
    }
  }
  if (!anyAlive) return;

  const leftEdge  = formX + minCol * INV_CX - INV_W / 2;
  const rightEdge = formX + maxCol * INV_CX + INV_W / 2;

  const hitRight = formDirX > 0 && rightEdge + STEP_X >= W - 8;
  const hitLeft  = formDirX < 0 && leftEdge  - STEP_X <= 8;

  if (hitRight || hitLeft) {
    formY    += STEP_Y;
    formDirX *= -1;
  } else {
    formX += STEP_X * formDirX;
  }
}

// Returns true if player was hit by an enemy bullet
function checkCollisions() {
  const deadPB = new Set();

  // Player bullets vs invaders
  for (let bi = 0; bi < playerBullets.length; bi++) {
    const b = playerBullets[bi];
    let hit = false;
    outer:
    for (let row = 0; row < INV_ROWS; row++) {
      for (let col = 0; col < INV_COLS; col++) {
        const inv = invaders[row][col];
        if (!inv.alive) continue;
        const ix = formX + col * INV_CX;
        const iy = formY + row * INV_CY;
        if (Math.abs(b.x - ix) < INV_W / 2 + 2 &&
            Math.abs(b.y - iy) < INV_H / 2 + 2) {
          inv.alive = false;
          alive--;
          score += 10;
          sndHit();
          deadPB.add(bi);
          hit = true;
          break outer;
        }
      }
    }
    if (hit) continue;

    // Player bullets vs enemy bullets (cancel each other)
    for (let ei = enemyBullets.length - 1; ei >= 0; ei--) {
      const eb = enemyBullets[ei];
      if (Math.abs(b.x - eb.x) < 6 && Math.abs(b.y - eb.y) < 12) {
        deadPB.add(bi);
        enemyBullets.splice(ei, 1);
        break;
      }
    }
    if (deadPB.has(bi)) continue;

    // Player bullets vs shields
    for (const sh of shields) {
      const col = Math.floor((b.x - sh.x) / SH_BLK_W);
      const row = Math.floor((b.y - sh.y) / SH_BLK_H);
      if (col >= 0 && col < SH_COLS && row >= 0 && row < SH_ROWS && sh.blocks[row][col]) {
        sh.blocks[row][col] = false;
        deadPB.add(bi);
        break;
      }
    }
  }

  playerBullets = playerBullets.filter((_, i) => !deadPB.has(i));

  // Enemy bullets vs shields and player
  const deadEB = new Set();
  for (let ei = 0; ei < enemyBullets.length; ei++) {
    const eb = enemyBullets[ei];

    for (const sh of shields) {
      const col = Math.floor((eb.x - sh.x) / SH_BLK_W);
      const row = Math.floor((eb.y - sh.y) / SH_BLK_H);
      if (col >= 0 && col < SH_COLS && row >= 0 && row < SH_ROWS && sh.blocks[row][col]) {
        sh.blocks[row][col] = false;
        deadEB.add(ei);
        break;
      }
    }
    if (deadEB.has(ei)) continue;

    // Hit player?
    if (Math.abs(eb.x - playerX) < PLAYER_W / 2 + 2 &&
        Math.abs(eb.y - PLAYER_Y) < 16) {
      deadEB.add(ei);
      enemyBullets = enemyBullets.filter((_, i) => !deadEB.has(i));
      return true; // player hit!
    }
  }

  enemyBullets = enemyBullets.filter((_, i) => !deadEB.has(i));
  return false;
}

function invadersReachedBottom() {
  // Check if the bottom-most alive invader has crossed the player line
  for (let row = INV_ROWS - 1; row >= 0; row--) {
    for (let col = 0; col < INV_COLS; col++) {
      if (!invaders[row][col].alive) continue;
      const iy = formY + row * INV_CY;
      if (iy + INV_H / 2 >= SH_Y) return true;
    }
  }
  return false;
}

function die(instant) {
  sndDie();
  if (instant || lives <= 1) {
    lives = 0;
    state = 'gameover';
  } else {
    lives--;
    state    = 'dying';
    stateTimer = 1800;
  }
}

// ── Drawing ───────────────────────────────────────────────────────────────────
function drawBg() {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // Header divider
  ctx.strokeStyle = C.accent + '99';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, HEADER_H); ctx.lineTo(W, HEADER_H); ctx.stroke();

  // Ground line
  ctx.strokeStyle = C.ground;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, H - 28); ctx.lineTo(W, H - 28); ctx.stroke();
}

function drawHUD() {
  ctx.save();

  // Score
  ctx.font = '12px "Courier New"'; ctx.fillStyle = C.dim; ctx.textAlign = 'left';
  ctx.fillText('SCORE', 12, 19);
  ctx.font = 'bold 19px "Courier New"'; ctx.fillStyle = C.score;
  ctx.fillText(String(score).padStart(6, '0'), 12, 44);

  // Title / level
  ctx.font = 'bold 15px "Courier New"'; ctx.fillStyle = C.text; ctx.textAlign = 'center';
  ctx.fillText('FACE INVADERS', W / 2, 20);
  ctx.font = '12px "Courier New"'; ctx.fillStyle = C.accent;
  ctx.fillText(`LEVEL ${level}`, W / 2, 40);

  // Lives (drawn as tiny ships)
  ctx.font = '12px "Courier New"'; ctx.fillStyle = C.dim; ctx.textAlign = 'right';
  ctx.fillText('LIVES', W - 12, 19);
  for (let i = 0; i < lives; i++) {
    drawShipShape(W - 22 - i * 26, 36, 9);
  }

  ctx.restore();
}

function drawShipShape(cx, cy, size) {
  ctx.fillStyle = C.player;
  ctx.beginPath();
  ctx.moveTo(cx,               cy - size * 0.9);
  ctx.lineTo(cx + size * 0.65, cy + size * 0.5);
  ctx.lineTo(cx + size * 0.22, cy + size * 0.10);
  ctx.lineTo(cx,               cy + size * 0.28);
  ctx.lineTo(cx - size * 0.22, cy + size * 0.10);
  ctx.lineTo(cx - size * 0.65, cy + size * 0.5);
  ctx.closePath();
  ctx.fill();
  // Cannon
  ctx.fillRect(cx - 2, cy - size * 1.5, 4, size * 0.65);
}

function drawPlayer(hidden) {
  if (hidden) return;
  ctx.save();
  ctx.shadowColor = C.player;
  ctx.shadowBlur  = 14;
  drawShipShape(playerX, PLAYER_Y, 18);
  ctx.restore();
}

// ── Face drawing ─────────────────────────────────────────────────────────────
// Three distinct "mean face" types:
//   type 0 — small tentacled squid (top row)
//   type 1 — medium alien with antennae (middle rows)
//   type 2 — big crab with pincers (bottom rows)

function drawFaceType0(cx, cy, frame) {
  // Squid / octopus head — small, round, angry
  const col = C.face[0];
  ctx.fillStyle = col;

  // Head blob
  ctx.beginPath();
  ctx.ellipse(cx, cy - 3, 12, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  // Angry eyebrows (slanting inward)
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy - 8); ctx.lineTo(cx - 3, cy - 5);
  ctx.moveTo(cx + 8, cy - 8); ctx.lineTo(cx + 3, cy - 5);
  ctx.stroke();

  // Eyes
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(cx - 4, cy - 3, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 4, cy - 3, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(cx - 3, cy - 4, 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 5, cy - 4, 1.2, 0, Math.PI * 2); ctx.fill();

  // Frown
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy + 3, 4.5, 0.25, Math.PI - 0.25, false);
  ctx.stroke();

  // Tentacles (3, animated)
  ctx.strokeStyle = col; ctx.lineWidth = 2.5;
  const swing = frame === 0 ? 1 : -1;
  for (let i = -1; i <= 1; i++) {
    const tx = cx + i * 8;
    ctx.beginPath();
    ctx.moveTo(tx, cy + 8);
    ctx.quadraticCurveTo(tx + swing * 4, cy + 14, tx + swing * 2, cy + 20);
    ctx.stroke();
  }
}

function drawFaceType1(cx, cy, frame) {
  // Alien head with antennae — medium, rectangular
  const col = C.face[1];

  // Head rect
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.rect(cx - 14, cy - 12, 28, 22);
  ctx.fill();

  // Antennae
  ctx.strokeStyle = col; ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy - 12); ctx.lineTo(cx - 9, cy - 21);
  ctx.moveTo(cx + 6, cy - 12); ctx.lineTo(cx + 9, cy - 21);
  ctx.stroke();
  // Antenna tips
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(cx - 9, cy - 21, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 9, cy - 21, 3, 0, Math.PI * 2); ctx.fill();

  // Angry eyes (angled inner corner — mean look)
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy - 7); ctx.lineTo(cx - 3,  cy - 9);
  ctx.lineTo(cx - 3,  cy - 1); ctx.lineTo(cx - 10, cy - 1);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 10, cy - 7); ctx.lineTo(cx + 3,  cy - 9);
  ctx.lineTo(cx + 3,  cy - 1); ctx.lineTo(cx + 10, cy - 1);
  ctx.closePath(); ctx.fill();
  // Pupils
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(cx - 7, cy - 5, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 7, cy - 5, 1.8, 0, Math.PI * 2); ctx.fill();

  // Teeth (open grin)
  ctx.fillStyle = '#000';
  ctx.fillRect(cx - 9, cy + 2, 18, 7);
  ctx.fillStyle = col;
  for (let t = 0; t < 4; t++) ctx.fillRect(cx - 8 + t * 5, cy + 3, 3, 6);

  // Arms (animated up/down)
  const armY = frame === 0 ? cy - 6 : cy;
  ctx.strokeStyle = col; ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 14, cy - 3); ctx.lineTo(cx - 20, armY);
  ctx.moveTo(cx + 14, cy - 3); ctx.lineTo(cx + 20, armY);
  ctx.stroke();
}

function drawFaceType2(cx, cy, frame) {
  // Crab — wide, menacing, big claws
  const col = C.face[2];

  // Body ellipse
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 15, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Claws (animated open/close)
  const gap = frame === 0 ? 4 : 7;
  ctx.fillStyle = col;
  // Left claw
  ctx.beginPath();
  ctx.moveTo(cx - 15, cy);
  ctx.lineTo(cx - 22, cy - gap);
  ctx.lineTo(cx - 24, cy - 1);
  ctx.lineTo(cx - 22, cy + gap);
  ctx.closePath(); ctx.fill();
  // Right claw
  ctx.beginPath();
  ctx.moveTo(cx + 15, cy);
  ctx.lineTo(cx + 22, cy - gap);
  ctx.lineTo(cx + 24, cy - 1);
  ctx.lineTo(cx + 22, cy + gap);
  ctx.closePath(); ctx.fill();

  // Eyes (large, menacing)
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(cx - 6, cy - 3, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 6, cy - 3, 4.5, 0, Math.PI * 2); ctx.fill();
  // Angry slash eyebrows (across the eyes)
  ctx.strokeStyle = col; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - 11, cy - 7); ctx.lineTo(cx - 1, cy - 1);
  ctx.moveTo(cx + 11, cy - 7); ctx.lineTo(cx + 1, cy - 1);
  ctx.stroke();
  // Pupils
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(cx - 6, cy - 3, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 6, cy - 3, 2, 0, Math.PI * 2); ctx.fill();

  // Gnashing teeth
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.moveTo(cx - 9, cy + 5);
  ctx.lineTo(cx - 6, cy + 10);
  ctx.lineTo(cx - 3, cy + 6);
  ctx.lineTo(cx,     cy + 10);
  ctx.lineTo(cx + 3, cy + 6);
  ctx.lineTo(cx + 6, cy + 10);
  ctx.lineTo(cx + 9, cy + 5);
  ctx.closePath(); ctx.fill();

  // Little legs at the bottom (3 each side)
  ctx.strokeStyle = col; ctx.lineWidth = 1.5;
  const legDrop = frame === 0 ? 3 : 5;
  for (let i = 0; i < 3; i++) {
    const lx = cx - 12 + i * 5;
    ctx.beginPath();
    ctx.moveTo(lx, cy + 10);
    ctx.lineTo(lx - 2, cy + 10 + legDrop);
    ctx.stroke();
    const rx = cx + 12 - i * 5;
    ctx.beginPath();
    ctx.moveTo(rx, cy + 10);
    ctx.lineTo(rx + 2, cy + 10 + legDrop);
    ctx.stroke();
  }
}

function drawInvaders() {
  for (let row = 0; row < INV_ROWS; row++) {
    for (let col = 0; col < INV_COLS; col++) {
      const inv = invaders[row][col];
      if (!inv.alive) continue;
      const x = formX + col * INV_CX;
      const y = formY + row * INV_CY;
      ctx.save();
      if (inv.type === 0) drawFaceType0(x, y, animFrame);
      else if (inv.type === 1) drawFaceType1(x, y, animFrame);
      else                     drawFaceType2(x, y, animFrame);
      ctx.restore();
    }
  }
}

function drawShields() {
  for (const sh of shields) {
    for (let row = 0; row < SH_ROWS; row++) {
      for (let col = 0; col < SH_COLS; col++) {
        if (!sh.blocks[row][col]) continue;
        ctx.fillStyle = C.shield;
        ctx.fillRect(sh.x + col * SH_BLK_W, sh.y + row * SH_BLK_H, SH_BLK_W - 1, SH_BLK_H - 1);
      }
    }
  }
}

function drawBullets() {
  // Player bullets (yellow, upward laser)
  ctx.save();
  ctx.fillStyle = C.pBullet; ctx.shadowColor = C.pBullet; ctx.shadowBlur = 8;
  for (const b of playerBullets) ctx.fillRect(b.x - 2, b.y - 10, 4, 12);
  ctx.restore();

  // Enemy bullets (red, downward chevron)
  ctx.save();
  ctx.fillStyle = C.eBullet; ctx.shadowColor = C.eBullet; ctx.shadowBlur = 8;
  for (const b of enemyBullets) {
    ctx.beginPath();
    ctx.moveTo(b.x,     b.y + 8);
    ctx.lineTo(b.x - 3, b.y);
    ctx.lineTo(b.x,     b.y + 3);
    ctx.lineTo(b.x + 3, b.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawOverlay(title, line1, line2) {
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(0, HEADER_H, W, H - HEADER_H);

  const mid = HEADER_H + (H - HEADER_H) / 2;
  ctx.save();
  ctx.textAlign = 'center';

  ctx.font = 'bold 34px "Courier New"'; ctx.fillStyle = C.text;
  ctx.shadowColor = C.accent; ctx.shadowBlur = 22;
  ctx.fillText(title, W / 2, mid - 24);
  ctx.shadowBlur = 0;

  if (line1) {
    ctx.font = '17px "Courier New"'; ctx.fillStyle = C.accent;
    ctx.fillText(line1, W / 2, mid + 16);
  }
  if (line2) {
    ctx.font = '12px "Courier New"'; ctx.fillStyle = C.dim;
    ctx.fillText(line2, W / 2, mid + 46);
  }
  ctx.restore();
}

// ── Main loop ─────────────────────────────────────────────────────────────────
let prevTime = 0;

function loop(now) {
  const dt = Math.min((now - prevTime) / 1000, 0.05);
  prevTime = now;

  if (state === 'playing') {
    updatePlayer(dt);
    tryPlayerShoot(now);
    updatePlayerBullets(dt);
    updateEnemyBullets(dt);
    tryEnemyShoot(now);
    marchInvaders(now);

    const playerHit = checkCollisions();
    if (playerHit) {
      die(false);
    } else if (invadersReachedBottom()) {
      die(true); // reached bottom = instant game over
    } else if (alive === 0) {
      level++;
      sndLevel();
      state = 'levelup';
      stateTimer = 2800;
    }

  } else if (state === 'dying') {
    stateTimer -= dt * 1000;
    if (stateTimer <= 0) respawnAfterDeath();

  } else if (state === 'levelup') {
    stateTimer -= dt * 1000;
    if (stateTimer <= 0) { setupLevel(); state = 'playing'; }
  }

  // ── Render ──
  drawBg();
  drawHUD();
  drawShields();
  drawInvaders();
  drawBullets();

  const flashHide = state === 'dying' && Math.floor(now / 130) % 2 === 1;
  drawPlayer(flashHide);

  if (state === 'start')
    drawOverlay('FACE INVADERS', 'DESTROY THE FACES!', 'ARROW KEYS + SPACE TO PLAY');
  else if (state === 'dying')
    drawOverlay('SHIP LOST!',
      `${lives} ${lives === 1 ? 'LIFE' : 'LIVES'} REMAINING`, '');
  else if (state === 'gameover')
    drawOverlay('GAME OVER',
      `FINAL SCORE: ${String(score).padStart(6, '0')}`,
      'PRESS SPACE TO PLAY AGAIN');
  else if (state === 'levelup')
    drawOverlay(`LEVEL ${level}!`, 'CLEAR!', 'BRACE FOR IMPACT...');

  requestAnimationFrame(loop);
}

newGame();
requestAnimationFrame(loop);
