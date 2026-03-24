import * as THREE from 'three';
import { Bullet } from './Bullet.js';

const SPEED_BASE    = 4.5;
const TURN_SPEED    = Math.PI * 0.7;
const FIRE_RATE     = 1.8;   // seconds between shots
const DETECT_RANGE  = 28;
const ATTACK_RANGE  = 18;
const HALF_EXT      = 0.65;

const STATE_PATROL = 0;
const STATE_CHASE  = 1;

// Build the tank mesh (dark body + colored wireframe edges)
function buildTankMesh(edgeColor) {
  const group = new THREE.Group();
  const solidMat = new THREE.MeshBasicMaterial({ color: 0x0a0000 });
  const lineMat  = new THREE.LineBasicMaterial({ color: edgeColor });

  function addBox(w, h, d, px, py, pz) {
    const geo  = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, solidMat);
    mesh.position.set(px, py, pz);
    const edges = new THREE.EdgesGeometry(geo);
    mesh.add(new THREE.LineSegments(edges, lineMat));
    group.add(mesh);
  }

  // Body
  addBox(1.8, 0.65, 2.2,  0, 0.55, 0);
  // Tracks (two flat boxes either side)
  addBox(0.3, 0.25, 2.4, -0.85, 0.2, 0);
  addBox(0.3, 0.25, 2.4,  0.85, 0.2, 0);
  // Turret
  addBox(0.9, 0.45, 1.0,  0, 1.05, -0.1);
  // Gun barrel
  addBox(0.14, 0.14, 1.2,  0, 1.05, -0.85);

  return group;
}

export class EnemyTank {
  constructor(scene, { position, wallBoxes, difficulty = 0 }) {
    this.scene = scene;
    this.wallBoxes = wallBoxes;
    this.difficulty = difficulty; // 0 = easiest, 1 = hardest

    this.health    = 100;
    this.maxHealth = 100;
    this.counted   = false;

    this.position  = position.clone();
    this.yaw       = Math.random() * Math.PI * 2;

    this.speed     = SPEED_BASE + difficulty * 2;
    this.fireRate  = FIRE_RATE  - difficulty * 0.6;
    this.fireCooldown = Math.random() * 2; // stagger initial shots

    this.state      = STATE_PATROL;
    this.patrolTimer = 0;
    this.lostLosTimer = 0;

    this.onFire = null;

    // Bounding box
    this.boundingBox = new THREE.Box3();
    this._updateBoundingBox();

    // Raycaster for LOS
    this._ray = new THREE.Ray();
    this._rayTarget = new THREE.Vector3();

    // Mesh
    this.mesh = buildTankMesh(0xff4400);
    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
  }

  update(dt, playerPosition) {
    if (this.health <= 0) return;

    this.fireCooldown  = Math.max(0, this.fireCooldown  - dt);
    this.patrolTimer  += dt;

    const toPlayer = new THREE.Vector3(
      playerPosition.x - this.position.x,
      0,
      playerPosition.z - this.position.z
    );
    const dist = toPlayer.length();
    const hasLos = dist < DETECT_RANGE && this._checkLOS(playerPosition);

    if (hasLos) {
      this.lostLosTimer = 0;
      this.state = STATE_CHASE;
      this._steerToward(playerPosition, dt);
      if (dist < ATTACK_RANGE) this._tryFire(playerPosition);
    } else {
      this.lostLosTimer += dt;
      if (this.state === STATE_CHASE && this.lostLosTimer < 3) {
        // Keep heading toward last known position for a moment
        this._steerToward(playerPosition, dt);
      } else {
        this.state = STATE_PATROL;
        this._patrol(dt);
      }
    }

    this.mesh.position.set(this.position.x, 0, this.position.z);
    this.mesh.rotation.y = this.yaw;
    this._updateBoundingBox();
  }

  _patrol(dt) {
    if (this.patrolTimer > 1.5 + Math.random() * 2) {
      this.yaw += (Math.random() - 0.5) * Math.PI;
      this.patrolTimer = 0;
    }

    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const nx = this.position.x + fwd.x * this.speed * 0.45 * dt;
    const nz = this.position.z + fwd.z * this.speed * 0.45 * dt;

    if (this._collidesAt(nx, this.position.z) || this._collidesAt(this.position.x, nz)) {
      this.yaw += Math.PI / 2 + (Math.random() - 0.5) * Math.PI / 2;
      this.patrolTimer = 0;
    } else {
      this.position.x = nx;
      this.position.z = nz;
    }
  }

  _steerToward(target, dt) {
    const dx = target.x - this.position.x;
    const dz = target.z - this.position.z;
    const targetYaw = Math.atan2(-dx, -dz);

    let diff = targetYaw - this.yaw;
    while (diff >  Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    const maxTurn = TURN_SPEED * dt;
    this.yaw += Math.max(-maxTurn, Math.min(maxTurn, diff));

    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const nx = this.position.x + fwd.x * this.speed * dt;
    const nz = this.position.z + fwd.z * this.speed * dt;

    if (!this._collidesAt(nx, this.position.z)) this.position.x = nx;
    if (!this._collidesAt(this.position.x, nz)) this.position.z = nz;
  }

  _checkLOS(playerPosition) {
    const origin = new THREE.Vector3(this.position.x, 1.0, this.position.z);
    const target = new THREE.Vector3(playerPosition.x, 1.0, playerPosition.z);
    const dir = new THREE.Vector3().subVectors(target, origin).normalize();
    const dist = origin.distanceTo(target);

    this._ray.set(origin, dir);
    for (const box of this.wallBoxes) {
      const hit = this._ray.intersectBox(box, this._rayTarget);
      if (hit && this._rayTarget.distanceTo(origin) < dist - 0.3) return false;
    }
    return true;
  }

  _tryFire(playerPosition) {
    if (this.fireCooldown > 0) return;
    this.fireCooldown = this.fireRate;

    const origin = new THREE.Vector3(this.position.x, 1.0, this.position.z);
    // Add inaccuracy that decreases with difficulty
    const inaccuracy = (1 - this.difficulty) * 2.5;
    const target = new THREE.Vector3(
      playerPosition.x + (Math.random() - 0.5) * inaccuracy,
      1.0,
      playerPosition.z + (Math.random() - 0.5) * inaccuracy
    );
    const dir = new THREE.Vector3().subVectors(target, origin).normalize();
    const bullet = new Bullet(origin, dir, 0xff4400);
    if (this.onFire) this.onFire(bullet);
  }

  _collidesAt(x, z) {
    const box = new THREE.Box3(
      new THREE.Vector3(x - HALF_EXT, 0,   z - HALF_EXT),
      new THREE.Vector3(x + HALF_EXT, 2.5, z + HALF_EXT)
    );
    return this.wallBoxes.some(w => w.intersectsBox(box));
  }

  _updateBoundingBox() {
    this.boundingBox.set(
      new THREE.Vector3(this.position.x - HALF_EXT, 0,   this.position.z - HALF_EXT),
      new THREE.Vector3(this.position.x + HALF_EXT, 2.0, this.position.z + HALF_EXT)
    );
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this._explode();
    } else {
      // Hit flash — briefly white, then restore original colors
      this.mesh.traverse(obj => {
        if (obj.isMesh) obj.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
        if (obj.isLineSegments) obj.material = new THREE.LineBasicMaterial({ color: 0xffffff });
      });
      setTimeout(() => {
        if (this.health > 0) {
          this.mesh.traverse(obj => {
            if (obj.isMesh) obj.material = new THREE.MeshBasicMaterial({ color: 0x0a0000 });
            if (obj.isLineSegments) obj.material = new THREE.LineBasicMaterial({ color: 0xff4400 });
          });
        }
      }, 80);
    }
  }

  _explode() {
    this.mesh.updateWorldMatrix(true, true);

    const pieces = [];
    const tankCenter = this.mesh.position.clone();

    this.mesh.children.forEach(child => {
      if (!child.isMesh) return;

      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      child.getWorldPosition(pos);
      child.getWorldQuaternion(quat);

      const geo = child.geometry.clone();
      const solidMat = new THREE.MeshBasicMaterial({ color: 0x331100, transparent: true });
      const lineMat  = new THREE.LineBasicMaterial({ color: 0xff4400, transparent: true });

      const piece = new THREE.Mesh(geo, solidMat);
      piece.position.copy(pos);
      piece.quaternion.copy(quat);
      piece.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat));
      this.scene.add(piece);

      // Velocity: burst outward from tank center + random upward kick
      const outDir = new THREE.Vector3(pos.x - tankCenter.x, 0, pos.z - tankCenter.z);
      if (outDir.lengthSq() < 0.01) outDir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      outDir.normalize();

      const speed = 4 + Math.random() * 6;
      const vel = new THREE.Vector3(
        outDir.x * speed + (Math.random() - 0.5) * 2,
        2 + Math.random() * 6,
        outDir.z * speed + (Math.random() - 0.5) * 2
      );
      const angVel = new THREE.Vector3(
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14
      );

      pieces.push({ piece, solidMat, lineMat, vel, angVel });
    });

    // Brief point-light flash at explosion origin
    const flash = new THREE.PointLight(0xff6600, 10, 10);
    flash.position.set(tankCenter.x, 1, tankCenter.z);
    this.scene.add(flash);

    this.scene.remove(this.mesh);

    const GRAVITY    = -16;
    const DURATION   = 1.6;
    const FADE_START = 1.0;
    let elapsed = 0;
    let last = performance.now();

    const tick = () => {
      const now = performance.now();
      const dt  = Math.min((now - last) / 1000, 0.05);
      last = now;
      elapsed += dt;

      // Flash fades out in first 0.3s
      flash.intensity = Math.max(0, 10 * (1 - elapsed / 0.3));

      if (elapsed >= DURATION) {
        pieces.forEach(({ piece }) => this.scene.remove(piece));
        this.scene.remove(flash);
        return;
      }

      const opacity = elapsed > FADE_START
        ? 1 - (elapsed - FADE_START) / (DURATION - FADE_START)
        : 1;

      pieces.forEach(({ piece, solidMat, lineMat, vel, angVel }) => {
        vel.y += GRAVITY * dt;
        piece.position.addScaledVector(vel, dt);
        piece.rotation.x += angVel.x * dt;
        piece.rotation.y += angVel.y * dt;
        piece.rotation.z += angVel.z * dt;
        solidMat.opacity = opacity;
        lineMat.opacity  = opacity;
      });

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }
}
