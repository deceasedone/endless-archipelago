import * as THREE from 'three';
import { clamp, lerp } from './utils.js';
import { waveHeight, WAVE_GLSL } from './ocean.js';
import { FISH, RARITY } from './data.js';
import { createFish, animateFish, createShadow, RARITY_SHADOW } from './fishmodels.js';

// ---------------------------------------------------------------------------
// Fishing spots: patches of disturbed water with circling shadows and fish
// that leap now and then. Fishing inside one bites faster and rarer.
// ---------------------------------------------------------------------------
const SPOT_R = 11;
const rippleGeo = new THREE.RingGeometry(0.01, SPOT_R, 40, 6);
rippleGeo.rotateX(-Math.PI / 2);

function rippleMaterial(env, color) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: env.uTime, uWaveAmp: env.uWaveAmp, uColor: { value: new THREE.Color(color) }, uAlpha: { value: 0 } },
    transparent: true, depthWrite: false,
    vertexShader: `
      uniform float uTime; varying vec2 vP;
      ${WAVE_GLSL}
      void main() { vP = position.xz / ${SPOT_R.toFixed(1)};
        vec4 wp = modelMatrix * vec4(position, 1.0); wp.y = waveH(wp.xz, uTime) + 0.06;
        gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `
      uniform float uTime, uAlpha; uniform vec3 uColor; varying vec2 vP;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        float d = length(vP);
        float ring = smoothstep(0.82, 1.0, sin(d * 22.0 - uTime * 3.2)) * (1.0 - smoothstep(0.55, 1.0, d));
        vec2 cell = floor(vP * 9.0);
        float h = hash(cell);
        float bub = step(0.86, h) * smoothstep(0.35, 0.0, length(fract(vP * 9.0) - 0.5)) * (0.5 + 0.5 * sin(uTime * 5.0 + h * 40.0));
        float a = (ring * 0.55 + bub * 0.8) * (1.0 - smoothstep(0.7, 1.0, d)) * uAlpha;
        gl_FragColor = vec4(uColor, a);
      }`,
  });
}

const SPOT_POOL = {
  school: ['sardine', 'mackerel', 'tuna', 'snapper', 'flyingfish'],
  glimmer: ['lantern', 'starfish', 'koi', 'manta'],
};

class Spots {
  constructor(scene, env, splash, wake) {
    Object.assign(this, { scene, env, splash, wake });
    this.list = [];
  }

  _spawn(bp, islands, night) {
    for (let tries = 0; tries < 10; tries++) {
      const a = Math.random() * Math.PI * 2, d = 140 + Math.random() * 300;
      const x = bp.x + Math.sin(a) * d, z = bp.z + Math.cos(a) * d;
      if (!islands.every((i) => Math.hypot(i.x - x, i.z - z) > i.shoreR + 30)) continue;
      const type = (night > 0.6 && Math.random() < 0.5) || Math.random() < 0.15 ? 'glimmer' : 'school';
      const ripple = new THREE.Mesh(rippleGeo, rippleMaterial(this.env, type === 'glimmer' ? '#ffe08a' : '#ffffff'));
      ripple.position.set(x, 0, z);
      ripple.renderOrder = 2;
      ripple.frustumCulled = false;
      const shadows = Array.from({ length: 3 }, (_, i) => {
        const s = createShadow(WAVE_GLSL, this.env);
        s.material.uniforms.uColor = { value: new THREE.Color(type === 'glimmer' ? '#2a1c4a' : '#06243a') };
        s.userData = { r: 2.5 + i * 1.6, sp: (0.35 + Math.random() * 0.3) * (i % 2 ? 1 : -1), a: Math.random() * 6.28, sc: 1 + Math.random() * 0.8 };
        this.scene.add(s);
        return s;
      });
      this.scene.add(ripple);
      this.list.push({ x, z, type, ripple, shadows, left: 3, fade: 0, dying: false, jumpT: 2 + Math.random() * 3, jump: null });
      return;
    }
  }

  _remove(s) {
    this.scene.remove(s.ripple);
    s.ripple.material.dispose();
    for (const sh of s.shadows) { this.scene.remove(sh); sh.material.dispose(); }
    if (s.jump) this.scene.remove(s.jump.mesh);
    this.list.splice(this.list.indexOf(s), 1);
  }

  nearest(pos, within = Infinity) {
    let best = null, bd = within;
    for (const s of this.list) {
      if (s.dying) continue;
      const d = Math.hypot(s.x - pos.x, s.z - pos.z);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  consume(s) { if (s && --s.left <= 0) s.dying = true; }

  update(bp, dt, time, islands, night) {
    if (this.list.filter((s) => !s.dying).length < 3) this._spawn(bp, islands, night);
    for (const s of [...this.list]) {
      const d = Math.hypot(s.x - bp.x, s.z - bp.z);
      if (d > 750) s.dying = true;
      s.fade = clamp(s.fade + (s.dying ? -dt : dt) * 0.5, 0, 1);
      if (s.dying && s.fade <= 0) { this._remove(s); continue; }
      s.ripple.material.uniforms.uAlpha.value = s.fade;
      for (const sh of s.shadows) {
        const u = sh.userData;
        u.a += u.sp * dt;
        sh.position.set(s.x + Math.cos(u.a) * u.r, 0, s.z + Math.sin(u.a) * u.r);
        sh.rotation.y = Math.atan2(-Math.sin(u.a) * Math.sign(u.sp), Math.cos(u.a) * Math.sign(u.sp));
        sh.scale.setScalar(u.sc * 1.6);
        sh.material.uniforms.uAlpha.value = 0.42 * s.fade;
      }
      // A fish breaks the surface now and then: the tell of a good spot.
      if (d < 500) {
        s.jumpT -= dt;
        if (s.jumpT <= 0 && !s.jump && s.fade > 0.5) {
          s.jumpT = 2.5 + Math.random() * 4;
          const pool = SPOT_POOL[s.type];
          const mesh = createFish(pool[Math.floor(Math.random() * pool.length)]);
          mesh.scale.setScalar(s.type === 'glimmer' ? 2.2 : 1.6 + Math.random());
          const a = Math.random() * 6.28, r = Math.random() * 5;
          const h = Math.random() * 6.28;
          s.jump = { mesh, t: 0, x: s.x + Math.cos(a) * r, z: s.z + Math.sin(a) * r, h, L: 2 + Math.random() * 2 };
          this.scene.add(mesh);
          this.splash.burst(s.jump.x, waveHeight(s.jump.x, s.jump.z, time), s.jump.z, 8, 4, 1.5, 0.8);
        }
        if (s.jump) {
          const j = s.jump;
          j.t += dt / 1.1;
          const k = clamp(j.t, 0, 1);
          const x = j.x + Math.sin(j.h) * j.L * k, z = j.z + Math.cos(j.h) * j.L * k;
          j.mesh.position.set(x, waveHeight(x, z, time) - 0.3 + Math.sin(k * Math.PI) * 2.6, z);
          j.mesh.rotation.set(-Math.cos(k * Math.PI) * 0.9, j.h, Math.sin(k * 7) * 0.2, 'YXZ');
          animateFish(j.mesh, time, { speed: 14 });
          if (j.t >= 1) {
            this.splash.burst(x, waveHeight(x, z, time), z, 10, 4.5, 1.8, 0.8);
            this.wake.emit(x, z, 0.5, 3, 1.2);
            this.scene.remove(j.mesh);
            s.jump = null;
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Cast → a shadow swims up → nibbles → bite → timing minigame → the fish
// leaps out of the water onto the deck (or the one that got away).
// ---------------------------------------------------------------------------
export class Fishing {
  constructor(scene, env, audio, splash, wake, events) {
    Object.assign(this, { scene, env, audio, splash, wake, events });
    this.state = 'idle';
    this.spots = new Spots(scene, env, splash, wake);
    const bob = new THREE.Group();
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#e0473a', emissive: '#e0473a', emissiveIntensity: 0.5 }));
    const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ffffff' }));
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5), new THREE.MeshStandardMaterial({ color: '#ffe08a', emissive: '#ffb000', emissiveIntensity: 0.6 }));
    stick.position.y = 0.3;
    bob.add(top, bottom, stick);
    bob.visible = false;
    this.bobber = bob;
    scene.add(bob);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 12), 3));
    this.line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: '#f5f2ea', transparent: true, opacity: 0.75 }));
    this.line.frustumCulled = false;
    this.line.visible = false;
    scene.add(this.line);
    this.shadow = createShadow(WAVE_GLSL, env);
    this.shadow.visible = false;
    scene.add(this.shadow);
    this.leap = null;
  }

  get busy() { return this.state !== 'idle'; }

  // env: { shallows, deep, night, storm, rod }
  action(boat, env) {
    if (this.state === 'idle') return this._cast(boat, env);
    if (this.state === 'waiting') return this._reset('You reel in an empty line.');
    if (this.state === 'bite') return this._hook();
    if (this.state === 'reel') return this._strike();
    return null;
  }

  _cast(boat, env) {
    if (Math.abs(boat.speed) > 3) return 'Slow down to cast a line';
    this.env = env;
    this.state = 'casting';
    this.t = 0;
    const side = Math.random() < 0.5 ? -1 : 1;
    let a = boat.heading + Math.PI + side * 0.5;
    let d = 9 + Math.random() * 4;
    // Aim for a fishing spot if one is close.
    const spot = this.spots.nearest(boat.position, 40);
    if (spot) {
      const dx = spot.x - boat.position.x, dz = spot.z - boat.position.z;
      a = Math.atan2(dx, dz);
      d = clamp(Math.hypot(dx, dz), 6, 22);
    }
    this.spot = spot && Math.hypot(spot.x - boat.position.x, spot.z - boat.position.z) < 40 ? spot : null;
    this.target = { x: boat.position.x + Math.sin(a) * d, z: boat.position.z + Math.cos(a) * d };
    this.bobber.visible = true;
    this.line.visible = true;
    this.audio.whoosh();
    return null;
  }

  _pick() {
    const e = this.env;
    const rod = e.rod || 0;
    const sp = this.spot ? (this.spot.type === 'glimmer' ? 2 : 1) : 0;
    const w = { common: 62 - rod * 8 - sp * 14, uncommon: 26 + rod * 2 + sp * 4, rare: 10 + rod * 4 + sp * 6, legendary: 2 + rod * 1.6 + sp * 2.5 };
    let r = Math.random() * (w.common + w.uncommon + w.rare + w.legendary);
    let rarity = 'common';
    for (const k of ['legendary', 'rare', 'uncommon', 'common']) { if (r < w[k]) { rarity = k; break; } r -= w[k]; }
    const ok = (f) => f.where === 'any' || (f.where === 'shallows' && e.shallows) || (f.where === 'deep' && e.deep) || (f.where === 'night' && e.night) || (f.where === 'storm' && e.storm);
    let pool = FISH.filter((f) => f.rarity === rarity && ok(f) && !f.junk);
    if (rarity === 'common' && !this.spot && Math.random() < 0.12) pool = FISH.filter((f) => f.junk);
    if (!pool.length) pool = FISH.filter((f) => f.rarity === 'common' && ok(f) && !f.junk);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  _hook() {
    this.state = 'reel';
    const r = RARITY[this.fish.rarity];
    const rod = this.env.rod || 0;
    this.zoneW = r.zone * (1 + rod * 0.15);
    this.zoneC = 0.2 + Math.random() * 0.6;
    this.marker = 0;
    this.dir = 1;
    this.speed = r.speed * 0.75;
    this.hits = 0;
    this.misses = 0;
    this.need = this.fish.rarity === 'legendary' ? 4 : 3;
    this.t = 0;
    this.thrashT = 0;
    this.audio.splash(0.6);
    this._burst(14, 5);
    this._ui();
    return null;
  }

  _burst(n, p, size = 0.9) {
    const b = this.bobber.position;
    this.splash.burst(b.x, b.y, b.z, n, p, 1.8, size);
  }

  _strike() {
    const inZone = Math.abs(this.marker - this.zoneC) < this.zoneW / 2;
    if (inZone) {
      this.hits++;
      this.audio.reel(true);
      this._burst(10, 5);
      this.zoneC = 0.15 + Math.random() * 0.7;
      this.speed *= 1.12;
      if (this.hits >= this.need) { this._land(); return null; }
    } else {
      this.misses++;
      this.audio.reel(false);
      this.pull = 1;
      if (this.misses >= 3) { this._escape(); return null; }
    }
    this._ui();
    return null;
  }

  _land() {
    const f = this.fish;
    this.size = Math.round(f.min + (f.max - f.min) * Math.pow(Math.random(), 1.6));
    this.state = 'landing';
    this.events.onUI(null);
    const mesh = createFish(f.id);
    const scale = clamp(0.6 + (this.size / 100) * 0.9, 0.6, 3.6);
    mesh.scale.setScalar(scale);
    this.scene.add(mesh);
    this.leap = { mesh, t: 0, from: this.bobber.position.clone() };
    this.shadow.visible = false;
    this.bobber.visible = false;
    this._burst(26, 8, 1.2);
    this.wake.emit(this.leap.from.x, this.leap.from.z, 0.8, 4, 1.4);
    this.audio.splash(1.2);
    if (this.spot) this.spots.consume(this.spot);
  }

  _escape() {
    const f = this.fish;
    this.shadowFlee = { t: 0, dir: Math.random() * Math.PI * 2 };
    this._burst(12, 4);
    this.events.onEscape(f);
    this._reset(null, true);
  }

  _reset(msg, keepShadow = false) {
    this.state = 'idle';
    this.bobber.visible = false;
    this.line.visible = false;
    if (!keepShadow) { this.shadow.visible = false; this.shadowFlee = null; }
    this.events.onUI(null);
    return msg;
  }

  cancel(msg) { if (this.state !== 'idle' && this.state !== 'landing') { this._reset(); return msg; } return null; }

  _ui() {
    this.events.onUI({
      state: this.state, fish: this.fish, rarity: this.fish && RARITY[this.fish.rarity],
      marker: this.marker, zoneC: this.zoneC, zoneW: this.zoneW, hits: this.hits, misses: this.misses, need: this.need, spot: !!this.spot,
    });
  }

  _placeShadow(x, z, heading, alpha, wiggle) {
    const s = this.shadow;
    s.visible = true;
    s.position.set(x, 0, z);
    s.rotation.y = heading;
    s.scale.setScalar(this.shadowScale);
    s.material.uniforms.uAlpha.value = alpha;
    s.material.uniforms.uWiggle.value = wiggle;
  }

  update(boat, dt, time, ctx) {
    this.spots.update(boat.position, dt, time, ctx.islands, ctx.night);

    // The catch flies out of the water and onto the deck.
    if (this.leap) {
      const L = this.leap;
      L.t += dt / 0.95;
      const k = clamp(L.t, 0, 1);
      const to = boat.position.clone().add(new THREE.Vector3(0, 2.4, 0));
      const p = L.from.clone().lerp(to, k);
      p.y += Math.sin(k * Math.PI) * 5.5;
      L.mesh.position.copy(p);
      L.mesh.rotation.set(-0.9 + k * 1.8, Math.atan2(to.x - L.from.x, to.z - L.from.z), k * Math.PI * 2, 'YXZ');
      animateFish(L.mesh, time, { speed: 22, amp: 0.12 });
      if (k >= 1) {
        this.scene.remove(L.mesh);
        this.leap = null;
        this.splash.burst(to.x, to.y - 0.5, to.z, 8, 3, 1.2, 0.6);
        this.state = 'idle';
        this.line.visible = false;
        this.events.onCatch(this.fish, this.size);
      }
      return null;
    }

    // A spooked fish darts away.
    if (this.shadowFlee) {
      const f = this.shadowFlee;
      f.t += dt;
      const s = this.shadow;
      s.position.x += Math.sin(f.dir) * 14 * dt;
      s.position.z += Math.cos(f.dir) * 14 * dt;
      s.rotation.y = f.dir;
      s.material.uniforms.uAlpha.value = Math.max(0, 0.6 * (1 - f.t));
      s.material.uniforms.uWiggle.value = 22;
      if (f.t > 1) { this.shadowFlee = null; s.visible = false; }
    }

    if (this.state === 'idle' || this.state === 'landing') return null;
    if (Math.abs(boat.speed) > 5) { this.events.onEscape(null); this._reset(); return 'You sailed off and the line snapped'; }
    this.t += dt;
    const bp = boat.position;
    let bx = this.target.x, bz = this.target.z, by = waveHeight(bx, bz, time);
    if (this.state === 'casting') {
      const k = clamp(this.t / 0.8, 0, 1);
      bx = bp.x + (this.target.x - bp.x) * k; bz = bp.z + (this.target.z - bp.z) * k;
      by = waveHeight(bx, bz, time) + Math.sin(k * Math.PI) * 5 + (1 - k) * 2;
      if (k >= 1) {
        this.state = 'waiting'; this.t = 0;
        this.fish = this._pick();
        this.wait = (this.spot ? 2.5 + Math.random() * 2.5 : 3.5 + Math.random() * 5) * (1 - (this.env.rod || 0) * 0.12);
        this.audio.plop();
        this.splash.burst(bx, by, bz, 8, 3, 1.2, 0.6);
        this.wake.emit(bx, bz, 0.4, 2.2, 1);
        this.approachDir = Math.random() * Math.PI * 2;
        this.shadowScale = this.fish.junk ? 1.1 : RARITY_SHADOW[this.fish.rarity] * (0.85 + Math.random() * 0.3);
        this.nibbles = 0;
        this.events.onUI({ state: 'waiting', spot: !!this.spot });
      }
    } else if (this.state === 'waiting') {
      by += Math.sin(time * 3) * 0.05;
      // The shadow glides in from the deep, then noses the bobber.
      const approach = Math.max(0.5, this.wait - 1.6);
      const k = clamp(this.t / approach, 0, 1);
      const e = 1 - Math.pow(1 - k, 2);
      const len = this.shadowScale * 0.5;
      const sx = bx + Math.sin(this.approachDir) * (10 + len), sz = bz + Math.cos(this.approachDir) * (10 + len);
      const hx = bx + Math.sin(this.approachDir) * len * 1.05, hz = bz + Math.cos(this.approachDir) * len * 1.05;
      let x = lerp(sx, hx, e), z = lerp(sz, hz, e);
      const facing = this.approachDir + Math.PI;
      if (k >= 1) {
        const nib = Math.max(0, Math.sin((this.t - approach) * 7));
        x -= Math.sin(this.approachDir) * nib * 0.6; z -= Math.cos(this.approachDir) * nib * 0.6;
        by -= nib * 0.12;
        const count = Math.floor((this.t - approach) * 7 / Math.PI);
        if (count > this.nibbles) { this.nibbles = count; this.wake.emit(bx, bz, 0.3, 1.6, 0.7); this.audio.plop(); }
      } else {
        x += Math.cos(this.approachDir) * Math.sin(this.t * 1.7) * 1.2 * (1 - e);
        z -= Math.sin(this.approachDir) * Math.sin(this.t * 1.7) * 1.2 * (1 - e);
      }
      if (!this.fish.junk) this._placeShadow(x, z, facing, 0.55 * clamp(this.t / 1.2, 0, 1), 6);
      if (this.t > this.wait) {
        this.state = 'bite'; this.t = 0;
        this.audio.bite();
        this._burst(16, 5);
        this.wake.emit(bx, bz, 0.6, 3.2, 1.2);
        this.events.onUI({ state: 'bite' });
      }
    } else if (this.state === 'bite') {
      by -= 0.45 + Math.sin(time * 40) * 0.1;
      if (!this.fish.junk) this._placeShadow(this.shadow.position.x, this.shadow.position.z, this.shadow.rotation.y + Math.sin(time * 30) * 0.05, 0.62, 18);
      if (this.t > 1.3) { this._escape(); return 'Too slow, it slipped the hook'; }
    } else if (this.state === 'reel') {
      this.pull = Math.max(0, (this.pull || 0) - dt * 2);
      by -= 0.2 + Math.sin(time * 25) * 0.12;
      const r = 1.2 + this.pull * 2.5;
      const a = time * 3.2;
      bx += Math.sin(time * 2.3) * 0.6; bz += Math.cos(time * 1.7) * 0.6;
      if (!this.fish.junk) this._placeShadow(bx + Math.sin(a) * r, bz + Math.cos(a) * r, a + Math.PI / 2 + Math.sin(time * 9) * 0.4, 0.62, 20);
      this.thrashT -= dt;
      if (this.thrashT <= 0) { this.thrashT = 0.45 + Math.random() * 0.4; this.splash.burst(bx + Math.sin(a) * r, by, bz + Math.cos(a) * r, 6, 3.5, 1.4, 0.7); }
      this.marker += this.dir * this.speed * dt;
      if (this.marker > 1) { this.marker = 1; this.dir = -1; }
      if (this.marker < 0) { this.marker = 0; this.dir = 1; }
      if (this.t > 14) { this._escape(); return null; }
      this._ui();
    }
    this.bobber.position.set(bx, by, bz);
    // A sagging line from the stern to the bobber.
    const P = this.line.geometry.attributes.position;
    const sx = bp.x - Math.sin(boat.heading) * 3.2, sz = bp.z - Math.cos(boat.heading) * 3.2, sy = bp.y + 2.4;
    const tension = this.state === 'reel' || this.state === 'bite' ? 0.1 : 1;
    for (let i = 0; i < 12; i++) {
      const k = i / 11;
      P.setXYZ(i, lerp(sx, bx, k), lerp(sy, by + 0.2, k) - Math.sin(k * Math.PI) * 0.9 * tension, lerp(sz, bz, k));
    }
    P.needsUpdate = true;
    return null;
  }
}
