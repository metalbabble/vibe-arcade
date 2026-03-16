class ResultsScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ResultsScene' });
  }

  init(data) {
    this.winner      = data.winner;       // 'player' | 'ai'
    this.playerScore = data.playerScore;
    this.aiScore     = data.aiScore;
    this.gameConfig  = data.gameConfig;
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    const isWin = this.winner === 'player';

    // ── Background ────────────────────────────────────────────────
    this.add.rectangle(W / 2, H / 2, W, H, 0x080810);

    // Flash
    const flash = this.add.rectangle(W / 2, H / 2, W, H,
      isWin ? 0x00ff44 : 0xff2222, 0.25
    );
    this.tweens.add({ targets: flash, alpha: 0, duration: 900 });

    // Scanlines
    const sg = this.add.graphics();
    sg.fillStyle(0x000000, 0.15);
    for (let y = 0; y < H; y += 3) sg.fillRect(0, y, W, 1);

    // ── Main result ───────────────────────────────────────────────
    const mainColor  = isWin ? '#00ff44' : '#ff3333';
    const mainStroke = isWin ? '#003322' : '#330000';

    this.add.text(W / 2, H * 0.26, isWin ? 'VICTORY!' : 'DEFEAT!', {
      fontSize: '76px',
      fontFamily: 'monospace',
      color: mainColor,
      stroke: mainStroke,
      strokeThickness: 5
    }).setOrigin(0.5);

    this.add.text(W / 2, H * 0.42, isWin ? 'YOU WIN THE BATTLE!' : 'THE ENEMY WINS!', {
      fontSize: '22px',
      fontFamily: 'monospace',
      color: mainColor
    }).setOrigin(0.5);

    // ── Score ─────────────────────────────────────────────────────
    const scoreStr = `PLAYER  ${this.playerScore}  —  ${this.aiScore}  ENEMY`;
    this.add.text(W / 2, H * 0.55, scoreStr, {
      fontSize: '26px',
      fontFamily: 'monospace',
      color: '#aaaaaa'
    }).setOrigin(0.5);

    // Score bar pips
    this._drawScorePips(W, H);

    // ── Config reminder ───────────────────────────────────────────
    const parts = [
      `WALLS: ${this.gameConfig.walls ? 'ON' : 'OFF'}`,
      `BOUNCY: ${this.gameConfig.bouncy ? 'ON' : 'OFF'}`,
      `DIFFICULTY: ${this.gameConfig.difficulty.toUpperCase()}`
    ];
    this.add.text(W / 2, H * 0.68, parts.join('   '), {
      fontSize: '13px',
      fontFamily: 'monospace',
      color: '#2a442a'
    }).setOrigin(0.5);

    // ── Return prompt ─────────────────────────────────────────────
    const ret = this.add.text(W / 2, H * 0.82, '[ PRESS ENTER OR CLICK TO CONTINUE ]', {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#00aa33'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.tweens.add({ targets: ret, alpha: 0.1, duration: 600, yoyo: true, repeat: -1 });

    // ── Input ─────────────────────────────────────────────────────
    const goBack = () => this.scene.start('TitleScene', { returnSettings: this.gameConfig });
    this.input.keyboard.once('keydown-ENTER', goBack);
    ret.once('pointerdown', goBack);

    // ── Sound ─────────────────────────────────────────────────────
    const sm = new SoundManager();
    if (isWin) sm.playWin(); else sm.playLose();
  }

  _drawScorePips(W, H) {
    const y = H * 0.615;
    const pipW = 18;
    const pipH = 12;
    const gap  = 4;
    const totalW = 10 * (pipW + gap) - gap;

    // Player pips (left side)
    const px = W / 2 - 30 - totalW;
    for (let i = 0; i < 10; i++) {
      const x = px + i * (pipW + gap);
      const filled = i < this.playerScore;
      this.add.rectangle(x + pipW / 2, y, pipW, pipH,
        filled ? 0x00ff44 : 0x0a2a0a
      );
      if (filled) {
        this.add.rectangle(x + pipW / 2, y, pipW - 2, pipH - 2, 0x44ff88);
      }
    }

    // AI pips (right side)
    const ax = W / 2 + 30;
    for (let i = 0; i < 10; i++) {
      const x = ax + i * (pipW + gap);
      const filled = i < this.aiScore;
      this.add.rectangle(x + pipW / 2, y, pipW, pipH,
        filled ? 0xff2222 : 0x2a0a0a
      );
      if (filled) {
        this.add.rectangle(x + pipW / 2, y, pipW - 2, pipH - 2, 0xff6666);
      }
    }
  }
}
