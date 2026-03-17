import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene.js';
import '../../../shared/touch-controller.js'

const config = {
  type: Phaser.AUTO,
  backgroundColor: '#000000',
  scene: [GameScene],
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 800,
    height: 600,
  },
};

new Phaser.Game(config);
