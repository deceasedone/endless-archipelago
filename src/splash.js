import * as THREE from 'three';

// Pooled water droplets: one instanced draw call for every splash in the game.
export class Splash {
  constructor(scene, max = 600) {
    this.max = max;
    this.mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.13, 0),
      new THREE.MeshStandardMaterial({ color: '#e9fbff', emissive: '#6fc7e8', emissiveIntensity: 0.35, roughness: 0.15, transparent: true, opacity: 0.92 }),
      max,
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.age = new Float32Array(max).fill(1);
    this.size = new Float32Array(max);
    this.cursor = 0;
    this.dummy = new THREE.Object3D();
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, this.dummy.matrix);
    scene.add(this.mesh);
  }

  /** Burst of droplets. power ~ upward speed, spread ~ sideways speed. */
  burst(x, y, z, count = 12, power = 5, spread = 2.5, size = 1, dir = null) {
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const a = Math.random() * Math.PI * 2, r = Math.random();
      this.p[i * 3] = x + Math.cos(a) * r * 0.4 * size;
      this.p[i * 3 + 1] = y;
      this.p[i * 3 + 2] = z + Math.sin(a) * r * 0.4 * size;
      this.v[i * 3] = Math.cos(a) * spread * (0.3 + r) + (dir ? dir.x : 0);
      this.v[i * 3 + 1] = power * (0.55 + Math.random() * 0.6);
      this.v[i * 3 + 2] = Math.sin(a) * spread * (0.3 + r) + (dir ? dir.z : 0);
      this.age[i] = 0;
      this.life[i] = 0.5 + Math.random() * 0.6;
      this.size[i] = size * (0.5 + Math.random() * 0.9);
    }
  }

  update(dt) {
    const d = this.dummy;
    for (let i = 0; i < this.max; i++) {
      if (this.age[i] >= this.life[i]) {
        if (this.age[i] < 9) { this.age[i] = 9; d.scale.setScalar(0); d.updateMatrix(); this.mesh.setMatrixAt(i, d.matrix); }
        continue;
      }
      this.age[i] += dt;
      this.v[i * 3 + 1] -= 18 * dt;
      this.p[i * 3] += this.v[i * 3] * dt;
      this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt;
      this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      const k = 1 - this.age[i] / this.life[i];
      d.position.set(this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2]);
      // stretch along velocity so droplets read as streaks
      const vy = this.v[i * 3 + 1];
      d.scale.set(this.size[i] * k, this.size[i] * k * (1 + Math.min(2, Math.abs(vy) * 0.12)), this.size[i] * k);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
