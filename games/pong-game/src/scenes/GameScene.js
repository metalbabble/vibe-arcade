import Phaser from 'phaser';

const W = 800;
const H = 600;
const PADDLE_W = 12;
const PADDLE_H = 80;
const BALL_SIZE = 10;
const PLAYER_X = 30;
const AI_X = W - 30;
const PADDLE_SPEED = 400;
const BALL_START_SPEED = 300;
const BALL_MAX_SPEED = 600;
const SCORE_Y = 30;

// Medium AI: tracks ball with a slight delay and speed cap
const AI_SPEED = 260;
const AI_REACTION_ZONE = W * 0.55; // AI only reacts when ball is past this x

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.playerScore = 0;
    this.aiScore = 0;
    this.audioCtx = null;
  }

  create() {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Center dashed line
    this.drawCenterLine();

    // Paddles
    this.playerPaddle = this.add.rectangle(PLAYER_X, H / 2, PADDLE_W, PADDLE_H, 0xffffff);
    this.aiPaddle = this.add.rectangle(AI_X, H / 2, PADDLE_W, PADDLE_H, 0xffffff);
    this.physics.add.existing(this.playerPaddle, false);
    this.physics.add.existing(this.aiPaddle, false);
    this.playerPaddle.body.setCollideWorldBounds(true);
    this.playerPaddle.body.setImmovable(true);
    this.aiPaddle.body.setCollideWorldBounds(true);
    this.aiPaddle.body.setImmovable(true);

    // Ball — only bounce off top/bottom; left/right are scoring zones
    this.physics.world.setBounds(0, 0, W, H, false, false, true, true);
    this.ball = this.add.rectangle(W / 2, H / 2, BALL_SIZE, BALL_SIZE, 0xffffff);
    this.physics.add.existing(this.ball, false);
    this.ball.body.setCollideWorldBounds(true);
    this.ball.body.setBounce(1, 1);
    this.ball.body.onWorldBounds = true;

    this.launchBall();

    // Colliders
    this.physics.add.collider(this.ball, this.playerPaddle, this.onPaddleHit, null, this);
    this.physics.add.collider(this.ball, this.aiPaddle, this.onPaddleHit, null, this);

    // World bounds hit (top/bottom beep)
    this.physics.world.on('worldbounds', (body, up, down) => {
      if (body.gameObject === this.ball && (up || down)) {
        this.playBeep(440, 0.05, 'square');
      }
    });

    // Score text
    this.playerScoreText = this.add.text(W / 4, SCORE_Y, '0', {
      fontSize: '40px',
      fontFamily: 'monospace',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5);

    this.aiScoreText = this.add.text((W * 3) / 4, SCORE_Y, '0', {
      fontSize: '40px',
      fontFamily: 'monospace',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5);

    // Labels above scores
    this.add.text(W / 4, SCORE_Y - 22, 'PLAYER', {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#888888',
    }).setOrigin(0.5, 0.5);

    this.add.text((W * 3) / 4, SCORE_Y - 22, 'CPU', {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#888888',
    }).setOrigin(0.5, 0.5);

    // Keyboard
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
    });

    // Scoring zone (left/right walls)
    this.isScoringPaused = false;
  }

  drawCenterLine() {
    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0x444444, 1);
    const segH = 20;
    const gap = 14;
    for (let y = 0; y < H; y += segH + gap) {
      graphics.beginPath();
      graphics.moveTo(W / 2, y);
      graphics.lineTo(W / 2, y + segH);
      graphics.strokePath();
    }
  }

  launchBall(towardPlayer = null) {
    const angle = Phaser.Math.Between(-35, 35);
    let dir = towardPlayer === null
      ? (Math.random() < 0.5 ? 1 : -1)
      : towardPlayer ? -1 : 1;
    const rad = Phaser.Math.DegToRad(angle);
    this.ball.setPosition(W / 2, H / 2);
    const vx = dir * Math.cos(rad) * BALL_START_SPEED;
    const vy = Math.sin(rad) * BALL_START_SPEED;
    this.ball.body.setVelocity(vx, vy);
  }

  onPaddleHit(ball, paddle) {
    // Angle based on hit position relative to paddle center
    const relY = (ball.y - paddle.y) / (PADDLE_H / 2);
    const bounceAngle = relY * 60; // max 60deg
    const speed = Math.min(
      Math.sqrt(ball.body.velocity.x ** 2 + ball.body.velocity.y ** 2) + 20,
      BALL_MAX_SPEED
    );
    const dir = ball.x < W / 2 ? 1 : -1;
    const rad = Phaser.Math.DegToRad(bounceAngle);
    ball.body.setVelocity(dir * Math.cos(rad) * speed, Math.sin(rad) * speed);

    this.playBeep(660, 0.06, 'sine');
  }

  updateAI(delta) {
    const ballX = this.ball.x;
    const ballY = this.ball.y;
    const paddleY = this.aiPaddle.y;
    const dt = delta / 1000;

    // Only react when ball is heading toward AI side
    if (ballX < AI_REACTION_ZONE) {
      // Drift toward center slowly
      const target = H / 2;
      if (paddleY < target - 5) {
        this.aiPaddle.body.setVelocityY(AI_SPEED * 0.3);
      } else if (paddleY > target + 5) {
        this.aiPaddle.body.setVelocityY(-AI_SPEED * 0.3);
      } else {
        this.aiPaddle.body.setVelocityY(0);
      }
      return;
    }

    // Add slight imperfection — aim slightly off center of paddle
    const targetY = ballY + Phaser.Math.Between(-15, 15);

    if (paddleY < targetY - 5) {
      this.aiPaddle.body.setVelocityY(AI_SPEED);
    } else if (paddleY > targetY + 5) {
      this.aiPaddle.body.setVelocityY(-AI_SPEED);
    } else {
      this.aiPaddle.body.setVelocityY(0);
    }
  }

  checkScoring() {
    if (this.isScoringPaused) return;
    const bx = this.ball.x;

    if (bx <= 0) {
      // AI scores
      this.aiScore++;
      this.aiScoreText.setText(this.aiScore);
      this.playScore(false);
      this.pauseAndReset(false);
    } else if (bx >= W) {
      // Player scores
      this.playerScore++;
      this.playerScoreText.setText(this.playerScore);
      this.playScore(true);
      this.pauseAndReset(true);
    }
  }

  pauseAndReset(playerScored) {
    this.isScoringPaused = true;
    this.ball.body.setVelocity(0, 0);
    this.ball.setPosition(W / 2, H / 2);
    this.time.delayedCall(1000, () => {
      this.isScoringPaused = false;
      this.launchBall(!playerScored); // serve toward the one who was scored on
    });
  }

  update(_time, delta) {
    // Player input
    const upPressed = this.cursors.up.isDown || this.wasd.up.isDown;
    const downPressed = this.cursors.down.isDown || this.wasd.down.isDown;

    if (upPressed) {
      this.playerPaddle.body.setVelocityY(-PADDLE_SPEED);
    } else if (downPressed) {
      this.playerPaddle.body.setVelocityY(PADDLE_SPEED);
    } else {
      this.playerPaddle.body.setVelocityY(0);
    }

    // AI
    if (!this.isScoringPaused) {
      this.updateAI(delta);
    } else {
      this.aiPaddle.body.setVelocityY(0);
    }

    // Scoring
    this.checkScoring();
  }

  // --- Audio helpers ---

  playBeep(freq, duration, type = 'sine') {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
    gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);
    osc.start(this.audioCtx.currentTime);
    osc.stop(this.audioCtx.currentTime + duration);
  }

  playScore(playerScored) {
    if (!this.audioCtx) return;
    if (playerScored) {
      // Ascending boop — player scored!
      this.playBeep(440, 0.1, 'sine');
      this.time.delayedCall(120, () => this.playBeep(660, 0.12, 'sine'));
      this.time.delayedCall(250, () => this.playBeep(880, 0.18, 'sine'));
    } else {
      // Descending sad tones — AI scored
      this.playBeep(440, 0.12, 'sine');
      this.time.delayedCall(120, () => this.playBeep(330, 0.12, 'sine'));
      this.time.delayedCall(250, () => this.playBeep(220, 0.2, 'sine'));
    }
  }
}
