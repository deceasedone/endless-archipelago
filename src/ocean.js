import * as THREE from 'three';

// ---------------------------------------------------------------------------
// One wave definition drives everything: the water mesh, the shading normals,
// the foam decals and the boat's buoyancy all sample the same sum of sines.
// ---------------------------------------------------------------------------
const WAVE_DEFS = [
  // dirX, dirZ, wavelength, amplitude
  [0.8, 0.6, 95, 0.55],
  [-0.45, 0.89, 58, 0.32],
  [0.2, -0.98, 36, 0.18],
];

const WAVES = WAVE_DEFS.map(([dx, dz, len, amp]) => {
  const l = Math.hypot(dx, dz);
  const k = (Math.PI * 2) / len;
  return { dx: dx / l, dz: dz / l, k, amp, w: Math.sqrt(9.8 * k) };
});

export const waveState = { amp: 1 };

export function waveHeight(x, z, t) {
  let h = 0;
  for (const w of WAVES) h += w.amp * Math.sin((x * w.dx + z * w.dz) * w.k + t * w.w);
  return h * waveState.amp;
}

const f = (n) => n.toFixed(5);
export const WAVE_GLSL = `
uniform float uWaveAmp;
float waveH(vec2 p, float t) {
  float h = 0.0;
${WAVES.map((w) => `  h += ${f(w.amp)} * sin(dot(p, vec2(${f(w.dx)}, ${f(w.dz)})) * ${f(w.k)} + t * ${f(w.w)});`).join('\n')}
  return h * uWaveAmp;
}
vec2 waveGrad(vec2 p, float t) {
  vec2 g = vec2(0.0);
${WAVES.map((w) => `  g += ${f(w.amp * w.k)} * vec2(${f(w.dx)}, ${f(w.dz)}) * cos(dot(p, vec2(${f(w.dx)}, ${f(w.dz)})) * ${f(w.k)} + t * ${f(w.w)});`).join('\n')}
  return g * uWaveAmp;
}
`;

export const MAX_ISLANDS = 16;
const OCEAN_SIZE = 3200;
const OCEAN_SEGS = 320;
export const OCEAN_GRID = OCEAN_SIZE / OCEAN_SEGS;

// Shared environment colours (sky + water read the same instances).
export function createEnvUniforms() {
  return {
    uTime: { value: 0 },
    uHorizon: { value: new THREE.Color() },
    uZenith: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color() },
    uLightDir: { value: new THREE.Vector3(0, 1, 0) },
    uLightColor: { value: new THREE.Color() },
    uNight: { value: 0 },
    uFogDensity: { value: 0.0013 },
    uWaveAmp: { value: 1 },
    uStorm: { value: 0 },
    uFlash: { value: 0 },
  };
}

export function createOcean(env) {
  const geo = new THREE.PlaneGeometry(OCEAN_SIZE, OCEAN_SIZE, OCEAN_SEGS, OCEAN_SEGS);
  geo.rotateX(-Math.PI / 2);

  const uniforms = {
    ...env,
    uDeep: { value: new THREE.Color() },
    uShallow: { value: new THREE.Color() },
    uFoam: { value: new THREE.Color() },
    uIslands: { value: Array.from({ length: MAX_ISLANDS }, () => new THREE.Vector4()) },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorld;
      ${WAVE_GLSL}
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        wp.y += waveH(wp.xz, uTime);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime, uFogDensity, uStorm, uFlash;
      uniform vec3 uHorizon, uZenith, uLightDir, uLightColor, uDeep, uShallow, uFoam;
      uniform vec4 uIslands[${MAX_ISLANDS}];
      varying vec3 vWorld;
      ${WAVE_GLSL}

      void main() {
        vec2 p = vWorld.xz;
        vec3 toCam = cameraPosition - vWorld;
        float dist = length(toCam);
        vec3 V = toCam / dist;

        // Analytic normal: big swell + small ripples that fade with distance.
        vec2 g = waveGrad(p, uTime);
        float df = exp(-dist * 0.007);
        // Warp the ripple domain so highlights break up organically instead of in a lattice.
        vec2 rp = p + 5.0 * vec2(sin(p.y * 0.043 + uTime * 0.21) + sin(p.x * 0.017 - uTime * 0.1),
                                 cos(p.x * 0.037 - uTime * 0.17) + cos(p.y * 0.021 + uTime * 0.13));
        vec2 d = vec2(0.0);
        d += 0.085 * vec2(0.96, 0.29) * cos(dot(rp, vec2(0.96, 0.29)) * 0.83 + uTime * 1.7);
        d += 0.080 * vec2(-0.51, 0.86) * cos(dot(rp, vec2(-0.51, 0.86)) * 1.27 - uTime * 2.1);
        d += 0.065 * vec2(0.37, -0.93) * cos(dot(rp, vec2(0.37, -0.93)) * 2.11 + uTime * 2.9);
        d += 0.050 * vec2(-0.89, -0.45) * cos(dot(rp, vec2(-0.89, -0.45)) * 3.43 + uTime * 3.4);
        d += 0.040 * vec2(0.71, 0.70) * cos(dot(rp, vec2(0.71, 0.70)) * 5.19 - uTime * 4.1);
        d += 0.030 * vec2(-0.17, 0.98) * cos(dot(rp, vec2(-0.17, 0.98)) * 7.31 + uTime * 5.0);
        g += d * df * (1.0 + uStorm * 0.45);
        vec3 N = normalize(vec3(-g.x, 1.0, -g.y));

        // Shallows and surf around the nearest islands.
        float shore = 0.0;
        float foam = 0.0;
        float clear = 0.0;
        for (int i = 0; i < ${MAX_ISLANDS}; i++) {
          vec4 I = uIslands[i];
          if (I.z <= 0.0) continue;
          vec2 rel = p - I.xy;
          float dd = length(rel) - I.z;
          if (dd > 45.0) continue;
          float ang = atan(rel.y, rel.x);
          shore = max(shore, 1.0 - smoothstep(0.0, 40.0, dd));
          clear = max(clear, 1.0 - smoothstep(2.0, 16.0, dd));
          float wob = sin(ang * 7.0 + uTime * 0.5) * 1.2;
          float band = sin((dd + wob) * 0.75 - uTime * 1.5);
          float surf = smoothstep(0.72, 0.98, band) * (1.0 - smoothstep(2.0, 20.0, dd)) * smoothstep(-6.0, 0.0, dd);
          foam = max(foam, surf * 0.75);
        }

        vec3 base = mix(uDeep, uShallow, shore * 0.9);
        float h = waveH(p, uTime);
        base = mix(base, uShallow, smoothstep(0.35, 1.05, h) * 0.22);

        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 R = reflect(-V, N);
        R.y = abs(R.y);
        vec3 sky = mix(uHorizon, uZenith, pow(R.y, 0.5));
        float spec = pow(max(dot(R, uLightDir), 0.0), 220.0) * 1.6
                   + pow(max(dot(R, uLightDir), 0.0), 28.0) * 0.12;

        vec3 col = mix(base, sky, fres * 0.85) + uLightColor * spec;
        col += vec3(0.65, 0.72, 1.0) * uFlash * (0.08 + fres * 0.5);
        col = mix(col, uFoam, foam);

        float fog = 1.0 - exp(-pow(dist * uFogDensity, 2.0));
        col = mix(col, uHorizon, fog);

        float alpha = mix(1.0, 0.62, clear * (1.0 - fres));
        alpha = max(alpha, foam);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  return { mesh, uniforms };
}

export function createSky(env) {
  const mat = new THREE.ShaderMaterial({
    uniforms: env,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uHorizon, uZenith, uSunDir, uSunColor;
      uniform float uNight, uStorm, uFlash;
      varying vec3 vDir;
      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 col = mix(uHorizon, uZenith, pow(h, 0.42));

        float sd = max(dot(d, uSunDir), 0.0);
        col += uSunColor * (smoothstep(0.9990, 0.9995, sd) * 4.0 + pow(sd, 10.0) * 0.22 + pow(sd, 120.0) * 0.5) * (1.0 - uStorm * 0.85);

        float md = max(dot(d, -uSunDir), 0.0);
        col += vec3(0.85, 0.9, 1.0) * (smoothstep(0.9992, 0.9995, md) * 1.6 + pow(md, 60.0) * 0.12) * uNight * (1.0 - uStorm * 0.85);

        vec3 q = d * 170.0;
        float r = hash(floor(q));
        float star = step(0.9962, r) * smoothstep(0.5, 0.05, length(fract(q) - 0.5));
        star *= 0.6 + 0.4 * sin(r * 6000.0);
        col += vec3(star) * uNight * smoothstep(0.02, 0.25, d.y) * 1.4 * (1.0 - uStorm);
        col += vec3(0.7, 0.76, 1.0) * uFlash * (0.25 + 0.5 * h);

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

// Foam decals that ride the same wave surface as the water.
export function createWake(env, foamColor) {
  const MAX = 320;
  const offs = new Float32Array(MAX * 2);
  const sa = new Float32Array(MAX * 2);
  const parts = Array.from({ length: MAX }, () => ({ age: 1, life: 1, s0: 0, s1: 0, vx: 0, vz: 0 }));
  let cursor = 0;

  const base = new THREE.PlaneGeometry(1, 1);
  base.rotateX(-Math.PI / 2);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.attributes.position);
  geo.setAttribute('uv', base.attributes.uv);
  const aOff = new THREE.InstancedBufferAttribute(offs, 2);
  const aSA = new THREE.InstancedBufferAttribute(sa, 2);
  aOff.setUsage(THREE.DynamicDrawUsage);
  aSA.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aOff', aOff);
  geo.setAttribute('aSA', aSA);
  geo.instanceCount = MAX;

  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: env.uTime, uWaveAmp: env.uWaveAmp, uFoam: foamColor },
    transparent: true,
    depthWrite: false,
    vertexShader: `
      uniform float uTime;
      attribute vec2 aOff;
      attribute vec2 aSA;
      varying vec2 vUv;
      varying float vA;
      ${WAVE_GLSL}
      void main() {
        vUv = uv;
        vA = aSA.y;
        vec2 p = aOff + position.xz * aSA.x;
        vec3 wp = vec3(p.x, waveH(p, uTime) + 0.07, p.y);
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uFoam;
      varying vec2 vUv;
      varying float vA;
      void main() {
        float a = smoothstep(0.5, 0.18, length(vUv - 0.5)) * vA;
        gl_FragColor = vec4(uFoam, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;

  return {
    mesh,
    emit(x, z, s0, s1, life, vx = 0, vz = 0) {
      const p = parts[cursor];
      p.age = 0; p.life = life; p.s0 = s0; p.s1 = s1; p.vx = vx; p.vz = vz;
      offs[cursor * 2] = x;
      offs[cursor * 2 + 1] = z;
      cursor = (cursor + 1) % MAX;
    },
    update(dt) {
      for (let i = 0; i < MAX; i++) {
        const p = parts[i];
        if (p.age >= p.life) { sa[i * 2] = 0; sa[i * 2 + 1] = 0; continue; }
        p.age += dt;
        const t = Math.min(1, p.age / p.life);
        offs[i * 2] += p.vx * dt;
        offs[i * 2 + 1] += p.vz * dt;
        sa[i * 2] = p.s0 + (p.s1 - p.s0) * Math.sqrt(t);
        sa[i * 2 + 1] = (1 - t) * (1 - t) * 0.7;
      }
      aOff.needsUpdate = true;
      aSA.needsUpdate = true;
    },
  };
}
