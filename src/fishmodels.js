import * as THREE from 'three';
import { Builder, clamp, mulberry32, smoothstep } from './utils.js';

// ---------------------------------------------------------------------------
// Procedural low-poly sea creatures.
// Every body is lofted along +z (nose at z = +0.5, tail at z = -0.5) so a
// single vertex shader can make it swim: a sine wave travels down the spine
// and grows toward the tail (the trick ABZU-style fish use instead of bones).
// ---------------------------------------------------------------------------

const C = (h) => new THREE.Color(h);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

// shape: torpedo | deep | round | flat | eel | ribbon
// tail: fork | crescent | round | fan | none | fluke
// pattern: none | vstripes | hstripe | spots | patches | zigzag | glowspots
// swim: 0 side-to-side, 1 up-and-down (mammals / flatfish), 2 wing flaps
export const SPECS = {
  sardine: { shape: 'torpedo', H: 0.085, W: 0.055, peak: 0.6, top: '#3d6f8f', belly: '#eef3f6', pattern: 'hstripe', accent: '#9fd0e8', tail: 'fork', dorsal: [0.45, 0.6, 0.05], eye: 0.022 },
  mackerel: { shape: 'torpedo', H: 0.1, W: 0.075, peak: 0.58, top: '#2f6b62', belly: '#e9eef0', pattern: 'zigzag', accent: '#14302e', tail: 'fork', dorsal: [0.42, 0.6, 0.06], finlets: true, eye: 0.02 },
  snapper: { shape: 'deep', H: 0.19, W: 0.075, peak: 0.55, top: '#e0473a', belly: '#ffd2c2', pattern: 'none', tail: 'fork', dorsal: [0.25, 0.75, 0.11], spiny: true, anal: true, eye: 0.03 },
  puffer: { shape: 'round', H: 0.28, W: 0.26, peak: 0.52, blunt: true, top: '#c9b25a', belly: '#f6f0d8', pattern: 'spots', accent: '#5d4c20', tail: 'round', spikes: true, eye: 0.045 },
  flounder: { shape: 'flat', H: 0.045, W: 0.3, peak: 0.52, blunt: true, top: '#a88a5e', belly: '#f4f1ea', pattern: 'spots', accent: '#6b5236', tail: 'round', fringe: true, topEyes: true, swim: 1, eye: 0.025, view: 'top' },
  tuna: { shape: 'torpedo', H: 0.155, W: 0.12, peak: 0.52, top: '#1f3f6e', belly: '#e2e9ef', pattern: 'hstripe', accent: '#d8b54a', tail: 'crescent', dorsal: [0.45, 0.58, 0.08], finlets: true, anal: true, eye: 0.024 },
  parrot: { shape: 'deep', H: 0.18, W: 0.09, peak: 0.5, blunt: true, top: '#22c49b', belly: '#9ff3df', pattern: 'patches', accent: '#ff7fc2', tail: 'crescent', dorsal: [0.2, 0.72, 0.06], beak: '#f5f2e6', eye: 0.028 },
  squid: { special: 'squid', top: '#d8c8ff', belly: '#f3eeff', accent: '#9b7be0', swim: 1 },
  swordfish: { shape: 'torpedo', H: 0.13, W: 0.1, peak: 0.55, top: '#26486b', belly: '#cdd8e2', pattern: 'none', tail: 'crescent', dorsal: [0.55, 0.68, 0.22], sail: true, bill: 0.26, eye: 0.022 },
  lantern: { shape: 'deep', H: 0.17, W: 0.1, peak: 0.6, blunt: true, top: '#1a2440', belly: '#39456b', pattern: 'glowspots', accent: '#9ff0ff', tail: 'round', dorsal: [0.4, 0.6, 0.05], lure: '#9ff0ff', eye: 0.055 },
  eel: { shape: 'eel', H: 0.05, W: 0.04, top: '#3a3f1a', belly: '#d9e07a', pattern: 'zigzag', accent: '#f5ff7a', tail: 'none', fringe: true, eye: 0.014, amp: 0.09, freq: 16 },
  manta: { special: 'manta', top: '#2b2f55', belly: '#f2f4f8', accent: '#4a5290', swim: 2, view: 'top' },
  koi: { shape: 'deep', H: 0.16, W: 0.11, peak: 0.55, blunt: true, top: '#fbf6ee', belly: '#fffaf2', pattern: 'patches', accent: '#ff7a2a', tail: 'fan', dorsal: [0.3, 0.7, 0.07], barbels: true, eye: 0.024 },
  oarfish: { shape: 'ribbon', H: 0.07, W: 0.02, top: '#dfe4ec', belly: '#eef1f5', pattern: 'spots', accent: '#4a5a70', tail: 'none', crest: '#e03030', eye: 0.014, amp: 0.07, freq: 18 },
  starfish: { shape: 'torpedo', H: 0.14, W: 0.09, peak: 0.55, top: '#3a2a7a', belly: '#7c6cc8', pattern: 'glowspots', accent: '#ffe89a', tail: 'fan', dorsal: [0.35, 0.7, 0.09], crown: '#ffe89a', eye: 0.026 },
  boot: { special: 'boot' },
  tin: { special: 'tin' },
  flyingfish: { shape: 'torpedo', H: 0.08, W: 0.06, peak: 0.6, top: '#3f6fa8', belly: '#eef4fa', pattern: 'none', tail: 'fork', wings: true, eye: 0.02 },
  dolphin: { shape: 'torpedo', H: 0.14, W: 0.13, peak: 0.55, top: '#6f8ea6', belly: '#e3ebf0', pattern: 'none', tail: 'fluke', dorsal: [0.42, 0.52, 0.12], curved: true, pecs: 0.14, beak: '#8aa3b8', swim: 1, eye: 0.016 },
  whale: { shape: 'torpedo', H: 0.15, W: 0.15, peak: 0.6, blunt: true, top: '#33475a', belly: '#d4dadf', pattern: 'grooves', accent: '#9aa6b0', tail: 'fluke', dorsal: [0.28, 0.33, 0.03], pecs: 0.42, pecColor: '#dfe5ea', knobs: true, swim: 1, eye: 0.012, amp: 0.035 },
};

function envelope(t, peak, blunt) {
  const a = Math.log(0.5) / Math.log(clamp(peak, 0.2, 0.8));
  const s = Math.sin(Math.PI * Math.pow(clamp(t, 0, 1), a));
  return blunt && t > peak ? Math.pow(Math.max(s, 0), 0.45) : s;
}

function profile(spec, t) {
  const { H, W } = spec;
  if (spec.shape === 'eel' || spec.shape === 'ribbon') {
    const k = smoothstep(0, 0.25, t) * (t > 0.9 ? Math.sqrt(Math.max(0, (1 - t) / 0.1)) : 1);
    return [H * (0.25 + 0.75 * k), W * (0.25 + 0.75 * k)];
  }
  const e = envelope(t, spec.peak, spec.blunt);
  const ped = spec.shape === 'round' ? 0.18 : 0.1; // narrow "wrist" before the tail
  return [H * (ped + (1 - ped) * e), W * (ped + (1 - ped) * e)];
}

function colorAt(spec, t, y, h, ang, seg, ring, rng) {
  const top = C(spec.top), belly = C(spec.belly), acc = spec.accent ? C(spec.accent) : null;
  const k = smoothstep(-0.35, 0.45, y / Math.max(h, 1e-4));
  const c = belly.clone().lerp(top, spec.topEyes ? 1 : k);
  const upper = y > -0.15 * h;
  switch (spec.pattern) {
    case 'vstripes': if (upper && Math.sin(t * 34) > 0.35) c.copy(acc); break;
    case 'hstripe': if (Math.abs(y / h - 0.05) < 0.16) c.lerp(acc, 0.85); break;
    case 'zigzag': if (upper && Math.sin(t * 60 + Math.sin(ang * 3) * 2.2) > 0.3) c.lerp(acc, 0.85); break;
    case 'spots': if ((spec.topEyes || upper) && rng() < 0.28) c.lerp(acc, 0.8); break;
    case 'patches': if (Math.sin(t * 9 + 1.3) * Math.cos(ang * 2 + t * 4) > 0.2 && (upper || spec.top === spec.belly)) c.copy(acc); else if (spec === SPECS.koi && rng() < 0.05) c.set('#1a1a1a'); break;
    case 'glowspots': if (rng() < 0.16) c.copy(acc).multiplyScalar(1.6); break;
    case 'grooves': if (y < -0.25 * h && seg % 2 === 0) c.lerp(acc, 0.7); break;
    default: break;
  }
  // a darker lateral line and a lighter cheek near the head
  if (t > 0.78 && t < 0.86 && Math.abs(y) < h * 0.7 && spec.shape !== 'eel') c.multiplyScalar(0.82);
  return c;
}

function loftBody(b, spec, rng) {
  const RINGS = spec.shape === 'eel' || spec.shape === 'ribbon' ? 22 : 13;
  const SEG = 10;
  const rings = [];
  for (let i = 0; i <= RINGS; i++) {
    const t = 0.04 + (i / RINGS) * 0.94;
    const [h, w] = profile(spec, t);
    const z = t - 0.5;
    const yc = spec.shape === 'deep' ? (t - 0.55) * -0.04 : 0;
    const ring = [];
    for (let s = 0; s < SEG; s++) {
      const a = (s / SEG) * Math.PI * 2;
      // superellipse: slightly boxier bellies read better in flat shading
      const ca = Math.cos(a), sa = Math.sin(a);
      const x = Math.sign(ca) * Math.pow(Math.abs(ca), 0.85) * w;
      const y = yc + Math.sign(sa) * Math.pow(Math.abs(sa), spec.shape === 'flat' ? 0.6 : 0.95) * h * (sa < 0 && spec.shape === 'deep' ? 0.9 : 1);
      ring.push(V(x, y, z));
    }
    rings.push({ t, h, w, ring, yc });
  }
  for (let i = 0; i < RINGS; i++) {
    const A = rings[i], B = rings[i + 1];
    for (let s = 0; s < SEG; s++) {
      const s2 = (s + 1) % SEG;
      const p = [A.ring[s], B.ring[s], B.ring[s2], A.ring[s2]];
      const cy = (p[0].y + p[1].y + p[2].y + p[3].y) / 4 - A.yc;
      const col = colorAt(spec, (A.t + B.t) / 2, cy, A.h, (s / SEG) * Math.PI * 2, s, i, rng);
      b.quad(p[0], p[3], p[2], p[1], col, 0.04);
    }
  }
  // nose cap
  const last = rings[RINGS];
  const nose = V(0, last.yc - last.h * 0.1, 0.5 + (spec.blunt ? 0.0 : 0.02));
  for (let s = 0; s < SEG; s++) {
    const s2 = (s + 1) % SEG;
    const cy = (last.ring[s].y + last.ring[s2].y) / 2;
    b.tri(last.ring[s], last.ring[s2], nose, colorAt(spec, 1, cy - last.yc, last.h, 0, s, RINGS, rng), 0.04);
  }
  // tail cap
  const first = rings[0];
  const tip = V(0, first.yc, -0.5);
  for (let s = 0; s < SEG; s++) b.tri(first.ring[(s + 1) % SEG], first.ring[s], tip, C(spec.top), 0.04);
  return rings;
}

const at = (rings, t) => {
  let best = rings[0];
  for (const r of rings) if (Math.abs(r.t - t) < Math.abs(best.t - t)) best = r;
  return best;
};

function fin(b, pts, col) {
  for (let i = 1; i < pts.length - 1; i++) b.tri(pts[0], pts[i], pts[i + 1], col, 0.08);
}

function addFins(b, spec, rings) {
  const finCol = C(spec.top).lerp(C(spec.accent || spec.top), 0.25).multiplyScalar(0.9);
  const tailCol = spec.tail === 'fan' ? C(spec.accent || spec.top).lerp(C('#ffffff'), 0.35) : finCol;
  const r0 = rings[0];
  const z0 = -0.47;
  const T = spec.shape === 'round' ? 0.16 : 0.2;
  // tail
  if (spec.tail === 'fork') { fin(b, [V(0, r0.yc + r0.h * 0.6, z0), V(0, r0.yc + T, -0.66), V(0, r0.yc, -0.56), V(0, r0.yc - T, -0.66), V(0, r0.yc - r0.h * 0.6, z0)], tailCol); }
  else if (spec.tail === 'crescent') { fin(b, [V(0, r0.yc, z0), V(0, r0.yc + T * 1.15, -0.62), V(0, r0.yc + T * 0.55, -0.6), V(0, r0.yc, -0.53), V(0, r0.yc - T * 0.55, -0.6), V(0, r0.yc - T * 1.15, -0.62)], tailCol); }
  else if (spec.tail === 'round') { const pts = [V(0, r0.yc, z0)]; for (let i = 0; i <= 6; i++) { const a = -1.1 + (i / 6) * 2.2; pts.push(V(0, r0.yc + Math.sin(a) * T * 0.9, z0 - Math.cos(a) * 0.15)); } fin(b, pts, tailCol); }
  else if (spec.tail === 'fan') { const pts = [V(0, r0.yc, z0)]; for (let i = 0; i <= 8; i++) { const a = -1.25 + (i / 8) * 2.5; pts.push(V(0, r0.yc + Math.sin(a) * T * 1.3, z0 - (0.22 + 0.06 * Math.sin(i * 2.1))) ); } fin(b, pts, tailCol); }
  else if (spec.tail === 'fluke') {
    fin(b, [V(0, r0.yc, z0), V(0.24, r0.yc + 0.01, -0.6), V(0.08, r0.yc, -0.56), V(0, r0.yc, -0.53)], finCol);
    fin(b, [V(0, r0.yc, z0), V(0, r0.yc, -0.53), V(-0.08, r0.yc, -0.56), V(-0.24, r0.yc + 0.01, -0.6)], finCol);
  }
  // dorsal
  if (spec.dorsal) {
    const [t0, t1, ht] = spec.dorsal;
    const a = at(rings, t0), c = at(rings, t1);
    const ya = a.yc + a.h * 0.95, yc = c.yc + c.h * 0.95;
    if (spec.sail) fin(b, [V(0, ya, t0 - 0.5), V(0, yc, t1 - 0.5), V(0, yc + ht, t1 - 0.52), V(0, ya + ht * 0.4, t0 - 0.5)], finCol);
    else if (spec.curved) fin(b, [V(0, ya, t0 - 0.5), V(0, yc, t1 - 0.5), V(0, yc + ht * 0.6, t1 - 0.53), V(0, ya + ht, t0 - 0.57)], finCol);
    else if (spec.spiny) { const n = 7; const pts = [V(0, ya, t0 - 0.5)]; for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * (i / n); const r = at(rings, t); pts.push(V(0, r.yc + r.h * 0.95 + ht * (i % 2 ? 0.7 : 1) * (0.6 + 0.4 * Math.sin((i / n) * Math.PI)), t - 0.5)); } pts.push(V(0, yc, t1 - 0.5)); fin(b, pts, finCol); }
    else fin(b, [V(0, ya, t0 - 0.5), V(0, yc, t1 - 0.5), V(0, (ya + yc) / 2 + ht, (t0 + t1) / 2 - 0.52)], finCol);
  }
  if (spec.anal) { const a = at(rings, 0.25); fin(b, [V(0, a.yc - a.h * 0.9, -0.25), V(0, a.yc - a.h * 0.9, -0.12), V(0, a.yc - a.h - 0.06, -0.24)], finCol); }
  if (spec.finlets) for (let i = 0; i < 4; i++) { const t = 0.1 + i * 0.05; const r = at(rings, t); for (const s of [1, -1]) fin(b, [V(0, r.yc + s * r.h * 0.9, t - 0.5), V(0, r.yc + s * r.h * 0.9, t - 0.47), V(0, r.yc + s * (r.h + 0.03), t - 0.51)], C(spec.accent || '#ffd34d')); }
  if (spec.fringe) {
    for (let i = 1; i < rings.length - 2; i++) {
      const A = rings[i], B = rings[i + 1];
      if (spec.shape === 'flat') {
        for (const s of [1, -1]) fin(b, [V(s * A.w, A.yc, A.t - 0.5), V(s * (A.w + 0.05), A.yc, A.t - 0.5), V(s * (B.w + 0.05), B.yc, B.t - 0.5), V(s * B.w, B.yc, B.t - 0.5)], finCol);
      } else {
        for (const s of [1, -1]) fin(b, [V(0, A.yc + s * A.h, A.t - 0.5), V(0, A.yc + s * (A.h + 0.025), A.t - 0.5), V(0, B.yc + s * (B.h + 0.025), B.t - 0.5), V(0, B.yc + s * B.h, B.t - 0.5)], C(spec.accent || spec.top));
      }
    }
  }
  if (spec.crest) {
    for (let i = 2; i < rings.length - 1; i++) {
      const A = rings[i], B = rings[i + 1];
      const hA = i > rings.length - 5 ? 0.14 : 0.05, hB = i + 1 > rings.length - 5 ? 0.16 : 0.05;
      fin(b, [V(0, A.yc + A.h, A.t - 0.5), V(0, A.yc + A.h + hA, A.t - 0.52), V(0, B.yc + B.h + hB, B.t - 0.52), V(0, B.yc + B.h, B.t - 0.5)], C(spec.crest));
    }
  }
  // pectoral fins / wings / flippers
  const p = at(rings, 0.68);
  if (spec.wings) {
    for (const s of [1, -1]) fin(b, [V(s * p.w, p.yc, 0.2), V(s * 0.42, p.yc + 0.04, 0.02), V(s * 0.38, p.yc + 0.03, -0.12), V(s * p.w, p.yc, 0.1)], C('#9fc8f0'));
  } else if (spec.pecs) {
    const L = spec.pecs, col = spec.pecColor ? C(spec.pecColor) : finCol;
    for (const s of [1, -1]) fin(b, [V(s * p.w * 0.9, p.yc - p.h * 0.5, 0.22), V(s * (p.w + L), p.yc - p.h * 0.7 - L * 0.12, 0.22 - L * 0.55), V(s * (p.w + L * 0.85), p.yc - p.h * 0.7 - L * 0.1, 0.16 - L * 0.62), V(s * p.w * 0.9, p.yc - p.h * 0.5, 0.12)], col);
  } else if (spec.shape !== 'eel' && spec.shape !== 'ribbon' && spec.shape !== 'flat') {
    for (const s of [1, -1]) fin(b, [V(s * p.w * 0.95, p.yc - p.h * 0.3, 0.2), V(s * (p.w + 0.07), p.yc - p.h * 0.6, 0.08), V(s * (p.w + 0.03), p.yc - p.h * 0.55, 0.05)], finCol);
  }
}

function addHead(b, spec, rings) {
  const r = at(rings, 0.86);
  const eye = spec.eye || 0.02;
  const white = C('#f4f4ef'), black = C('#0d0f14');
  const eyes = spec.topEyes ? [[0.35, r.yc + r.h * 0.95, 0.86], [-0.2, r.yc + r.h * 0.95, 0.83]] : [[1, r.yc + r.h * 0.3, 0.86], [-1, r.yc + r.h * 0.3, 0.86]];
  for (const [sx, y, t] of eyes) {
    const x = spec.topEyes ? sx * r.w : sx * r.w * 0.88;
    const out = spec.topEyes ? V(0, 1, 0) : V(Math.sign(sx), 0, 0.2).normalize();
    _m.makeTranslation(x, y, t - 0.5);
    b.add(new THREE.IcosahedronGeometry(eye, 0), _m, white, 0);
    _m.makeTranslation(x + out.x * eye * 0.55, y + out.y * eye * 0.55, t - 0.5 + out.z * eye * 0.55 + eye * 0.15);
    b.add(new THREE.IcosahedronGeometry(eye * 0.6, 0), _m, black, 0);
  }
  const nose = at(rings, 0.98);
  if (spec.bill) fin(b, [V(0.015, nose.yc, 0.47), V(0, nose.yc + 0.015, 0.47), V(0, nose.yc, 0.5 + spec.bill), V(-0.015, nose.yc, 0.47)], C('#2d3a46'));
  if (spec.beak) { _m.compose(V(0, nose.yc - nose.h * 0.15, 0.5), _q.setFromEuler(_e.set(Math.PI / 2, 0, 0)), V(1, 1, 1)); b.add(new THREE.ConeGeometry(spec.shape === 'deep' ? 0.04 : 0.035, 0.09, 5), _m, C(spec.beak), 0.02); }
  if (spec.barbels) for (const s of [1, -1]) fin(b, [V(s * 0.02, nose.yc - 0.02, 0.48), V(s * 0.09, nose.yc - 0.06, 0.44), V(s * 0.02, nose.yc - 0.03, 0.47)], C('#e8d0b0'));
  if (spec.knobs) for (let i = 0; i < 6; i++) { const t = 0.84 + i * 0.022; const rr = at(rings, t); _m.makeTranslation((i % 2 ? 0.3 : -0.3) * rr.w, rr.yc + rr.h * 0.92, t - 0.5); b.add(new THREE.IcosahedronGeometry(0.014, 0), _m, C('#26323e'), 0.05); }
  if (spec.spikes) for (let i = 0; i < 26; i++) {
    const t = 0.25 + ((i * 0.61803) % 1) * 0.6, a = i * 2.39996;
    const rr = at(rings, t);
    const dir = V(Math.cos(a), Math.sin(a), 0);
    _q.setFromUnitVectors(V(0, 1, 0), dir);
    _m.compose(V(dir.x * rr.w * 0.97, rr.yc + dir.y * rr.h * 0.97, t - 0.5), _q, V(1, 1, 1));
    b.add(new THREE.ConeGeometry(0.012, 0.05, 4), _m, C('#8a7a3a'), 0.05);
  }
}

// ---- special bodies ---------------------------------------------------------
function squid(b, spec) {
  const top = C(spec.top), acc = C(spec.accent);
  const rings = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10; // 0 = mantle tip (back), 1 = head
    const r = 0.11 * Math.sin(Math.PI * (0.08 + 0.72 * t)) + 0.02;
    rings.push({ z: -0.5 + t * 0.62, r });
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let s = 0; s < 8; s++) {
      const a0 = (s / 8) * Math.PI * 2, a1 = ((s + 1) / 8) * Math.PI * 2;
      const A = rings[i], B = rings[i + 1];
      const P = (R, a) => V(Math.cos(a) * R.r, Math.sin(a) * R.r, R.z);
      const col = (i + s) % 3 === 0 ? acc : top;
      b.quad(P(A, a0), P(A, a1), P(B, a1), P(B, a0), col, 0.06);
    }
  }
  fin(b, [V(0, 0.01, -0.5), V(0.2, 0, -0.38), V(0, 0.02, -0.26)], acc);
  fin(b, [V(0, 0.01, -0.5), V(0, 0.02, -0.26), V(-0.2, 0, -0.38)], acc);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const L = k < 2 ? 0.42 : 0.3;
    const x = Math.cos(a) * 0.05, y = Math.sin(a) * 0.05;
    fin(b, [V(x - 0.012, y, 0.12), V(x + 0.012, y, 0.12), V(x * 1.6, y * 1.6, 0.12 + L)], top);
  }
  for (const s of [1, -1]) { _m.makeTranslation(s * 0.07, 0.03, 0.06); b.add(new THREE.IcosahedronGeometry(0.03, 0), _m, C('#111'), 0); }
}

function manta(b, spec) {
  const top = C(spec.top), belly = C(spec.belly), acc = C(spec.accent);
  for (const [ridge, col, flip] of [[[0.07, 0.09, 0.05], top, false], [[-0.03, -0.04, -0.02], belly, true]]) {
    const C1 = V(0, ridge[0], 0.22), C2 = V(0, ridge[1], 0.0), C3 = V(0, ridge[2], -0.25);
    for (const s of [1, -1]) {
      const L1 = V(s * 0.12, 0.02, 0.3), L2 = V(s * 0.45, 0.0, 0.13), T = V(s * 0.8, -0.05, -0.06);
      const R1 = V(s * 0.42, 0.0, -0.17), R2 = V(s * 0.12, 0.02, -0.3);
      const tris = [[C1, L1, L2], [C1, L2, C2], [C2, L2, T], [C2, T, R1], [C2, R1, C3], [C3, R1, R2]];
      tris.forEach(([p, q, r], i) => b.tri(p, flip ? r : q, flip ? q : r, !flip && i === 2 ? acc : col, 0.05));
      b.tri(C1, V(s * 0.03, ridge[0] - 0.02, 0.34), L1, col, 0.05);
    }
  }
  for (const s of [1, -1]) {
    fin(b, [V(s * 0.06, 0.03, 0.3), V(s * 0.11, 0.0, 0.42), V(s * 0.14, 0.01, 0.3)], top);
    _m.makeTranslation(s * 0.11, 0.05, 0.26); b.add(new THREE.IcosahedronGeometry(0.016, 0), _m, C('#111'), 0);
  }
  fin(b, [V(0.012, 0.03, -0.28), V(0, 0.03, -0.72), V(-0.012, 0.03, -0.28)], top);
}

function boot(b) {
  const leather = C('#6b4a2f'), sole = C('#2a1d12');
  _m.makeTranslation(0, 0.12, -0.12); b.add(new THREE.BoxGeometry(0.2, 0.36, 0.22), _m, leather, 0.08);
  _m.makeTranslation(0, -0.02, 0.08); b.add(new THREE.BoxGeometry(0.2, 0.12, 0.4), _m, leather, 0.08);
  _m.makeTranslation(0, -0.1, 0.02); b.add(new THREE.BoxGeometry(0.22, 0.04, 0.56), _m, sole, 0.05);
  _m.makeTranslation(0, 0.31, -0.12); b.add(new THREE.BoxGeometry(0.23, 0.04, 0.25), _m, C('#4a3220'), 0.05);
}

function tin(b) {
  b.add(new THREE.CylinderGeometry(0.16, 0.16, 0.34, 14), null, C('#9a8a78'), 0.18);
  _m.makeTranslation(0, 0.03, 0);
  b.add(new THREE.CylinderGeometry(0.163, 0.163, 0.14, 14), _m, C('#c04a2a'), 0.06);
  _m.makeTranslation(0, 0.175, 0);
  b.add(new THREE.CylinderGeometry(0.15, 0.16, 0.02, 14), _m, C('#cfc6b8'), 0.05);
  _m.makeRotationX(-0.9).setPosition(0, 0.23, -0.08);
  b.add(new THREE.CylinderGeometry(0.15, 0.15, 0.01, 14), _m, C('#b8ad9c'), 0.05);
}

// ---- public API ------------------------------------------------------------------
const geoCache = new Map();
export function fishGeometry(id) {
  if (geoCache.has(id)) return geoCache.get(id);
  const spec = SPECS[id] || SPECS.sardine;
  const rng = mulberry32(id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0);
  const b = new Builder(rng);
  if (spec.special === 'squid') squid(b, spec);
  else if (spec.special === 'manta') manta(b, spec);
  else if (spec.special === 'boot') boot(b);
  else if (spec.special === 'tin') tin(b);
  else {
    const rings = loftBody(b, spec, rng);
    addFins(b, spec, rings);
    addHead(b, spec, rings);
    spec._rings = rings;
  }
  const g = b.build();
  geoCache.set(id, g);
  return g;
}

const SWIM_VERT = `
  float sT = clamp(0.55 - position.z, 0.0, 1.2);
  float sW = sin(position.z * uFreq - uTime * uSpeed);
  if (uMode < 0.5) {
    transformed.x += sW * uAmp * sT * sT + uBend * sT * sT;
  } else if (uMode < 1.5) {
    transformed.y += sW * uAmp * sT * sT;
  } else {
    transformed.y += sin(uTime * uSpeed * 0.5 - abs(position.x) * 3.0) * uAmp * 3.0 * abs(position.x);
  }
`;

/** A swimming fish: a mesh whose material bends it along the spine. */
export function createFish(id, { emissive = 0 } = {}) {
  const spec = SPECS[id] || SPECS.sardine;
  const uniforms = {
    uTime: { value: 0 }, uAmp: { value: spec.amp ?? 0.05 }, uFreq: { value: spec.freq ?? 9 },
    uSpeed: { value: 7 }, uMode: { value: spec.swim || 0 }, uBend: { value: 0 },
  };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.42, metalness: 0.08, side: THREE.DoubleSide });
  if (emissive) { mat.emissive = new THREE.Color('#ffffff'); mat.emissiveIntensity = emissive; }
  if (spec.special === 'boot' || spec.special === 'tin') uniforms.uAmp.value = 0;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = 'uniform float uTime, uAmp, uFreq, uSpeed, uMode, uBend;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${SWIM_VERT}`);
  };
  mat.customProgramCacheKey = () => 'swimfish';
  const mesh = new THREE.Mesh(fishGeometry(id), mat);
  mesh.castShadow = true;
  const group = new THREE.Group();
  group.add(mesh);
  // Glowing extras pick up bloom.
  if (spec.lure) {
    const lure = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 1), new THREE.MeshBasicMaterial({ color: spec.lure }));
    lure.position.set(0, 0.26, 0.6);
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.2, 4), new THREE.MeshBasicMaterial({ color: '#33405e' }));
    stalk.position.set(0, 0.2, 0.52); stalk.rotation.x = 0.7;
    group.add(lure, stalk);
    group.userData.glow = lure;
  }
  if (spec.crown) {
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.022, 0), new THREE.MeshBasicMaterial({ color: spec.crown }));
      s.position.set(0, 0.17 + Math.sin(i) * 0.02, 0.15 - i * 0.07);
      group.add(s);
    }
  }
  group.userData.uniforms = uniforms;
  group.userData.id = id;
  return group;
}

export function animateFish(group, time, { speed = 7, amp = null, bend = 0 } = {}) {
  const u = group.userData.uniforms;
  u.uTime.value = time;
  u.uSpeed.value = speed;
  if (amp != null) u.uAmp.value = amp;
  u.uBend.value = bend;
  if (group.userData.glow) group.userData.glow.scale.setScalar(1 + Math.sin(time * 4) * 0.25);
}

// ---------------------------------------------------------------------------
// FishStudio: a tiny separate renderer for the catch card and logbook portraits.
// ---------------------------------------------------------------------------
export class FishStudio {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.setSize(canvas.width, canvas.height, false);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(26, canvas.width / canvas.height, 0.01, 20);
    const key = new THREE.DirectionalLight('#fff4e0', 3.2); key.position.set(2, 3, 2);
    const rim = new THREE.DirectionalLight('#8fd8ff', 2.4); rim.position.set(-2, 1, -3);
    this.scene.add(new THREE.HemisphereLight('#dff2ff', '#3a4a5a', 1.3), key, rim);
    this.fish = null;
    this.thumbs = {};
  }

  show(id) {
    if (this.pivot) {
      this.scene.remove(this.pivot);
      this.pivot.traverse((o) => { if (o.material) o.material.dispose(); });
    }
    this.fish = createFish(id);
    const g = fishGeometry(id);
    g.computeBoundingSphere();
    const r = g.boundingSphere.radius;
    this.fish.position.copy(g.boundingSphere.center).multiplyScalar(-1);
    this.pivot = new THREE.Group();
    this.pivot.add(this.fish);
    this.scene.add(this.pivot);
    this.dist = r / Math.sin(THREE.MathUtils.degToRad(13)) * 0.9;
    if ((SPECS[id] || {}).view === 'top') this.camera.position.set(this.dist * 0.12, this.dist * 0.8, this.dist * 0.6);
    else this.camera.position.set(this.dist * 0.92, this.dist * 0.22, this.dist * 0.35);
    this.camera.lookAt(0, 0, 0);
    this.fishId = id;
  }

  render(time) {
    if (!this.fish) return;
    this.pivot.rotation.y = Math.sin(time * 0.7) * 0.6 - 0.25;
    this.pivot.rotation.z = Math.sin(time * 1.3) * 0.05;
    this.pivot.position.y = Math.sin(time * 1.6) * 0.02 * this.dist;
    animateFish(this.fish, time, { speed: 5 });
    this.renderer.render(this.scene, this.camera);
  }

  thumb(id) {
    if (this.thumbs[id]) return this.thumbs[id];
    const prev = this.fishId;
    this.show(id);
    this.pivot.rotation.set(0, -0.35, 0);
    animateFish(this.fish, 0.4, { speed: 0, amp: 0 });
    this.renderer.render(this.scene, this.camera);
    this.thumbs[id] = this.canvas.toDataURL('image/png');
    if (prev) this.show(prev);
    return this.thumbs[id];
  }
}

// ---------------------------------------------------------------------------
// Soft fish-shaped shadows that swim just under the surface.
// ---------------------------------------------------------------------------
let shadowTex = null;
function shadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const x = c.getContext('2d');
  x.filter = 'blur(3px)';
  x.fillStyle = '#fff';
  x.beginPath(); x.ellipse(32, 52, 14, 40, 0, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.moveTo(32, 84); x.lineTo(14, 118); x.lineTo(32, 108); x.lineTo(50, 118); x.closePath(); x.fill();
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}

export function createShadow(waveGLSL, env) {
  const geo = new THREE.PlaneGeometry(0.45, 1, 1, 8);
  geo.rotateX(-Math.PI / 2); // length along z, head at -z in uv terms; flip so head = +z
  geo.rotateY(Math.PI);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: env.uTime, uWaveAmp: env.uWaveAmp, tMap: { value: shadowTexture() }, uAlpha: { value: 0 }, uWiggle: { value: 7 }, uColor: { value: new THREE.Color('#06243a') } },
    transparent: true, depthWrite: false,
    vertexShader: `
      uniform float uTime, uWiggle;
      varying vec2 vUv;
      ${waveGLSL}
      void main() {
        vUv = uv;
        vec3 p = position;
        float t = clamp(0.5 - p.z, 0.0, 1.0);
        p.x += sin(p.z * 6.0 - uTime * uWiggle) * 0.12 * t * t;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        wp.y = waveH(wp.xz, uTime) + 0.04;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform sampler2D tMap; uniform float uAlpha; uniform vec3 uColor; varying vec2 vUv;
      void main() { float a = texture2D(tMap, vUv).r * uAlpha; gl_FragColor = vec4(uColor, a); }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 2;
  m.frustumCulled = false;
  return m;
}

export const RARITY_SHADOW = { common: 1.3, uncommon: 1.8, rare: 2.6, legendary: 3.6 };
