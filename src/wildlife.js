import * as THREE from 'three';
import { Builder, clamp, lerp } from './utils.js';
import { waveHeight } from './ocean.js';
import { buildHull, MAIN_SAIL, JIB_SAIL } from './boat.js';
import { createFish, animateFish, fishGeometry } from './fishmodels.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

function blob(b, pos, scale, color, rot = [0, 0, 0], detail = 0) {
  _q.setFromEuler(_e.set(...rot));
  _m.compose(pos, _q, scale);
  b.add(new THREE.IcosahedronGeometry(1, detail), _m, color, 0.06);
}

function turtleGeo() {
  const b = new Builder();
  const shell = new THREE.Color('#5f7a3a'), skin = new THREE.Color('#9bb07a');
  blob(b, V(0, 0, 0), V(1.1, 0.45, 1.35), shell, [0, 0, 0], 0);
  blob(b, V(0, 0, 1.55), V(0.32, 0.28, 0.42), skin);
  b.quad(V(0.8, -0.1, 0.6), V(1.9, -0.15, 0.2), V(1.6, -0.15, -0.2), V(0.8, -0.1, 0.1), skin);
  b.quad(V(-0.8, -0.1, 0.6), V(-0.8, -0.1, 0.1), V(-1.6, -0.15, -0.2), V(-1.9, -0.15, 0.2), skin);
  return b.build();
}

function jellyGeo() {
  const g = new THREE.SphereGeometry(0.7, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  g.scale(1, 0.8, 1);
  return g;
}


export class Wildlife {
  constructor(scene, wake, events, fx) {
    this.scene = scene;
    this.fx = fx;
    this.wake = wake;
    this.events = events;

    // Dolphins
    this.dolphins = Array.from({ length: 4 }, () => {
      const m = createFish('dolphin');
      m.scale.setScalar(3.4);
      m.rotation.order = 'YXZ';
      m.visible = false;
      scene.add(m);
      return { mesh: m, side: 0, fwd: 0, ph: 0, prevArc: 0 };
    });
    this.pod = { active: false, t: 0, cool: 25 };

    // Whale
    this.whale = createFish('whale');
    this.whale.scale.setScalar(24);
    this.whale.rotation.order = 'YXZ';
    this.whale.visible = false;
    scene.add(this.whale);
    this.whaleS = { active: false, t: 0, cool: 70, x: 0, z: 0, h: 0, splashed: false };

    // Turtle
    this.turtle = new THREE.Mesh(turtleGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true }));
    this.turtle.visible = false;
    scene.add(this.turtle);
    this.turtleS = { island: null, a: 0, dir: 1 };

    // Flying fish (instanced)
    this.fishMesh = new THREE.InstancedMesh(fishGeometry('flyingfish'), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, metalness: 0.3, roughness: 0.35, side: THREE.DoubleSide }), 12);
    this.fishMesh.frustumCulled = false;
    this.fishMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.fishMesh);
    this.fish = Array.from({ length: 12 }, () => ({ t: 1, life: 1, x: 0, z: 0, vx: 0, vz: 0, h: 0 }));
    this.fishCool = 4;

    // Glow jellies (instanced, emissive so they bloom)
    this.jellyMesh = new THREE.InstancedMesh(jellyGeo(), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }), 18);
    this.jellyMesh.frustumCulled = false;
    this.jellyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const jc = ['#ff7fc2', '#7fe9ff', '#b79bff', '#9dffb0'];
    this.jellies = Array.from({ length: 18 }, (_, i) => {
      this.jellyMesh.setColorAt(i, new THREE.Color(jc[i % jc.length]));
      return { x: 0, z: 0, ph: Math.random() * 6.28, set: false };
    });
    this.jellyMesh.instanceColor.needsUpdate = true;
    scene.add(this.jellyMesh);

    // Ghost ship
    const ghostMat = new THREE.MeshBasicMaterial({ color: '#7fd8ff', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.ghostMat = ghostMat;
    this.ghost = new THREE.Group();
    const gh = new THREE.Group();
    gh.add(new THREE.Mesh(buildHull('#7fd8ff'), ghostMat));
    const ms = new THREE.Mesh(MAIN_SAIL(), ghostMat); ms.position.z = 0.6; ms.rotation.y = 0.5;
    gh.add(ms, new THREE.Mesh(JIB_SAIL(), ghostMat));
    gh.scale.setScalar(2.2);
    this.ghost.add(gh);
    this.ghostLight = new THREE.PointLight('#5fc8ff', 0, 90, 1.5);
    this.ghostLight.position.y = 8;
    this.ghost.add(this.ghostLight);
    this.ghost.visible = false;
    scene.add(this.ghost);
    this.ghostS = { active: false, t: 0, cool: 30, h: 0, fade: 0, caught: false, nightUsed: false };

    this._dummy = new THREE.Object3D();
  }

  splash(x, z, n = 6, size = 3) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.wake.emit(x + Math.cos(a) * 0.8, z + Math.sin(a) * 0.8, size * 0.4, size * 1.6, 1.4, Math.cos(a) * 3, Math.sin(a) * 3);
    }
    this.fx.burst(x, 0.2, z, n * 6, size * 2.2, size * 0.9, Math.min(2.5, size * 0.35));
  }

  // ctx: { boat, dt, time, night, nearestIsland, camera }
  update(ctx) {
    const { boat, dt, time } = ctx;
    const bp = boat.position;
    const sp = Math.abs(boat.speed);
    const hs = Math.sin(boat.heading), hc = Math.cos(boat.heading);

    // ---- dolphins race fast boats -----------------------------------------
    const pod = this.pod;
    if (!pod.active) {
      pod.cool -= dt;
      if (pod.cool <= 0 && sp > 13) {
        pod.active = true; pod.t = 0;
        this.dolphins.forEach((d, i) => {
          d.side = (i % 2 ? 1 : -1) * (4.5 + Math.random() * 3.5);
          d.fwd = 3 + i * 2.6 + Math.random() * 2;
          d.ph = Math.random() * 6.28;
          d.mesh.visible = true;
          d.mesh.position.set(bp.x + hc * d.side * 3, -4, bp.z - hs * d.side * 3);
        });
        this.events.onSighting('dolphin');
      }
    } else {
      pod.t += dt;
      const leaving = pod.t > 22 || sp < 5;
      for (const d of this.dolphins) {
        const side = d.side * (leaving ? 2.5 : 1);
        const tx = bp.x + hs * d.fwd + hc * side;
        const tz = bp.z + hc * d.fwd - hs * side;
        d.mesh.position.x = lerp(d.mesh.position.x, tx, Math.min(1, dt * 2));
        d.mesh.position.z = lerp(d.mesh.position.z, tz, Math.min(1, dt * 2));
        const arc = Math.sin(time * 2.4 + d.ph);
        const base = waveHeight(d.mesh.position.x, d.mesh.position.z, time);
        d.mesh.position.y = base + (leaving ? lerp(arc * 1.6 - 0.5, -6, clamp((pod.t - 22) / 3, 0, 1)) : arc * 1.7 - 0.5);
        d.mesh.rotation.set(-Math.cos(time * 2.4 + d.ph) * 0.65, boat.heading, 0);
        if ((arc < 0.3) !== (d.prevArc < 0.3) && !leaving) { this.wake.emit(d.mesh.position.x, d.mesh.position.z, 0.6, 2.6, 1.0); this.fx.burst(d.mesh.position.x, base, d.mesh.position.z, 9, 4.5, 1.6, 0.9); }
        animateFish(d.mesh, time, { speed: 9 });
        d.prevArc = arc;
      }
      if (pod.t > 26 || (leaving && pod.t > 3 && sp < 5 && pod.t > 8)) {
        pod.active = false;
        pod.cool = 35 + Math.random() * 50;
        this.dolphins.forEach((d) => (d.mesh.visible = false));
      }
    }

    // ---- flying fish ---------------------------------------------------------
    this.fishCool -= dt;
    if (this.fishCool <= 0 && sp > 8) {
      this.fishCool = 4 + Math.random() * 7;
      const side = Math.random() < 0.5 ? -1 : 1;
      const n = 3 + Math.floor(Math.random() * 4);
      let spawned = 0;
      for (const f of this.fish) {
        if (f.t < f.life || spawned >= n) continue;
        const fwd = 8 + Math.random() * 14, off = side * (5 + Math.random() * 6);
        f.x = bp.x + hs * fwd + hc * off; f.z = bp.z + hc * fwd - hs * off;
        const dir = boat.heading + side * (0.3 + Math.random() * 0.5);
        const v = 10 + Math.random() * 6;
        f.vx = Math.sin(dir) * v; f.vz = Math.cos(dir) * v; f.h = dir;
        f.t = -Math.random() * 0.5; f.life = 1.1 + Math.random() * 0.6;
        spawned++;
      }
      if (spawned) this.events.onSighting('flyingfish');
    }
    this.fish.forEach((f, i) => {
      const dd = this._dummy;
      if (f.t >= f.life) { dd.scale.setScalar(0); dd.updateMatrix(); this.fishMesh.setMatrixAt(i, dd.matrix); return; }
      f.t += dt;
      const t = clamp(f.t / f.life, 0, 1);
      if (f.t > 0) { f.x += f.vx * dt; f.z += f.vz * dt; }
      const y = waveHeight(f.x, f.z, time) + Math.sin(t * Math.PI) * 2.2 - 0.2;
      dd.position.set(f.x, f.t > 0 ? y : -5, f.z);
      dd.rotation.set(-Math.cos(t * Math.PI) * 0.6, f.h, 0, 'YXZ');
      dd.scale.setScalar(1.25);
      dd.updateMatrix();
      this.fishMesh.setMatrixAt(i, dd.matrix);
      if (f.t >= f.life) { this.wake.emit(f.x, f.z, 0.3, 1.2, 0.7); this.fx.burst(f.x, waveHeight(f.x, f.z, time), f.z, 5, 2.5, 1, 0.5); }
    });
    this.fishMesh.instanceMatrix.needsUpdate = true;

    // ---- turtle in the shallows of the nearest island ------------------------
    const isl = ctx.nearestIsland;
    const ts = this.turtleS;
    if (isl && isl.dist < 260 && isl.spawn >= 1) {
      if (ts.island !== isl) { ts.island = isl; ts.a = Math.random() * 6.28; ts.dir = Math.random() < 0.5 ? -1 : 1; }
      ts.a += dt * 0.05 * ts.dir;
      const r = isl.shoreR + 9;
      const x = isl.x + Math.cos(ts.a) * r, z = isl.z + Math.sin(ts.a) * r;
      this.turtle.visible = true;
      this.turtle.position.set(x, waveHeight(x, z, time) - 0.25 + Math.sin(time * 0.8) * 0.1, z);
      this.turtle.rotation.y = Math.atan2(-Math.sin(ts.a) * ts.dir, Math.cos(ts.a) * ts.dir);
      if (Math.hypot(bp.x - x, bp.z - z) < 50) this.events.onSighting('turtle');
    } else this.turtle.visible = false;

    // ---- glow jellies at night -------------------------------------------------
    const nightAmt = clamp((ctx.night - 0.4) / 0.5, 0, 1);
    this.jellyMesh.visible = nightAmt > 0.01;
    if (this.jellyMesh.visible) {
      this.jellyMesh.material.opacity = 0.85 * nightAmt;
      let seen = false;
      this.jellies.forEach((j, i) => {
        const dx = j.x - bp.x, dz = j.z - bp.z;
        if (!j.set || dx * dx + dz * dz > 95 * 95) {
          const a = Math.random() * Math.PI * 2, d = 18 + Math.random() * 70;
          j.x = bp.x + hs * 40 + Math.cos(a) * d; j.z = bp.z + hc * 40 + Math.sin(a) * d; j.set = true;
        }
        const pulse = 0.85 + 0.25 * Math.sin(time * 2 + j.ph);
        const dd = this._dummy;
        dd.position.set(j.x, waveHeight(j.x, j.z, time) - 0.35 + Math.sin(time * 0.7 + j.ph) * 0.15, j.z);
        dd.rotation.set(0, 0, 0);
        dd.scale.set(pulse, 1 / pulse, pulse);
        dd.updateMatrix();
        this.jellyMesh.setMatrixAt(i, dd.matrix);
        if (dx * dx + dz * dz < 40 * 40) seen = true;
      });
      this.jellyMesh.instanceMatrix.needsUpdate = true;
      if (seen && nightAmt > 0.6) this.events.onSighting('jelly');
    }

    // ---- whale breaches far from shore ---------------------------------------
    const w = this.whaleS;
    if (!w.active) {
      w.cool -= dt;
      if (w.cool <= 0) {
        w.cool = 15;
        if ((!isl || isl.dist > 180) && Math.random() < 0.5) {
          const side = Math.random() < 0.5 ? -1 : 1;
          const fwd = 70 + Math.random() * 60, off = side * (45 + Math.random() * 40);
          w.x = bp.x + hs * fwd + hc * off; w.z = bp.z + hc * fwd - hs * off;
          w.h = boat.heading + side * (Math.PI / 2) + (Math.random() - 0.5);
          w.active = true; w.t = 0; w.splashed = false; w.blown = false;
          this.whale.visible = true;
        }
      }
    } else {
      w.t += dt;
      const t = w.t;
      const T = 4.4;
      w.x += Math.sin(w.h) * 4 * dt; w.z += Math.cos(w.h) * 4 * dt;
      const base = waveHeight(w.x, w.z, time);
      const y = t < T ? -14 + 22 * Math.sin(Math.PI * clamp(t / T, 0, 1)) : -8 - (t - T) * 3;
      this.whale.position.set(w.x, base + y, w.z);
      const pitch = lerp(-1.15, 0.9, clamp(t / T, 0, 1));
      this.whale.rotation.set(pitch, w.h, clamp(t / T, 0, 1) * 1.3);
      animateFish(this.whale, time, { speed: 2.5 });
      if (!w.blown && y > -2) { w.blown = true; this.splash(w.x, w.z, 8, 5); this.events.onSighting('whale'); }
      if (!w.splashed && t > T * 0.72 && y < 3) { w.splashed = true; this.splash(w.x, w.z, 14, 9); this.splash(w.x + Math.sin(w.h) * 6, w.z + Math.cos(w.h) * 6, 10, 7); this.events.onWhaleSplash(Math.hypot(bp.x - w.x, bp.z - w.z)); }
      if (t > T + 3) { w.active = false; this.whale.visible = false; w.cool = 80 + Math.random() * 120; }
    }

    // ---- the ghost ship sails at midnight ----------------------------------------
    const g = this.ghostS;
    if (ctx.night < 0.5) g.nightUsed = false;
    if (!g.active) {
      g.cool -= dt;
      if (g.cool <= 0) {
        g.cool = 20;
        if (ctx.night > 0.85 && !g.nightUsed && Math.random() < 0.4) {
          g.nightUsed = true;
          const a = boat.heading + (Math.random() < 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.6);
          const d = 240;
          this.ghost.position.set(bp.x + Math.sin(a) * d, 0, bp.z + Math.cos(a) * d);
          // Aim it past the boat so the player can intercept.
          const tx = bp.x + hs * 60, tz = bp.z + hc * 60;
          g.h = Math.atan2(tx - this.ghost.position.x, tz - this.ghost.position.z);
          g.active = true; g.t = 0; g.fade = 0; g.caught = false;
          this.ghost.visible = true;
        }
      }
    } else {
      g.t += dt;
      const gp = this.ghost.position;
      gp.x += Math.sin(g.h) * 9 * dt; gp.z += Math.cos(g.h) * 9 * dt;
      gp.y = waveHeight(gp.x, gp.z, time) + 0.2;
      this.ghost.rotation.set(Math.sin(time * 0.7) * 0.04, g.h, Math.sin(time * 0.9) * 0.05);
      const d = Math.hypot(bp.x - gp.x, bp.z - gp.z);
      if (d < 330) this.events.onSighting('ghost');
      const target = g.caught || g.t > 85 ? 0 : 1;
      g.fade = lerp(g.fade, target, Math.min(1, dt * (target ? 0.6 : 1.5)));
      this.ghostMat.opacity = 0.35 * g.fade * (0.8 + 0.2 * Math.sin(time * 3));
      this.ghostLight.intensity = 120 * g.fade;
      if (!g.caught && d < 26) { g.caught = true; this.events.onGhost(gp.x, gp.z); }
      if ((g.caught || g.t > 85) && g.fade < 0.02) { g.active = false; this.ghost.visible = false; g.cool = 30; }
    }
  }
}
