
export class AudioBus {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.enabled = true;
    this._bufs = {};
  }

  resume() {
    if (!this.enabled) return;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMute(m) {
    this.muted = !!m;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
  }

  noise(len, color = 'white') {
    const sr = this.ctx.sampleRate;
    const n = Math.floor(sr * len);
    const buf = this.ctx.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (color === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else d[i] = w;
    }
    return buf;
  }

  playBuf(buf, opts = {}) {
    if (!this.ctx || this.muted) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = opts.gain ?? 0.4;
    const f = this.ctx.createBiquadFilter();
    f.type = opts.filter || 'lowpass';
    f.frequency.value = opts.freq ?? 4000;
    src.connect(f); f.connect(g); g.connect(this.master);
    if (opts.rate) src.playbackRate.value = opts.rate;
    src.start();
  }

  tone(freq, dur, type = 'square', gain = 0.08) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }

  gun(kind) {
    this.resume();
    if (!this.ctx) return;
    const map = {
      pistol: { len: 0.18, freq: 2800, gain: 0.55, rate: 1.15 },
      smg: { len: 0.09, freq: 3200, gain: 0.32, rate: 1.4 },
      rifle: { len: 0.22, freq: 2200, gain: 0.62, rate: 0.92 },
      shotgun: { len: 0.32, freq: 1400, gain: 0.75, rate: 0.72 }
    };
    const p = map[kind] || map.pistol;
    const key = 'n' + kind;
    if (!this._bufs[key]) this._bufs[key] = this.noise(p.len, 'white');
    this.playBuf(this._bufs[key], { gain: p.gain, freq: p.freq, rate: p.rate });
    this.tone(kind === 'shotgun' ? 90 : 140, 0.08, 'sine', 0.12);
  }

  reload() {
    this.resume();
    this.tone(180, 0.05, 'square', 0.05);
    setTimeout(() => this.tone(240, 0.06, 'square', 0.05), 90);
    setTimeout(() => this.tone(160, 0.07, 'triangle', 0.06), 220);
  }

  foot() {
    this.resume();
    if (!this.ctx) return;
    if (!this._bufs.foot) this._bufs.foot = this.noise(0.08, 'brown');
    this.playBuf(this._bufs.foot, { gain: 0.18, freq: 500, rate: 0.8 + Math.random() * 0.3 });
  }

  hit() { this.resume(); this.tone(520, 0.04, 'square', 0.05); }
  hurt() { this.resume(); this.tone(70, 0.18, 'sawtooth', 0.08); }
  spawn() { this.resume(); this.tone(220, 0.2, 'triangle', 0.05); }
  boss() {
    this.resume();
    this.tone(70, 0.55, 'sawtooth', 0.1);
    setTimeout(() => this.tone(52, 0.7, 'square', 0.06), 80);
  }
  ui() { this.resume(); this.tone(440, 0.05, 'square', 0.04); }
  pickup(medkit = false) {
    this.resume();
    this.tone(medkit ? 520 : 360, 0.07, 'triangle', 0.07);
    setTimeout(() => this.tone(medkit ? 720 : 480, 0.09, 'sine', 0.06), 70);
  }
  explode() {
    this.resume();
    if (!this.ctx) return;
    if (!this._bufs.boom) this._bufs.boom = this.noise(0.4, 'brown');
    this.playBuf(this._bufs.boom, { gain: 0.7, freq: 600, rate: 0.55 });
    this.tone(60, 0.3, 'sine', 0.12);
  }
}
