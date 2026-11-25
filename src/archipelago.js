import * as THREE from 'three';
import { Builder, mulberry32, hash2, smoothstep } from './utils.js';
import { waveHeight } from './ocean.js';
import { ASPECTS, BOTTLE_KINDS } from './data.js';

export const CELL = 240;
const RADIUS = 5; // cells kept alive around the boat in each direction
const SHORE = 0.775; // fraction of island radius where sand meets the sea

const col = (hex) => new THREE.Color(hex);
const PAL = {
  wet: col('#bfa672'), sand: col('#efdca4'), grass: col('#74c24c'), jungle: col('#3f9440'),
  rock: col('#8b867a'), peak: col('#b9b4a8'), trunk: col('#8a6237'), frond: col('#2f9f52'),
  frond2: col('#57b947'), stone: col('#9a968c'), stoneDark: col('#77736b'), bush: col('#2f8a3f'),
  coconut: col('#5b3d22'), flower: col('#ff6fa8'), flower2: col('#ffd34d'),
};

const SYL_A = ['Ka', 'Mo', 'Lu', 'Ta', 'Ni', 'Vo', 'Sa', 'Ae', 'Io', 'Ha', 'Ke', 'Ra', 'Pua', 'Tei', 'Wai', 'Nu', 'Lo', 'Mi', 'Ora', 'Ulu', 'Fe', 'Ma', 'Re'];
const SYL_B = ['kai', 'lani', 'moa', 'nui', 'ro', 'ta', 'vea', 'lua', 'hiva', 'ri', 'na', 'tu', 'maru', 'peke', 'tea', 'oko'];
const FORMS = [(n) => `Isle of ${n}`, (n) => `${n} Atoll`, (n) => `${n} Cay`, (n) => `Motu ${n}`, (n) => `${n} Reef`, (n) => `Port ${n}`, (n) => `${n} Rock`, (n) => `${n} Haven`];

export const TRIALS = {
  approach: null,
  circle: 'Sail a full circle around the island to wake its shrine',
  still: 'Drop sail and drift beside the island for a moment',
  night: 'This shrine only stirs under the stars',
};

const UP = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _a = new THREE.Vector3();
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const islandMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, side: THREE.DoubleSide });

// ---- decoration helpers ---------------------------------------------------
function addPalm(b, rng, x, y, z, scale) {
  const h = (5 + rng() * 3.5) * scale;
  const segs = 5;
  const la = rng() * Math.PI * 2;
  const bend = (0.8 + rng() * 2.4) * scale;
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    pts.push(V(x + Math.cos(la) * bend * t * t, y - 0.5 + h * t, z + Math.sin(la) * bend * t * t));
  }
  for (let i = 0; i < segs; i++) {
    const a = pts[i], c = pts[i + 1];
    _a.subVectors(c, a);
    const len = _a.length();
    _q.setFromUnitVectors(UP, _a.normalize());
    const r0 = 0.3 * scale * (1 - 0.45 * (i / segs));
    const r1 = 0.3 * scale * (1 - 0.45 * ((i + 1) / segs));
    _m.compose(a.clone().add(c).multiplyScalar(0.5), _q, _s);
    b.add(new THREE.CylinderGeometry(r1, r0 * 1.12, len * 1.04, 5, 1, true), _m, PAL.trunk, 0.1);
  }
  const top = pts[segs];
  const n = 6 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + rng() * 0.5;
    const L = (3.3 + rng() * 1.4) * scale;
    const dx = Math.cos(ang), dz = Math.sin(ang);
    const c = rng() < 0.5 ? PAL.frond : PAL.frond2;
    let pl = null, pr = null;
    for (let k = 0; k <= 4; k++) {
      const t = k / 4;
      const px = top.x + dx * L * t, pz = top.z + dz * L * t;
      const py = top.y + L * 0.4 * t - L * 0.85 * t * t;
      const w = 0.8 * scale * Math.sin(Math.PI * (0.12 + 0.88 * t));
      const l = V(px - dz * w, py - 0.15 * w, pz + dx * w);
      const r = V(px + dz * w, py - 0.15 * w, pz - dx * w);
      if (pl) b.quad(pl, l, r, pr, c, 0.12);
      pl = l; pr = r;
    }
  }
  for (let i = 0; i < 2; i++) {
    _m.makeTranslation(top.x + (rng() - 0.5) * 0.6, top.y - 0.35, top.z + (rng() - 0.5) * 0.6);
    b.add(new THREE.IcosahedronGeometry(0.26 * scale, 0), _m, PAL.coconut, 0.1);
  }
}

function addBlob(b, rng, x, y, z, sx, sy, sz, color) {
  _q.setFromEuler(new THREE.Euler(rng() * 3, rng() * 3, rng() * 3));
  _m.compose(V(x, y, z), _q, V(sx, sy, sz));
  b.add(new THREE.IcosahedronGeometry(1, 0), _m, color, 0.12);
}

function addShrineStone(b, rng, y) {
  _m.makeTranslation(0, y + 0.15, 0);
  b.add(new THREE.CylinderGeometry(3.7, 4.2, 0.8, 8), _m, PAL.stone, 0.08);
  _m.makeTranslation(0, y + 0.8, 0);
  b.add(new THREE.CylinderGeometry(2.6, 3.0, 0.5, 8), _m, PAL.stoneDark, 0.08);
  _m.makeTranslation(0, y + 1.65, 0);
  b.add(new THREE.CylinderGeometry(0.45, 0.85, 1.3, 6), _m, PAL.stone, 0.08);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const broken = rng() < 0.3;
    const ph = broken ? 1.6 + rng() : 3.6;
    const px = Math.cos(a) * 3.0, pz = Math.sin(a) * 3.0;
    _q.setFromEuler(new THREE.Euler((rng() - 0.5) * 0.14, a, (rng() - 0.5) * 0.14));
    _m.compose(V(px, y + 0.5 + ph / 2, pz), _q, _s);
    b.add(new THREE.BoxGeometry(0.75, ph, 0.75), _m, PAL.stone, 0.1);
    if (!broken) {
      _m.compose(V(px, y + 0.5 + ph + 0.15, pz), _q, _s);
      b.add(new THREE.BoxGeometry(1.1, 0.3, 1.1), _m, PAL.stoneDark, 0.1);
    }
  }
}

// ---- shared dynamic bits --------------------------------------------------
const crystalGeo = new THREE.OctahedronGeometry(0.95, 0);
const beamGeo = new THREE.CylinderGeometry(3.2, 0.7, 280, 10, 1, true);
beamGeo.translate(0, 140, 0);
const ringGeo = new THREE.RingGeometry(0.9, 1.0, 48);
ringGeo.rotateX(-Math.PI / 2);

export function makeBeamMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uIntensity: { value: 0.2 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uIntensity; varying vec2 vUv;
      void main(){ float a = pow(1.0 - vUv.y, 1.6) * uIntensity; gl_FragColor = vec4(uColor * a, a);
      #include <colorspace_fragment>
      }`,
  });
}

const bottleAssets = {};
function bottleAsset(kind) {
  if (bottleAssets[kind]) return bottleAssets[kind];
  const def = BOTTLE_KINDS[kind];
  const b = new Builder();
  const glass = col(def.glass), cork = col('#c9a36a'), paper = col(kind === 'map' ? '#e8cf98' : '#fff3d0');
  b.add(new THREE.CylinderGeometry(0.34, 0.34, 0.95, 6), null, glass, 0.08);
  b.add(new THREE.CylinderGeometry(0.12, 0.3, 0.45, 6), _m.makeTranslation(0, 0.7, 0), glass, 0.08);
  b.add(new THREE.CylinderGeometry(0.13, 0.13, 0.2, 5), _m.makeTranslation(0, 1.0, 0), cork, 0.05);
  b.add(new THREE.CylinderGeometry(0.16, 0.16, 0.6, 5), null, paper, 0.02);
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, emissive: def.glow,
    emissiveIntensity: kind === 'golden' ? 1.4 : 0.6, roughness: 0.3, metalness: kind === 'golden' ? 0.5 : 0,
  });
  const halo = new THREE.MeshBasicMaterial({ color: kind === 'golden' ? '#ffd34d' : '#ffe89a' });
  return (bottleAssets[kind] = { geo: b.build(), mat, halo });
}
const haloGeo = new THREE.OctahedronGeometry(0.38, 0);

function pickBottleKind(r) {
  if (r < 0.04) return 'golden';
  if (r < 0.19) return 'story';
  if (r < 0.29) return 'map';
  if (r < 0.41) return 'riddle';
  if (r < 0.5) return 'shanty';
  if (r < 0.58) return 'recipe';
  if (r < 0.72) return 'letter';
  return 'musing';
}

// ---------------------------------------------------------------------------
export class Archipelago {
  constructor(scene, opts, events) {
    this.scene = scene;
    this.events = events;
    this.seed = opts.seed;
    this.cells = new Map();
    this.queue = [];
    this.islands = [];
    this.bottles = [];
    this.rings = [];
    this.awakened = new Set(opts.awakened || []);
    this.collected = new Set(opts.bottles || []);
    this.center = { cx: NaN, cz: NaN };
    this.sorted = [];
    this.sortT = 0;
    this.shrineLight = new THREE.PointLight('#ffffff', 0, 60, 1.6);
    scene.add(this.shrineLight);
    this.gulls = this._makeGulls();
  }

  dispose() {
    for (const cell of [...this.cells.values()]) this._remove(cell);
    for (const r of this.rings) { this.scene.remove(r.mesh); r.mesh.material.dispose(); }
    this.scene.remove(this.shrineLight, this.gulls.mesh);
    this.gulls.mesh.geometry.dispose();
  }

  // -- generation -----------------------------------------------------------
  _generate(cx, cz) {
    const key = `${cx},${cz}`;
    const rng = mulberry32(hash2(cx, cz, this.seed));
    const cell = { key, cx, cz, island: null, bottle: null };
    const forced = cx === 0 && cz === 1;
    const home = cx === 0 && cz === 0;
    const roll = rng();

    if (home || (!forced && roll > 0.58)) {
      if (!home && rng() < 0.6 && !this.collected.has(key)) {
        const bx = (cx + 0.2 + rng() * 0.6) * CELL, bz = (cz + 0.2 + rng() * 0.6) * CELL;
        cell.bottle = this._makeBottle(key, bx, bz, rng);
      }
      return cell;
    }

    const tr = forced ? 0.5 : rng();
    const type = tr < 0.24 ? 'sandbar' : tr < 0.8 ? 'lush' : 'peak';
    const R = type === 'sandbar' ? 22 + rng() * 12 : type === 'lush' ? 30 + rng() * 22 : 38 + rng() * 20;
    const H = type === 'sandbar' ? 0.8 + rng() * 1.6 : type === 'lush' ? 4 + rng() * 6 : 14 + rng() * 12;
    const hasShrine = forced || rng() < 0.5;
    const j = forced ? 0 : CELL / 2 - R - 14;
    const x = (cx + 0.5) * CELL + (rng() * 2 - 1) * j;
    const z = (cz + 0.5) * CELL + (rng() * 2 - 1) * j;
    const ph = [rng() * 6.28, rng() * 6.28, rng() * 6.28, rng() * 6.28];

    const radiusAt = (a) => R * (1 + 0.09 * Math.sin(a * 2 + ph[0]) + 0.05 * Math.sin(a * 3 + ph[1]));
    const heightAt = (lx, lz) => {
      const u = Math.hypot(lx, lz) / radiusAt(Math.atan2(lz, lx));
      if (u >= 1) return -5.5;
      if (u > 0.7) return 1.3 - 6.8 * Math.pow((u - 0.7) / 0.3, 1.2);
      const s = Math.min(1, (1 - u / 0.7) / 0.8);
      const sm = s * s * (3 - 2 * s);
      const n = Math.sin(lx * 0.13 + ph[2]) * Math.cos(lz * 0.11 + ph[3]) * 0.5 + 0.5;
      return 1.3 + H * sm * (0.75 + 0.5 * n * smoothstep(0.12, 0.4, u));
    };

    // Terrain: a jittered polar grid, coloured per face by altitude.
    const b = new Builder(rng);
    const RINGS = 10, SEG = 24;
    const grid = [];
    for (let i = 1; i <= RINGS; i++) {
      const row = [];
      for (let s = 0; s < SEG; s++) {
        const edge = i === RINGS;
        const u = i / RINGS + (edge ? 0 : (rng() - 0.5) * 0.045);
        const a = ((s + (i % 2) * 0.5) / SEG) * Math.PI * 2 + (rng() - 0.5) * 0.06;
        const r = u * radiusAt(a);
        const lx = Math.cos(a) * r, lz = Math.sin(a) * r;
        let y = heightAt(lx, lz);
        if (!edge && !(hasShrine && u < 0.2)) y += (rng() - 0.5) * Math.min(1.4, 0.35 + H * 0.06);
        row.push(V(lx, y, lz));
      }
      grid.push(row);
    }
    const faceColor = (a, c, d) => {
      const y = (a.y + c.y + d.y) / 3;
      if (y < 0.15) return PAL.wet;
      if (y < 2.1) return PAL.sand;
      if (type === 'sandbar') return y > 2.6 ? PAL.grass : PAL.sand;
      if (y > 19) return PAL.peak;
      if (y > 11) return PAL.rock;
      return y > 6 ? PAL.jungle : PAL.grass;
    };
    const tri = (a, c, d) => b.tri(a, c, d, faceColor(a, c, d), 0.07);
    const top = heightAt(0, 0);
    const centre = V(0, top, 0);
    for (let s = 0; s < SEG; s++) tri(centre, grid[0][(s + 1) % SEG], grid[0][s]);
    for (let i = 0; i < RINGS - 1; i++) {
      for (let s = 0; s < SEG; s++) {
        const a = grid[i][s], c = grid[i][(s + 1) % SEG];
        const d = grid[i + 1][s], e = grid[i + 1][(s + 1) % SEG];
        if (i % 2 === 0) { tri(a, c, d); tri(c, e, d); } else { tri(a, c, e); tri(a, e, d); }
      }
    }

    // Vegetation, flowers and rocks.
    const palms = type === 'sandbar' ? 1 + Math.floor(rng() * 3) : type === 'lush' ? 5 + Math.floor(rng() * 7) : 3 + Math.floor(rng() * 5);
    for (let i = 0, tries = 0; i < palms && tries < 60; tries++) {
      const a = rng() * 6.28, u = 0.16 + rng() * 0.5;
      const lx = Math.cos(a) * u * R, lz = Math.sin(a) * u * R;
      const y = heightAt(lx, lz);
      if (y < 1.5 || y > 10.5 || (hasShrine && u < 0.3)) continue;
      addPalm(b, rng, lx, y, lz, 0.85 + rng() * 0.5);
      i++;
    }
    const rocks = 2 + Math.floor(rng() * 5);
    for (let i = 0; i < rocks; i++) {
      const a = rng() * 6.28, u = 0.55 + rng() * 0.38;
      const lx = Math.cos(a) * u * R, lz = Math.sin(a) * u * R;
      const s = 0.7 + rng() * 1.8;
      addBlob(b, rng, lx, heightAt(lx, lz) + s * 0.2, lz, s, s * (0.6 + rng() * 0.5), s * (0.8 + rng() * 0.5), PAL.rock);
    }
    if (type !== 'sandbar') {
      const bushes = 3 + Math.floor(rng() * 6);
      for (let i = 0; i < bushes; i++) {
        const a = rng() * 6.28, u = 0.2 + rng() * 0.4;
        const lx = Math.cos(a) * u * R, lz = Math.sin(a) * u * R;
        const y = heightAt(lx, lz);
        if (y < 2.2 || y > 11 || (hasShrine && u < 0.28)) continue;
        const s = 0.8 + rng() * 0.9;
        addBlob(b, rng, lx, y + s * 0.3, lz, s * 1.2, s * 0.8, s * 1.2, PAL.bush);
        if (rng() < 0.6) {
          const fc = rng() < 0.5 ? PAL.flower : PAL.flower2;
          for (let f = 0; f < 3; f++) addBlob(b, rng, lx + (rng() - 0.5) * s * 2, y + s * 0.9, lz + (rng() - 0.5) * s * 2, 0.22, 0.22, 0.22, fc);
        }
      }
    }
    if (hasShrine) addShrineStone(b, rng, top);

    const root = new THREE.Group();
    root.position.set(x, 0, z);
    const mesh = new THREE.Mesh(b.build(), islandMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);

    const island = {
      key, x, z, R, H, type, shoreR: R * SHORE, root, mesh, spawn: 0,
      name: FORMS[Math.floor(rng() * FORMS.length)](SYL_A[Math.floor(rng() * SYL_A.length)] + SYL_B[Math.floor(rng() * SYL_B.length)]),
      shrine: null,
    };

    if (hasShrine) {
      const aspect = ASPECTS[Math.floor(rng() * ASPECTS.length)];
      const t = rng();
      const trial = forced ? 'approach' : t < 0.55 ? 'approach' : t < 0.75 ? 'circle' : t < 0.9 ? 'still' : 'night';
      const crystalMat = new THREE.MeshStandardMaterial({ color: '#9fb4c4', emissive: trial === 'approach' ? '#6f8fa8' : '#a8946f', emissiveIntensity: 0.5, flatShading: true, roughness: 0.25 });
      const crystal = new THREE.Mesh(crystalGeo, crystalMat);
      crystal.position.set(0, top + 3.9, 0);
      crystal.scale.set(1, 1.5, 1);
      const beam = new THREE.Mesh(beamGeo, makeBeamMaterial(trial === 'approach' ? '#cfeeff' : '#ffe6b0'));
      beam.position.set(0, top + 3.5, 0);
      beam.renderOrder = 3;
      root.add(crystal, beam);
      island.shrine = { aspect, trial, crystal, beam, awake: false, burst: 0, y: top + 3.9, phase: rng() * 6.28, progress: 0, circ: 0, lastA: null, stillT: 0, hinted: false };
      if (this.awakened.has(key)) this._setAwake(island, false);
    }

    // Some islands have a bottle drifting off their shore.
    if (rng() < 0.28 && !this.collected.has(key)) {
      const a = rng() * Math.PI * 2, d = R + 22 + rng() * 15;
      cell.bottle = this._makeBottle(key, x + Math.cos(a) * d, z + Math.sin(a) * d, rng);
    }

    cell.island = island;
    return cell;
  }

  _makeBottle(key, x, z, rng) {
    const kind = pickBottleKind(rng());
    const asset = bottleAsset(kind);
    const g = new THREE.Group();
    const body = new THREE.Mesh(asset.geo, asset.mat);
    body.rotation.z = 0.9;
    body.scale.setScalar(kind === 'golden' ? 1.9 : 1.5);
    const halo = new THREE.Mesh(haloGeo, asset.halo);
    halo.position.y = 2.6;
    g.add(body, halo);
    g.position.set(x, 0, z);
    return { key, kind, x, z, group: g, body, halo, phase: rng() * 6.28, seed: Math.floor(rng() * 1e9) };
  }

  _setAwake(island, announce) {
    const s = island.shrine;
    s.awake = true;
    s.progress = 1;
    const c = new THREE.Color(s.aspect.color);
    s.crystal.material.color.copy(c);
    s.crystal.material.emissive.copy(c);
    s.crystal.material.emissiveIntensity = 2.2;
    s.beam.material.uniforms.uColor.value.copy(c);
    if (announce) {
      s.burst = 1;
      this.awakened.add(island.key);
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
        ring.position.set(island.x, s.y - 1.5 + i * 0.6, island.z);
        ring.renderOrder = 4;
        this.scene.add(ring);
        this.rings.push({ mesh: ring, t: -i * 0.28 });
      }
      this.events.onAwaken(island);
    }
  }

  _add(cell) {
    this.cells.set(cell.key, cell);
    if (cell.island) { this.scene.add(cell.island.root); this.islands.push(cell.island); }
    if (cell.bottle) { this.scene.add(cell.bottle.group); this.bottles.push(cell.bottle); }
  }

  _remove(cell) {
    this.cells.delete(cell.key);
    if (cell.island) {
      const isl = cell.island;
      this.scene.remove(isl.root);
      isl.mesh.geometry.dispose();
      if (isl.shrine) { isl.shrine.crystal.material.dispose(); isl.shrine.beam.material.dispose(); }
      this.islands.splice(this.islands.indexOf(isl), 1);
    }
    if (cell.bottle) this._removeBottle(cell.bottle);
  }

  _removeBottle(bottle) {
    this.scene.remove(bottle.group);
    const i = this.bottles.indexOf(bottle);
    if (i >= 0) this.bottles.splice(i, 1);
  }

  // -- per-frame ------------------------------------------------------------
  // ctx: { pos, speed, night, dt, time, instant, pickupR }
  update(ctx) {
    const { pos, dt, time } = ctx;
    const ccx = Math.floor(pos.x / CELL), ccz = Math.floor(pos.z / CELL);
    if (ccx !== this.center.cx || ccz !== this.center.cz) {
      this.center = { cx: ccx, cz: ccz };
      for (const cell of [...this.cells.values()]) {
        if (Math.abs(cell.cx - ccx) > RADIUS + 1 || Math.abs(cell.cz - ccz) > RADIUS + 1) this._remove(cell);
      }
      this.queue.length = 0;
      for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        for (let dz = -RADIUS; dz <= RADIUS; dz++) {
          if (!this.cells.has(`${ccx + dx},${ccz + dz}`)) this.queue.push({ cx: ccx + dx, cz: ccz + dz, d: dx * dx + dz * dz });
        }
      }
      this.queue.sort((a, b) => b.d - a.d);
    }
    for (let n = ctx.instant ? 9999 : 2; n > 0 && this.queue.length; n--) {
      const q = this.queue.pop();
      const cell = this._generate(q.cx, q.cz);
      if (cell.island && ctx.instant) cell.island.spawn = 1;
      this._add(cell);
    }

    let nearest = null, nd = Infinity;
    for (const isl of this.islands) {
      if (isl.spawn < 1) {
        isl.spawn = Math.min(1, isl.spawn + dt / 1.6);
        const e = 1 - Math.pow(1 - isl.spawn, 3);
        isl.root.scale.set(1, Math.max(0.001, e), 1);
        isl.root.position.y = -6 * (1 - e);
      }
      const s = isl.shrine;
      if (!s) continue;
      const d = Math.hypot(pos.x - isl.x, pos.z - isl.z);
      if (d < nd) { nd = d; nearest = isl; }
      if (d > 900) continue;
      if (!s.awake && isl.spawn >= 1) this._trial(isl, s, d, ctx);
      s.burst = Math.max(0, s.burst - dt * 0.7);
      s.crystal.rotation.y += dt * (s.awake ? 1.6 : 0.4 + s.progress * 3);
      s.crystal.position.y = s.y + Math.sin(time * 1.4 + s.phase) * 0.3 + s.burst * 1.5;
      const sc = 1 + s.burst * 1.2 + (s.awake ? 0 : s.progress * 0.4);
      s.crystal.scale.set(sc, sc * 1.5, sc);
      const pulse = 0.5 + 0.5 * Math.sin(time * 2 + s.phase);
      s.beam.material.uniforms.uIntensity.value = s.awake ? 0.5 + pulse * 0.2 + s.burst * 1.2 : 0.16 + pulse * 0.06 + s.progress * 0.4;
      s.beam.scale.set(1 + s.burst * 2, 1, 1 + s.burst * 2);
    }
    if (nearest && nd < 260) {
      const s = nearest.shrine;
      this.shrineLight.position.set(nearest.x, s.y + 1, nearest.z);
      this.shrineLight.color.copy(s.crystal.material.emissive);
      this.shrineLight.intensity = (s.awake ? 160 : 35) * (1 + s.burst * 2);
    } else this.shrineLight.intensity = 0;

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      const t = Math.max(0, r.t) / 2.2;
      r.mesh.scale.setScalar(1 + t * 90);
      r.mesh.material.opacity = Math.max(0, 1 - t) * (r.t > 0 ? 1 : 0);
      if (t >= 1) { this.scene.remove(r.mesh); r.mesh.material.dispose(); this.rings.splice(i, 1); }
    }

    const pickR = ctx.pickupR || 6.5;
    for (let i = this.bottles.length - 1; i >= 0; i--) {
      const bt = this.bottles[i];
      const dx = pos.x - bt.x, dz = pos.z - bt.z;
      const d = Math.hypot(dx, dz);
      // A better net gently pulls bottles in.
      if (d < pickR * 2.2 && d > 0.1) { const pull = dt * 6; bt.x += (dx / d) * pull; bt.z += (dz / d) * pull; bt.group.position.x = bt.x; bt.group.position.z = bt.z; }
      bt.group.position.y = waveHeight(bt.x, bt.z, time) + 0.15;
      bt.body.rotation.y = time * 0.4 + bt.phase;
      bt.body.rotation.x = Math.sin(time * 1.1 + bt.phase) * 0.2;
      bt.halo.rotation.y = time * 2.5;
      bt.halo.position.y = 2.7 + Math.sin(time * 2 + bt.phase) * 0.3;
      if (d < pickR) {
        this.collected.add(bt.key);
        this._removeBottle(bt);
        const cell = this.cells.get(bt.key);
        if (cell) cell.bottle = null;
        this.events.onBottle(bt);
      }
    }

    this.sortT -= dt;
    if (this.sortT <= 0) {
      this.sortT = 0.25;
      for (const isl of this.islands) isl.dist = Math.hypot(pos.x - isl.x, pos.z - isl.z);
      this.sorted = [...this.islands].sort((a, b) => a.dist - b.dist);
    }
    this._updateGulls(pos, dt, time);
  }

  _trial(isl, s, d, ctx) {
    const near = d < isl.shoreR + 17;
    if (!s.hinted && s.trial !== 'approach' && d < isl.shoreR + 80) {
      s.hinted = true;
      this.events.onTrialHint(isl, TRIALS[s.trial]);
    }
    if (s.trial === 'approach') {
      if (near) this._setAwake(isl, true);
    } else if (s.trial === 'night') {
      s.progress = ctx.night;
      if (near && ctx.night > 0.55) this._setAwake(isl, true);
    } else if (s.trial === 'still') {
      if (d < isl.shoreR + 40 && Math.abs(ctx.speed) < 1.6) s.stillT += ctx.dt; else s.stillT = Math.max(0, s.stillT - ctx.dt * 2);
      s.progress = Math.min(1, s.stillT / 3);
      if (s.stillT >= 3) this._setAwake(isl, true);
    } else if (s.trial === 'circle') {
      if (d < isl.shoreR + 75) {
        const a = Math.atan2(ctx.pos.z - isl.z, ctx.pos.x - isl.x);
        if (s.lastA !== null) {
          let da = a - s.lastA;
          if (da > Math.PI) da -= Math.PI * 2;
          if (da < -Math.PI) da += Math.PI * 2;
          s.circ += da;
        }
        s.lastA = a;
      } else if (d > isl.shoreR + 110) { s.circ = 0; s.lastA = null; }
      s.progress = Math.min(1, Math.abs(s.circ) / (Math.PI * 2));
      if (s.progress >= 1) this._setAwake(isl, true);
    }
  }

  // Keep the boat off the beach. Returns impact speed when it runs aground.
  collide(boat) {
    const p = boat.position;
    let hit = 0;
    for (const isl of this.islands) {
      const dx = p.x - isl.x, dz = p.z - isl.z;
      const min = isl.shoreR + 2.6;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 0.001;
      p.x = isl.x + (dx / d) * min;
      p.z = isl.z + (dz / d) * min;
      const into = -(Math.sin(boat.heading) * dx + Math.cos(boat.heading) * dz) / d;
      if (into > 0.2 && Math.abs(boat.speed) > 2) {
        hit = Math.max(hit, Math.abs(boat.speed) * into);
        boat.speed *= 1 - Math.min(0.9, into * 0.9);
      }
    }
    return hit;
  }

  nearestDormant() {
    for (const isl of this.sorted) if (isl.shrine && !isl.shrine.awake) return isl;
    return null;
  }

  nearestIsland() { return this.sorted[0] || null; }

  // -- gulls: one dynamic mesh, two triangles per bird ------------------------
  _makeGulls() {
    const N = 14;
    const pos = new Float32Array(N * 18);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    const rng = mulberry32(7);
    const birds = Array.from({ length: N }, () => ({ r: 14 + rng() * 45, h: 16 + rng() * 22, sp: (0.25 + rng() * 0.3) * (rng() < 0.5 ? -1 : 1), ph: rng() * 6.28, fl: 5 + rng() * 3 }));
    return { mesh, mat, pos, birds, cx: 0, cz: 0, init: false };
  }

  _updateGulls(pos, dt, time) {
    const g = this.gulls;
    const target = this.sorted[0] && this.sorted[0].dist < 500 ? this.sorted[0] : pos;
    if (!g.init) { g.cx = target.x; g.cz = target.z; g.init = true; }
    const k = Math.min(1, dt * 0.25);
    g.cx += (target.x - g.cx) * k;
    g.cz += (target.z - g.cz) * k;
    g.near = Math.hypot(pos.x - g.cx, pos.z - g.cz) < 120;
    const P = g.pos;
    g.birds.forEach((b, i) => {
      const a = time * b.sp + b.ph;
      const x = g.cx + Math.cos(a) * b.r, z = g.cz + Math.sin(a) * b.r;
      const y = b.h + Math.sin(time * 0.5 + b.ph) * 3;
      const dir = Math.sign(b.sp);
      const fx = -Math.sin(a) * dir, fz = Math.cos(a) * dir;
      const rx = fz, rz = -fx;
      const flap = Math.sin(time * b.fl + b.ph) * 0.7;
      const span = 1.5 * Math.cos(flap), lift = 1.5 * Math.sin(flap);
      const o = i * 18;
      const nose = [x + fx * 0.7, y, z + fz * 0.7], tail = [x - fx * 0.5, y, z - fz * 0.5];
      P.set(nose, o); P.set(tail, o + 3); P.set([x + rx * span, y + lift, z + rz * span], o + 6);
      P.set(nose, o + 9); P.set([x - rx * span, y + lift, z - rz * span], o + 12); P.set(tail, o + 15);
    });
    g.mesh.geometry.attributes.position.needsUpdate = true;
  }
}
