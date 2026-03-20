const PARTICLE_TEXTURE_KEY = 'particle';

export default class ParticleManager {
  constructor(scene) {
    if (!scene.textures.exists(PARTICLE_TEXTURE_KEY)) {
      const gfx = scene.make.graphics({ x: 0, y: 0, add: false });
      gfx.fillStyle(0xffffff);
      gfx.fillRect(0, 0, 5, 5);
      gfx.generateTexture(PARTICLE_TEXTURE_KEY, 5, 5);
      gfx.destroy();
    }

    this._emitter = scene.add.particles(0, 0, PARTICLE_TEXTURE_KEY, {
      speed: { min: 60, max: 200 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
      lifespan: { min: 300, max: 600 },
      gravityY: 250,
      quantity: 14,
      emitting: false,
    });
    this._emitter.setDepth(10);
  }

  explode(x, y, color) {
    this._emitter.setParticleTint(color);
    this._emitter.emitParticleAt(x, y);
  }
}
