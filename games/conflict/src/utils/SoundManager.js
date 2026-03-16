export default class SoundManager {
  constructor() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      this.ctx = null;
    }
    this.motorOscillator = null;
    this.motorGain = null;
    this.motorPlaying = false;
  }

  _resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playShoot(isPlayer = true) {
    if (!this.ctx) return;
    this._resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(isPlayer ? 880 : 440, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(isPlayer ? 440 : 220, this.ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + 0.12);
  }

  playWallHit() {
    if (!this.ctx) return;
    this._resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 180;
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + 0.06);
  }

  playHit() {
    if (!this.ctx) return;
    this._resume();
    const duration = 0.35;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    // Low-pass filter for more "explosion" quality
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;

    const gain = this.ctx.createGain();
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    gain.gain.setValueAtTime(0.6, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    source.start(this.ctx.currentTime);
  }

  startMotor() {
    if (!this.ctx || this.motorPlaying) return;
    this._resume();

    this.motorGain = this.ctx.createGain();
    this.motorGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.motorGain.gain.linearRampToValueAtTime(0.06, this.ctx.currentTime + 0.12);
    this.motorGain.connect(this.ctx.destination);

    // Two oscillators for a richer engine sound
    this.motorOscillator = this.ctx.createOscillator();
    this.motorOscillator.type = 'sawtooth';
    this.motorOscillator.frequency.value = 55;
    this.motorOscillator.connect(this.motorGain);
    this.motorOscillator.start(this.ctx.currentTime);

    this.motorOsc2 = this.ctx.createOscillator();
    this.motorOsc2.type = 'square';
    this.motorOsc2.frequency.value = 82;

    const gain2 = this.ctx.createGain();
    gain2.gain.value = 0.4;
    this.motorOsc2.connect(gain2);
    gain2.connect(this.motorGain);
    this.motorOsc2.start(this.ctx.currentTime);

    this.motorPlaying = true;
  }

  stopMotor() {
    if (!this.ctx || !this.motorPlaying) return;
    const t = this.ctx.currentTime;
    this.motorGain.gain.linearRampToValueAtTime(0, t + 0.18);
    this.motorOscillator.stop(t + 0.18);
    if (this.motorOsc2) this.motorOsc2.stop(t + 0.18);
    this.motorOscillator = null;
    this.motorOsc2 = null;
    this.motorGain = null;
    this.motorPlaying = false;
  }

  playWin() {
    if (!this.ctx) return;
    this._resume();
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = 'square';
      osc.frequency.value = freq;
      const t = this.ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.start(t);
      osc.stop(t + 0.28);
    });
  }

  playLose() {
    if (!this.ctx) return;
    this._resume();
    const notes = [784, 659, 523, 392];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = 'square';
      osc.frequency.value = freq;
      const t = this.ctx.currentTime + i * 0.2;
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  destroy() {
    this.stopMotor();
  }
}
