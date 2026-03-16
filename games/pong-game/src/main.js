import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene.js';
import '../../../shared/touch-controller.js'

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#000000',
  scene: [GameScene],
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
};

new Phaser.Game(config);
