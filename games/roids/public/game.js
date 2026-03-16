const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDiv = document.getElementById('score');

let score = 0;
let gameOver = false;

// audio context for effects
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playShoot() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(800, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.1);
}

function playCrash() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(100, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.5);
}

function playExplosion() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(600, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.3);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.3);
}

const ship = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  angle: 0,
  radius: 10,
  vx: 0,
  vy: 0,
};

const keys = {};
const bullets = [];
const asteroids = [];

function createAsteroid() {
  const radius = Math.random() * 30 + 15;
  const edge = Math.floor(Math.random() * 4);
  let x, y;

  if (edge === 0) {
    x = 0;
    y = Math.random() * canvas.height;
  } else if (edge === 1) {
    x = canvas.width;
    y = Math.random() * canvas.height;
  } else if (edge === 2) {
    x = Math.random() * canvas.width;
    y = 0;
  } else {
    x = Math.random() * canvas.width;
    y = canvas.height;
  }

  const speed = 1 + Math.random() * 1.5;
  const angle = Math.atan2(ship.y - y, ship.x - x);

  // create jagged polygon
  const vertexCount = Math.floor(Math.random() * 5) + 7; // 7-11 points
  const vertices = [];
  for (let i = 0; i < vertexCount; i++) {
    const theta = (i / vertexCount) * Math.PI * 2;
    const r = radius * (0.75 + Math.random() * 0.5);
    vertices.push({ x: Math.cos(theta) * r, y: Math.sin(theta) * r });
  }

  asteroids.push({ x, y, radius, speed, angle, vertices });
}

function drawShip() {
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);
  ctx.beginPath();
  ctx.moveTo(15, 0);
  ctx.lineTo(-10, -10);
  ctx.lineTo(-10, 10);
  ctx.closePath();
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.restore();
}

function drawAsteroids() {
  ctx.strokeStyle = '#888';
  asteroids.forEach(a => {
    ctx.beginPath();
    if (a.vertices) {
      const first = a.vertices[0];
      ctx.moveTo(a.x + first.x, a.y + first.y);
      a.vertices.forEach(v => {
        ctx.lineTo(a.x + v.x, a.y + v.y);
      });
      ctx.closePath();
    } else {
      ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
    }
    ctx.stroke();
  });
}

function drawBullets() {
  ctx.fillStyle = '#f00';
  bullets.forEach(b => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

function update() {
  if (keys['ArrowLeft']) ship.angle -= 0.05;
  if (keys['ArrowRight']) ship.angle += 0.05;
  if (keys['ArrowUp']) {
    // thrust
    ship.vx += Math.cos(ship.angle) * 0.1;
    ship.vy += Math.sin(ship.angle) * 0.1;
  }
  // apply velocity
  ship.x += ship.vx;
  ship.y += ship.vy;
  // friction
  ship.vx *= 0.99;
  ship.vy *= 0.99;
  // wrap around
  if (ship.x < 0) ship.x = canvas.width;
  if (ship.x > canvas.width) ship.x = 0;
  if (ship.y < 0) ship.y = canvas.height;
  if (ship.y > canvas.height) ship.y = 0;

  bullets.forEach((b, i) => {
    b.x += Math.cos(b.angle) * b.speed;
    b.y += Math.sin(b.angle) * b.speed;
    // remove offscreen
    if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) {
      bullets.splice(i, 1);
    }
  });

  asteroids.forEach((a, ai) => {
    a.x += Math.cos(a.angle) * a.speed;
    a.y += Math.sin(a.angle) * a.speed;

    // collision with ship
    const dx = a.x - ship.x;
    const dy = a.y - ship.y;
    if (Math.hypot(dx, dy) < a.radius + ship.radius) {
      playCrash();
      gameOver = true;
    }

    // collision with bullets
    bullets.forEach((b, bi) => {
      const dx2 = a.x - b.x;
      const dy2 = a.y - b.y;
      if (Math.hypot(dx2, dy2) < a.radius + 2) {
        asteroids.splice(ai, 1);
        bullets.splice(bi, 1);
        score += 10;
        playExplosion();
      }
    });
  });

  if (Math.random() < 0.02) createAsteroid();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawShip();
  drawAsteroids();
  drawBullets();
  scoreDiv.textContent = 'Score: ' + score;

  if (gameOver) {
    ctx.fillStyle = '#fff';
    ctx.font = '48px Arial';
    ctx.fillText('You lose', canvas.width / 2 - 100, canvas.height / 2);
    return;
  }

  update();
  requestAnimationFrame(draw);
}

window.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.key === ' ') {
    bullets.push({
      x: ship.x + Math.cos(ship.angle) * 15,
      y: ship.y + Math.sin(ship.angle) * 15,
      angle: ship.angle,
      speed: 5,
    });
    playShoot();
  }
});

window.addEventListener('keyup', e => {
  keys[e.key] = false;
});

draw();
