import * as THREE from 'three';

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Small, fast seeded PRNG so the whole world is deterministic.
export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x, z, seed) {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

const _v = new THREE.Vector3();

// Collects flat-shaded, vertex-coloured triangles into one geometry
// so a whole island (terrain, palms, rocks, ruins) is a single draw call.
export class Builder {
  constructor(rng = Math.random) {
    this.p = [];
    this.c = [];
    this.rng = rng;
  }

  tri(a, b, c, col, jitter = 0.06) {
    const k = 1 + (this.rng() - 0.5) * 2 * jitter;
    this.p.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) this.c.push(col.r * k, col.g * k, col.b * k);
  }

  quad(a, b, c, d, col, jitter = 0.06) {
    this.tri(a, b, c, col, jitter);
    this.tri(a, c, d, col, jitter);
  }

  add(geo, matrix, col, jitter = 0.06) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const pos = g.attributes.position;
    let k = 1;
    for (let i = 0; i < pos.count; i++) {
      if (i % 3 === 0) k = 1 + (this.rng() - 0.5) * 2 * jitter;
      _v.fromBufferAttribute(pos, i);
      if (matrix) _v.applyMatrix4(matrix);
      this.p.push(_v.x, _v.y, _v.z);
      this.c.push(col.r * k, col.g * k, col.b * k);
    }
  }

  build() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }
}
