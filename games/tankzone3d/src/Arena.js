import * as THREE from 'three';

const WALL_COLOR = 0x003300;
const EDGE_COLOR = 0x00ff44;

export class Arena {
  constructor(scene) {
    this.scene = scene;
    this.size = 60;
    this.wallBoxes = [];

    this._createFloor();
    this._createBoundaryWalls();
    this._createObstacles();
  }

  _createFloor() {
    // Grid floor — the retro look
    const gridHelper = new THREE.GridHelper(this.size, this.size, 0x003300, 0x001a00);
    gridHelper.position.y = 0.01;
    this.scene.add(gridHelper);

    // Solid black base underneath
    const geo = new THREE.PlaneGeometry(this.size, this.size);
    const mat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const floor = new THREE.Mesh(geo, mat);
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
  }

  _createBoundaryWalls() {
    const h = this.size / 2;
    const wallHeight = 3;
    const thickness = 0.4;

    // N, S, W, E
    this._addWall(new THREE.Vector3(0, wallHeight / 2, -h), this.size + thickness, wallHeight, thickness);
    this._addWall(new THREE.Vector3(0, wallHeight / 2,  h), this.size + thickness, wallHeight, thickness);
    this._addWall(new THREE.Vector3(-h, wallHeight / 2, 0), thickness, wallHeight, this.size);
    this._addWall(new THREE.Vector3( h, wallHeight / 2, 0), thickness, wallHeight, this.size);
  }

  _createObstacles() {
    // Fixed structural pillars near the middle + random walls
    const structures = [
      // Cross-shaped central dividers
      { pos: [-12, 0, 0], w: 0.6, d: 8 },
      { pos: [ 12, 0, 0], w: 0.6, d: 8 },
      { pos: [0, 0, -12], w: 8, d: 0.6 },
      { pos: [0, 0,  12], w: 8, d: 0.6 },
    ];
    structures.forEach(s => {
      this._addWall(new THREE.Vector3(s.pos[0], 1.5, s.pos[2]), s.w, 3, s.d);
    });

    // Random obstacles
    const half = this.size / 2 - 3;
    let placed = 0;
    let attempts = 0;
    while (placed < 20 && attempts < 300) {
      attempts++;
      const x = (Math.random() - 0.5) * half * 2;
      const z = (Math.random() - 0.5) * half * 2;

      // Keep spawn areas clear (player at 0,0; enemies at radius ~14)
      if (Math.hypot(x, z) < 5) continue;

      const w = 1 + Math.random() * 3;
      const d = 1 + Math.random() * 3;
      this._addWall(new THREE.Vector3(x, 1.5, z), w, 3, d);
      placed++;
    }
  }

  _addWall(position, width, height, depth) {
    const geo = new THREE.BoxGeometry(width, height, depth);

    // Solid fill (very dark, nearly invisible)
    const solidMat = new THREE.MeshBasicMaterial({ color: WALL_COLOR });
    const solid = new THREE.Mesh(geo, solidMat);
    solid.position.copy(position);
    this.scene.add(solid);

    // Glowing wireframe edges
    const edges = new THREE.EdgesGeometry(geo);
    const lineMat = new THREE.LineBasicMaterial({ color: EDGE_COLOR });
    const lines = new THREE.LineSegments(edges, lineMat);
    solid.add(lines);

    // Collision box
    const box = new THREE.Box3(
      new THREE.Vector3(position.x - width / 2, position.y - height / 2, position.z - depth / 2),
      new THREE.Vector3(position.x + width / 2, position.y + height / 2, position.z + depth / 2)
    );
    this.wallBoxes.push(box);
  }
}
