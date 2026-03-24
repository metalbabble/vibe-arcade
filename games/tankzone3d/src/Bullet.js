import * as THREE from 'three';

const BULLET_SPEED = 32;
const MAX_RANGE    = 55;

export class Bullet {
  constructor(position, direction, color) {
    this.velocity = direction.clone().multiplyScalar(BULLET_SPEED);
    this.distanceTraveled = 0;
    this.maxRange = MAX_RANGE;

    // Core sphere
    const geo = new THREE.SphereGeometry(0.08, 5, 5);
    const mat = new THREE.MeshBasicMaterial({ color });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(position);

    // Glow halo
    const glowGeo = new THREE.SphereGeometry(0.18, 5, 5);
    const glowMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25 });
    this.mesh.add(new THREE.Mesh(glowGeo, glowMat));
  }

  update(dt) {
    const move = this.velocity.clone().multiplyScalar(dt);
    this.mesh.position.add(move);
    this.distanceTraveled += move.length();
  }
}
