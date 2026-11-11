/** Original procedural audio for 尘线突击. WebAudio only — no commercial samples. */

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

export class AudioBus {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.muted = false;
    this.vol = { master: 0.7, music: 0.5, sfx: 0.85 };
    this.buses = null;
    this._bufs = {};
    this._reloadGen = 0;
    this._nextVocal = 0;
    this._nextCreak = 8;
    this._nextMoan = 6;
    this._nextSting = 18;
    this._nextPulse = 0;
    this._scene = 'title';
    this._lowHp = false;
    this._tension = 0;
    this._beds = null;
    this._wantUnlock = false;
  }

  resume() {
    if (!this.enabled) return;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      this.ctx = new AC();
      this._buildGraph();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this._ensureBeds();
  }

  _buildGraph() {
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.musicGain = ctx.createGain();
    this.sfxGain = ctx.createGain();
    this.ambGain = ctx.createGain();
    this.sfxFilter = ctx.createBiquadFilter();
    this.sfxFilter.type = 'lowpass';
    this.sfxFilter.frequency.value = 18000;
    this.sfxFilter.Q.value = 0.7;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 10;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.004;
    comp.release.value = 0.16;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -2.5;
    lim.knee.value = 2;
    lim.ratio.value = 18;
    lim.attack.value = 0.001;
    lim.release.value = 0.09;

    this.sfxFilter.connect(this.sfxGain);
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.ambGain.connect(this.master);
    this.master.connect(comp);
    comp.connect(lim);
    lim.connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._makeIR();
    this.reverb.connect(this.sfxGain);

    this.buses = {
      master: this.master,
      music: this.musicGain,
      sfx: this.sfxGain,
      amb: this.ambGain,
      comp,
      limiter: lim
    };
    this._applyVol();
  }

  _applyVol() {
    const m = this.muted ? 0 : this.vol.master;
    if (this.master) this.master.gain.value = m;
    if (this.musicGain) this.musicGain.gain.value = this.vol.music;
    if (this.ambGain) this.ambGain.gain.value = this.vol.music * 0.92;
    if (this.sfxGain) this.sfxGain.gain.value = this.vol.sfx;
  }

  setMute(m) {
    this.muted = !!m;
    this._applyVol();
  }

  setVolumes(v = {}) {
    if (v.master != null) this.vol.master = clamp(+v.master, 0, 1);
    if (v.music != null) this.vol.music = clamp(+v.music, 0, 1);
    if (v.sfx != null) this.vol.sfx = clamp(+v.sfx, 0, 1);
    this._applyVol();
  }

  getVolumes() { return { ...this.vol, muted: this.muted }; }

  _bus(name) {
    if (name === 'music') return this.musicGain;
    if (name === 'amb') return this.ambGain;
    return this.sfxFilter;
  }

  _noise(len, color = 'white') {
    const key = color + ':' + len.toFixed(3);
    if (this._bufs[key]) return this._bufs[key];
    const sr = this.ctx.sampleRate;
    const n = Math.max(8, Math.floor(sr * len));
    const buf = this.ctx.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (color === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.4; }
      else if (color === 'pink') { last = 0.97 * last + 0.03 * w; d[i] = last * 3.2 + w * 0.25; }
      else d[i] = w;
    }
    this._bufs[key] = buf;
    return buf;
  }

  _makeIR() {
    const sr = this.ctx.sampleRate;
    const n = Math.floor(sr * 0.48);
    const buf = this.ctx.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        let s = (Math.random() * 2 - 1) * Math.exp(-t * 5.8);
        if (Math.abs(i - 0.024 * sr) < 10) s += (Math.random() * 2 - 1) * 0.55;
        if (Math.abs(i - 0.052 * sr) < 12) s += (Math.random() * 2 - 1) * 0.32;
        d[i] = s * 0.62;
      }
    }
    return buf;
  }

  _out(opts = {}) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const peak = opts.gain ?? 0.3;
    const now = ctx.currentTime + (opts.when || 0);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now + (opts.atk || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, now + (opts.dur || 0.12));
    let node = g;
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = opts.filter;
      f.frequency.value = opts.freq ?? 2400;
      if (opts.Q != null) f.Q.value = opts.Q;
      g.connect(f);
      node = f;
    }
    if (opts.x != null) {
      const p = ctx.createPanner();
      p.panningModel = 'HRTF';
      p.distanceModel = 'inverse';
      p.refDistance = opts.refDist ?? 5;
      p.maxDistance = 50;
      p.rolloffFactor = 1.15;
      p.positionX.value = opts.x;
      p.positionY.value = opts.y ?? 1.2;
      p.positionZ.value = opts.z ?? 0;
      node.connect(p);
      p.connect(this._bus(opts.bus));
      if (opts.verb && this.reverb) {
        const vg = ctx.createGain();
        vg.gain.value = opts.verb;
        p.connect(vg); vg.connect(this.reverb);
      }
    } else {
      node.connect(this._bus(opts.bus));
      if (opts.verb && this.reverb) {
        const vg = ctx.createGain();
        vg.gain.value = opts.verb;
        node.connect(vg); vg.connect(this.reverb);
      }
    }
    return { g, now };
  }

  _buf(buf, opts = {}) {
    if (!this.ctx || this.muted) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = opts.rate ?? 1;
    const { g } = this._out(opts);
    src.connect(g);
    src.start(this.ctx.currentTime + (opts.when || 0));
    return src;
  }

  _tone(freq, dur, type = 'sine', gain = 0.08, opts = {}) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    const start = this.ctx.currentTime + (opts.when || 0);
    o.frequency.setValueAtTime(freq, start);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slide), start + dur);
    const { g } = this._out({ ...opts, gain, dur, atk: opts.atk || 0.003 });
    o.connect(g);
    o.start(start);
    o.stop(start + dur + 0.02);
  }

  _jitter(n = 0.06) { return 1 + (Math.random() * 2 - 1) * n; }

  gun(kind) {
    this.resume();
    if (!this.ctx || this.muted) return;
    const k = kind || 'pistol';
    const spec = {
      pistol: { len: 0.16, body: 2600, q: 0.9, gain: 0.42, thump: 148, thumpG: 0.16, click: 4200, verb: 0.18, rate: 1.08 },
      smg: { len: 0.075, body: 3400, q: 0.7, gain: 0.22, thump: 190, thumpG: 0.07, click: 5100, verb: 0.1, rate: 1.28 },
      rifle: { len: 0.2, body: 1900, q: 1.1, gain: 0.48, thump: 118, thumpG: 0.2, click: 3600, verb: 0.22, rate: 0.94 },
      shotgun: { len: 0.34, body: 980, q: 0.55, gain: 0.58, thump: 72, thumpG: 0.28, click: 2400, verb: 0.3, rate: 0.7 }
    }[k] || { len: 0.16, body: 2600, q: 0.9, gain: 0.42, thump: 148, thumpG: 0.16, click: 4200, verb: 0.18, rate: 1.08 };
    const j = this._jitter(0.045);
    const gj = this._jitter(0.08);
    this._buf(this._noise(0.012, 'white'), {
      gain: 0.2 * gj, freq: spec.click, filter: 'highpass', dur: 0.03, atk: 0.001, verb: 0.06, rate: 1.4 * j
    });
    this._buf(this._noise(spec.len, k === 'shotgun' ? 'pink' : 'white'), {
      gain: spec.gain * gj, freq: spec.body * j, filter: 'lowpass', Q: spec.q,
      dur: spec.len, rate: spec.rate * j, verb: spec.verb
    });
    this._tone(spec.thump * j, Math.min(0.16, spec.len), 'sine', spec.thumpG * gj, { dur: Math.min(0.16, spec.len), verb: 0.08 });
    if (k === 'shotgun') {
      this._buf(this._noise(0.22, 'brown'), { gain: 0.28 * gj, freq: 420, filter: 'lowpass', dur: 0.24, rate: 0.62 * j, verb: 0.16 });
    }
    if (k !== 'smg' || Math.random() < 0.45) {
      setTimeout(() => this.casing(), 70 + Math.random() * 90);
    }
  }

  dry() {
    this.resume();
    this._tone(1900, 0.035, 'square', 0.045, { filter: 'highpass', freq: 900, dur: 0.04, atk: 0.001 });
    this._buf(this._noise(0.03, 'white'), { gain: 0.08, freq: 2800, filter: 'highpass', dur: 0.04, rate: 1.6 });
  }

  casing() {
    if (!this.ctx || this.muted) return;
    const f = 2400 + Math.random() * 1600;
    this._tone(f, 0.07, 'triangle', 0.035, { dur: 0.08, filter: 'bandpass', freq: f, Q: 6 });
    this._tone(f * 1.34, 0.045, 'sine', 0.02, { dur: 0.05, when: 0.012 });
  }

  flesh() {
    this.resume();
    this._buf(this._noise(0.09, 'pink'), { gain: 0.22, freq: 520, filter: 'bandpass', Q: 1.2, dur: 0.1, rate: this._jitter(0.08) });
    this._tone(170, 0.07, 'sine', 0.07, { dur: 0.08 });
  }

  headshot() {
    this.resume();
    this.flesh();
    this._buf(this._noise(0.07, 'white'), { gain: 0.2, freq: 1400, filter: 'bandpass', Q: 2, dur: 0.08, rate: 0.9 });
    this._tone(880, 0.05, 'square', 0.04, { dur: 0.055, filter: 'lowpass', freq: 1800 });
  }

  ricochet() {
    this.resume();
    const f = 1700 + Math.random() * 1800;
    this._tone(f, 0.09, 'triangle', 0.055, { dur: 0.1, slide: f * 0.55, verb: 0.12 });
    this._buf(this._noise(0.05, 'white'), { gain: 0.12, freq: 3200, filter: 'highpass', dur: 0.06, rate: 1.3 });
  }

  reload(kind, duration = 1.4) {
    this.resume();
    this._reloadGen += 1;
    const gen = this._reloadGen;
    if (kind === 'shotgun') {
      this.reloadShell();
      return;
    }
    const d = Math.max(0.6, duration);
    const later = (t, fn) => setTimeout(() => {
      if (this._reloadGen !== gen || !this.ctx) return;
      fn();
    }, t * 1000);
    later(d * 0.08, () => this._magOut());
    later(d * 0.46, () => this._magIn());
    later(d * 0.78, () => this._rack(kind));
  }

  reloadShell() {
    this.resume();
    if (!this.ctx || this.muted) return;
    this._buf(this._noise(0.05, 'brown'), { gain: 0.12, freq: 700, filter: 'lowpass', dur: 0.07, rate: 0.85 });
    this._tone(320 + Math.random() * 40, 0.05, 'triangle', 0.05, { dur: 0.06 });
    this._tone(190, 0.04, 'sine', 0.04, { dur: 0.045, when: 0.03 });
  }

  cancelReload() { this._reloadGen += 1; }

  _magOut() {
    this._buf(this._noise(0.06, 'white'), { gain: 0.1, freq: 1800, filter: 'highpass', dur: 0.07, rate: 1.15 });
    this._tone(210, 0.05, 'square', 0.035, { dur: 0.055 });
  }

  _magIn() {
    this._buf(this._noise(0.05, 'brown'), { gain: 0.14, freq: 650, filter: 'lowpass', dur: 0.07, rate: 0.9 });
    this._tone(140, 0.06, 'sine', 0.055, { dur: 0.07 });
    this._tone(380, 0.035, 'triangle', 0.03, { dur: 0.04, when: 0.03 });
  }

  _rack(kind) {
    const hi = kind === 'pistol' ? 1900 : 1450;
    this._buf(this._noise(0.055, 'white'), { gain: 0.13, freq: hi, filter: 'bandpass', Q: 1.4, dur: 0.07, rate: 1.05 });
    this._tone(kind === 'rifle' ? 220 : 280, 0.05, 'square', 0.04, { dur: 0.055 });
    this._tone(hi * 0.7, 0.04, 'triangle', 0.03, { dur: 0.045, when: 0.025 });
  }

  explode() {
    this.resume();
    if (!this.ctx || this.muted) return;
    this._buf(this._noise(0.55, 'brown'), { gain: 0.62, freq: 380, filter: 'lowpass', dur: 0.5, rate: 0.48, verb: 0.28 });
    this._buf(this._noise(0.28, 'white'), { gain: 0.28, freq: 1800, filter: 'highpass', dur: 0.22, rate: 0.8, verb: 0.14 });
    this._tone(58, 0.42, 'sine', 0.22, { dur: 0.42, slide: 32 });
    this._tone(92, 0.18, 'triangle', 0.08, { dur: 0.2 });
    for (let i = 0; i < 4; i++) {
      const when = 0.05 + i * 0.05 + Math.random() * 0.04;
      this._buf(this._noise(0.08, 'pink'), {
        gain: 0.1, freq: 700 + Math.random() * 900, filter: 'bandpass', Q: 1.2,
        dur: 0.09, rate: 0.7 + Math.random() * 0.4, when, verb: 0.08
      });
    }
  }

  nadePin() {
    this.resume();
    this._tone(1400, 0.04, 'triangle', 0.045, { dur: 0.045 });
    this._tone(2100, 0.03, 'sine', 0.03, { dur: 0.035, when: 0.02 });
  }

  nadeThrow() {
    this.resume();
    this._buf(this._noise(0.12, 'pink'), { gain: 0.1, freq: 900, filter: 'highpass', dur: 0.13, rate: 1.1 });
    this._tone(180, 0.08, 'sine', 0.04, { dur: 0.09, slide: 120 });
  }

  enemyGun(kind, x, y, z) {
    this.resume();
    if (!this.ctx || this.muted) return;
    const rifle = kind !== 'shotgun';
    this._buf(this._noise(rifle ? 0.11 : 0.2, 'white'), {
      gain: rifle ? 0.2 : 0.28, freq: rifle ? 2100 : 900, filter: 'lowpass',
      dur: rifle ? 0.12 : 0.22, rate: rifle ? 1.05 : 0.72, verb: 0.14,
      x, y: y ?? 1.4, z, bus: 'sfx'
    });
    this._tone(rifle ? 150 : 80, 0.08, 'sine', rifle ? 0.05 : 0.08, { dur: 0.09, x, y: y ?? 1.4, z });
  }

  vocal(type, verb, x, y, z) {
    this.resume();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (verb === 'idle' && now < this._nextVocal) return;
    if (verb === 'idle') this._nextVocal = now + 2.4 + Math.random() * 1.6;
    const deep = type === 'midboss' || type === 'finalboss';
    const gurgle = type === 'grenadier';
    const snarl = type === 'rusher';
    const base = deep ? 62 : gurgle ? 96 : snarl ? 150 : 118;
    const dur = verb === 'death' ? (deep ? 0.9 : 0.45) : verb === 'spawn' ? (deep ? 0.7 : 0.32) : verb === 'attack' ? 0.22 : 0.38;
    const gain = (deep ? 0.16 : 0.09) * (verb === 'death' ? 1.15 : 1);
    const j = this._jitter(0.08);
    this._tone(base * j, dur, deep ? 'sawtooth' : 'square', gain, {
      dur, slide: base * j * (verb === 'death' ? 0.55 : 0.82),
      filter: 'lowpass', freq: deep ? 420 : gurgle ? 380 : 700,
      x, y: y ?? 1.3, z, bus: 'sfx', verb: 0.1, atk: 0.02
    });
    this._buf(this._noise(dur, gurgle ? 'brown' : 'pink'), {
      gain: (gurgle ? 0.12 : 0.07) * (deep ? 1.3 : 1),
      freq: gurgle ? 280 : snarl ? 900 : 500, filter: gurgle ? 'lowpass' : 'bandpass', Q: 1.1,
      dur, rate: (snarl ? 1.15 : 0.8) * j, x, y: y ?? 1.3, z
    });
  }

  foot() {
    this.resume();
    if (!this.ctx) return;
    this._buf(this._noise(0.07, 'brown'), { gain: 0.12, freq: 420, filter: 'lowpass', dur: 0.08, rate: 0.75 + Math.random() * 0.3 });
  }

  hit() { this.resume(); this._tone(620, 0.03, 'square', 0.035, { dur: 0.035 }); }
  hurt() {
    this.resume();
    this._tone(68, 0.2, 'sawtooth', 0.08, { dur: 0.2, filter: 'lowpass', freq: 280 });
    this._buf(this._noise(0.14, 'pink'), { gain: 0.1, freq: 300, filter: 'lowpass', dur: 0.15 });
  }
  spawn() { /* vocals handle presence; keep a faint sting for tests/compat */ this.resume(); }
  boss() {
    this.resume();
    this._tone(48, 0.8, 'sawtooth', 0.1, { dur: 0.8, filter: 'lowpass', freq: 220, bus: 'music' });
    this._tone(36, 1.1, 'sine', 0.08, { dur: 1.1, bus: 'music', when: 0.05 });
    this._nextSting = 2;
  }
  ui() { this.resume(); this._tone(470, 0.05, 'square', 0.035, { dur: 0.055, bus: 'sfx' }); }
  pickup(medkit = false) {
    this.resume();
    this._tone(medkit ? 520 : 360, 0.07, 'triangle', 0.07, { dur: 0.08 });
    this._tone(medkit ? 720 : 480, 0.09, 'sine', 0.055, { dur: 0.1, when: 0.06 });
  }

  _ensureBeds() {
    if (!this.ctx || this._beds) return;
    const ctx = this.ctx;
    const wind = ctx.createBufferSource();
    wind.buffer = this._noise(2.4, 'brown');
    wind.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'bandpass'; wf.frequency.value = 380; wf.Q.value = 0.7;
    const wg = ctx.createGain();
    wg.gain.value = 0.045;
    wind.connect(wf); wf.connect(wg); wg.connect(this.ambGain);
    wind.start();

    const drones = [];
    const freqs = [41, 42.4, 61.5, 82, 123.5];
    for (const f of freqs) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.018;
      const lf = ctx.createBiquadFilter();
      lf.type = 'lowpass'; lf.frequency.value = 240;
      o.connect(lf); lf.connect(g); g.connect(this.musicGain);
      o.start();
      drones.push({ o, g });
    }
    const strings = [];
    for (const f of [196, 207.6, 233.1]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const fl = ctx.createBiquadFilter();
      fl.type = 'lowpass'; fl.frequency.value = 520; fl.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.value = 0.01;
      o.connect(fl); fl.connect(g); g.connect(this.musicGain);
      o.start();
      strings.push({ o, g });
    }
    this._beds = { wind, wf, wg, drones, strings };
  }

  _setListener(L) {
    if (!this.ctx || !L) return;
    const li = this.ctx.listener;
    if (li.positionX) {
      li.positionX.value = L.x; li.positionY.value = L.y; li.positionZ.value = L.z;
      if (L.fx != null) {
        li.forwardX.value = L.fx; li.forwardY.value = L.fy; li.forwardZ.value = L.fz;
        li.upX.value = L.ux; li.upY.value = L.uy; li.upZ.value = L.uz;
      }
    } else if (li.setPosition) {
      li.setPosition(L.x, L.y, L.z);
    }
  }

  update(dt, state = {}) {
    if (!this.ctx || !this._beds) return;
    this._scene = state.mode || this._scene;
    this._setListener(state.listener);
    const living = state.living || 0;
    const boss = !!state.boss;
    const hp = state.hp ?? 100;
    const maxHp = state.maxHp ?? 100;
    const low = hp > 0 && hp / maxHp < 0.3;
    const play = this._scene === 'play';
    const title = this._scene === 'title';
    this._tension += ((play ? Math.min(1, living / 9) : 0) - this._tension) * Math.min(1, dt * 2);

    if (low !== this._lowHp && this.sfxFilter) {
      this._lowHp = low;
      this.sfxFilter.frequency.cancelScheduledValues(this.ctx.currentTime);
      this.sfxFilter.frequency.linearRampToValueAtTime(low ? 1200 : 18000, this.ctx.currentTime + 0.25);
    }

    const windBase = title ? 0.05 : play ? 0.042 : 0.028;
    this._beds.wg.gain.value = windBase + Math.sin(this.ctx.currentTime * 0.17) * 0.012;
    this._beds.wf.frequency.value = 340 + Math.sin(this.ctx.currentTime * 0.11) * 90;

    this._beds.drones.forEach((d, i) => {
      const dest = (title ? 0.028 : play ? 0.016 : 0.01) + (boss ? 0.02 : 0) + (i === 0 && boss ? 0.015 : 0);
      d.g.gain.value += (dest - d.g.gain.value) * Math.min(1, dt * 3);
    });
    this._beds.strings.forEach((s, i) => {
      const dest = (title ? 0.016 : 0.007 + this._tension * 0.012) * (i === 1 ? 1.15 : 1) + (low ? 0.008 : 0);
      s.g.gain.value += (dest - s.g.gain.value) * Math.min(1, dt * 2.4);
    });

    this._nextPulse -= dt;
    if (this._nextPulse <= 0) {
      const beat = low ? 0.72 : (play ? 1.15 - this._tension * 0.25 : title ? 1.6 : 1.4);
      this._nextPulse = beat;
      if (!this.muted) {
        const g = low ? 0.11 : play ? 0.035 + this._tension * 0.04 : 0.028;
        this._tone(low ? 52 : 46, 0.12, 'sine', g, { dur: 0.13, bus: 'music', atk: 0.01 });
        if (play && this._tension > 0.35) {
          this._buf(this._noise(0.04, 'white'), { gain: 0.03 + this._tension * 0.04, freq: 900, filter: 'highpass', dur: 0.05, bus: 'music' });
        }
      }
    }

    this._nextCreak -= dt;
    if (this._nextCreak <= 0) {
      this._nextCreak = 7 + Math.random() * 10;
      if (!this.muted && (play || title)) {
        const f = 280 + Math.random() * 420;
        this._tone(f, 0.55, 'sawtooth', 0.025, { dur: 0.55, slide: f * 0.7, filter: 'bandpass', freq: f, Q: 4, bus: 'amb' });
      }
    }
    this._nextMoan -= dt;
    if (this._nextMoan <= 0) {
      this._nextMoan = 8 + Math.random() * 10;
      if (!this.muted && play) {
        const side = Math.random() > 0.5 ? 14 : -14;
        this.vocal('rifle', 'idle', side + Math.random() * 6, 1.6, -8 - Math.random() * 10);
      }
    }
    this._nextSting -= dt;
    if (this._nextSting <= 0) {
      this._nextSting = 16 + Math.random() * 22;
      if (!this.muted && (title || boss || Math.random() < 0.4)) {
        this._tone(233, 0.7, 'sawtooth', 0.035, { dur: 0.7, filter: 'lowpass', freq: 700, bus: 'music' });
        this._tone(311, 0.9, 'triangle', 0.03, { dur: 0.9, when: 0.05, bus: 'music' });
      }
    }
  }
}
