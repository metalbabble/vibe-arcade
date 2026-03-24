import * as THREE from 'three';
import { Bullet } from './Bullet.js';

const SPEED = 8;
const TURN_SPEED = Math.PI * 0.9; // rad/sec
const FIRE_RATE = 0.5;            // seconds between shots
const HALF_EXT = 0.65;
const EYE_HEIGHT = 0.9;
const MOUSE_SENS = 0.0018;
const MAX_PITCH = Math.PI / 3.5;

export class PlayerTank {
  constructor(scene, camera, { position, wallBoxes, initialHealth = 100 }) {
    this.scene = scene;
    this.camera = camera;
    this.wallBoxes = wallBoxes;

    this.position = position.clone();
    this.yaw = 0;
    this.pitch = 0;
    this.health = initialHealth;
    this.maxHealth = 100;

    this.pointerLocked = false;
    this.keys = {};
    this.fireCooldown = 0;
    this.onFire = null;

    this.boundingBox = new THREE.Box3();
    this._updateBoundingBox();
    this._updateCamera();

    this._setupInput();
  }

  _setupInput() {
    this._onKeyDown = e => {
      this.keys[e.code] = true;
      if (e.code === 'Space' && this.pointerLocked) this._tryFire();
    };
    this._onKeyUp   = e => { this.keys[e.code] = false; };
    this._onMouseMove = e => {
      if (!this.pointerLocked) return;
      this.yaw   -= e.movementX * MOUSE_SENS;
      this.pitch -= e.movementY * MOUSE_SENS;
      this.pitch  = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch));
    };
    this._onMouseDown = e => {
      if (e.button === 0 && this.pointerLocked) this._tryFire();
    };

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup',   this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mousedown', this._onMouseDown);
  }

  setPointerLocked(locked) {
    this.pointerLocked = locked;
  }

  update(dt) {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);

    // Turn
    if (this.keys['KeyA'] || this.keys['ArrowLeft'])  this.yaw += TURN_SPEED * dt;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) this.yaw -= TURN_SPEED * dt;

    // Move
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    let dx = 0, dz = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp'])   { dx += fwd.x * SPEED * dt; dz += fwd.z * SPEED * dt; }
    if (this.keys['KeyS'] || this.keys['ArrowDown']) { dx -= fwd.x * SPEED * dt; dz -= fwd.z * SPEED * dt; }

    // Slide collision
    const nx = this.position.x + dx;
    if (!this._collidesAt(nx, this.position.z)) this.position.x = nx;
    const nz = this.position.z + dz;
    if (!this._collidesAt(this.position.x, nz)) this.position.z = nz;

    this._updateCamera();
    this._updateBoundingBox();
  }

  _updateCamera() {
    this.camera.position.set(this.position.x, EYE_HEIGHT, this.position.z);
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  _updateBoundingBox() {
    this.boundingBox.set(
      new THREE.Vector3(this.position.x - HALF_EXT, 0,   this.position.z - HALF_EXT),
      new THREE.Vector3(this.position.x + HALF_EXT, 2.0, this.position.z + HALF_EXT)
    );
  }

  _collidesAt(x, z) {
    const box = new THREE.Box3(
      new THREE.Vector3(x - HALF_EXT, 0,   z - HALF_EXT),
      new THREE.Vector3(x + HALF_EXT, 2.5, z + HALF_EXT)
    );
    return this.wallBoxes.some(w => w.intersectsBox(box));
  }

  _tryFire() {
    if (this.fireCooldown > 0) return;
    this.fireCooldown = FIRE_RATE;

    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const origin = this.camera.position.clone().addScaledVector(dir, 0.5);
    const bullet = new Bullet(origin, dir, 0x00ffaa);
    if (this.onFire) this.onFire(bullet);
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  destroy() {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup',   this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mousedown', this._onMouseDown);
  }
}
