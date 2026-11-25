import * as THREE from 'three';
import { Builder, clamp, lerp } from './utils.js';
import { waveHeight } from './ocean.js';
import { makeBeamMaterial } from './archipelago.js';

const _m = new THREE.Matrix4();
const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
// World +z is "north" on the radar (radar draws +z upward).
export function bearingName(dx, dz) {
  const a = Math.atan2(-dx, dz); // radar is mirrored on x
  const i = Math.round(((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
  return COMPASS[i];
}

function chestParts() {
  const b = new Builder();
  const wood = new THREE.Color('#7a4a24'), gold = new THREE.Color('#ffcf4d');
  b.add(new THREE.BoxGeometry(2.2, 1.2, 1.4), _m.makeTranslation(0, 0.6, 0), wood, 0.06);
  b.add(new THREE.BoxGeometry(2.3, 0.22, 1.5), _m.makeTranslation(0, 0.35, 0), gold, 0.03);
  b.add(new THREE.BoxGeometry(0.3, 0.4, 0.12), _m.makeTranslation(0, 1.0, 0.72), gold, 0.03);
  const body = b.build();
  const l = new Builder();
  l.add(new THREE.CylinderGeometry(0.7, 0.7, 2.2, 8, 1, false, 0, Math.PI), _m.makeRotationZ(Math.PI / 2), wood, 0.06);
  l.add(new THREE.BoxGeometry(2.3, 0.15, 0.2), _m.makeTranslation(0, 0.05, 0), gold, 0.03);
  const lid = l.build();
  lid.translate(0, 0, 0.7);
  return { body, lid };
}
const CHEST = chestParts();
const chestMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6, metalness: 0.2 });
const bubbleGeo = new THREE.IcosahedronGeometry(0.35, 0);
const bubbleMat = new THREE.MeshBasicMaterial({ color: '#e8fbff', transparent: true, opacity: 0.7 });
const pillarGeo = new THREE.CylinderGeometry(1.5, 0.4, 70, 8, 1, true);
pillarGeo.translate(0, 35, 0);

// ---------------------------------------------------------------------------
// Treasure maps: a map bottle marks an X out at sea. Reach it and a chest rises.
// ---------------------------------------------------------------------------
export class Treasure {
  constructor(scene, events) {
    this.scene = scene;
    this.events = events;
    this.maps = [];
  }

  load(list) {
    this.clear();
    for (const m of list || []) this.maps.push({ ...m, marker: null, state: 'hidden', t: 0 });
  }

  save() { return this.maps.filter((m) => m.state !== 'done').map(({ x, z, fx, fz, id }) => ({ x, z, fx, fz, id })); }

  clear() {
    for (const m of this.maps) this._dropMarker(m);
    this.maps = [];
  }

  add(fx, fz, islands) {
    let best = null;
    for (let tries = 0; tries < 24; tries++) {
      const a = Math.random() * Math.PI * 2, d = 520 + Math.random() * 520;
      const x = fx + Math.sin(a) * d, z = fz + Math.cos(a) * d;
      if (islands.every((i) => Math.hypot(i.x - x, i.z - z) > i.shoreR + 30)) { best = { x, z }; break; }
      if (!best) best = { x, z };
    }
    const map = { ...best, fx, fz, id: Math.floor(Math.random() * 1e9), marker: null, state: 'hidden', t: 0 };
    this.maps.push(map);
    return map;
  }

  describe(map) {
    const dx = map.x - map.fx, dz = map.z - map.fz;
    return `${(Math.hypot(dx, dz) / 500).toFixed(1)} leagues ${bearingName(dx, dz)} of where this bottle drifted. Look for rising bubbles and a golden light.`;
  }

  // Parchment sketch: known islands, a dotted course and an X.
  sketch(canvas, map, islands) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#ecd9a8'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, W * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(110,70,20,0.35)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const cx = (map.x + map.fx) / 2, cz = (map.z + map.fz) / 2;
    const span = Math.max(Math.hypot(map.x - map.fx, map.z - map.fz) * 1.35, 600);
    const s = W / span;
    const P = (x, z) => [W / 2 - (x - cx) * s, H / 2 - (z - cz) * s];
    ctx.fillStyle = 'rgba(120,90,40,0.55)';
    for (const i of islands) {
      const [px, py] = P(i.x, i.z);
      if (px < -20 || py < -20 || px > W + 20 || py > H + 20) continue;
      ctx.beginPath(); ctx.arc(px, py, Math.max(3, i.shoreR * s), 0, Math.PI * 2); ctx.fill();
    }
    const [ax, ay] = P(map.fx, map.fz), [bx, by] = P(map.x, map.z);
    ctx.setLineDash([5, 6]); ctx.strokeStyle = '#7a3b1a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#7a3b1a'; ctx.beginPath(); ctx.arc(ax, ay, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#b3261e'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(bx - 8, by - 8); ctx.lineTo(bx + 8, by + 8); ctx.moveTo(bx + 8, by - 8); ctx.lineTo(bx - 8, by + 8); ctx.stroke();
    ctx.fillStyle = '#5a3a18'; ctx.font = 'italic 13px Georgia'; ctx.textAlign = 'center';
    ctx.fillText('N', W - 22, 22);
    ctx.beginPath(); ctx.moveTo(W - 22, 28); ctx.lineTo(W - 27, 42); ctx.lineTo(W - 17, 42); ctx.closePath(); ctx.fill();
  }

  _makeMarker(m) {
    const g = new THREE.Group();
    g.position.set(m.x, 0, m.z);
    const pillar = new THREE.Mesh(pillarGeo, makeBeamMaterial('#ffcf4d'));
    pillar.material.uniforms.uIntensity.value = 0.55;
    pillar.renderOrder = 3;
    const bubbles = Array.from({ length: 10 }, () => {
      const b = new THREE.Mesh(bubbleGeo, bubbleMat);
      b.userData = { a: Math.random() * 6.28, r: Math.random() * 2.2, t: Math.random() };
      g.add(b);
      return b;
    });
    const chest = new THREE.Group();
    const body = new THREE.Mesh(CHEST.body, chestMat);
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 1.2, -0.7);
    lidPivot.add(new THREE.Mesh(CHEST.lid, chestMat));
    chest.add(body, lidPivot);
    chest.position.y = -6;
    chest.scale.setScalar(1.3);
    const glow = new THREE.PointLight('#ffcf4d', 0, 30, 1.5);
    glow.position.y = 2;
    chest.add(glow);
    g.add(pillar, chest);
    this.scene.add(g);
    m.marker = { g, pillar, bubbles, chest, lidPivot, glow };
  }

  _dropMarker(m) {
    if (!m.marker) return;
    this.scene.remove(m.marker.g);
    m.marker.pillar.material.dispose();
    m.marker = null;
  }

  nearest(pos) {
    let best = null, bd = Infinity;
    for (const m of this.maps) {
      if (m.state === 'done') continue;
      const d = Math.hypot(m.x - pos.x, m.z - pos.z);
      if (d < bd) { bd = d; best = m; }
    }
    return best ? { map: best, dist: bd } : null;
  }

  update(pos, dt, time, islands) {
    for (let i = this.maps.length - 1; i >= 0; i--) {
      const m = this.maps[i];
      const d = Math.hypot(m.x - pos.x, m.z - pos.z);
      if (d < 480 && !m.marker) {
        // Nudge the X off any island that generated on top of it.
        for (const isl of islands) {
          const dx = m.x - isl.x, dz = m.z - isl.z, dd = Math.hypot(dx, dz);
          if (dd < isl.shoreR + 14) { const k = (isl.shoreR + 16) / (dd || 1); m.x = isl.x + dx * k; m.z = isl.z + dz * k; }
        }
        this._makeMarker(m);
      } else if (d > 700 && m.marker && m.state === 'hidden') this._dropMarker(m);
      if (!m.marker) continue;
      const mk = m.marker;
      mk.g.position.set(m.x, 0, m.z);
      const base = waveHeight(m.x, m.z, time);
      for (const b of mk.bubbles) {
        const u = b.userData;
        u.t = (u.t + dt * 0.5) % 1;
        b.position.set(Math.cos(u.a) * u.r, base - 1 + u.t * 2.2, Math.sin(u.a) * u.r);
        b.scale.setScalar(0.5 + u.t);
      }
      mk.pillar.material.uniforms.uIntensity.value = (m.state === 'hidden' ? 0.45 : 0.9) + Math.sin(time * 3) * 0.1;
      if (m.state === 'hidden' && d < 14) {
        m.state = 'rising'; m.t = 0;
        this.events.onChestFound(m);
      }
      if (m.state === 'rising' || m.state === 'open') {
        m.t += dt;
        const rise = clamp(m.t / 1.5, 0, 1);
        mk.chest.position.y = lerp(-6, base + 0.2, 1 - Math.pow(1 - rise, 3));
        mk.chest.rotation.y += dt * 0.6;
        mk.lidPivot.rotation.x = -clamp((m.t - 1.4) / 0.6, 0, 1) * 1.9;
        mk.glow.intensity = clamp((m.t - 1.4) / 0.5, 0, 1) * 220;
        if (m.state === 'rising' && m.t > 2.0) { m.state = 'open'; this.events.onChestOpen(m); }
        if (m.t > 7) { m.state = 'done'; this._dropMarker(m); this.maps.splice(i, 1); }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Regatta: a chain of buoy gates with a timer per gate.
// ---------------------------------------------------------------------------
const GATES = 6;
const GATE_TIME = 24;
const gateArchGeo = new THREE.TorusGeometry(7.5, 0.28, 6, 28, Math.PI);
const buoyGeo = (() => {
  const b = new Builder();
  const red = new THREE.Color('#e0473a'), white = new THREE.Color('#f5f2ea');
  for (let i = 0; i < 4; i++) b.add(new THREE.CylinderGeometry(0.75, 0.85, 0.7, 8), _m.makeTranslation(0, i * 0.7, 0), i % 2 ? white : red, 0.03);
  b.add(new THREE.ConeGeometry(0.75, 1.2, 8), _m.makeTranslation(0, 3.3, 0), red, 0.03);
  return b.build();
})();
const buoyMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.5 });

export class Regatta {
  constructor(scene, events) {
    this.scene = scene;
    this.events = events;
    this.active = false;
    this.gates = [];
  }

  _makeGate(x, z, h, i) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = h;
    const archMat = new THREE.MeshBasicMaterial({ color: i === GATES - 1 ? '#ffcf4d' : '#5effd9', transparent: true, opacity: 0.85 });
    const arch = new THREE.Mesh(gateArchGeo, archMat);
    arch.position.y = 1.5;
    const b1 = new THREE.Mesh(buoyGeo, buoyMat); b1.position.x = 7.5;
    const b2 = new THREE.Mesh(buoyGeo, buoyMat); b2.position.x = -7.5;
    b1.castShadow = b2.castShadow = true;
    g.add(arch, b1, b2);
    this.scene.add(g);
    return { x, z, h, g, archMat, passed: false };
  }

  _place(fromX, fromZ, h, islands, i) {
    for (let tries = 0; tries < 16; tries++) {
      const nh = h + (Math.random() - 0.5) * (tries < 8 ? 1.6 : 3.5);
      const d = 110 + Math.random() * 60;
      const x = fromX + Math.sin(nh) * d, z = fromZ + Math.cos(nh) * d;
      if (islands.every((isl) => Math.hypot(isl.x - x, isl.z - z) > isl.shoreR + 28)) return this._makeGate(x, z, nh, i);
    }
    const x = fromX + Math.sin(h) * 120, z = fromZ + Math.cos(h) * 120;
    return this._makeGate(x, z, h, i);
  }

  start(boat, islands) {
    this.stop();
    this.active = true;
    this.index = 0;
    this.elapsed = 0;
    this.gateT = GATE_TIME + 6;
    const bp = boat.position;
    const first = this._place(bp.x - Math.sin(boat.heading) * 30, bp.z - Math.cos(boat.heading) * 30, boat.heading, islands, 0);
    this.gates = [first, this._place(first.x, first.z, first.h, islands, 1)];
  }

  stop() {
    for (const g of this.gates) this.scene.remove(g.g);
    this.gates = [];
    this.active = false;
  }

  get current() { return this.gates.find((g) => !g.passed) || null; }
  get total() { return GATES; }

  update(boat, dt, time, islands) {
    if (!this.active) return;
    this.elapsed += dt;
    this.gateT -= dt;
    const bp = boat.position;
    for (const g of this.gates) {
      g.g.position.y = waveHeight(g.x, g.z, time) - 0.3;
      g.archMat.opacity = g.passed ? Math.max(0, g.archMat.opacity - dt * 2) : 0.65 + Math.sin(time * 4) * 0.2;
    }
    const cur = this.current;
    if (cur) {
      // Pass when crossing the gate line between the buoys.
      const dx = bp.x - cur.x, dz = bp.z - cur.z;
      const along = dx * Math.sin(cur.h) + dz * Math.cos(cur.h);
      const across = dx * Math.cos(cur.h) - dz * Math.sin(cur.h);
      if (Math.abs(along) < 4 && Math.abs(across) < 7.2) {
        cur.passed = true;
        this.index++;
        if (this.index >= GATES) {
          const time = this.elapsed;
          this.active = false;
          setTimeout(() => { if (!this.active) this.stop(); }, 1500);
          this.events.onRegattaDone(time);
          return;
        }
        this.gateT = GATE_TIME;
        this.events.onGate(this.index);
        if (this.gates.length < GATES) {
          const last = this.gates[this.gates.length - 1];
          this.gates.push(this._place(last.x, last.z, last.h, islands, this.gates.length));
        }
        // Clean up gates two behind.
        while (this.gates.length > 3 && this.gates[0].passed && this.gates[1].passed) { this.scene.remove(this.gates[0].g); this.gates.shift(); }
      }
    }
    if (this.gateT <= 0) {
      this.events.onRegattaFail(this.index);
      this.stop();
    }
  }
}
