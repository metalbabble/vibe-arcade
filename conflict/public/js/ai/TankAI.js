class TankAI {
  constructor(aiTank, playerTank, difficulty, scene) {
    this.tank = aiTank;
    this.player = playerTank;
    this.difficulty = difficulty;
    this.scene = scene;

    // Per-difficulty tuning
    const cfg = {
      easy:   { thinkMs: 1400, aimTol: 28, rotSpd: 55,  moveSpd: 75,  fireChance: 0.015 },
      medium: { thinkMs: 700,  aimTol: 14, rotSpd: 95,  moveSpd: 110, fireChance: 0.06  },
      hard:   { thinkMs: 200,  aimTol: 5,  rotSpd: 160, moveSpd: 145, fireChance: 1.0   }
    };
    const d = cfg[difficulty] || cfg.medium;
    this.thinkMs   = d.thinkMs;
    this.aimTol    = d.aimTol;
    this.rotSpd    = d.rotSpd;
    this.moveSpd   = d.moveSpd;
    this.fireChance = d.fireChance;

    this.thinkTimer  = 0;
    this.action      = 'idle';
    this.active      = true;
  }

  setActive(active) {
    this.active = active;
    if (!active && this.tank.body) {
      this.tank.body.setVelocity(0, 0);
    }
  }

  update(delta) {
    if (!this.active || this.tank.isSpinning) {
      if (this.tank.body) this.tank.body.setVelocity(0, 0);
      return;
    }

    const dt = delta / 1000;
    const angleDiff = this._angleDiffToPlayer();
    const dist = Phaser.Math.Distance.Between(
      this.tank.x, this.tank.y, this.player.x, this.player.y
    );

    if (this.difficulty === 'hard') {
      this._hardUpdate(dt, angleDiff, dist);
    } else if (this.difficulty === 'medium') {
      this._mediumUpdate(dt, delta, angleDiff, dist);
    } else {
      this._easyUpdate(dt, delta, angleDiff, dist);
    }
  }

  // ─── Hard: continuous tracking, fires when aimed ───────────────
  _hardUpdate(dt, angleDiff, dist) {
    // Rotate toward player
    if (Math.abs(angleDiff) > this.aimTol) {
      this.tank.angle += Math.sign(angleDiff) * this.rotSpd * dt;
      this.tank.body.setVelocity(0, 0);
    } else {
      // Aimed — advance if far, hold if close
      if (dist > 220) {
        const v = this.scene.physics.velocityFromAngle(this.tank.angle, this.moveSpd);
        this.tank.body.setVelocity(v.x, v.y);
      } else if (dist < 120) {
        const v = this.scene.physics.velocityFromAngle(this.tank.angle, -this.moveSpd * 0.5);
        this.tank.body.setVelocity(v.x, v.y);
      } else {
        this.tank.body.setVelocity(0, 0);
      }
      this.scene.aiFireMissile();
    }
  }

  // ─── Medium: periodic re-evaluation, decent aim ────────────────
  _mediumUpdate(dt, delta, angleDiff, dist) {
    this.thinkTimer += delta;
    if (this.thinkTimer >= this.thinkMs) {
      this.thinkTimer = 0;
      const roll = Math.random();
      if (roll < 0.65)      this.action = 'track';
      else if (roll < 0.82) this.action = 'move';
      else                  this.action = 'idle';
    }

    if (this.action === 'track' || Math.abs(angleDiff) > this.aimTol * 1.5) {
      this.tank.angle += Math.sign(angleDiff) * this.rotSpd * dt;
    }

    if (this.action === 'move' && dist > 150) {
      const v = this.scene.physics.velocityFromAngle(this.tank.angle, this.moveSpd);
      this.tank.body.setVelocity(v.x, v.y);
    } else {
      this.tank.body.setVelocity(0, 0);
    }

    if (Math.abs(angleDiff) <= this.aimTol && Math.random() < this.fireChance) {
      this.scene.aiFireMissile();
    }
  }

  // ─── Easy: mostly random, occasionally tracks ──────────────────
  _easyUpdate(dt, delta, angleDiff, dist) {
    this.thinkTimer += delta;
    if (this.thinkTimer >= this.thinkMs) {
      this.thinkTimer = 0;
      const roll = Math.random();
      if      (roll < 0.22) this.action = 'rotLeft';
      else if (roll < 0.44) this.action = 'rotRight';
      else if (roll < 0.64) this.action = 'move';
      else if (roll < 0.80) this.action = 'track';
      else                  this.action = 'idle';
    }

    switch (this.action) {
      case 'rotLeft':
        this.tank.angle -= this.rotSpd * dt;
        this.tank.body.setVelocity(0, 0);
        break;
      case 'rotRight':
        this.tank.angle += this.rotSpd * dt;
        this.tank.body.setVelocity(0, 0);
        break;
      case 'track':
        this.tank.angle += Math.sign(angleDiff) * this.rotSpd * dt;
        this.tank.body.setVelocity(0, 0);
        break;
      case 'move': {
        const v = this.scene.physics.velocityFromAngle(this.tank.angle, this.moveSpd);
        this.tank.body.setVelocity(v.x, v.y);
        break;
      }
      default:
        this.tank.body.setVelocity(0, 0);
    }

    if (Math.abs(angleDiff) <= this.aimTol * 1.8 && Math.random() < this.fireChance) {
      this.scene.aiFireMissile();
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────
  _angleDiffToPlayer() {
    const target = Phaser.Math.RadToDeg(
      Math.atan2(this.player.y - this.tank.y, this.player.x - this.tank.x)
    );
    let diff = target - this.tank.angle;
    while (diff > 180)  diff -= 360;
    while (diff < -180) diff += 360;
    return diff;
  }
}
