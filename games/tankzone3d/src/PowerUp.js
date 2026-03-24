import * as THREE from 'three';

export class PowerUp {
  constructor(scene, position) {
    this._t = Math.random() * Math.PI * 2;

    const geo = new THREE.OctahedronGeometry(0.35, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    this.mesh = new THREE.Mesh(geo, mat);

    const edges  = new THREE.EdgesGeometry(geo);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff });
    this.mesh.add(new THREE.LineSegments(edges, lineMat));

    // Outer ring
    const ringGeo = new THREE.TorusGeometry(0.55, 0.03, 6, 16);
    const ringMat = new THREE.LineBasicMaterial({ color: 0x00ff88 });
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.3 }));
    this.mesh.add(ring);

    this.mesh.position.set(position.x, 1.0, position.z);
    scene.add(this.mesh);
  }

  update(dt) {
    this._t += dt;
    this.mesh.position.y = 1.0 + Math.sin(this._t * 1.8) * 0.25;
    this.mesh.rotation.y += dt * 1.4;
  }
}
