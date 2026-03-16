const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDiv = document.getElementById('score');

// ─── Colour palette (matches other arcade games) ────────────────────────────
const C = {
  bg:       '#050510',
  ship:     '#00ccff',
  thrust:   '#ff6622',
  bullet:   '#ffee22',
  asteroid: '#aaaacc',
  ufo:      '#ff44cc',
  ufoB:     '#ff8800',
  text:     '#ffffff',
  score:    '#44ff88',
};

// ─── Audio ───────────────────────────────────────────────────────────────────
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function tone(freq, toFreq, dur, type = 'square', vol = 0.14, delay = 0) {
  const t = audioCtx.currentTime + delay;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.connect(g); g.connect(audioCtx.destination);
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (toFreq !== freq) o.frequency.exponentialRampToValueAtTime(toFreq, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.start(t); o.stop(t + dur);
}

// "Pew pew" — two rapid laser chirps
function playShoot() {
  tone(1400, 280, 0.07, 'square', 0.09);
  tone(1200, 240, 0.07, 'square', 0.07, 0.08);
}

// Noise-based "BOOM" — size affects pitch and duration
function playExplosion(size) {
  const dur  = size === 'large' ? 0.65 : size === 'medium' ? 0.40 : 0.22;
  const vol  = size === 'large' ? 0.75 : size === 'medium' ? 0.50 : 0.30;
  const fc   = size === 'large' ?  600 : size === 'medium' ?  900 : 1400;
  const n    = Math.floor(audioCtx.sampleRate * dur);
  const buf  = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src  = audioCtx.createBufferSource();
  src.buffer = buf;
  const flt  = audioCtx.createBiquadFilter();
  flt.type   = 'lowpass';
  flt.frequency.value = fc;
  const g    = audioCtx.createGain();
  src.connect(flt); flt.connect(g); g.connect(audioCtx.destination);
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  src.start();
}

function playCrash() {
  playExplosion('large');
  tone(280, 30, 0.9, 'sawtooth', 0.12);
}

function playUFOBeep() {
  tone(520, 260, 0.05, 'square', 0.06);
  tone(260, 520, 0.05, 'square', 0.06, 0.07);
}

function playExtraLife() {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.12, 'square', 0.10, i * 0.09));
}

function playLevelUp() {
  [392, 494, 587, 784].forEach((f, i) => tone(f, f * 1.5, 0.18, 'square', 0.11, i * 0.14));
}

// ─── Stars ───────────────────────────────────────────────────────────────────
const stars = Array.from({ length: 90 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  r: Math.random() * 1.5 + 0.2,
  b: Math.random() * 0.5 + 0.4,
}));

// ─── Game state ──────────────────────────────────────────────────────────────
let score        = 0;
let lives        = 3;
let level        = 1;
let levelBanner  = 0;   // countdown frames to show "LEVEL X" banner
let levelSpeedMult = 1; // asteroid speed scalar, increases each level
let state        = 'playing'; // 'playing' | 'dying' | 'gameover'
let dieTimer     = 0;
let frame        = 0;
let shootCd      = 0;
let ufoTimer     = 0;
let ufoBeepTimer = 0;
let nextLifeAt   = 10000;
let invincible   = 0;

const DIE_DUR   = 180;
let   ufoEvery  = 900 + Math.floor(Math.random() * 600); // recomputed each level

const ship = { x: 400, y: 300, angle: -Math.PI / 2, radius: 12, vx: 0, vy: 0, thrusting: false };
const keys = {};
const bullets   = [];
const asteroids = [];
const particles = [];
const ufos      = [];

// ─── Factories ───────────────────────────────────────────────────────────────
function makeAsteroid(x, y, size) {
  let r;
  if (size === 'large')       r = 36 + Math.random() * 14;
  else if (size === 'medium') r = 18 + Math.random() * 10;
  else                        r =  8 + Math.random() *  6;

  if (x === undefined) {
    const edge = Math.floor(Math.random() * 4);
    if (edge === 0)      { x = 0;            y = Math.random() * canvas.height; }
    else if (edge === 1) { x = canvas.width; y = Math.random() * canvas.height; }
    else if (edge === 2) { x = Math.random() * canvas.width; y = 0; }
    else                 { x = Math.random() * canvas.width; y = canvas.height; }
  }

  const spd  = (size === 'large'  ? 0.5 + Math.random() * 0.8
             : size === 'medium' ? 1.0 + Math.random() * 1.2
             :                     1.8 + Math.random() * 1.5) * levelSpeedMult;
  const ang  = Math.random() * Math.PI * 2;
  const spin = (Math.random() - 0.5) * 0.025;
  const vc   = Math.floor(Math.random() * 5) + 7;
  const verts = [];
  for (let i = 0; i < vc; i++) {
    const th = (i / vc) * Math.PI * 2;
    const rv = r * (0.70 + Math.random() * 0.60);
    verts.push({ x: Math.cos(th) * rv, y: Math.sin(th) * rv });
  }
  return { x, y, r, spd, ang, spin, rot: 0, verts, size };
}

function makeUFO() {
  const fromLeft = Math.random() < 0.5;
  const big      = Math.random() < 0.55;
  return {
    x:     fromLeft ? -35 : canvas.width + 35,
    y:     80 + Math.random() * (canvas.height - 160),
    dir:   fromLeft ? 1 : -1,
    spd:   big ? 1.2 : 2.2,
    r:     big ? 18 : 11,
    big,
    shootT: 100 + Math.random() * 60,
  };
}

function makeParticles(x, y, n, color, spd) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (0.4 + Math.random()) * spd;
    particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 1, decay: 0.018 + Math.random() * 0.028,
      color, sz: 1 + Math.random() * 2,
    });
  }
}

// ─── Level management ─────────────────────────────────────────────────────────
function startLevel(n) {
  const count = Math.min(2 + n, 11); // level 1 → 3, level 2 → 4 … capped at 11
  levelSpeedMult = 1 + (n - 1) * 0.12;
  ufoEvery = Math.max(400, 900 - (n - 1) * 60) + Math.floor(Math.random() * 300);
  bullets.length = 0;
  ufos.length = 0;
  ufoTimer = 0;
  for (let i = 0; i < count; i++) asteroids.push(makeAsteroid(undefined, undefined, 'large'));
}

// ─── Init ─────────────────────────────────────────────────────────────────────
startLevel(1);

// ─── Draw helpers ─────────────────────────────────────────────────────────────
function drawBackground() {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  stars.forEach(s => {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200,215,255,${s.b * 0.55})`;
    ctx.fill();
  });
}

function drawShip(hide) {
  if (hide) return;
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);

  // Thrust flame
  if (ship.thrusting) {
    const fl = 8 + Math.random() * 10;
    ctx.save();
    ctx.shadowColor = C.thrust;
    ctx.shadowBlur  = 18;
    ctx.strokeStyle = C.thrust;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(-10, -5);
    ctx.lineTo(-10 - fl, 0);
    ctx.lineTo(-10,  5);
    ctx.stroke();
    ctx.restore();
  }

  // Hull
  ctx.shadowColor = C.ship;
  ctx.shadowBlur  = 14;
  ctx.strokeStyle = C.ship;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(15, 0);
  ctx.lineTo(-10, -9);
  ctx.lineTo(-6,   0);
  ctx.lineTo(-10,  9);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawAsteroids() {
  asteroids.forEach(a => {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.rot);
    ctx.shadowColor = C.asteroid;
    ctx.shadowBlur  = 7;
    ctx.strokeStyle = C.asteroid;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(a.verts[0].x, a.verts[0].y);
    a.verts.forEach(v => ctx.lineTo(v.x, v.y));
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  });
}

function drawBullets() {
  bullets.forEach(b => {
    ctx.save();
    const col = b.fromUFO ? C.ufoB : C.bullet;
    ctx.fillStyle   = col;
    ctx.shadowColor = col;
    ctx.shadowBlur  = 9;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawParticles() {
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle   = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur  = 5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.sz, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawUFOs() {
  ufos.forEach(u => {
    ctx.save();
    ctx.translate(u.x, u.y);
    ctx.shadowColor = C.ufo;
    ctx.shadowBlur  = 14;
    ctx.strokeStyle = C.ufo;
    ctx.lineWidth   = 1.5;
    const r = u.r;
    // Lower disc
    ctx.beginPath();
    ctx.ellipse(0, 4, r, r * 0.38, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Upper dome
    ctx.beginPath();
    ctx.ellipse(0, 2, r * 0.55, r * 0.55, 0, Math.PI, 0);
    ctx.stroke();
    // Blinking beacon
    if (Math.floor(frame / 12) % 2 === 0) {
      ctx.fillStyle = C.ufo;
      ctx.beginPath();
      ctx.arc(0, 2 - r * 0.28, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
}

function drawHUD() {
  ctx.save();
  ctx.font        = 'bold 18px "Courier New", monospace';
  ctx.fillStyle   = C.score;
  ctx.shadowColor = C.score;
  ctx.shadowBlur  = 8;
  ctx.fillText('SCORE  ' + score, 14, 30);
  ctx.textAlign   = 'center';
  ctx.fillText('LEVEL  ' + level, canvas.width / 2, 30);
  ctx.restore();

  // Lives — small ship icons top-right
  for (let i = 0; i < lives; i++) {
    ctx.save();
    ctx.translate(canvas.width - 22 - i * 26, 20);
    ctx.rotate(-Math.PI / 2);
    ctx.strokeStyle = C.ship;
    ctx.shadowColor = C.ship;
    ctx.shadowBlur  = 8;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-4,  0);
    ctx.lineTo(-6,  5);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  // Keep the DOM score element in sync
  scoreDiv.textContent = 'Score: ' + score;
}

// ─── Update ───────────────────────────────────────────────────────────────────
function killShip() {
  playCrash();
  makeParticles(ship.x, ship.y, 32, C.ship, 4);
  state    = 'dying';
  dieTimer = 0;
  ship.vx  = 0;
  ship.vy  = 0;
}

function spawnShip() {
  ship.x     = canvas.width  / 2;
  ship.y     = canvas.height / 2;
  ship.vx    = 0;
  ship.vy    = 0;
  ship.angle = -Math.PI / 2;
  invincible = 120; // ~2 s grace period
}

function update() {
  frame++;
  if (invincible > 0) invincible--;

  // ── Ship movement ────────────────────────────────────────────
  if (state === 'playing') {
    if (keys['ArrowLeft'])  ship.angle -= 0.05;
    if (keys['ArrowRight']) ship.angle += 0.05;
    ship.thrusting = !!keys['ArrowUp'];
    if (ship.thrusting) {
      ship.vx += Math.cos(ship.angle) * 0.15;
      ship.vy += Math.sin(ship.angle) * 0.15;
    }
    const spd = Math.hypot(ship.vx, ship.vy);
    if (spd > 8) { ship.vx = ship.vx / spd * 8; ship.vy = ship.vy / spd * 8; }
  } else {
    ship.thrusting = false;
  }

  ship.x += ship.vx;  ship.y += ship.vy;
  ship.vx *= 0.985;   ship.vy *= 0.985;
  if (ship.x < 0)             ship.x = canvas.width;
  if (ship.x > canvas.width)  ship.x = 0;
  if (ship.y < 0)             ship.y = canvas.height;
  if (ship.y > canvas.height) ship.y = 0;

  if (shootCd > 0) shootCd--;

  // ── Bullets ──────────────────────────────────────────────────
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += Math.cos(b.ang) * b.spd;
    b.y += Math.sin(b.ang) * b.spd;
    b.life--;
    if (b.life <= 0 || b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height)
      bullets.splice(i, 1);
  }

  // ── Particles ────────────────────────────────────────────────
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.97; p.vy *= 0.97;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // ── Asteroids ────────────────────────────────────────────────
  asteroids.forEach(a => {
    a.x += Math.cos(a.ang) * a.spd;
    a.y += Math.sin(a.ang) * a.spd;
    a.rot += a.spin;
    if (a.x < -a.r)               a.x = canvas.width  + a.r;
    if (a.x > canvas.width  + a.r) a.x = -a.r;
    if (a.y < -a.r)               a.y = canvas.height + a.r;
    if (a.y > canvas.height + a.r) a.y = -a.r;
  });

  // ── UFO spawning ──────────────────────────────────────────────
  ufoTimer++;
  if (ufoTimer >= ufoEvery && ufos.length === 0) {
    ufos.push(makeUFO());
    ufoTimer = 0;
  }

  // ── UFO update ────────────────────────────────────────────────
  ufoBeepTimer++;
  for (let i = ufos.length - 1; i >= 0; i--) {
    const u = ufos[i];
    u.x += u.dir * u.spd;
    u.shootT--;

    if (ufoBeepTimer % 40 === 0) playUFOBeep();

    // UFO shoots toward ship with scatter
    if (u.shootT <= 0 && state === 'playing') {
      u.shootT = 90 + Math.random() * 70;
      const scatter = u.big ? 0.6 : 1.2;
      const aim = Math.atan2(ship.y - u.y, ship.x - u.x) + (Math.random() - 0.5) * scatter;
      bullets.push({ x: u.x, y: u.y, ang: aim, spd: 4, life: 130, fromUFO: true });
    }

    if ((u.dir > 0 && u.x > canvas.width + 50) || (u.dir < 0 && u.x < -50))
      ufos.splice(i, 1);
  }

  // ── Level-clear detection ─────────────────────────────────────
  if (asteroids.length === 0 && levelBanner === 0 && state === 'playing') {
    level++;
    levelBanner = 160;
    playLevelUp();
  }
  if (levelBanner > 0) {
    levelBanner--;
    if (levelBanner === 0) startLevel(level);
  }

  // ── Bullet ↔ asteroid ────────────────────────────────────────
  for (let ai = asteroids.length - 1; ai >= 0; ai--) {
    const a = asteroids[ai];
    let hit = false;
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      if (b.fromUFO) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + 2.5) {
        bullets.splice(bi, 1);
        hit = true;
        break;
      }
    }
    if (!hit) continue;

    asteroids.splice(ai, 1);
    score += a.size === 'large' ? 20 : a.size === 'medium' ? 50 : 100;
    playExplosion(a.size);
    makeParticles(a.x, a.y, a.size === 'large' ? 22 : 14, C.asteroid, 3);

    if (a.size === 'large') {
      asteroids.push(makeAsteroid(a.x, a.y, 'medium'));
      asteroids.push(makeAsteroid(a.x, a.y, 'medium'));
      asteroids.push(makeAsteroid(a.x, a.y, 'small'));
    } else if (a.size === 'medium') {
      asteroids.push(makeAsteroid(a.x, a.y, 'small'));
      asteroids.push(makeAsteroid(a.x, a.y, 'small'));
    }
  }

  // ── UFO bullet ↔ ship ─────────────────────────────────────────
  if (state === 'playing' && invincible === 0) {
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      if (!b.fromUFO) continue;
      if (Math.hypot(b.x - ship.x, b.y - ship.y) < ship.radius + 2.5) {
        bullets.splice(bi, 1);
        killShip();
        break;
      }
    }
  }

  // ── Asteroid ↔ ship ───────────────────────────────────────────
  if (state === 'playing' && invincible === 0) {
    for (const a of asteroids) {
      if (Math.hypot(a.x - ship.x, a.y - ship.y) < a.r + ship.radius) {
        killShip();
        break;
      }
    }
  }

  // ── Bullet ↔ UFO ──────────────────────────────────────────────
  for (let ui = ufos.length - 1; ui >= 0; ui--) {
    const u = ufos[ui];
    let hit = false;
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      if (b.fromUFO) continue;
      if (Math.hypot(u.x - b.x, u.y - b.y) < u.r + 2.5) {
        bullets.splice(bi, 1);
        hit = true;
        break;
      }
    }
    if (!hit) continue;
    ufos.splice(ui, 1);
    score += u.big ? 200 : 1000;
    playExplosion('medium');
    makeParticles(u.x, u.y, 22, C.ufo, 4);
  }

  // ── Death timer ───────────────────────────────────────────────
  if (state === 'dying') {
    dieTimer++;
    if (dieTimer >= DIE_DUR) {
      dieTimer = 0;
      lives--;
      if (lives <= 0) {
        state = 'gameover';
      } else {
        state = 'playing';
        spawnShip();
      }
    }
  }

  // ── Extra life milestone ──────────────────────────────────────
  if (score >= nextLifeAt) {
    nextLifeAt += 10000;
    lives++;
    playExtraLife();
  }
}

// ─── Main loop ────────────────────────────────────────────────────────────────
function draw() {
  const dyingFlash = state === 'dying' && Math.floor(frame / 4) % 2 === 0;
  const invFlash   = invincible > 0    && Math.floor(frame / 5) % 2 === 0;
  const hideShip   = dyingFlash || invFlash;

  drawBackground();
  drawAsteroids();
  drawUFOs();
  drawBullets();
  drawParticles();
  drawShip(hideShip);
  drawHUD();

  // Level banner overlay
  if (levelBanner > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, levelBanner / 30);
    ctx.textAlign   = 'center';
    ctx.font        = 'bold 52px "Courier New", monospace';
    ctx.fillStyle   = C.ship;
    ctx.shadowColor = C.ship;
    ctx.shadowBlur  = 28;
    ctx.fillText('LEVEL  ' + level, canvas.width / 2, canvas.height / 2);
    ctx.restore();
  }

  if (state === 'gameover') {
    ctx.save();
    ctx.textAlign   = 'center';
    ctx.font        = 'bold 56px "Courier New", monospace';
    ctx.fillStyle   = '#ff4444';
    ctx.shadowColor = '#ff4444';
    ctx.shadowBlur  = 24;
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 24);
    ctx.font      = 'bold 20px "Courier New", monospace';
    ctx.fillStyle = C.text;
    ctx.shadowBlur = 0;
    ctx.fillText('SCORE  ' + score, canvas.width / 2, canvas.height / 2 + 22);
    ctx.font      = '16px "Courier New", monospace';
    ctx.fillStyle = C.score;
    ctx.fillText('PRESS  ENTER  TO  PLAY  AGAIN', canvas.width / 2, canvas.height / 2 + 56);
    ctx.restore();
  } else {
    update();
  }

  requestAnimationFrame(draw);
}

// ─── Reset ────────────────────────────────────────────────────────────────────
function resetGame() {
  score        = 0;
  lives        = 3;
  level        = 1;
  levelBanner  = 0;
  levelSpeedMult = 1;
  state        = 'playing';
  dieTimer     = 0;
  frame        = 0;
  ufoTimer     = 0;
  nextLifeAt   = 10000;
  invincible   = 0;
  bullets.length = 0; asteroids.length = 0;
  particles.length = 0; ufos.length = 0;
  spawnShip();
  startLevel(1);
}

// ─── Input ────────────────────────────────────────────────────────────────────
window.addEventListener('keydown', e => {
  keys[e.key] = true;

  if (state === 'gameover' && e.key === 'Enter') { resetGame(); return; }

  if (e.key === ' ' && state === 'playing' && shootCd === 0) {
    bullets.push({
      x:    ship.x + Math.cos(ship.angle) * 16,
      y:    ship.y + Math.sin(ship.angle) * 16,
      ang:  ship.angle,
      spd:  6.5,
      life: 85,
    });
    playShoot();
    shootCd = 9;
  }
});

window.addEventListener('keyup', e => { keys[e.key] = false; });

draw();
