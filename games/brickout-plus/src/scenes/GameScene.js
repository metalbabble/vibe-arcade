import Phaser from 'phaser';
import GAME_CONFIG from '../config.js';
import Ball from '../objects/Ball.js';
import Paddle from '../objects/Paddle.js';
import BrickGrid from '../objects/BrickGrid.js';
import ScoreManager from '../managers/ScoreManager.js';
import SoundManager from '../managers/SoundManager.js';
import ParticleManager from '../managers/ParticleManager.js';
import PowerUpManager from '../managers/PowerUpManager.js';

const TEXT_STYLE = { fontFamily: 'monospace', fontSize: '18px', fill: '#ffffff' };
const BIG_TEXT_STYLE = { fontFamily: 'monospace', fontSize: '36px', fill: '#f1c40f', stroke: '#000', strokeThickness: 4 };

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    this._sound = new SoundManager();
    this._levelTransition = false;

    // Active power-up timers (for cancellation on level reset)
    this._activePowerUpTimers = [];

    // Laser state
    this._laserActive = false;
    this._lastLaserTime = 0;
    this._laserGroup = this.physics.add.group();

    this._createHUD();
    this._paddle = new Paddle(this);
    this._bricks = new BrickGrid(this);
    this._particles = new ParticleManager(this);
    this._powerUps = new PowerUpManager(this);

    // Ball array — always at least one ball
    this._balls = [];
    this._addBall();

    this._scoreManager = new ScoreManager(
      this._scoreText,
      this._livesText,
      this._levelText,
    );

    // Ball-brick uses OVERLAP so we can skip bounce for powerball
    this._setupBallColliders(this._balls[0]);

    // Laser vs bricks
    this.physics.add.overlap(
      this._laserGroup,
      this._bricks.getGroup(),
      this._onLaserBrick,
      null,
      this,
    );

    // Power-up token vs paddle
    this.physics.add.overlap(
      this._powerUps.getGroup(),
      this._paddle,
      this._onCollectPowerUp,
      null,
      this,
    );

    // World bounds beep (walls + ceiling)
    this.physics.world.on('worldbounds', () => this._sound.playCollision());

    // SPACE key — shared handler for launch / sticky release / laser
    this._spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this._spaceKey.on('down', this._onSpaceDown, this);

    // Touch controls
    this._setupTouchControls();

    // Overlay text
    this._overlayText = this.add.text(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.CANVAS_HEIGHT / 2,
      '',
      BIG_TEXT_STYLE,
    ).setOrigin(0.5).setVisible(false).setDepth(20);

    this._promptText = this.add.text(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.CANVAS_HEIGHT / 2 + 50,
      'SPACE / tap center to launch',
      { ...TEXT_STYLE, fill: '#aaaaaa' },
    ).setOrigin(0.5).setDepth(20);

    // Active power-up HUD label
    this._powerUpHUD = this.add.text(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.CANVAS_HEIGHT - 16,
      '',
      { fontFamily: 'monospace', fontSize: '14px', fill: '#f1c40f' },
    ).setOrigin(0.5).setDepth(20);
  }

  update(time, delta) {
    if (this._levelTransition) return;

    this._paddle.update(delta, this._touchLeft, this._touchRight);
    this._powerUps.update();
    this._updateLasers();

    // Sticky ball tracking
    this._balls.forEach(b => b.trackPaddle(this._paddle));

    // Ball-out-of-bounds checks
    for (let i = this._balls.length - 1; i >= 0; i--) {
      if (this._balls[i].isOffBottom()) {
        if (this._balls.length > 1) {
          this._removeBall(i);
        } else {
          this._onBallLost();
          return;
        }
      }
    }
  }

  // ── Ball management ──────────────────────────────────────────────────────────

  _addBall(x, y, launchImmediately = false, speed = null) {
    const ball = new Ball(
      this,
      x ?? GAME_CONFIG.CANVAS_WIDTH / 2,
      y ?? GAME_CONFIG.CANVAS_HEIGHT / 2,
    );
    this._balls.push(ball);
    this._setupBallColliders(ball);
    if (launchImmediately) {
      ball.launch(speed ?? this._scoreManager.ballSpeed());
    }
    return ball;
  }

  _removeBall(idx) {
    this._balls[idx].destroy();
    this._balls.splice(idx, 1);
  }

  _setupBallColliders(ball) {
    // Overlap (not collider) lets us manually control bounce for powerball
    this.physics.add.overlap(
      ball,
      this._bricks.getGroup(),
      this._onBallBrick,
      null,
      this,
    );
    this.physics.add.collider(ball, this._paddle, this._onBallPaddle, null, this);
  }

  // ── Collision handlers ──────────────────────────────────────────────────────

  _onBallPaddle(ball, _paddle) {
    if (ball.stickyAttached) return; // already stuck, ignore repeated overlap

    this._sound.playCollision();

    if (this._stickyMode) {
      ball.attachToPaddle(this._paddle);
      this._promptText.setText('STICKY — SPACE / tap center to release').setVisible(true);
      return;
    }

    ball.reflectOffPaddle(this._paddle);
  }

  _onBallBrick(ball, brick) {
    if (!brick.active) return; // guard against multi-hit in same frame
    if (this._levelTransition) return;

    if (!ball.isPowerball) {
      // Manually compute bounce side
      const dx = ball.x - brick.x;
      const dy = ball.y - brick.y;
      const halfW = GAME_CONFIG.BRICK_WIDTH / 2 + GAME_CONFIG.BALL_RADIUS;
      const halfH = GAME_CONFIG.BRICK_HEIGHT / 2 + GAME_CONFIG.BALL_RADIUS;
      if (Math.abs(dx / halfW) > Math.abs(dy / halfH)) {
        ball.setVelocityX(-ball.body.velocity.x);
      } else {
        ball.setVelocityY(-ball.body.velocity.y);
      }
    }

    this._destroyBrick(brick);
  }

  _onLaserBrick(_laser, brick) {
    if (!brick.active) return;
    _laser.destroy();
    this._destroyBrick(brick);
  }

  _onCollectPowerUp(_paddle, sprite) {
    const type = this._powerUps.collect(sprite);
    this._sound.playPowerUp();
    this._applyPowerUp(type);
  }

  // ── Brick destruction (shared logic) ────────────────────────────────────────

  _destroyBrick(brick) {
    const color = brick.tintTopLeft;
    this._particles.explode(brick.x, brick.y, color);
    this._bricks.destroyBrick(brick);
    this._sound.playBrickDestroy();
    this._scoreManager.addScore(GAME_CONFIG.SCORE_PER_BRICK);
    this._powerUps.trySpawn(brick.x, brick.y);

    if (this._bricks.isEmpty()) {
      this._onLevelComplete();
    }
  }

  // ── Power-up effects ─────────────────────────────────────────────────────────

  _applyPowerUp(type) {
    this._showPowerUpHUD(GAME_CONFIG.POWERUP_META[type].label);

    switch (type) {
      case 'longPaddle':
        this._paddle.activateLongPaddle();
        this._schedulePowerUpEnd(type, () => this._paddle.resetWidth());
        break;

      case 'laser':
        this._laserActive = true;
        this._schedulePowerUpEnd(type, () => {
          this._laserActive = false;
          this._laserGroup.clear(true, true);
        });
        break;

      case 'multiBall': {
        const src = this._balls[0];
        const speed = this._scoreManager.ballSpeed();
        [-50, 50].forEach(angleOffset => {
          const newBall = this._addBall(src.x, src.y, false);
          newBall.launch(speed, Phaser.Math.Between(40, 140) + angleOffset);
          newBall.isPowerball = src.isPowerball;
          if (src.isPowerball) newBall.setTint(0xff6600);
        });
        break;
      }

      case 'extraLife':
        this._scoreManager.addLife();
        break;

      case 'extraPoints':
        this._scoreManager.addScore(GAME_CONFIG.POWERUP_BONUS_POINTS);
        break;

      case 'stickyPaddle':
        this._stickyMode = true;
        this._schedulePowerUpEnd(type, () => {
          this._stickyMode = false;
          // Release any stuck ball
          this._balls.forEach(b => {
            if (b.stickyAttached) b.releaseFromPaddle(this._scoreManager.ballSpeed());
          });
        });
        break;

      case 'powerball':
        this._balls.forEach(b => b.setPowerball(true));
        this._schedulePowerUpEnd(type, () => {
          this._balls.forEach(b => b.setPowerball(false));
        });
        break;
    }
  }

  _schedulePowerUpEnd(type, onEnd) {
    const timer = this.time.delayedCall(GAME_CONFIG.POWERUP_DURATION, () => {
      onEnd();
      this._clearPowerUpHUD();
    });
    this._activePowerUpTimers.push({ type, timer, onEnd });
  }

  _cancelAllPowerUps() {
    this._activePowerUpTimers.forEach(({ timer, onEnd }) => {
      timer.remove();
      onEnd();
    });
    this._activePowerUpTimers = [];
    this._stickyMode = false;
    this._laserActive = false;
    this._laserGroup.clear(true, true);
    this._clearPowerUpHUD();
  }

  // ── Laser ────────────────────────────────────────────────────────────────────

  _fireLaser() {
    const now = this.time.now;
    if (now - this._lastLaserTime < GAME_CONFIG.LASER_COOLDOWN) return;
    this._lastLaserTime = now;
    this._sound.playLaser();

    [-18, 18].forEach(offsetX => {
      this._spawnLaserBeam(this._paddle.x + offsetX, this._paddle.y - GAME_CONFIG.PADDLE_HEIGHT / 2 - 4);
    });
  }

  _spawnLaserBeam(x, y) {
    if (!this.textures.exists('laser')) {
      const gfx = this.make.graphics({ x: 0, y: 0, add: false });
      gfx.fillStyle(0xff4444);
      gfx.fillRect(0, 0, 4, 16);
      gfx.generateTexture('laser', 4, 16);
      gfx.destroy();
    }
    const beam = this.physics.add.image(x, y, 'laser');
    beam.setDepth(7);
    this._laserGroup.add(beam);
    beam.body.setAllowGravity(false);
    beam.setVelocityY(-GAME_CONFIG.LASER_SPEED);
  }

  _updateLasers() {
    this._laserGroup.children.each(beam => {
      if (beam.y < -20) beam.destroy();
    });
  }

  // ── Touch controls ───────────────────────────────────────────────────────────

  _setupTouchControls() {
    this._touchLeft = false;
    this._touchRight = false;
    this._activeTouches = new Map(); // pointerId -> 'left' | 'middle' | 'right'

    this.input.on('pointerdown', (ptr) => {
      const zone = this._touchZone(ptr.x);
      this._activeTouches.set(ptr.id, zone);
      this._updateTouchFlags();
      if (zone === 'middle') this._onSpaceDown();
    });

    this.input.on('pointerup', (ptr) => {
      this._activeTouches.delete(ptr.id);
      this._updateTouchFlags();
    });

    this.input.on('pointermove', (ptr) => {
      if (!this._activeTouches.has(ptr.id)) return;
      const newZone = this._touchZone(ptr.x);
      if (this._activeTouches.get(ptr.id) !== newZone) {
        this._activeTouches.set(ptr.id, newZone);
        this._updateTouchFlags();
      }
    });
  }

  _touchZone(x) {
    const third = GAME_CONFIG.CANVAS_WIDTH / 3;
    if (x < third) return 'left';
    if (x >= third * 2) return 'right';
    return 'middle';
  }

  _updateTouchFlags() {
    this._touchLeft = false;
    this._touchRight = false;
    for (const zone of this._activeTouches.values()) {
      if (zone === 'left') this._touchLeft = true;
      if (zone === 'right') this._touchRight = true;
    }
  }

  // ── SPACE key ────────────────────────────────────────────────────────────────

  _onSpaceDown() {
    if (this._levelTransition) return;

    // Priority 1: release sticky ball
    const stuckBall = this._balls.find(b => b.stickyAttached);
    if (stuckBall) {
      stuckBall.releaseFromPaddle(this._scoreManager.ballSpeed());
      this._promptText.setVisible(false);
      return;
    }

    // Priority 2: launch unlaunched ball
    const unlaunched = this._balls.find(b => !b.isLaunched());
    if (unlaunched) {
      unlaunched.launch(this._scoreManager.ballSpeed());
      this._promptText.setVisible(false);
      return;
    }

    // Priority 3: fire laser
    if (this._laserActive) {
      this._fireLaser();
    }
  }

  // ── Game flow ─────────────────────────────────────────────────────────────────

  _onBallLost() {
    this._sound.playLifeLost();
    this._scoreManager.loseLife();
    this._cancelAllPowerUps();
    this._powerUps.clearAll();

    // Reset to single ball
    while (this._balls.length > 1) this._removeBall(this._balls.length - 1);
    this._balls[0].reset();

    if (this._scoreManager.isGameOver()) {
      this.scene.start('GameOverScene', { score: this._scoreManager.score });
      return;
    }

    this._showOverlay('Life Lost!', () => {
      this._promptText.setText('SPACE / tap center to launch').setVisible(true);
    });
  }

  _onLevelComplete() {
    if (this._levelTransition) return;
    this._levelTransition = true;

    this._balls.forEach(b => b.setVelocity(0, 0));
    this._sound.playLevelComplete();
    this._scoreManager.nextLevel();
    this._cancelAllPowerUps();
    this._powerUps.clearAll();

    // Reset to single ball
    while (this._balls.length > 1) this._removeBall(this._balls.length - 1);
    this._balls[0].reset();

    this._showOverlay(`Level ${this._scoreManager.level}!`, () => {
      this._bricks.reset();
      this._levelTransition = false;
      this._promptText.setText('SPACE / tap center to launch').setVisible(true);
    });
  }

  _showOverlay(message, onDone) {
    this._overlayText.setText(message).setVisible(true);
    this._promptText.setVisible(false);
    this.time.delayedCall(1500, () => {
      this._overlayText.setVisible(false);
      onDone();
    });
  }

  // ── Power-up HUD ─────────────────────────────────────────────────────────────

  _showPowerUpHUD(label) {
    this._powerUpHUD.setText(`POWER-UP: ${label}`);
  }

  _clearPowerUpHUD() {
    if (this._activePowerUpTimers.length === 0) {
      this._powerUpHUD.setText('');
    }
  }

  // ── HUD ───────────────────────────────────────────────────────────────────────

  _createHUD() {
    const y = 16;
    this._scoreText = this.add.text(12, y, 'Score: 0', TEXT_STYLE).setDepth(5);
    this._levelText = this.add.text(
      GAME_CONFIG.CANVAS_WIDTH / 2, y, 'Level: 1', TEXT_STYLE,
    ).setOrigin(0.5, 0).setDepth(5);
    this._livesText = this.add.text(
      GAME_CONFIG.CANVAS_WIDTH - 12, y, 'Lives: 3', TEXT_STYLE,
    ).setOrigin(1, 0).setDepth(5);

    this.add.rectangle(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.HUD_HEIGHT,
      GAME_CONFIG.CANVAS_WIDTH,
      1,
      0x444466,
    ).setDepth(5);
  }
}
