// Everything is synthesised with WebAudio: no audio files to download.
const PENTA_DAY = [0, 2, 4, 7, 9, 12, 14, 16];
const PENTA_NIGHT = [0, 3, 5, 7, 10, 12, 15, 17];

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.beat = 0;
  }

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = (this.ctx = new Ctx());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    this.master.connect(ctx.destination);

    const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = last * 0.97 + (Math.random() * 2 - 1) * 0.03; // brown-ish noise
      data[i] = last * 6;
    }
    this.noiseBuf = buf;
    const white = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const wd = white.getChannelData(0);
    for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1;
    this.whiteBuf = white;

    const noise = (b, filterType, freq, q) => {
      const src = ctx.createBufferSource();
      src.buffer = b;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = freq;
      filter.Q.value = q;
      const gain = ctx.createGain();
      src.connect(filter).connect(gain).connect(this.master);
      src.start();
      return gain;
    };

    const ocean = noise(buf, 'lowpass', 520, 0.3);
    ocean.gain.value = 0.22;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.12;
    lfo.connect(lfoGain).connect(ocean.gain);
    lfo.start();

    this.wind = noise(buf, 'bandpass', 1100, 0.5);
    this.wind.gain.value = 0;
    this.rain = noise(white, 'highpass', 2500, 0.3);
    this.rain.gain.value = 0;

    this.echo = ctx.createDelay(1);
    this.echo.delayTime.value = 0.33;
    const fb = ctx.createGain();
    fb.gain.value = 0.35;
    this.echo.connect(fb).connect(this.echo);
    this.echo.connect(this.master);

    this.music = ctx.createGain();
    this.music.gain.value = 0.55;
    this.music.connect(this.master);
  }

  setSpeed(f) {
    if (this.ctx) this.wind.gain.setTargetAtTime(Math.min(1, Math.abs(f)) * 0.16, this.ctx.currentTime, 0.4);
  }

  setRain(v) {
    if (this.ctx) this.rain.gain.setTargetAtTime(v * 0.09, this.ctx.currentTime, 0.8);
  }

  _note(freq, at, dur, vol, type = 'sine', dest = null) {
    const ctx = this.ctx;
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(dest || this.master);
    g.connect(this.echo);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  _burst(type, freq, dur, vol, q = 0.7, buf = null) {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = buf || this.whiteBuf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
    return f;
  }

  // Gentle generative music that grows with the session.
  updateMusic(dt, intensity, night) {
    if (!this.ctx || this.muted) return;
    this.beat -= dt;
    if (this.beat > 0) return;
    this.beat = 0.55;
    const scale = night > 0.5 ? PENTA_NIGHT : PENTA_DAY;
    const root = night > 0.5 ? 196 : 220;
    if (Math.random() < 0.12 + intensity * 0.45) {
      const s = scale[Math.floor(Math.random() * scale.length)];
      this._note(root * Math.pow(2, s / 12), 0, 2.4, 0.035 + intensity * 0.02, 'sine', this.music);
    }
    if (intensity > 0.35 && Math.random() < 0.08) this._note(root / 2, 0, 4, 0.04, 'triangle', this.music);
  }

  chime(seed = 0) {
    if (!this.ctx) return;
    const roots = [261.63, 293.66, 329.63, 392.0, 440.0];
    const root = roots[seed % roots.length];
    [0, 7, 12, 16, 19, 24].forEach((semi, i) => {
      const f = root * Math.pow(2, semi / 12);
      this._note(f, i * 0.13, 2.2, 0.16);
      this._note(f * 2, i * 0.13, 1.2, 0.04, 'triangle');
    });
  }

  pluck() {
    if (!this.ctx) return;
    this._note(880, 0, 0.5, 0.14, 'triangle');
    this._note(1318.5, 0.09, 0.7, 0.12, 'triangle');
  }

  coin() {
    if (!this.ctx) return;
    this._note(1567.98, 0, 0.18, 0.09, 'square');
    this._note(2093, 0.07, 0.35, 0.08, 'square');
  }

  ding(n = 0) {
    if (!this.ctx) return;
    this._note(659.25 * Math.pow(2, n / 12), 0, 0.6, 0.14, 'triangle');
  }

  fanfare() {
    if (!this.ctx) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this._note(f, i * 0.12, 0.9, 0.13, 'triangle'));
    this._note(1046.5, 0.55, 1.6, 0.12, 'sine');
  }

  fail() {
    if (!this.ctx) return;
    [392, 349.23, 293.66].forEach((f, i) => this._note(f, i * 0.16, 0.5, 0.1, 'triangle'));
  }

  thunder() {
    if (!this.ctx) return;
    const f = this._burst('lowpass', 180, 3.2, 0.9, 0.5, this.noiseBuf);
    f.frequency.setTargetAtTime(60, this.ctx.currentTime, 1.2);
  }

  splash(v = 1) { if (this.ctx) this._burst('bandpass', 900, 0.5, 0.25 * v, 0.6); }
  plop() { if (this.ctx) { this._note(320, 0, 0.12, 0.12); this._burst('bandpass', 1400, 0.15, 0.1, 2); } }
  whoosh() { if (this.ctx) { const f = this._burst('bandpass', 600, 0.45, 0.12, 1.2); f.frequency.exponentialRampToValueAtTime(2200, this.ctx.currentTime + 0.4); } }
  bite() { if (this.ctx) { this._burst('bandpass', 1100, 0.3, 0.3, 1); this._note(740, 0, 0.2, 0.12, 'square'); } }
  reel(ok) { if (this.ctx) this._note(ok ? 988 : 220, 0, 0.15, 0.1, ok ? 'triangle' : 'sawtooth'); }

  thud(strength = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.min(0.5, 0.15 + strength * 0.02), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.7, this.ctx.currentTime, 0.05);
    return this.muted;
  }
}
