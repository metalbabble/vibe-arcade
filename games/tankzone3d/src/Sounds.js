// Add new tracks by dropping files into public/music/ and incrementing this number
const MUSIC_TRACK_COUNT = 4;

export class Sounds {
  constructor() {
    this._ac = null;
    this._music = null;
  }

  _ctx() {
    if (!this._ac) {
      this._ac = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this._ac.state === 'suspended') this._ac.resume();
    return this._ac;
  }

  // Oscillator with frequency sweep and gain envelope
  _osc(type, freqStart, freqEnd, duration, gainPeak, startTime = 0) {
    const ctx = this._ctx();
    const t = ctx.currentTime + startTime;

    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainPeak, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration);
  }

  // White noise burst through a lowpass filter
  _noise(duration, gainPeak, filterFreq, startTime = 0) {
    const ctx = this._ctx();
    const t = ctx.currentTime + startTime;

    const sampleRate = ctx.sampleRate;
    const frameCount = Math.ceil(sampleRate * duration);
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainPeak, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
    src.stop(t + duration);
  }

  // --- Sound events ---

  playerPew() {
    // Bright descending laser zap
    this._osc('square', 880, 120, 0.16, 0.35);
  }

  enemyPew() {
    // Lower, slightly raspier enemy shot
    this._osc('sawtooth', 600, 90, 0.18, 0.2);
  }

  playerHit() {
    // Sharp impact crack + low thud
    this._noise(0.28, 0.7, 1200);
    this._osc('sine', 220, 35, 0.22, 0.5);
  }

  kaboom() {
    // Big deep explosion: low rumble + two noise layers
    this._noise(0.7, 1.0, 500);
    this._noise(0.5, 0.6, 150, 0.05);
    this._osc('sine', 110, 18, 0.65, 0.8);
    // High crack on impact
    this._noise(0.12, 0.5, 4000);
  }

  levelStart() {
    // Ascending military arpeggio: C4 E4 G4 C5
    const notes = [261, 329, 392, 523];
    notes.forEach((freq, i) => {
      this._osc('square', freq, freq * 0.98, 0.14, 0.28, i * 0.09);
    });
  }

  levelComplete() {
    // Triumphant fanfare: G4 C5 E5 G5 C6
    const notes = [392, 523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const dur = i === notes.length - 1 ? 0.45 : 0.18;
      this._osc('square', freq, freq * 0.99, dur, 0.32, i * 0.11);
    });
    // Harmony on the last note
    this._osc('square', 1047 * 1.5, 1047 * 1.48, 0.45, 0.15, notes.length * 0.11 - 0.11);
  }

  enemyHit() {
    // Metallic clank: sharp high-freq transient + short ring
    this._noise(0.09, 0.45, 3500);
    this._osc('square', 380, 120, 0.1, 0.28);
  }

  lowHealthBeep() {
    // Sharp warning ping
    this._osc('sine', 1100, 1050, 0.1, 0.35);
  }

  powerUp() {
    // Sparkling upward glide
    this._osc('sine', 440, 1760, 0.22, 0.35);
    this._osc('sine', 660, 2640, 0.18, 0.18, 0.06);
  }

  startMusic() {
    this.stopMusic();
    const track = Math.floor(Math.random() * MUSIC_TRACK_COUNT) + 1;
    const audio = new Audio(`/music/${track}.mp3`);
    audio.loop = true;
    audio.volume = 0.4;
    audio.play().catch(() => {}); // ignore autoplay policy errors
    this._music = audio;
  }

  stopMusic() {
    if (this._music) {
      this._music.pause();
      this._music = null;
    }
  }
}
