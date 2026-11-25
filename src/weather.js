import * as THREE from 'three';
import { Builder, clamp, lerp, mulberry32 } from './utils.js';

const KINDS = {
  clear: { name: 'Clear skies', storm: 0, fog: 0, wind: 0.55 },
  breezy: { name: 'Fresh breeze', storm: 0.12, fog: 0, wind: 0.9 },
  fog: { name: 'Fog bank', storm: 0.05, fog: 1, wind: 0.3 },
  storm: { name: 'Storm', storm: 1, fog: 0.25, wind: 1 },
};

// Weather, wind, clouds, rain and lightning.
export class Weather {
  constructor(scene, audio) {
    this.scene = scene;
    this.audio = audio;
    this.kind = 'clear';
    this.timer = 150; // a calm first few minutes
    this.storm = 0;
    this.fog = 0;
    this.windDir = Math.PI * 0.15;
    this.windTarget = this.windDir;
    this.windStrength = 0.55;
    this.flash = 0;
    this.boltT = 6;
    this.thunderQ = [];
    this.forced = null;
    this._makeClouds();
    this._makeRain();
  }

  get name() { return KINDS[this.kind].name; }

  force(kind) {
    this.kind = kind;
    this.timer = 180;
  }

  _next() {
    const r = Math.random();
    const prev = this.kind;
    this.kind = r < 0.38 ? 'clear' : r < 0.62 ? 'breezy' : r < 0.78 ? 'fog' : 'storm';
    if (this.kind === prev && prev === 'storm') this.kind = 'clear';
    this.timer = 90 + Math.random() * 120;
    this.windTarget = this.windDir + (Math.random() - 0.5) * 2.2;
    return this.kind !== prev;
  }

  _makeClouds() {
    const rng = mulberry32(42);
    const geos = [];
    for (let g = 0; g < 5; g++) {
      const b = new Builder(rng);
      const puffs = 5 + Math.floor(rng() * 5);
      const m = new THREE.Matrix4();
      for (let i = 0; i < puffs; i++) {
        const s = 9 + rng() * 14;
        const x = (i - puffs / 2) * 11 + (rng() - 0.5) * 8;
        m.compose(new THREE.Vector3(x, (rng() - 0.3) * 6, (rng() - 0.5) * 14), new THREE.Quaternion(), new THREE.Vector3(s * 1.3, s * 0.7, s));
        b.add(new THREE.IcosahedronGeometry(1, 1), m, new THREE.Color(1, 1, 1), 0.05);
      }
      geos.push(b.build());
    }
    this.cloudMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: '#ffffff', emissiveIntensity: 0.35 });
    this.clouds = [];
    for (let i = 0; i < 26; i++) {
      const mesh = new THREE.Mesh(geos[i % geos.length], this.cloudMat);
      const a = rng() * Math.PI * 2, d = 200 + rng() * 1100;
      mesh.position.set(Math.cos(a) * d, 150 + rng() * 90, Math.sin(a) * d);
      mesh.rotation.y = rng() * 6.28;
      mesh.userData.h = mesh.position.y;
      mesh.scale.setScalar(0.8 + rng() * 0.9);
      this.scene.add(mesh);
      this.clouds.push(mesh);
    }
  }

  _makeRain() {
    const N = 2200;
    this.rainN = N;
    this.rainPos = new Float32Array(N * 6);
    this.rainSeed = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      this.rainSeed[i * 3] = (Math.random() - 0.5) * 140;
      this.rainSeed[i * 3 + 1] = Math.random() * 70;
      this.rainSeed[i * 3 + 2] = (Math.random() - 0.5) * 140;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.rainMat = new THREE.LineBasicMaterial({ color: '#e6efff', transparent: true, opacity: 0, depthWrite: false });
    this.rain = new THREE.LineSegments(geo, this.rainMat);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.scene.add(this.rain);
    this.rainFall = 0;
  }

  /** Returns true when the weather kind changed this frame. */
  update(dt, camPos, boatPos, day) {
    let changed = false;
    this.timer -= dt;
    if (this.timer <= 0) changed = this._next();
    const K = KINDS[this.kind];
    const k = Math.min(1, dt * 0.06);
    this.storm = lerp(this.storm, K.storm, k);
    this.fog = lerp(this.fog, K.fog, k);
    this.windStrength = lerp(this.windStrength, K.wind, k);
    this.windTarget += (Math.random() - 0.5) * dt * 0.02;
    let dw = this.windTarget - this.windDir;
    dw = Math.atan2(Math.sin(dw), Math.cos(dw));
    this.windDir += dw * Math.min(1, dt * 0.05);

    // Lightning
    this.flash = Math.max(0, this.flash - dt * 3.5);
    if (this.storm > 0.7) {
      this.boltT -= dt;
      if (this.boltT <= 0) {
        this.boltT = 3 + Math.random() * 9;
        this.flash = 1;
        this.thunderQ.push(0.4 + Math.random() * 1.8);
      }
    }
    for (let i = this.thunderQ.length - 1; i >= 0; i--) {
      this.thunderQ[i] -= dt;
      if (this.thunderQ[i] <= 0) { this.audio.thunder(); this.thunderQ.splice(i, 1); }
    }
    const flicker = this.flash > 0 ? this.flash * (0.6 + 0.4 * Math.sin(this.flash * 60)) : 0;
    this.flashOut = flicker;

    // Clouds drift with the wind and wrap around the boat.
    const wx = Math.sin(this.windDir) * (2 + this.windStrength * 6) * dt;
    const wz = Math.cos(this.windDir) * (2 + this.windStrength * 6) * dt;
    const cloudCol = lerp(0.35, 1, day) * (1 - this.storm * 0.55);
    this.cloudMat.color.setScalar(cloudCol);
    this.cloudMat.emissive.setScalar(1).multiplyScalar(0.25 + flicker * 0.6);
    this.cloudMat.emissiveIntensity = lerp(0.05, 0.35, day) * (1 - this.storm * 0.6) + flicker;
    for (const c of this.clouds) {
      c.position.x += wx;
      c.position.z += wz;
      const dx = c.position.x - boatPos.x, dz = c.position.z - boatPos.z;
      if (dx * dx + dz * dz > 1400 * 1400) {
        c.position.x = boatPos.x - dx * 0.95;
        c.position.z = boatPos.z - dz * 0.95;
      }
      c.position.y = lerp(c.position.y, c.userData.h - this.storm * 55, Math.min(1, dt * 0.2));
    }

    // Rain
    const rainAmt = clamp((this.storm - 0.35) / 0.5, 0, 1);
    this.rain.visible = rainAmt > 0.01;
    this.rainMat.opacity = rainAmt * 0.7;
    this.audio.setRain(rainAmt);
    if (this.rain.visible) {
      this.rainFall += dt * 55;
      const sx = Math.sin(this.windDir) * 0.5, sz = Math.cos(this.windDir) * 0.5;
      const P = this.rainPos, S = this.rainSeed;
      for (let i = 0; i < this.rainN; i++) {
        const x = camPos.x + S[i * 3] + sx * 6, z = camPos.z + S[i * 3 + 2] + sz * 6;
        const y = camPos.y + 35 - ((S[i * 3 + 1] + this.rainFall) % 70);
        P[i * 6] = x; P[i * 6 + 1] = y; P[i * 6 + 2] = z;
        P[i * 6 + 3] = x + sx * 1.6; P[i * 6 + 4] = y - 1.8; P[i * 6 + 5] = z + sz * 1.6;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
    return changed;
  }
}
