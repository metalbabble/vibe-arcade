class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  init(data) {
    this.cfg         = data;   // { walls, bouncy, difficulty }
    this.playerScore = 0;
    this.aiScore     = 0;
    this.gameOver    = false;
  }

  // ─────────────────────────────────────────────────────────────────
  //  CREATE
  // ─────────────────────────────────────────────────────────────────
  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.HUD_H    = 48;
    this.CELL     = 40;
    this.COLS     = 20;
    this.ROWS     = 13;
    this.GRID_X   = 0;
    this.GRID_Y   = this.HUD_H + Math.floor((H - this.HUD_H - this.ROWS * this.CELL) / 2);
    // GRID_Y = 48 + floor((552 - 520)/2) = 48 + 16 = 64

    this.MISSILE_SPEED = 390;

    // ── Physics world bounds = play area ──────────────────────────
    this.physics.world.setBounds(0, this.HUD_H, W, H - this.HUD_H);

    // ── Background ────────────────────────────────────────────────
    this.add.rectangle(W / 2, (H + this.HUD_H) / 2, W, H - this.HUD_H, 0x0d0d18).setDepth(0);

    // Subtle grid lines
    const gridGfx = this.add.graphics().setDepth(0);
    gridGfx.lineStyle(1, 0x111122, 0.4);
    for (let c = 1; c < this.COLS; c++) {
      gridGfx.strokeLineShape(new Phaser.Geom.Line(
        c * this.CELL, this.HUD_H, c * this.CELL, H
      ));
    }
    for (let r = 0; r <= this.ROWS; r++) {
      const y = this.GRID_Y + r * this.CELL;
      gridGfx.strokeLineShape(new Phaser.Geom.Line(0, y, W, y));
    }

    // Arena border
    const borderGfx = this.add.graphics().setDepth(1);
    borderGfx.lineStyle(2, 0x224422);
    borderGfx.strokeRect(1, this.HUD_H + 1, W - 2, H - this.HUD_H - 2);

    // ── Textures ─────────────────────────────────────────────────
    this._createTextures();

    // ── Walls ─────────────────────────────────────────────────────
    this.wallGroup = null;
    this.wallGrid  = null;

    if (this.cfg.walls || this.cfg.bouncy) {
      const clearZones = [
        { col: 0,             row: this.ROWS - 3, w: 3, h: 3 }, // player (bottom-left)
        { col: this.COLS - 3, row: 0,             w: 3, h: 3 }  // AI (top-right)
      ];
      this.wallGrid  = WallGenerator.generate(this.COLS, this.ROWS, clearZones);
      this.wallGroup = WallGenerator.createWallSprites(
        this, this.wallGrid, this.GRID_X, this.GRID_Y, this.CELL
      );
    }

    // ── Tanks ─────────────────────────────────────────────────────
    this._createTanks();

    // ── Missiles ──────────────────────────────────────────────────
    this.playerMissile = null;
    this.aiMissile     = null;

    // ── HUD ───────────────────────────────────────────────────────
    this._createHUD();

    // ── Input ─────────────────────────────────────────────────────
    this.cursors  = this.input.keyboard.createCursorKeys();
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // ── AI ────────────────────────────────────────────────────────
    this.ai = new TankAI(this.aiTank, this.playerTank, this.cfg.difficulty, this);

    // ── Colliders: tank vs wall, tank vs tank ──────────────────────
    if (this.wallGroup) {
      this.physics.add.collider(this.playerTank, this.wallGroup);
      this.physics.add.collider(this.aiTank,     this.wallGroup);
    }
    this.physics.add.collider(this.playerTank, this.aiTank);

    // ── Sound ─────────────────────────────────────────────────────
    this.sfx      = new SoundManager();
    this.motorOn  = false;
  }

  // ─────────────────────────────────────────────────────────────────
  //  UPDATE
  // ─────────────────────────────────────────────────────────────────
  update(time, delta) {
    if (this.gameOver) return;

    this._handlePlayerInput(delta);
    this.ai.update(delta);
    this._tickMissiles(delta);
  }

  // ─────────────────────────────────────────────────────────────────
  //  TEXTURES
  // ─────────────────────────────────────────────────────────────────
  _createTextures() {
    if (!this.textures.exists('tank_player')) {
      this._makeTankTexture('tank_player', {
        tread:  0x0f3f0f,
        body:   0x1a6e1a,
        turret: 0x22aa22,
        barrel: 0x0f3f0f,
        highlight: 0x44ee44
      });
    }
    if (!this.textures.exists('tank_ai')) {
      this._makeTankTexture('tank_ai', {
        tread:  0x3f0f0f,
        body:   0x7a1a1a,
        turret: 0xbb2222,
        barrel: 0x3f0f0f,
        highlight: 0xff5555
      });
    }
    if (!this.textures.exists('missile_player')) {
      this._makeMissileTexture('missile_player', 0x88ff88, 0xffffff);
    }
    if (!this.textures.exists('missile_ai')) {
      this._makeMissileTexture('missile_ai', 0xff6666, 0xffffff);
    }
  }

  _makeTankTexture(key, c) {
    const g = this.add.graphics();

    // Treads (top & bottom strips)
    g.fillStyle(c.tread);
    g.fillRect(0,  0, 32, 7);
    g.fillRect(0, 25, 32, 7);

    // Tread segment gaps
    g.fillStyle(0x000000, 0.5);
    for (let x = 0; x < 32; x += 5) {
      g.fillRect(x, 1, 1, 5);
      g.fillRect(x, 26, 1, 5);
    }

    // Hull body
    g.fillStyle(c.body);
    g.fillRect(3, 7, 26, 18);

    // Hull highlight (top edge)
    g.fillStyle(c.highlight, 0.3);
    g.fillRect(4, 8, 22, 2);

    // Turret
    g.fillStyle(c.turret);
    g.fillRect(9, 11, 14, 10);

    // Turret highlight
    g.fillStyle(c.highlight, 0.4);
    g.fillRect(10, 12, 6, 2);

    // Barrel (pointing RIGHT — angle 0 in Phaser)
    g.fillStyle(c.barrel);
    g.fillRect(23, 14, 9, 4);

    // Barrel tip highlight
    g.fillStyle(c.highlight, 0.5);
    g.fillRect(30, 14, 2, 1);

    g.generateTexture(key, 32, 32);
    g.destroy();
  }

  _makeMissileTexture(key, bodyColor, tipColor) {
    const g = this.add.graphics();
    // Outer glow-ish
    g.fillStyle(bodyColor, 0.4);
    g.fillRect(0, 0, 14, 6);
    // Core
    g.fillStyle(bodyColor);
    g.fillRect(1, 1, 11, 4);
    // Tip
    g.fillStyle(tipColor);
    g.fillRect(11, 2, 3, 2);
    g.generateTexture(key, 14, 6);
    g.destroy();
  }

  // ─────────────────────────────────────────────────────────────────
  //  TANKS
  // ─────────────────────────────────────────────────────────────────
  _createTanks() {
    const cs = this.CELL;

    // Player: bottom-left
    const px = this.GRID_X + 1 * cs + cs / 2;
    const py = this.GRID_Y + (this.ROWS - 2) * cs + cs / 2;
    this.playerTank = this.physics.add.sprite(px, py, 'tank_player');
    this.playerTank.setDepth(3);
    this.playerTank.angle = -90;    // facing up
    this.playerTank.setCollideWorldBounds(true);
    this.playerTank.body.setSize(26, 26);
    this.playerTank.isSpinning = false;
    this.playerTank.isPlayer   = true;

    // AI: top-right
    const ax = this.GRID_X + (this.COLS - 2) * cs + cs / 2;
    const ay = this.GRID_Y + 1 * cs + cs / 2;
    this.aiTank = this.physics.add.sprite(ax, ay, 'tank_ai');
    this.aiTank.setDepth(3);
    this.aiTank.angle = 90;         // facing down
    this.aiTank.setCollideWorldBounds(true);
    this.aiTank.body.setSize(26, 26);
    this.aiTank.isSpinning = false;
    this.aiTank.isPlayer   = false;
  }

  // ─────────────────────────────────────────────────────────────────
  //  HUD
  // ─────────────────────────────────────────────────────────────────
  _createHUD() {
    const W = this.scale.width;
    const D = 8;  // depth

    // HUD background
    this.add.rectangle(W / 2, this.HUD_H / 2, W, this.HUD_H, 0x05050e).setDepth(D);
    // HUD bottom border
    this.add.rectangle(W / 2, this.HUD_H, W, 2, 0x224422).setDepth(D);

    // ── Player side ───────────────────────────────────────────────
    this.add.text(16, this.HUD_H / 2, 'P1', {
      fontSize: '13px', fontFamily: 'monospace', color: '#224422'
    }).setOrigin(0, 0.5).setDepth(D);

    this.playerScoreText = this.add.text(46, this.HUD_H / 2, '0', {
      fontSize: '28px', fontFamily: 'monospace', color: '#00ff44',
      stroke: '#003322', strokeThickness: 2
    }).setOrigin(0, 0.5).setDepth(D);

    this.playerPips = [];
    for (let i = 0; i < 10; i++) {
      const pip = this.add.rectangle(80 + i * 16, this.HUD_H / 2, 12, 10, 0x0a220a).setDepth(D);
      this.playerPips.push(pip);
    }

    // ── Center info ───────────────────────────────────────────────
    const modeLabel = [
      this.cfg.walls  ? 'WALLS'  : null,
      this.cfg.bouncy ? 'BOUNCY' : null,
      this.cfg.difficulty.toUpperCase()
    ].filter(Boolean).join('  ');

    this.add.text(W / 2, this.HUD_H / 2, modeLabel, {
      fontSize: '12px', fontFamily: 'monospace', color: '#224422'
    }).setOrigin(0.5).setDepth(D);

    // ── AI side ───────────────────────────────────────────────────
    this.aiPips = [];
    for (let i = 0; i < 10; i++) {
      const pip = this.add.rectangle(W - 80 - i * 16, this.HUD_H / 2, 12, 10, 0x220a0a).setDepth(D);
      this.aiPips.push(pip);
    }

    this.aiScoreText = this.add.text(W - 46, this.HUD_H / 2, '0', {
      fontSize: '28px', fontFamily: 'monospace', color: '#ff3333',
      stroke: '#330000', strokeThickness: 2
    }).setOrigin(1, 0.5).setDepth(D);

    this.add.text(W - 16, this.HUD_H / 2, 'AI', {
      fontSize: '13px', fontFamily: 'monospace', color: '#442222'
    }).setOrigin(1, 0.5).setDepth(D);
  }

  _refreshHUD() {
    this.playerScoreText.setText(String(this.playerScore));
    this.aiScoreText.setText(String(this.aiScore));
    for (let i = 0; i < 10; i++) {
      this.playerPips[i].setFillStyle(i < this.playerScore ? 0x00ff44 : 0x0a220a);
      this.aiPips[i].setFillStyle(i < this.aiScore ? 0xff3333 : 0x220a0a);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  //  PLAYER INPUT
  // ─────────────────────────────────────────────────────────────────
  _handlePlayerInput(delta) {
    if (this.playerTank.isSpinning) {
      this.playerTank.body.setVelocity(0, 0);
      return;
    }

    const dt       = delta / 1000;
    const ROT_SPD  = 120;
    const MOVE_SPD = 150;
    let moving     = false;

    if (this.cursors.left.isDown) {
      this.playerTank.angle -= ROT_SPD * dt;
      this.playerTank.body.setVelocity(0, 0);
    } else if (this.cursors.right.isDown) {
      this.playerTank.angle += ROT_SPD * dt;
      this.playerTank.body.setVelocity(0, 0);
    } else if (this.cursors.up.isDown) {
      const v = this.physics.velocityFromAngle(this.playerTank.angle, MOVE_SPD);
      this.playerTank.body.setVelocity(v.x, v.y);
      moving = true;
    } else {
      this.playerTank.body.setVelocity(0, 0);
    }

    // Motor sound
    if (moving && !this.motorOn) {
      this.sfx.startMotor();
      this.motorOn = true;
    } else if (!moving && this.motorOn) {
      this.sfx.stopMotor();
      this.motorOn = false;
    }

    // Fire
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.playerFireMissile();
    }
  }

  // ─────────────────────────────────────────────────────────────────
  //  MISSILES — public fire methods (called by AI too)
  // ─────────────────────────────────────────────────────────────────
  playerFireMissile() {
    if (this.playerTank.isSpinning) return;
    if (this.playerMissile && this.playerMissile.active) return;

    this.sfx.playShoot(true);
    this.playerMissile = this._spawnMissile(this.playerTank, 'missile_player', true);
  }

  aiFireMissile() {
    if (this.aiTank.isSpinning) return;
    if (this.aiMissile && this.aiMissile.active) return;

    this.sfx.playShoot(false);
    this.aiMissile = this._spawnMissile(this.aiTank, 'missile_ai', false);
  }

  // ─────────────────────────────────────────────────────────────────
  //  MISSILE SPAWN
  // ─────────────────────────────────────────────────────────────────
  _spawnMissile(tank, textureKey, isPlayer) {
    const SPWN  = 22;  // spawn distance in front of barrel
    const spd   = this.MISSILE_SPEED;
    const rad   = Phaser.Math.DegToRad(tank.angle);
    const mx    = tank.x + Math.cos(rad) * SPWN;
    const my    = tank.y + Math.sin(rad) * SPWN;

    const m = this.physics.add.sprite(mx, my, textureKey);
    m.setDepth(4);
    m.angle       = tank.angle;
    m.isPlayer    = isPlayer;
    m.lifespan    = this.cfg.bouncy ? 5200 : 3000;
    m.bounceCount = 0;
    m.maxBounces  = 6;
    m.body.setSize(10, 4);

    const vel = this.physics.velocityFromAngle(tank.angle, spd);
    m.body.setVelocity(vel.x, vel.y);
    m.body.setMaxVelocity(spd + 50, spd + 50);

    // ── Wall interaction ──────────────────────────────────────────
    if (this.wallGroup) {
      if (this.cfg.bouncy) {
        m.setBounce(1, 1);
        const wc = this.physics.add.collider(m, this.wallGroup, (missile) => {
          this._onMissileBounceWall(missile, spd);
        });
        m._wallCollider = wc;
      } else {
        const wo = this.physics.add.overlap(m, this.wallGroup, () => {
          this._killMissile(m, isPlayer);
        });
        m._wallCollider = wo;
      }
    }

    // ── World bounds bounce / destroy ─────────────────────────────
    if (this.cfg.bouncy) {
      m.setCollideWorldBounds(true);
      m.body.onWorldBounds = true;

      const wbHandler = (body) => {
        if (body.gameObject !== m) return;
        m.bounceCount++;
        m.setRotation(m.body.velocity.angle());
        this.sfx.playWallHit();
        // Re-normalize speed after world-bounds bounce
        this._normalizeMissileSpeed(m, spd);
        if (m.bounceCount >= m.maxBounces) this._killMissile(m, isPlayer);
      };
      this.physics.world.on('worldbounds', wbHandler);
      m._wbHandler = wbHandler;
    } else {
      m.setCollideWorldBounds(false);
    }

    // ── Hit the opposing tank ─────────────────────────────────────
    const target = isPlayer ? this.aiTank : this.playerTank;
    const ov = this.physics.add.overlap(m, target, () => {
      this._handleTankHit(m, target, isPlayer);
    });
    m._tankOverlap = ov;

    return m;
  }

  _onMissileBounceWall(missile, spd) {
    if (!missile || !missile.active) return;
    missile.bounceCount++;
    this.sfx.playWallHit();
    this._normalizeMissileSpeed(missile, spd);
    missile.setRotation(missile.body.velocity.angle());
    if (missile.bounceCount >= missile.maxBounces) {
      this._killMissile(missile, missile.isPlayer);
    }
  }

  _normalizeMissileSpeed(m, targetSpd) {
    const cur = m.body.velocity.length();
    if (cur > 1 && Math.abs(cur - targetSpd) > 10) {
      m.body.velocity.scale(targetSpd / cur);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  //  MISSILE LIFECYCLE
  // ─────────────────────────────────────────────────────────────────
  _tickMissiles(delta) {
    [
      { missile: this.playerMissile, isPlayer: true  },
      { missile: this.aiMissile,     isPlayer: false }
    ].forEach(({ missile, isPlayer }) => {
      if (!missile || !missile.active) return;

      missile.lifespan -= delta;

      // Keep visual angle aligned with velocity (bouncy)
      if (this.cfg.bouncy && missile.body.velocity.length() > 5) {
        missile.setRotation(missile.body.velocity.angle());
      }

      // Fade near end of life
      if (missile.lifespan < 900) {
        missile.setAlpha(Math.max(0, missile.lifespan / 900));
      }

      if (missile.lifespan <= 0) {
        this._killMissile(missile, isPlayer);
        return;
      }

      // Out-of-bounds check for non-bouncy
      if (!this.cfg.bouncy) {
        const W = this.scale.width;
        const H = this.scale.height;
        if (missile.x < 0 || missile.x > W || missile.y < this.HUD_H || missile.y > H) {
          this._killMissile(missile, isPlayer);
        }
      }
    });
  }

  _killMissile(m, isPlayer) {
    if (!m || !m.active) return;

    // Clean up colliders
    if (m._wallCollider) this.physics.world.removeCollider(m._wallCollider);
    if (m._tankOverlap)  this.physics.world.removeCollider(m._tankOverlap);
    if (m._wbHandler)    this.physics.world.off('worldbounds', m._wbHandler);

    // Small flash
    const flash = this.add.circle(m.x, m.y, 7, 0xffff88, 0.9).setDepth(5);
    this.tweens.add({
      targets: flash, alpha: 0, scaleX: 2.5, scaleY: 2.5,
      duration: 140, onComplete: () => flash.destroy()
    });

    m.destroy();

    if (isPlayer) this.playerMissile = null;
    else          this.aiMissile     = null;
  }

  // ─────────────────────────────────────────────────────────────────
  //  HIT HANDLING
  // ─────────────────────────────────────────────────────────────────
  _handleTankHit(missile, tank, playerScored) {
    if (!missile || !missile.active) return;
    if (tank.isSpinning) return;

    this._killMissile(missile, playerScored);

    if (playerScored) this.playerScore++;
    else              this.aiScore++;

    this._refreshHUD();
    this.sfx.playHit();

    // Brief camera shake
    this.cameras.main.shake(220, 0.006);

    this._spinAndRespawn(tank);

    if (this.playerScore >= 10 || this.aiScore >= 10) {
      this.time.delayedCall(300, () => this._endGame());
    }
  }

  // ─────────────────────────────────────────────────────────────────
  //  SPIN + RESPAWN
  // ─────────────────────────────────────────────────────────────────
  _spinAndRespawn(tank) {
    tank.isSpinning = true;
    tank.body.setVelocity(0, 0);

    const spinAmt = Phaser.Math.Between(540, 900) * (Math.random() < 0.5 ? 1 : -1);

    // Flash red/white on hit
    this.tweens.add({
      targets: tank, alpha: 0.2, duration: 60, yoyo: true, repeat: 3,
      onComplete: () => {
        // Spin
        this.tweens.add({
          targets: tank,
          angle: tank.angle + spinAmt,
          duration: 800,
          ease: 'Cubic.easeOut',
          onComplete: () => {
            // Teleport flicker
            this.tweens.add({
              targets: tank, alpha: 0, duration: 100, yoyo: true, repeat: 2,
              onComplete: () => {
                this._respawnTank(tank);
                tank.setAlpha(1);
                tank.isSpinning = false;
              }
            });
          }
        });
      }
    });
  }

  _respawnTank(tank) {
    const cells = this._validSpawnCells(tank);
    if (cells.length === 0) return;

    const cell = Phaser.Utils.Array.GetRandom(cells);
    const nx   = this.GRID_X + cell.col * this.CELL + this.CELL / 2;
    const ny   = this.GRID_Y + cell.row * this.CELL + this.CELL / 2;

    tank.setPosition(nx, ny);
    tank.body.reset(nx, ny);
    tank.angle = Phaser.Math.Between(0, 359);
  }

  _validSpawnCells(tank) {
    const other   = tank.isPlayer ? this.aiTank : this.playerTank;
    const MIN_DST = this.CELL * 4;
    const cells   = [];

    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        // Skip walls
        if (this.wallGrid && this.wallGrid[r][c]) continue;

        const cx = this.GRID_X + c * this.CELL + this.CELL / 2;
        const cy = this.GRID_Y + r * this.CELL + this.CELL / 2;

        if (Phaser.Math.Distance.Between(cx, cy, other.x, other.y) >= MIN_DST) {
          cells.push({ col: c, row: r });
        }
      }
    }

    return cells;
  }

  // ─────────────────────────────────────────────────────────────────
  //  GAME OVER
  // ─────────────────────────────────────────────────────────────────
  _endGame() {
    if (this.gameOver) return;
    this.gameOver = true;

    this.sfx.stopMotor();
    this.motorOn = false;
    this.ai.setActive(false);

    // Kill any live missiles cleanly
    if (this.playerMissile && this.playerMissile.active) this._killMissile(this.playerMissile, true);
    if (this.aiMissile     && this.aiMissile.active)     this._killMissile(this.aiMissile,     false);

    // Dim play field
    const dim = this.add.rectangle(
      this.scale.width / 2,
      (this.scale.height + this.HUD_H) / 2,
      this.scale.width,
      this.scale.height - this.HUD_H,
      0x000000, 0
    ).setDepth(10);

    this.tweens.add({
      targets: dim, alpha: 0.55, duration: 800,
      onComplete: () => {
        this.time.delayedCall(400, () => {
          this.scene.start('ResultsScene', {
            winner:      this.playerScore >= 10 ? 'player' : 'ai',
            playerScore: this.playerScore,
            aiScore:     this.aiScore,
            gameConfig:  this.cfg
          });
        });
      }
    });
  }
}
