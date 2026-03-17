// Sentra-Pede — centipede-inspired arcade game

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ── Grid constants ────────────────────────────────────────────────────────
const CELL        = 20;
const COLS        = 30;
const GAME_ROWS   = 30;
const HEADER_H    = 60;
const PLAYER_ROWS = 4;          // rows reserved at bottom for the player
const CENT_LEN    = 12;         // starting centipede segments
const SHROOM_CNT  = 30;

canvas.width  = COLS * CELL;                  // 600
canvas.height = GAME_ROWS * CELL + HEADER_H;  // 660

function scaleToFit() {
  const scale = Math.min(window.innerWidth / canvas.width, window.innerHeight / canvas.height, 1);
  canvas.style.width  = (canvas.width  * scale) + 'px';
  canvas.style.height = (canvas.height * scale) + 'px';
}
scaleToFit();
window.addEventListener('resize', scaleToFit);

// ── Palette ───────────────────────────────────────────────────────────────
const C = {
  bg:       '#0a0a0f',
  player:   '#00ccff',
  bullet:   '#ffee22',
  centHead: '#ff3333',
  centBody: '#33ee66',
  mushroom: '#aa44ff',
  accent:   '#7c3aed',
  text:     '#ffffff',
  dim:      '#555555',
  score:    '#44ff88',
};

// ── Game state ────────────────────────────────────────────────────────────
let score, lives, level, levelBonus;
let mushrooms;   // boolean[GAME_ROWS][COLS]
let centipedes;  // { segments: {x,y,dir}[] }[]
let bullets;     // { x, y }[]  — pixel coords
let player;      // { x, y }    — grid coords
let state;       // 'start' | 'playing' | 'dying' | 'levelup' | 'gameover'
let nextMoveAt;
let moveInterval;
let stateTimer;
let lastBulletAt;
let lastPlayerAt;

const BULLET_SPEED    = 620;  // px/s
const BULLET_COOLDOWN = 175;  // ms between shots
const PLAYER_STEP_MS  = 90;   // ms between player grid steps

// ── Audio ─────────────────────────────────────────────────────────────────
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
const sndShoot   = () => tone(720, 180, 0.07, 'square',   0.11);
const sndHitMush = () => tone(130,  80, 0.09, 'sawtooth', 0.18);
const sndHitCent = () => tone(520, 260, 0.10, 'square',   0.20);
const sndDie     = () => tone(380,  45, 0.75, 'sawtooth', 0.28);
const sndLevel   = () =>
  [262, 330, 392, 523].forEach((f, i) =>
    setTimeout(() => tone(f, f, 0.14, 'square', 0.14), i * 100));

// ── Initialization ────────────────────────────────────────────────────────
function newGame() {
  score = 0; lives = 3; level = 1;
  setupLevel();
  state = 'start';
}

function setupLevel() {
  moveInterval = Math.max(55, 210 - (level - 1) * 15);
  nextMoveAt = 0; lastBulletAt = 0; lastPlayerAt = 0;
  bullets = [];
  levelBonus = 0;

  // Place mushrooms — skip top 2 rows and the player zone
  mushrooms = Array.from({ length: GAME_ROWS }, () => new Array(COLS).fill(false));
  let placed = 0;
  while (placed < SHROOM_CNT) {
    const r = 2 + Math.floor(Math.random() * (GAME_ROWS - PLAYER_ROWS - 2));
    const c = Math.floor(Math.random() * COLS);
    if (!mushrooms[r][c]) { mushrooms[r][c] = true; placed++; }
  }

  // Centipede starts off-screen left at row 0, moving right
  centipedes = [{
    segments: Array.from({ length: CENT_LEN }, (_, i) => ({ x: -i - 1, y: 0, dir: 1 }))
  }];

  player = { x: Math.floor(COLS / 2), y: GAME_ROWS - 2 };
}

function respawnAfterDeath() {
  bullets = [];
  player = { x: Math.floor(COLS / 2), y: GAME_ROWS - 2 };
  centipedes = [{
    segments: Array.from({ length: CENT_LEN }, (_, i) => ({ x: -i - 1, y: 0, dir: 1 }))
  }];
  nextMoveAt = 0;
  state = 'playing';
}

// ── Input ─────────────────────────────────────────────────────────────────
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code))
    e.preventDefault();
  if ((e.code === 'Space' || e.code === 'Enter') &&
      (state === 'start' || state === 'gameover')) {
    newGame();
    state = 'playing';
  }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

// ── Update ────────────────────────────────────────────────────────────────
function updatePlayer(now) {
  if (now - lastPlayerAt < PLAYER_STEP_MS) return;
  lastPlayerAt = now;
  if (keys['ArrowLeft']  && player.x > 0)                        player.x--;
  if (keys['ArrowRight'] && player.x < COLS - 1)                 player.x++;
  if (keys['ArrowUp']    && player.y > GAME_ROWS - PLAYER_ROWS)  player.y--;
  if (keys['ArrowDown']  && player.y < GAME_ROWS - 1)            player.y++;
}

function tryShoot(now) {
  if (!keys['Space'] && !keys['KeyZ']) return;
  if (now - lastBulletAt < BULLET_COOLDOWN) return;
  lastBulletAt = now;
  bullets.push({ x: player.x * CELL + CELL / 2, y: player.y * CELL + HEADER_H });
  sndShoot();
}

function updateBullets(dt) {
  // Move all bullets upward
  for (const b of bullets) b.y -= BULLET_SPEED * dt;
  // Discard bullets that left the screen
  bullets = bullets.filter(b => b.y >= HEADER_H);

  const usedBullets = new Set();
  const newCents    = [];

  // ── Mushroom collisions ──
  for (let bi = 0; bi < bullets.length; bi++) {
    const b  = bullets[bi];
    const bc = Math.floor(b.x / CELL);
    const br = Math.floor((b.y - HEADER_H) / CELL);
    if (br >= 0 && br < GAME_ROWS && bc >= 0 && bc < COLS && mushrooms[br][bc]) {
      mushrooms[br][bc] = false;
      score += 10;
      usedBullets.add(bi);
      sndHitMush();
    }
  }

  // ── Centipede segment collisions ──
  outer:
  for (let bi = 0; bi < bullets.length; bi++) {
    if (usedBullets.has(bi)) continue;
    const b = bullets[bi];

    for (let ci = 0; ci < centipedes.length; ci++) {
      const cent = centipedes[ci];
      for (let si = 0; si < cent.segments.length; si++) {
        const seg = cent.segments[si];
        if (seg.x < 0) continue;  // off-screen left during entry

        const sx = seg.x * CELL + CELL / 2;
        const sy = seg.y * CELL + HEADER_H + CELL / 2;

        if (Math.abs(b.x - sx) < CELL * 0.62 && Math.abs(b.y - sy) < CELL * 0.62) {
          score += 25;
          usedBullets.add(bi);
          sndHitCent();

          // Leave a mushroom where the segment died
          if (seg.y >= 0 && seg.y < GAME_ROWS && seg.x >= 0 && seg.x < COLS)
            mushrooms[seg.y][seg.x] = true;

          // Split: back half becomes a new independent centipede
          const back = cent.segments.splice(si + 1);  // removes [si+1..end]
          cent.segments.splice(si, 1);                 // removes the hit segment
          if (back.length) newCents.push({ segments: back });

          continue outer;  // one bullet hits one segment
        }
      }
    }
  }

  bullets    = bullets.filter((_, i) => !usedBullets.has(i));
  centipedes = [...centipedes, ...newCents].filter(c => c.segments.length > 0);
}

function moveCentipedes(now) {
  if (now < nextMoveAt) return;
  nextMoveAt = now + moveInterval;

  for (const cent of centipedes) {
    if (!cent.segments.length) continue;

    // Snapshot positions before moving
    const prev = cent.segments.map(s => ({ ...s }));

    // Move the head
    const h  = cent.segments[0];
    const nx = h.x + h.dir;
    const wallHit = nx < 0 || nx >= COLS;
    const mushHit = !wallHit && h.y >= 0 && h.y < GAME_ROWS && mushrooms[h.y][nx];

    if (wallHit || mushHit) {
      h.y++;       // drop one row
      h.dir *= -1; // reverse horizontal direction
    } else {
      h.x = nx;
    }

    // Each body segment moves to where the preceding segment was
    for (let i = 1; i < cent.segments.length; i++) {
      cent.segments[i].x   = prev[i - 1].x;
      cent.segments[i].y   = prev[i - 1].y;
      cent.segments[i].dir = prev[i - 1].dir;
    }
  }
}

function checkDeath() {
  for (const cent of centipedes) {
    for (const seg of cent.segments) {
      if (seg.y >= GAME_ROWS)                               return true; // off bottom
      if (seg.x === player.x && seg.y === player.y)        return true; // hit player
    }
  }
  return false;
}

function die() {
  lives--;
  sndDie();
  state = (lives <= 0) ? 'gameover' : 'dying';
  stateTimer = 1800;
}

// ── Drawing ───────────────────────────────────────────────────────────────
function drawBg() {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Header divider
  ctx.strokeStyle = C.accent + '99';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, HEADER_H); ctx.lineTo(canvas.width, HEADER_H); ctx.stroke();

  // Player-zone divider (subtle)
  ctx.strokeStyle = C.accent + '28';
  const pzY = (GAME_ROWS - PLAYER_ROWS) * CELL + HEADER_H;
  ctx.beginPath(); ctx.moveTo(0, pzY); ctx.lineTo(canvas.width, pzY); ctx.stroke();
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
  ctx.fillText('SENTRY-PEDE', canvas.width / 2, 20);
  ctx.font = '12px "Courier New"'; ctx.fillStyle = C.accent;
  ctx.fillText(`LEVEL ${level}`, canvas.width / 2, 40);

  // Lives
  ctx.font = '12px "Courier New"'; ctx.fillStyle = C.dim; ctx.textAlign = 'right';
  ctx.fillText('SHIPS', canvas.width - 12, 19);
  for (let i = 0; i < lives; i++) {
    const lx = canvas.width - 18 - i * 22;
    ctx.fillStyle = C.player;
    ctx.beginPath();
    ctx.moveTo(lx, 30); ctx.lineTo(lx + 5, 44);
    ctx.lineTo(lx, 40); ctx.lineTo(lx - 5, 44);
    ctx.closePath(); ctx.fill();
  }

  ctx.restore();
}

function drawMushrooms() {
  for (let r = 0; r < GAME_ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!mushrooms[r][c]) continue;
      const cx = c * CELL + CELL / 2;
      const cy = r * CELL + HEADER_H + CELL / 2;

      ctx.fillStyle = C.mushroom;
      // cap (semicircle)
      ctx.beginPath();
      ctx.arc(cx, cy - 1, CELL * 0.41, Math.PI, 0, false);
      ctx.fill();
      // stem
      ctx.fillRect(cx - CELL * 0.21, cy - 1, CELL * 0.42, CELL * 0.36);
      // spots
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      ctx.beginPath(); ctx.arc(cx - 3, cy - 6, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 4, cy - 8, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawCentipedes() {
  for (const cent of centipedes) {
    for (let i = 0; i < cent.segments.length; i++) {
      const seg = cent.segments[i];
      if (seg.x < 0 || seg.x >= COLS || seg.y < 0 || seg.y >= GAME_ROWS) continue;

      const cx     = seg.x * CELL + CELL / 2;
      const cy     = seg.y * CELL + HEADER_H + CELL / 2;
      const isHead = i === 0;

      // Body circle
      ctx.fillStyle = isHead ? C.centHead : C.centBody;
      ctx.beginPath(); ctx.arc(cx, cy, CELL * 0.43, 0, Math.PI * 2); ctx.fill();

      if (isHead) {
        // Eyes (shift toward facing direction)
        const ex = seg.dir > 0 ? cx + 3 : cx - 3;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(ex + 2, cy - 3, 2.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex - 2, cy - 3, 2.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(ex + 2.5, cy - 3, 1.1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex - 1.5, cy - 3, 1.1, 0, Math.PI * 2); ctx.fill();
      } else {
        // Joint dot for body segments
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath(); ctx.arc(cx, cy, CELL * 0.21, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}

function drawPlayer(hide) {
  if (hide) return;
  const cx = player.x * CELL + CELL / 2;
  const cy = player.y * CELL + HEADER_H + CELL / 2;

  ctx.save();
  ctx.fillStyle = C.player;
  ctx.shadowColor = C.player; ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(cx,              cy - CELL * 0.48);
  ctx.lineTo(cx + CELL * 0.38, cy + CELL * 0.38);
  ctx.lineTo(cx + CELL * 0.12, cy + CELL * 0.20);
  ctx.lineTo(cx,              cy + CELL * 0.30);
  ctx.lineTo(cx - CELL * 0.12, cy + CELL * 0.20);
  ctx.lineTo(cx - CELL * 0.38, cy + CELL * 0.38);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawBullets() {
  ctx.save();
  ctx.fillStyle = C.bullet; ctx.shadowColor = C.bullet; ctx.shadowBlur = 7;
  for (const b of bullets) ctx.fillRect(b.x - 2, b.y - 8, 4, 10);
  ctx.restore();
}

function drawOverlay(title, line1, line2) {
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(0, HEADER_H, canvas.width, canvas.height - HEADER_H);

  const mid = HEADER_H + (canvas.height - HEADER_H) / 2;
  ctx.save();
  ctx.textAlign = 'center';

  ctx.font = 'bold 34px "Courier New"'; ctx.fillStyle = C.text;
  ctx.shadowColor = C.accent; ctx.shadowBlur = 22;
  ctx.fillText(title, canvas.width / 2, mid - 24);
  ctx.shadowBlur = 0;

  if (line1) {
    ctx.font = '17px "Courier New"'; ctx.fillStyle = C.accent;
    ctx.fillText(line1, canvas.width / 2, mid + 16);
  }
  if (line2) {
    ctx.font = '12px "Courier New"'; ctx.fillStyle = C.dim;
    ctx.fillText(line2, canvas.width / 2, mid + 46);
  }
  ctx.restore();
}

// ── Main loop ─────────────────────────────────────────────────────────────
let prevTime = 0;

function loop(now) {
  const dt = Math.min((now - prevTime) / 1000, 0.05);
  prevTime = now;

  if (state === 'playing') {
    updatePlayer(now);
    tryShoot(now);
    updateBullets(dt);
    moveCentipedes(now);

    // Level clear — all centipede segments destroyed
    if (centipedes.length === 0) {
      // Bonus points for remaining mushrooms (auto-cleared)
      levelBonus = 0;
      for (let r = 0; r < GAME_ROWS; r++)
        for (let c = 0; c < COLS; c++)
          if (mushrooms[r][c]) levelBonus += 10;
      score += levelBonus;
      level++;
      sndLevel();
      state = 'levelup';
      stateTimer = 2600;
    }

    if (checkDeath()) die();

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
  drawMushrooms();
  drawCentipedes();
  // Flash player ship during death animation
  drawPlayer(state === 'dying' && Math.floor(now / 140) % 2 === 1);
  drawBullets();

  if (state === 'start')
    drawOverlay('SENTRY-PEDE', 'BLAST THE CENTIPEDE!', 'PRESS SPACE TO START');
  else if (state === 'dying')
    drawOverlay('SHIP LOST!',
      `${lives} SHIP${lives !== 1 ? 'S' : ''} REMAINING`, '');
  else if (state === 'gameover')
    drawOverlay('GAME OVER',
      `FINAL SCORE: ${String(score).padStart(6, '0')}`,
      'PRESS SPACE TO PLAY AGAIN');
  else if (state === 'levelup')
    drawOverlay(`LEVEL ${level}!`,
      levelBonus > 0 ? `MUSHROOM BONUS  +${levelBonus}` : 'GET READY!',
      'PREPARE FOR BATTLE...');

  requestAnimationFrame(loop);
}

newGame();
requestAnimationFrame(loop);
