import * as THREE from 'three';
import { Arena } from './Arena.js';
import { PlayerTank } from './PlayerTank.js';
import { EnemyTank } from './EnemyTank.js';
import { PowerUp } from './PowerUp.js';
import { HUD } from './HUD.js';
import { Sounds } from './Sounds.js';

export class Game {
  constructor(container) {
    this.container = container;
    this.running = false;
    this.level = 1;
    this.totalKills = 0;
    this.playerHealth = 100; // persists across levels
    this.difficulty = 'medium'; // easy | medium | hard

    // --- Three.js setup ---
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.FogExp2(0x000000, 0.04);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.rotation.order = 'YXZ';

    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    // Dim ambient so wireframe edges glow
    const ambient = new THREE.AmbientLight(0x001100, 3);
    this.scene.add(ambient);

    this.clock = new THREE.Clock();
    this.hud = new HUD();
    this.sounds = new Sounds();

    window.addEventListener('resize', () => this.onResize());
  }

  startLevel(level) {
    this.level = level;
    this.levelComplete = false;
    this.running = false;

    // Reset overlay to default state
    document.getElementById('overlay').classList.remove('next-battle');

    // Clear previous level objects from scene
    this._clearScene();

    this.arena = new Arena(this.scene);

    // Player spawns at center; health carries over (full on level 1)
    if (level === 1) this.playerHealth = 100;

    this.sounds.levelStart();
    this.sounds.startMusic();

    this.player = new PlayerTank(this.scene, this.camera, {
      position: new THREE.Vector3(0, 0, 0),
      wallBoxes: this.arena.wallBoxes,
      initialHealth: this.playerHealth,
      sounds: this.sounds,
    });
    this.player.onFire = (bullet) => {
      this.playerBullets.push(bullet);
      this.scene.add(bullet.mesh);
      this.sounds.playerPew();
    };

    // Enemy count scales with level
    this.enemies = [];
    this.enemyBullets = [];
    this.playerBullets = [];
    const enemyCount = level;
    for (let i = 0; i < enemyCount; i++) {
      const preferredAngle = (i / enemyCount) * Math.PI * 2 + Math.PI / 4;
      const pos = this._findEnemySpawnPos(preferredAngle);
      const enemy = new EnemyTank(this.scene, {
        position: pos,
        wallBoxes: this.arena.wallBoxes,
        difficulty: Math.min(level * 0.1, 0.8), // 0–0.8 accuracy modifier
        sounds: this.sounds,
      });
      enemy.onFire = (bullet) => {
        this.enemyBullets.push(bullet);
        this.scene.add(bullet.mesh);
        this.sounds.enemyPew();
      };
      this.enemies.push(enemy);
    }

    this.powerUps = [];
    this._spawnPowerUps(3);

    this._lowHealthTimer = 0;

    this.hud.init(enemyCount);
    this.hud.showLevelBanner(level);
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('overlay').classList.add('hidden');

    // Request pointer lock
    this.container.requestPointerLock();

    this.running = true;
    this.clock.getDelta(); // reset delta
    this.animate();
  }

  _clearScene() {
    // Remove all objects except lights
    const toRemove = [];
    this.scene.traverse(obj => {
      if (obj.isLight) return;
      if (obj === this.scene) return;
      toRemove.push(obj);
    });
    // Only remove top-level children (traversal removes children too)
    [...this.scene.children].forEach(child => {
      if (!child.isLight) this.scene.remove(child);
    });
  }

  _findEnemySpawnPos(preferredAngle) {
    const tankRadius = 1.2;
    const radii = [14, 11, 17, 8];
    for (const r of radii) {
      for (let attempt = 0; attempt < 16; attempt++) {
        const angle = preferredAngle + (attempt / 16) * Math.PI * 2;
        const pos = new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r);
        if (!this._overlapsWall(pos, tankRadius)) return pos;
      }
    }
    // Fallback: scan the arena for any open spot
    const half = this.arena.size / 2 - 3;
    for (let attempt = 0; attempt < 200; attempt++) {
      const pos = new THREE.Vector3(
        (Math.random() - 0.5) * half * 2,
        0,
        (Math.random() - 0.5) * half * 2
      );
      if (pos.length() > 4 && !this._overlapsWall(pos, tankRadius)) return pos;
    }
    return new THREE.Vector3(Math.cos(preferredAngle) * 14, 0, Math.sin(preferredAngle) * 14);
  }

  _overlapsWall(pos, radius) {
    const tankBox = new THREE.Box3(
      new THREE.Vector3(pos.x - radius, -0.5, pos.z - radius),
      new THREE.Vector3(pos.x + radius, 2.5, pos.z + radius)
    );
    return this.arena.wallBoxes.some(box => box.intersectsBox(tankBox));
  }

  _spawnPowerUps(count) {
    const half = this.arena.size / 2 - 3;
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * half * 2;
      const z = (Math.random() - 0.5) * half * 2;
      // Don't spawn on player
      if (Math.hypot(x, z) < 3) { i--; continue; }
      const pu = new PowerUp(this.scene, new THREE.Vector3(x, 0, z));
      this.powerUps.push(pu);
    }
  }

  setPointerLocked(locked) {
    if (this.player) this.player.setPointerLocked(locked);
  }

  animate() {
    if (!this.running) return;
    requestAnimationFrame(() => this.animate());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  update(dt) {
    this.player.update(dt);

    const livingEnemies = this.enemies.filter(e => e.health > 0);
    livingEnemies.forEach(e => e.update(dt, this.player.position));

    this.playerBullets = this._updateBullets(this.playerBullets, dt, livingEnemies, true);
    this.enemyBullets = this._updateBullets(this.enemyBullets, dt, [this.player], false);

    this.powerUps.forEach(p => p.update(dt));
    this._checkPowerUpPickup();

    // Respawn power-ups
    if (this.powerUps.length < 2 && Math.random() < 0.003) {
      this._spawnPowerUps(1);
    }

    const kills = this.enemies.filter(e => e.health <= 0 && !e.counted).length;
    if (kills > 0) {
      this.enemies.filter(e => e.health <= 0 && !e.counted).forEach(e => { e.counted = true; });
      this.totalKills += kills;
    }

    this.hud.update(this.player, this.enemies, this.totalKills);

    // Low health warning beep (one shot = 25 dmg, so ≤25 HP is critical)
    if (this.player.health > 0 && this.player.health <= 25) {
      this._lowHealthTimer += dt;
      if (this._lowHealthTimer >= 0.6) {
        this._lowHealthTimer = 0;
        this.sounds.lowHealthBeep();
        this.hud.flashHealthBar();
      }
    } else {
      this._lowHealthTimer = 0;
    }

    // Win / lose
    if (!this.levelComplete && this.player.health <= 0) {
      this._endGame(false);
    } else if (!this.levelComplete && this.enemies.every(e => e.health <= 0)) {
      this._advanceLevel();
    }
  }

  _updateBullets(bullets, dt, targets, isPlayerBullet) {
    const alive = [];
    for (const bullet of bullets) {
      bullet.update(dt);

      let hit = false;

      // Wall hit
      const bpos = bullet.mesh.position;
      if (this.arena.wallBoxes.some(box => box.containsPoint(bpos))) {
        hit = true;
      }

      // Target hit
      if (!hit) {
        for (const t of targets) {
          if (t.health > 0 && t.boundingBox.containsPoint(bpos)) {
            const baseDmg = 25;
            const multiplier = isPlayerBullet ? 1 : { easy: 0.4, medium: 0.6, hard: 1 }[this.difficulty] ?? 1;
            const dmg = Math.round(baseDmg * multiplier);
            const wasAlive = t.health > 0;
            t.takeDamage(dmg);
            if (!isPlayerBullet) {
              this.hud.flashDamage();
              this.sounds.playerHit();
            } else if (wasAlive && t.health <= 0) {
              this.sounds.kaboom();
            } else if (wasAlive) {
              this.sounds.enemyHit();
            }
            hit = true;
            break;
          }
        }
      }

      if (hit || bullet.distanceTraveled >= bullet.maxRange) {
        this.scene.remove(bullet.mesh);
      } else {
        alive.push(bullet);
      }
    }
    return alive;
  }

  _checkPowerUpPickup() {
    const ppos = this.player.position;
    this.powerUps = this.powerUps.filter(pu => {
      const dist = ppos.distanceTo(pu.mesh.position);
      if (dist < 1.5 && this.player.health < 100) {
        this.player.heal(25);
        this.sounds.powerUp();
        this.scene.remove(pu.mesh);
        return false;
      }
      return true;
    });
  }

  _advanceLevel() {
    this.levelComplete = true;
    this.playerHealth = this.player.health;
    this.sounds.levelComplete();
    this.hud.showVictory();

    setTimeout(() => {
      this.running = false;
      this.hud.hideVictory();
      const nextLevel = this.level + 1;

      const overlay = document.getElementById('overlay');
      overlay.classList.add('next-battle');
      document.getElementById('overlay-title').textContent = 'PREPARE FOR NEXT BATTLE';
      document.getElementById('overlay-msg').textContent = `LEVEL ${nextLevel}`;
      document.getElementById('overlay-sub').textContent = `KILLS: ${this.totalKills}`;
      overlay.classList.remove('hidden');
      document.exitPointerLock();

      const enterPrompt = document.getElementById('overlay-enter-prompt');
      enterPrompt.onclick = () => {
        enterPrompt.onclick = null;
        this.startLevel(nextLevel);
      };
    }, 3000);
  }

  _endGame(won) {
    this.running = false;
    this.sounds.stopMusic();
    document.exitPointerLock();

    this._showGlassBreak(() => {
      const overlay = document.getElementById('overlay');
      overlay.classList.remove('next-battle', 'hidden');
      document.getElementById('overlay-title').textContent = 'TANKZONE 3D';
      document.getElementById('overlay-msg').textContent = won ? 'MISSION COMPLETE' : 'TANK DESTROYED';
      document.getElementById('overlay-sub').textContent = `KILLS: ${this.totalKills}`;
      const enterPrompt = document.getElementById('overlay-enter-prompt');
      enterPrompt.onclick = () => {
        enterPrompt.onclick = null;
        this.totalKills = 0;
        this.startLevel(1);
      };
    });
  }

  _showGlassBreak(callback) {
    const el = document.getElementById('glass-break');
    const svg = document.getElementById('glass-cracks');
    svg.innerHTML = '';
    el.classList.remove('shatter', 'fade-out');
    el.classList.remove('hidden');

    const W = window.innerWidth;
    const H = window.innerHeight;
    const ox = W / 2 + (Math.random() - 0.5) * W * 0.15;
    const oy = H / 2 + (Math.random() - 0.5) * H * 0.15;
    const numCracks = 11;

    for (let i = 0; i < numCracks; i++) {
      const angle = (i / numCracks) * Math.PI * 2 + Math.random() * 0.5;
      const crackLen = Math.max(W, H) * (0.45 + Math.random() * 0.55);
      const d = this._generateCrackPath(ox, oy, angle, crackLen);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('stroke', 'rgba(255,255,255,0.85)');
      path.setAttribute('stroke-width', String((0.8 + Math.random() * 1.4).toFixed(1)));
      path.setAttribute('fill', 'none');
      svg.appendChild(path);

      const len = path.getTotalLength();
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = len;
      setTimeout(() => {
        path.style.transition = `stroke-dashoffset ${0.25 + Math.random() * 0.2}s ease-out`;
        path.style.strokeDashoffset = '0';
      }, i * 25);
    }

    setTimeout(() => el.classList.add('shatter'), 500);

    setTimeout(() => {
      el.classList.add('fade-out');
      setTimeout(() => {
        el.classList.add('hidden');
        el.classList.remove('shatter', 'fade-out');
        callback();
      }, 550);
    }, 1800);
  }

  _generateCrackPath(ox, oy, angle, length) {
    let x = ox, y = oy;
    let d = `M ${x} ${y}`;
    const steps = 6 + Math.floor(Math.random() * 5);
    let a = angle;
    for (let i = 0; i < steps; i++) {
      a += (Math.random() - 0.5) * 0.35;
      const dist = (length / steps) * (0.55 + Math.random() * 0.9);
      x += Math.cos(a) * dist;
      y += Math.sin(a) * dist;
      d += ` L ${Math.round(x)} ${Math.round(y)}`;
    }
    return d;
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
