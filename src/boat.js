import * as THREE from 'three';
import { Builder, clamp, lerp } from './utils.js';
import { waveHeight } from './ocean.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildHull(hullHex = '#1d4f7c') {
  const b = new Builder();
  const white = new THREE.Color('#f6f0e4');
  const band = new THREE.Color(hullHex);
  const red = new THREE.Color('#a8402f');
  const wood = new THREE.Color('#b98a55');
  const darkWood = new THREE.Color('#7a5433');

  // Hull lofted through cross-sections: z, top half-width, top y, bottom half-width, bottom y
  const S = [
    [-3.2, 1.05, 1.05, 0.55, -0.3],
    [-1.5, 1.38, 0.92, 0.72, -0.6],
    [0.8, 1.32, 0.92, 0.62, -0.6],
    [2.6, 0.78, 1.08, 0.26, -0.4],
    [4.1, 0.03, 1.42, 0.03, 0.35],
  ];
  const pts = S.map(([z, w, yt, wb, yb]) => {
    const tl = V(w, yt, z), tr = V(-w, yt, z), bl = V(wb, yb, z), br = V(-wb, yb, z);
    return {
      tl, tr, bl, br,
      ml: tl.clone().lerp(bl, 0.3), mr: tr.clone().lerp(br, 0.3),
      dl: V(w * 0.92, yt - 0.28, z), dr: V(-w * 0.92, yt - 0.28, z),
    };
  });
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], n = pts[i + 1];
    b.quad(a.tl, n.tl, n.ml, a.ml, band, 0.02);
    b.quad(a.ml, n.ml, n.bl, a.bl, white, 0.02);
    b.quad(a.tr, a.mr, n.mr, n.tr, band, 0.02);
    b.quad(a.mr, a.br, n.br, n.mr, white, 0.02);
    b.quad(a.bl, n.bl, n.br, a.br, red, 0.02);
    b.quad(a.dl, a.dr, n.dr, n.dl, wood, 0.05);
  }
  const t = pts[0];
  b.quad(t.tl, t.ml, t.mr, t.tr, band, 0.02);
  b.quad(t.ml, t.bl, t.br, t.mr, white, 0.02);

  const m = new THREE.Matrix4();
  b.add(new THREE.BoxGeometry(1.5, 0.75, 1.7), m.makeTranslation(0, 1.0, -1.5), darkWood, 0.04);
  b.add(new THREE.BoxGeometry(1.75, 0.12, 1.95), m.makeTranslation(0, 1.42, -1.5), white, 0.02);
  b.add(new THREE.CylinderGeometry(0.07, 0.12, 8.2, 6), m.makeTranslation(0, 4.7, 0.6), darkWood, 0.03);
  m.makeRotationX(Math.PI / 2).setPosition(0, 1.35, 4.6);
  b.add(new THREE.CylinderGeometry(0.05, 0.07, 1.6, 5), m, darkWood, 0.03);
  b.add(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 5), m.makeTranslation(0, 1.6, -3.05), darkWood, 0.03);
  return b.build();
}

// Triangular sail with a soft belly so flat shading gives it facets.
export function sailGeometry(tack, clew, head, bulge, n = 5) {
  const P = (i, j) => {
    const a = i / n, bb = j / n, c = 1 - a - bb;
    const p = tack.clone()
      .addScaledVector(clew.clone().sub(tack), bb)
      .addScaledVector(head.clone().sub(tack), a);
    p.x += 27 * a * bb * c * bulge;
    return p;
  };
  const pos = [];
  const push = (...vs) => vs.forEach((v) => pos.push(v.x, v.y, v.z));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n - i; j++) {
      push(P(i, j), P(i, j + 1), P(i + 1, j));
      if (j < n - i - 1) push(P(i, j + 1), P(i + 1, j + 1), P(i + 1, j));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export const MAIN_SAIL = () => sailGeometry(V(0, 2.1, -0.15), V(0, 2.1, -3.7), V(0, 8.5, -0.1), 0.85);
export const JIB_SAIL = () => sailGeometry(V(0, 1.6, 5.2), V(0, 2.0, 1.0), V(0, 7.6, 0.75), 0.75);

// Points of sail, from the angle between the heading and where the wind blows.
export function pointOfSail(c) {
  if (c > 0.72) return 'Running';
  if (c > 0.2) return 'Broad reach';
  if (c > -0.35) return 'Beam reach';
  if (c > -0.7) return 'Close-hauled';
  return 'In irons';
}

export class Boat {
  constructor() {
    this.group = new THREE.Group();
    this.model = new THREE.Group();
    this.model.rotation.order = 'YXZ';
    this.group.add(this.model);

    this.hullMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.75, side: THREE.DoubleSide });
    this.hull = new THREE.Mesh(buildHull(), this.hullMat);
    this.hull.castShadow = true;
    this.hull.receiveShadow = true;
    this.model.add(this.hull);

    this.sailMat = new THREE.MeshStandardMaterial({ color: '#fff6e2', emissive: '#3a352c', flatShading: true, roughness: 0.9, side: THREE.DoubleSide });
    this.jibMat = new THREE.MeshStandardMaterial({ color: '#f0733c', flatShading: true, roughness: 0.9, side: THREE.DoubleSide });

    this.mainPivot = new THREE.Group();
    this.mainPivot.position.set(0, 0, 0.6);
    const main = new THREE.Mesh(MAIN_SAIL(), this.sailMat);
    main.castShadow = true;
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.8, 5), new THREE.MeshStandardMaterial({ color: '#7a5433', flatShading: true }));
    boom.rotation.x = Math.PI / 2;
    boom.position.set(0, 2.0, -1.9);
    this.mainPivot.add(main, boom);
    this.model.add(this.mainPivot);

    this.jib = new THREE.Mesh(JIB_SAIL(), this.jibMat);
    this.jib.castShadow = true;
    this.model.add(this.jib);

    const flagGeo = new THREE.BufferGeometry();
    flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0.5, 0, 0, 0.25, -1.0], 3));
    flagGeo.computeVertexNormals();
    this.flagMat = new THREE.MeshStandardMaterial({ color: '#e2413a', side: THREE.DoubleSide });
    this.flag = new THREE.Mesh(flagGeo, this.flagMat);
    this.flag.position.set(0, 8.75, 0.6);
    this.model.add(this.flag);

    this.lanternMat = new THREE.MeshStandardMaterial({ color: '#ffd38a', emissive: '#ffae4a', emissiveIntensity: 0.4 });
    const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.26), this.lanternMat);
    lantern.position.set(0, 2.38, -3.05);
    this.model.add(lantern);
    this.lanternLight = new THREE.PointLight('#ffb866', 0, 45, 1.8);
    this.lanternLight.position.set(0, 3.0, -3.05);
    this.model.add(this.lanternLight);

    this.heading = 0;
    this.speed = 0;
    this.turnRate = 0;
    this.boostT = 0;
    this.sailSide = 1;
    this.boomOut = 0.5;
    this.bob = 0;
    this.pitch = 0;
    this.roll = 0;
    this.windCos = 0;
  }

  get position() { return this.group.position; }

  setLook(def) {
    this.hull.geometry.dispose();
    this.hull.geometry = buildHull(def.hull);
    this.sailMat.color.set(def.main);
    this.sailMat.emissive.set(def.main).multiplyScalar(0.12);
    this.jibMat.color.set(def.jib);
    this.flagMat.color.set(def.flag);
  }

  /**
   * mods: { maxMul, turnMul, rigging, windDir, windStrength, lantern }
   */
  update(dt, input, time, night, mods) {
    const sx = Math.sin(this.heading), cz = Math.cos(this.heading);

    // Wind: c = 1 sailing dead downwind, -1 straight into it.
    const c = sx * Math.sin(mods.windDir) + cz * Math.cos(mods.windDir);
    this.windCos = c;
    const rig = mods.rigging || 0;
    let eff = 0.92 + 0.12 * (1 - c * c) - Math.max(0, -c - 0.3) * 0.9 * (1 - rig * 0.22);
    eff = clamp(eff, 0.35 + rig * 0.1, 1.04) * (0.8 + 0.32 * mods.windStrength);
    this.windEff = eff;

    const boost = this.boostT > 0 ? 1.45 : 1;
    this.boostT = Math.max(0, this.boostT - dt);
    const maxSpeed = 26 * boost * mods.maxMul * eff;
    const accel = 13 * boost * Math.max(0.6, eff);

    const thrust = input.fwd > 0 ? input.fwd : input.fwd * 0.45;
    this.speed += (thrust * accel - (accel / maxSpeed) * this.speed) * dt;
    if (input.fwd === 0) this.speed -= this.speed * 0.35 * dt;

    const steer = clamp(Math.abs(this.speed) / 9, 0.22, 1) * (this.speed < -0.5 ? -1 : 1);
    const target = input.turn * 1.05 * steer * mods.turnMul;
    this.turnRate += (target - this.turnRate) * Math.min(1, dt * 2.8);
    this.heading += this.turnRate * dt;

    const p = this.group.position;
    p.x += Math.sin(this.heading) * this.speed * dt;
    p.z += Math.cos(this.heading) * this.speed * dt;

    // Buoyancy: sample the real wave surface under bow, stern and both sides.
    const hs = Math.sin(this.heading), hc = Math.cos(this.heading);
    const L = 3.2, W = 1.3;
    const hB = waveHeight(p.x + hs * L, p.z + hc * L, time);
    const hS = waveHeight(p.x - hs * L, p.z - hc * L, time);
    const hL = waveHeight(p.x + hc * W, p.z - hs * W, time);
    const hR = waveHeight(p.x - hc * W, p.z + hs * W, time);
    const k = Math.min(1, dt * 7);
    this.bob = lerp(this.bob, (hB + hS + hL + hR) / 4, k);
    const speedF = clamp(this.speed / 26, -0.3, 1.5);
    const pitchT = -Math.atan2(hB - hS, L * 2) * 0.9 - speedF * 0.035;
    const rollT = Math.atan2(hL - hR, W * 2) * 0.7 - this.turnRate * speedF * 0.3;
    this.pitch = lerp(this.pitch, pitchT, k);
    this.roll = lerp(this.roll, rollT, k);

    p.y = this.bob + 0.05;
    this.model.rotation.set(this.pitch, this.heading, this.roll);

    // Sails swing to the leeward side and ease out as the wind comes from behind.
    const lateral = hs * Math.cos(mods.windDir) - hc * Math.sin(mods.windDir);
    this.sailSide = lerp(this.sailSide, lateral >= 0 ? 1 : -1, Math.min(1, dt * 1.8));
    this.boomOut = lerp(this.boomOut, 0.12 + 0.88 * (c + 1) / 2, Math.min(1, dt * 1.5));
    const luff = c < -0.7 ? Math.sin(time * 14) * 0.08 : 0; // flapping when in irons
    const fill = (0.35 + 0.65 * clamp(Math.abs(speedF) + 0.15 * Math.sin(time * 1.3), 0, 1)) * (c < -0.7 ? 0.4 : 1);
    this.mainPivot.rotation.y = this.sailSide * this.boomOut + Math.sin(time * 0.9) * 0.03 + luff;
    this.mainPivot.scale.x = this.sailSide * fill;
    this.jib.scale.x = this.sailSide * fill;
    const fa = mods.windDir - this.heading - Math.PI; // flag streams downwind
    this.flag.rotation.y = Math.atan2(Math.sin(fa), Math.cos(fa)) + Math.sin(time * 6) * 0.25;

    const lamp = mods.lantern ?? 1;
    this.lanternMat.emissiveIntensity = 0.4 + night * 2.6 * lamp;
    this.lanternLight.intensity = night * 60 * lamp;
    this.lanternLight.distance = 45 * (0.6 + 0.4 * lamp);
  }
}
