import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { createEnvUniforms, createOcean, createSky, createWake, waveHeight, waveState, OCEAN_GRID, MAX_ISLANDS } from './ocean.js';
import { Boat, pointOfSail } from './boat.js';
import { Archipelago, CELL, TRIALS } from './archipelago.js';
import { GameAudio } from './audio.js';
import { Weather } from './weather.js';
import { Wildlife } from './wildlife.js';
import { Treasure, Regatta } from './quests.js';
import { Fishing } from './fishing.js';
import { Splash } from './splash.js';
import { FishStudio } from './fishmodels.js';
import { Profile, todayKey, stringSeed, DEFAULT_SEED } from './progress.js';
import { UI, fmtTime } from './ui.js';
import { ASPECTS, RANKS, BOTTLE_KINDS, STORY, SAILS, CREATURES, RARITY, UPGRADES, FISH_DESC } from './data.js';
import { clamp, lerp, smoothstep } from './utils.js';

const profile = new Profile();
profile.ensureBounties();
const ui = new UI();

// ---- renderer / scene -----------------------------------------------------------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#a8d8f0', 0.0013);
const camera = new THREE.PerspectiveCamera(58, 1, 0.5, 7000);

const env = createEnvUniforms();
const sky = createSky(env);
const ocean = createOcean(env);
const wake = createWake(env, ocean.uniforms.uFoam);
scene.add(sky, ocean.mesh, wake.mesh);

const seabed = new THREE.Mesh(new THREE.PlaneGeometry(3200, 3200).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#3fa7a3' }));
seabed.position.y = -5.6;
scene.add(seabed);

const hemi = new THREE.HemisphereLight('#cfe9ff', '#6f8f6a', 1);
const sun = new THREE.DirectionalLight('#ffffff', 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -95, right: 95, top: 95, bottom: -95, near: 1, far: 520 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.6;
scene.add(hemi, sun, sun.target);

// ---- post-processing ----------------------------------------------------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.55, 0.88);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uVignette: { value: 0.32 }, uFlash: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVignette, uFlash; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - 0.5;
      float v = 1.0 - dot(d, d) * uVignette * 2.4;
      c.rgb = c.rgb * v + vec3(0.8, 0.85, 1.0) * uFlash * 0.18;
      gl_FragColor = c; }`,
});
composer.addPass(grade);

let quality = profile.d.quality || 'high';
function applyQuality() {
  renderer.setPixelRatio(quality === 'high' ? Math.min(devicePixelRatio, 2) : 1);
  resize();
}

// ---- constellation of the Seven Stars ----------------------------------------------------
const STAR_SHAPE = [[-0.36, 0.2], [-0.22, 0.27], [-0.07, 0.23], [0.06, 0.31], [0.17, 0.22], [0.3, 0.28], [0.26, 0.13]];
const constellation = (() => {
  const g = new THREE.Group();
  const pos = [], cols = [], sizes = [];
  for (const [ax, el] of STAR_SHAPE) {
    const yaw = ax; // due north (+z)
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el)).multiplyScalar(2500);
    pos.push(dir.x, dir.y, dir.z);
    cols.push(1, 1, 1);
    sizes.push(10);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uNight: { value: 0 }, uPx: { value: 1 } },
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute vec3 color; attribute float size; uniform float uPx; varying vec3 vC; void main(){ vC = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uPx; }',
    fragmentShader: 'uniform float uNight; varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); a *= a; gl_FragColor = vec4(vC * a * uNight * 1.6, a * uNight); }',
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6 * 6), 3));
  const lineMat = new THREE.LineBasicMaterial({ color: '#cfc2ff', transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  lines.frustumCulled = false;
  g.add(lines, pts);
  g.renderOrder = -9;
  pts.renderOrder = lines.renderOrder = -9;
  scene.add(g);
  return { g, geo, mat, lineGeo, lineMat, pos };
})();

function refreshConstellation() {
  const c = constellation;
  const col = c.geo.attributes.color, size = c.geo.attributes.size, lp = c.lineGeo.attributes.position;
  let segs = 0;
  ASPECTS.forEach((a, i) => {
    const lit = (profile.d.aspects[a.name] || 0) > 0;
    const cc = new THREE.Color(lit ? a.color : '#55607a');
    col.setXYZ(i, cc.r, cc.g, cc.b);
    size.setX(i, lit ? 26 : 9);
    const nextLit = i < 6 && (profile.d.aspects[ASPECTS[i + 1].name] || 0) > 0;
    if (lit && nextLit) {
      lp.setXYZ(segs * 2, c.pos[i * 3], c.pos[i * 3 + 1], c.pos[i * 3 + 2]);
      lp.setXYZ(segs * 2 + 1, c.pos[i * 3 + 3], c.pos[i * 3 + 4], c.pos[i * 3 + 5]);
      segs++;
    }
  });
  c.lineGeo.setDrawRange(0, segs * 2);
  col.needsUpdate = size.needsUpdate = lp.needsUpdate = true;
}
refreshConstellation();

// ---- systems ----------------------------------------------------------------------------
const audio = new GameAudio();
const boat = new Boat();
scene.add(boat.group);
const weather = new Weather(scene, audio);

const events = {
  onAwaken, onBottle, onTrialHint,
  onSighting, onGhost, onWhaleSplash,
  onChestFound: () => { ui.toast('Something stirs below', 'A chest is rising from the deep…', '#ffcf4d'); audio.splash(1); },
  onChestOpen, onGate, onRegattaDone, onRegattaFail,
  onCatch, onEscape: (f) => { if (f) { ui.toast('It got away…', `That felt like a ${RARITY[f.rarity].label.toLowerCase()} one.`, '#ff8a7a'); audio.fail(); } },
  onUI: (s) => { if (s && s.state === 'reel' && s.fish) s.thumb = studio.thumb(s.fish.id); ui.fishing(s); },
};
const splash = new Splash(scene);
const studio = new FishStudio(document.getElementById('catchCanvas'));
const wildlife = new Wildlife(scene, wake, events, splash);
const treasure = new Treasure(scene, events);
const regatta = new Regatta(scene, events);
const fishing = new Fishing(scene, env, audio, splash, wake, events);

let world = null;
let worldKey = '';
let mode = 'voyage';
let seed = profile.d.seed;
let started = false;
let tod = profile.d.tod ?? 0.34;
let night = 0;
let fuel = 1;
let session = newSession();
let time = 0;

function newSession() {
  return { score: 0, time: 0, shrines: 0, bottles: 0, fish: 0, chests: 0, gates: 0, distance: 0, topKnots: 0, combo: 1, comboT: 0, bestCombo: 1, trials: 0, over: false, distPts: 0 };
}

function lvl(id) { return profile.level(id); }
function mods() {
  return {
    maxMul: 1 + lvl('hull') * 0.08,
    turnMul: 1 + lvl('rudder') * 0.12,
    rigging: lvl('rigging'),
    windDir: weather.windDir,
    windStrength: weather.windStrength,
    lantern: mode === 'lantern' ? (0.35 + fuel * 0.9) * (1 + lvl('lantern') * 0.25) : 1 + lvl('lantern') * 0.3,
  };
}

function applySail() {
  const def = SAILS.find((s) => s.id === profile.d.sail) || SAILS[0];
  boat.setLook(def);
}
applySail();

// ---- scoring --------------------------------------------------------------------------------
function addScore(pts, label, color) {
  if (session.over) return;
  session.score += Math.round(pts);
  if (label) ui.pop(`+${Math.round(pts)} ${label}`, color);
}

function addPearls(n) {
  if (n <= 0) return;
  profile.d.pearls += n;
  audio.coin();
}

let pendingLeagues = 0, pendingStorm = 0;
function track(stat, amount = 1) {
  const res = profile.track(stat, amount);
  for (const b of res.bounties) { ui.toast('Bounty complete!', `${b.text} · +${b.pearls} pearls`, '#8dfce0'); audio.coin(); }
  for (const m of res.milestones) { ui.banner(m, 'Milestone'); audio.fanfare(); addPearls(10); }
  if (res.bounties.length) ui.bounties(profile.d.bounties);
}

function rankInfo() {
  const n = profile.d.stats.shrines;
  const i = RANKS.reduce((best, r, k) => (n >= r[0] ? k : best), 0);
  const next = RANKS[i + 1];
  return { i, name: RANKS[i][1], bar: next ? (n - RANKS[i][0]) / (next[0] - RANKS[i][0]) : 1 };
}

function refreshStats() {
  const r = rankInfo();
  ui.stats({
    rank: r.name, pearls: profile.d.pearls,
    shrines: mode === 'voyage' ? world.awakened.size : session.shrines,
    bottles: mode === 'voyage' ? world.collected.size : session.bottles,
    leagues: (session.distance / 500).toFixed(1), bar: r.bar,
  });
}

function unlockSails() {
  for (const s of profile.checkSails()) ui.toast('New sails unlocked!', `${s.name} · equip at the Shipwright (U)`, s.jib);
}

// ---- events ------------------------------------------------------------------------------------
function onAwaken(island) {
  const s = island.shrine;
  const { aspect } = s;
  const isTrial = s.trial !== 'approach';
  session.combo = session.comboT > 0 ? Math.min(5, session.combo + 1) : 1;
  session.comboT = 75;
  session.bestCombo = Math.max(session.bestCombo, session.combo);
  addScore((isTrial ? 200 : 100) * session.combo, session.combo > 1 ? `shrine ×${session.combo}` : 'shrine', aspect.color);
  addPearls(5 + (isTrial ? 5 : 0));
  session.shrines++;
  const firstOfAspect = !profile.d.aspects[aspect.name];
  const rankBefore = rankInfo().i;
  profile.d.aspects[aspect.name] = (profile.d.aspects[aspect.name] || 0) + 1;
  track('shrines');
  if (night > 0.6) track('nightShrines');
  if (isTrial) { track('trials'); session.trials++; }

  audio.chime(session.shrines);
  boat.boostT = 9;
  ui.flash(aspect.color);
  cine.t = 2.8; cine.target.set(island.x, s.y, island.z);
  ui.toast(island.name, `Shrine of the ${aspect.name} awakened${isTrial ? ' · trial complete' : ''} · tailwind!`, aspect.color);
  if (firstOfAspect) {
    refreshConstellation();
    setTimeout(() => ui.toast(`A new star: ${aspect.name}`, 'Sail north tonight: a star has joined the constellation', aspect.color), 1600);
    if (ASPECTS.every((a) => profile.d.aspects[a.name]) && !profile.d.constellation) {
      profile.d.constellation = true;
      addPearls(100);
      setTimeout(() => { ui.banner('The Seven Stars are joined', 'Constellation complete', '#b79bff'); audio.fanfare(); }, 3000);
    }
  }
  if (rankInfo().i > rankBefore) setTimeout(() => { ui.banner(rankInfo().name, 'New rank'); audio.fanfare(); }, 2000);
  unlockSails();
  if (mode === 'lantern') fuel = Math.min(1, fuel + 0.35);
  if (mode === 'daily' && session.shrines >= 7) setTimeout(finishDaily, 1500);
  refreshStats();
  saveAll();
}

function onBottle(bt) {
  let kind = bt.kind;
  if (kind === 'story' && profile.d.notes.story >= STORY.length) kind = 'letter';
  if (kind === 'map' && treasure.maps.length >= 3) kind = 'musing';
  const k = BOTTLE_KINDS[kind];
  addPearls(k.pearls);
  addScore(k.score, kind === 'golden' ? 'golden bottle' : 'bottle', k.glass);
  session.bottles++;
  track('bottles');
  audio.pluck();
  if (mode === 'lantern') fuel = Math.min(1, fuel + 0.1);
  const reward = `+${k.pearls} pearls · +${k.score} points`;
  if (kind === 'map') {
    const map = treasure.add(bt.x, bt.z, world.islands);
    ui.showNote({ kind: 'map', title: 'X marks the spot', text: treasure.describe(map) }, reward, { tail: 'The ✕ is on your radar', canvas: (c) => treasure.sketch(c, map, world.islands) });
  } else {
    const note = profile.nextNote(kind);
    ui.showNote(note, reward, { onReveal: () => revealRiddle(note.index) });
    if (kind === 'story' && note.index === STORY.length - 1) setTimeout(() => { ui.banner('Wren’s log is complete', 'Story finished', '#ffd34d'); unlockSails(); }, 2500);
    if (kind === 'golden') ui.flash('#ffd34d');
  }
  refreshStats();
  saveAll();
}

function revealRiddle(i) {
  const r = profile.d.notes.revealed || (profile.d.notes.revealed = []);
  if (!r.includes(i)) r.push(i);
  profile.save();
}

function onTrialHint(island, text) {
  ui.toast(`${island.name}: a golden shrine`, text, '#ffe6b0');
}

function onSighting(id) {
  if (profile.d.creatures[id]) return;
  profile.d.creatures[id] = true;
  const c = CREATURES.find((x) => x.id === id);
  ui.toast(`New sighting: ${c.name}`, 'Recorded in your logbook · +5 pearls', '#9dffb0');
  addPearls(5);
  addScore(150, 'sighting', '#9dffb0');
  profile.save();
}

function onGhost() {
  const note = profile.nextNote('golden');
  addPearls(40);
  addScore(600, 'ghost ship', '#7fd8ff');
  ui.flash('#7fd8ff');
  ui.banner('The ghost ship fades…', 'It left something behind', '#7fd8ff');
  setTimeout(() => ui.showNote(note, '+40 pearls · +600 points', { label: 'Left by the ghost ship' }), 1800);
  audio.fanfare();
}

function onWhaleSplash(dist) {
  if (dist < 140) { cam.shake = Math.max(cam.shake, (140 - dist) / 140); audio.splash(1.5); }
}

function onChestOpen() {
  const p = 15 + Math.floor(Math.random() * 26);
  addPearls(p);
  addScore(300, 'treasure', '#ffcf4d');
  session.chests++;
  track('chests');
  audio.fanfare();
  ui.toast('Treasure!', `The chest holds ${p} pearls`, '#ffcf4d');
  if (Math.random() < 0.3) setTimeout(() => ui.showNote(profile.nextNote('golden'), 'Tucked inside the chest', { label: 'A golden note' }), 1500);
  refreshStats();
  saveAll();
}

function onGate(i) {
  audio.ding(i * 2);
  addScore(30 * i, `gate ${i}`, '#5effd9');
  session.gates++;
  track('gates');
}

function onRegattaDone(t) {
  session.gates++;
  track('gates');
  const bonus = Math.max(0, Math.round(700 - t * 6));
  addScore(300 + bonus, 'regatta!', '#ffcf4d');
  addPearls(12);
  audio.fanfare();
  const best = profile.d.regattaBest;
  const pb = !best || t < best;
  if (pb) profile.d.regattaBest = t;
  ui.banner(fmtTime(t), pb ? 'Regatta · new personal best' : `Regatta · best ${fmtTime(best)}`, '#5effd9');
  setButtonStates();
  profile.save();
}

function onRegattaFail(n) {
  audio.fail();
  ui.toast('Regatta lost', `You passed ${n} of ${regatta.total} gates. Press R to try again.`, '#ff8a7a');
  setButtonStates();
}

function onCatch(f, size) {
  const rec = profile.d.fish[f.id];
  const isNew = !rec;
  const pb = rec && size > rec.best;
  profile.d.fish[f.id] = { count: (rec?.count || 0) + 1, best: Math.max(rec?.best || 0, size) };
  const R = RARITY[f.rarity];
  addPearls(f.pearls);
  addScore(f.junk ? 5 : f.pearls * 15 + size, f.junk ? 'junk' : 'catch', R.color);
  session.fish++;
  track('fish');
  if (mode === 'lantern') fuel = Math.min(1, fuel + 0.05);
  audio[f.junk ? 'pluck' : 'fanfare']();
  const tier = ['common', 'uncommon', 'rare', 'legendary'].indexOf(f.rarity);
  studio.show(f.id);
  ui.showCatch({ fish: f, size, rarity: R, isNew, pb, tier: f.junk ? 0 : tier, desc: FISH_DESC[f.id], reward: f.junk ? '+5 points · into the bin it goes' : `+${f.pearls} pearls · +${f.pearls * 15 + size} points` });
  if (tier >= 2 && !f.junk) ui.flash(R.color);
  refreshStats();
  profile.save();
}

// ---- modes -------------------------------------------------------------------------------------
const START = () => ({ x: CELL / 2, z: CELL / 2, h: 0 });

function buildWorld(key, opts) {
  if (world) world.dispose();
  world = new Archipelago(scene, opts, events);
  worldKey = key;
}

function startMode(m, { begin = true } = {}) {
  mode = m;
  fishing.cancel();
  regatta.stop();
  ui.closeModal();
  ui.hideNote();
  session = newSession();
  fuel = 1;
  let start = START();
  if (m === 'voyage') {
    seed = profile.d.seed;
    const w = profile.world(seed);
    const key = `voyage:${seed}`;
    if (worldKey !== key) buildWorld(key, { seed, awakened: w.awakened, bottles: w.bottles });
    treasure.load(w.maps);
    if (w.boat) start = w.boat;
    if (w.session && !w.session.over) session = { ...newSession(), ...w.session, combo: 1, comboT: 0 };
    tod = profile.d.tod ?? 0.34;
    if (weather.timer > 1000) weather.timer = 120;
  } else if (m === 'daily') {
    seed = stringSeed(`daily-${todayKey()}`);
    buildWorld(`daily:${seed}:${Date.now()}`, { seed });
    treasure.clear();
    tod = 0.3;
    weather.force('clear');
    weather.timer = 9999;
  } else {
    seed = Math.floor(Math.random() * 1e9);
    buildWorld(`lantern:${seed}`, { seed });
    treasure.clear();
    tod = 0.0;
  }
  boat.position.set(start.x, 0, start.z);
  boat.heading = start.h || 0;
  boat.speed = 0;
  boat.turnRate = 0;
  boat.boostT = 0;
  world.update({ pos: boat.position, dt: 0, time, instant: true, night, speed: 0 });
  cam.pos.set(boat.position.x - Math.sin(boat.heading) * 24, 10, boat.position.z - Math.cos(boat.heading) * 24);
  cam.look.copy(boat.position);
  cam.yaw = begin ? 0 : 0.9;
  refreshStats();
  ui.bounties(profile.ensureBounties());
  ui.goal(goalText(), m === 'lantern' ? fuel : null);
  if (begin) beginPlay();
}

function goalText() {
  if (mode === 'daily') return `Daily voyage · shrines ${session.shrines}/7`;
  if (mode === 'lantern') return 'Lantern Run · keep the light alive';
  return '';
}

function beginPlay() {
  started = true;
  audio.start();
  ui.el.intro.classList.add('gone');
  ui.el.hud.classList.add('on');
  cam.lastDrag = -10;
  if (mode === 'voyage' && !profile.d.seenIntro) {
    profile.d.seenIntro = true;
    const tips = [
      [1.2, 'A light on the horizon', 'Something is glowing dead ahead. Hold W and go and see.'],
      [16, 'Read the wind', 'The dial on the right shows the wind. Sailing across it is fastest; straight into it, you stall.'],
      [40, 'Bottles drift everywhere', 'Sail through glowing bottles to read stories, riddles, letters and treasure maps.'],
      [70, 'Stop and fish', 'Ease off to a stop and press F to cast a line.'],
      [100, 'Spend your pearls', 'Open the Shipwright (U) for faster hulls, better rods and new sails.'],
    ];
    tips.forEach(([t, a, b]) => setTimeout(() => started && ui.toast(a, b, '#cfeeff'), t * 1000));
  } else if (mode === 'daily') {
    ui.banner('Wake 7 shrines', `Daily voyage · ${todayKey()}`, '#ffd98a');
  } else if (mode === 'lantern') {
    ui.banner('Keep the light alive', 'Lantern Run', '#ffb866');
  }
  profile.save();
}

function showIntro() {
  started = false;
  fishing.cancel();
  regatta.stop();
  ui.closeModal();
  ui.hideNote();
  photo(false);
  ui.el.intro.classList.remove('gone');
  ui.el.hud.classList.remove('on');
  updateIntro();
}

function endRun(title, subtitle, extra = {}) {
  session.over = true;
  if (mode === 'voyage') profile.world(seed).session = null;
  const entry = { score: session.score, time: session.time, shrines: session.shrines, date: todayKey() };
  const rank = profile.addScore(mode, entry);
  const best = rank === 0 ? 'New personal best!' : rank > 0 ? `#${rank + 1} on your board` : '';
  ui.results({ title, subtitle, session, best, share: extra.share }, {
    again: () => startMode(mode),
    menu: () => { if (mode !== 'voyage') startMode('voyage', { begin: false }); showIntro(); },
  });
}

function finishDaily() {
  if (session.over) return;
  const t = session.time;
  const key = todayKey();
  const prev = profile.d.daily[key];
  if (!prev || t < prev) profile.d.daily[key] = t;
  const share = `⛵ Endless Archipelago · Daily ${key}\n7 shrines in ${fmtTime(t)} · ${Math.round(session.score).toLocaleString()} pts · best chain ×${session.bestCombo}`;
  endRun('Daily voyage complete', `${fmtTime(t)}${prev && prev < t ? ` · today’s best ${fmtTime(prev)}` : ''}`, { share });
}

function endLantern() {
  if (session.over) return;
  audio.fail();
  endRun('The lantern went out', `You kept it burning for ${fmtTime(session.time)}`);
}

function bankVoyage() {
  endRun('Voyage banked', `${fmtTime(session.time)} at sea`);
}

// ---- input -----------------------------------------------------------------------------------------
const keys = new Set();
const input = { fwd: 0, turn: 0 };
const cam = { yaw: 0.9, pitch: 0.3, dist: 26, drag: false, lastDrag: -10, pos: new THREE.Vector3(), look: new THREE.Vector3(), shake: 0 };
const cine = { t: 0, target: new THREE.Vector3() };
const touch = { id: null, x: 0 };
let photoMode = false;
let captureNext = false;

function fishAction() {
  if (!started || session.over) return;
  if (regatta.active) { ui.toast('Busy racing', 'Finish the regatta first', '#cfeeff'); return; }
  const nearest = world.nearestIsland();
  const msg = fishing.action(boat, {
    shallows: nearest && nearest.dist < nearest.shoreR + 55,
    deep: !nearest || nearest.dist > 160,
    night: night > 0.6,
    storm: weather.storm > 0.6,
    rod: lvl('rod'),
  });
  if (msg) ui.toast(msg, '', '#cfeeff');
}

function regattaAction() {
  if (!started || session.over) return;
  if (regatta.active) { regatta.stop(); ui.toast('Regatta abandoned', '', '#cfeeff'); }
  else {
    fishing.cancel();
    regatta.start(boat, world.islands);
    ui.toast('Regatta!', `Sail through ${regatta.total} gates. Each one gives you more time.`, '#5effd9');
    audio.ding(0);
  }
  setButtonStates();
}

function photo(on) {
  photoMode = on;
  ui.el.hud.classList.toggle('photo', on);
  setButtonStates();
}

function setButtonStates() {
  document.querySelector('[data-act="regatta"]').classList.toggle('on', regatta.active);
  document.querySelector('[data-act="photo"]').classList.toggle('on', photoMode);
}

const panels = {
  logbook: () => ui.logbook(profile, revealRiddle, (id) => studio.thumb(id)),
  shop: () => ui.shipwright(profile, {
    buy: (id) => { const ok = profile.buyUpgrade(id); if (ok) { audio.coin(); refreshStats(); ui.toast(`${UPGRADES.find((u) => u.id === id).name} upgraded`, '', '#8dfce0'); } return ok; },
    equip: (id) => { profile.d.sail = id; applySail(); profile.save(); },
    buySail: (id) => { const ok = profile.buySail(id); if (ok) { audio.coin(); profile.d.sail = id; applySail(); refreshStats(); profile.save(); } return ok; },
  }),
  scores: () => ui.scorecard(profile, session, mode, { end: bankVoyage, menu: () => { saveAll(); if (mode !== 'voyage') startMode('voyage', { begin: false }); showIntro(); } }),
};
function togglePanel(name) {
  if (!started) return;
  if (ui.modalName === name) ui.closeModal();
  else panels[name]();
}

addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  audio.start();
  if (ui.catchOpen && ['KeyF', 'Space', 'Escape', 'Enter', 'KeyE'].includes(e.code)) { ui.hideCatch(); return; }
  if (e.code === 'Escape') {
    if (ui.modalName) ui.closeModal();
    else if (photoMode) photo(false);
    else if (ui.noteOpen) ui.hideNote();
    return;
  }
  if (e.code === 'KeyM') ui.toast(audio.toggleMute() ? 'Sound off' : 'Sound on', 'Press M to toggle', '#cfeeff');
  if (e.code === 'KeyG') { quality = quality === 'high' ? 'low' : 'high'; profile.d.quality = quality; applyQuality(); ui.toast(`Graphics: ${quality === 'high' ? 'High (bloom)' : 'Performance'}`, 'Press G to switch', '#cfeeff'); profile.save(); }
  if (!started) return;
  if (e.code === 'Tab') togglePanel('scores');
  if (e.code === 'KeyL') togglePanel('logbook');
  if (e.code === 'KeyU') togglePanel('shop');
  if (ui.modalName) return;
  if (e.code === 'KeyF' || (e.code === 'Space' && fishing.busy)) fishAction();
  if (e.code === 'KeyR') regattaAction();
  if (e.code === 'KeyP') photo(!photoMode);
  if (e.code === 'KeyE' || e.code === 'Enter') ui.hideNote();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

document.querySelectorAll('#actions [data-act]').forEach((b) => b.addEventListener('click', (e) => {
  e.stopPropagation();
  const a = b.dataset.act;
  if (a === 'fish') fishAction();
  else if (a === 'regatta') regattaAction();
  else if (a === 'photo') photo(!photoMode);
  else togglePanel(a);
}));
document.getElementById('catch').addEventListener('click', () => ui.hideCatch());
document.getElementById('snap').addEventListener('click', () => { captureNext = true; });
document.getElementById('photoExit').addEventListener('click', () => photo(false));

canvas.addEventListener('pointerdown', (e) => {
  audio.start();
  canvas.setPointerCapture(e.pointerId);
  if (fishing.state === 'reel' || fishing.state === 'bite') { fishAction(); return; }
  if (e.pointerType === 'touch') { touch.id = e.pointerId; touch.x = e.clientX; } else cam.drag = true;
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') { if (e.pointerId === touch.id) touch.x = e.clientX; return; }
  if (!cam.drag) return;
  cam.yaw -= e.movementX * 0.005;
  cam.pitch = clamp(cam.pitch + e.movementY * 0.004, 0.04, 1.2);
  cam.lastDrag = time;
});
const release = (e) => {
  if (e.pointerId === touch.id) touch.id = null;
  cam.drag = false;
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('wheel', (e) => { cam.dist = clamp(cam.dist * (1 + Math.sign(e.deltaY) * 0.1), 12, 80); }, { passive: true });

const padPrev = {};
function readInput() {
  input.fwd = 0; input.turn = 0;
  if (!started || session.over || ui.modalName) return;
  const k = (...codes) => codes.some((c) => keys.has(c));
  input.fwd = (k('KeyW', 'ArrowUp') ? 1 : 0) - (k('KeyS', 'ArrowDown') ? 1 : 0);
  input.turn = (k('KeyA', 'ArrowLeft') ? 1 : 0) - (k('KeyD', 'ArrowRight') ? 1 : 0);
  if (touch.id !== null) {
    input.fwd = 1;
    input.turn = clamp(-(touch.x / innerWidth - 0.5) * 3, -1, 1);
  }
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
  if (gp) {
    const ax = gp.axes[0] || 0;
    if (Math.abs(ax) > 0.15) input.turn = -ax;
    const fwd = Math.max(gp.buttons[7]?.value || 0, gp.buttons[0]?.pressed ? 1 : 0);
    const back = Math.max(gp.buttons[6]?.value || 0, gp.buttons[1]?.pressed ? 1 : 0);
    if (fwd > 0.1 || back > 0.1) input.fwd = fwd - back;
    const rx = gp.axes[2] || 0, ry = gp.axes[3] || 0;
    if (Math.abs(rx) > 0.15) { cam.yaw -= rx * 0.04; cam.lastDrag = time; }
    if (Math.abs(ry) > 0.15) cam.pitch = clamp(cam.pitch + ry * 0.02, 0.04, 1.2);
    const edge = (i, fn) => { const p = !!gp.buttons[i]?.pressed; if (p && !padPrev[i]) fn(); padPrev[i] = p; };
    edge(2, fishAction);
    edge(3, regattaAction);
  }
}

// ---- day / night ------------------------------------------------------------------------------------
const C = (hex) => new THREE.Color(hex);
const SKY = {
  nightZ: C('#030816'), dayZ: C('#2f7fd9'), duskZ: C('#3a4f9a'),
  nightH: C('#0c1730'), dayH: C('#a9d9f2'), duskH: C('#ff9d62'),
  stormDay: C('#56636e'), stormNight: C('#0a0f16'),
  sunLow: C('#ff8038'), sunHigh: C('#fff3dc'), moon: C('#9db8ff'),
  deep: C('#0b5c8c'), shallow: C('#35d0c2'), foam: C('#ffffff'), stormSea: C('#1f3a48'),
};
const sunDir = new THREE.Vector3();
const _c = new THREE.Color();

function updateEnvironment(dt) {
  const a = (tod - 0.25) * Math.PI * 2;
  sunDir.set(Math.cos(a), Math.sin(a), 0.38).normalize();
  const e = sunDir.y;
  const day = smoothstep(-0.12, 0.3, e);
  const dusk = 1 - smoothstep(0, 0.48, Math.abs(e));
  night = 1 - smoothstep(-0.2, 0.08, e);
  const storm = weather.storm;

  env.uZenith.value.copy(SKY.nightZ).lerp(SKY.dayZ, day).lerp(SKY.duskZ, dusk * 0.4);
  env.uHorizon.value.copy(SKY.nightH).lerp(SKY.dayH, day).lerp(SKY.duskH, dusk * 0.78);
  _c.copy(SKY.stormNight).lerp(SKY.stormDay, day);
  env.uZenith.value.lerp(_c, storm * 0.8);
  env.uHorizon.value.lerp(_c, storm * 0.7);
  env.uHorizon.value.lerp(SKY.foam, weather.fog * 0.35 * day);
  env.uSunDir.value.copy(sunDir);
  env.uSunColor.value.copy(SKY.sunLow).lerp(SKY.sunHigh, smoothstep(0, 0.5, e)).multiplyScalar(smoothstep(-0.12, 0.02, e));
  env.uNight.value = night;
  env.uStorm.value = storm;
  env.uFlash.value = weather.flashOut;
  scene.fog.color.copy(env.uHorizon.value);
  const fogD = 0.0013 + weather.fog * 0.0042 + storm * 0.0012 + (mode === 'lantern' ? (1 - fuel) * 0.004 : 0);
  scene.fog.density = fogD;
  env.uFogDensity.value = fogD;
  waveState.amp = env.uWaveAmp.value = 1 + storm * 0.95;

  if (e > 0) {
    env.uLightDir.value.copy(sunDir);
    sun.color.copy(SKY.sunLow).lerp(SKY.sunHigh, smoothstep(0, 0.45, e));
    sun.intensity = 3.1 * smoothstep(0, 0.22, e);
  } else {
    env.uLightDir.value.copy(sunDir).negate();
    sun.color.copy(SKY.moon);
    sun.intensity = 0.85 * smoothstep(0, 0.25, -e);
  }
  sun.intensity *= 1 - storm * 0.7 - weather.fog * 0.3;
  env.uLightColor.value.copy(sun.color).multiplyScalar(sun.intensity / 3.1);
  hemi.intensity = lerp(0.42, 1.05, day) * (1 - storm * 0.35) + weather.flashOut * 2.5;
  hemi.color.copy(env.uZenith.value).lerp(SKY.foam, 0.55);

  const lum = lerp(0.1, 1, day);
  ocean.uniforms.uDeep.value.copy(SKY.deep).lerp(SKY.stormSea, storm * 0.7).multiplyScalar(lum);
  ocean.uniforms.uShallow.value.copy(SKY.shallow).multiplyScalar(lerp(0.16, 1, day) * (1 - storm * 0.4));
  ocean.uniforms.uFoam.value.copy(SKY.foam).multiplyScalar(lerp(0.3, 1, day)).lerp(env.uHorizon.value, dusk * 0.3);
  world.gulls.mat.color.setScalar(lerp(0.2, 1, day));
  constellation.mat.uniforms.uNight.value = night * (1 - storm);
  constellation.lineMat.opacity = night * (1 - storm) * 0.45;
  grade.uniforms.uFlash.value = weather.flashOut;

  if (mode === 'voyage') {
    const pace = (keys.has('KeyT') && started && !ui.modalName ? 0.09 : 1 / 420) * (e < -0.1 ? 2.2 : 1);
    tod = (tod + dt * pace) % 1;
  } else if (mode === 'daily') {
    tod = (tod + dt / 420) % 1;
  }
}

const clockName = () => {
  if (mode === 'lantern') return 'Endless night';
  const t = tod;
  if (t < 0.2 || t >= 0.8) return 'Night';
  if (t < 0.29) return 'Dawn';
  if (t < 0.42) return 'Morning';
  if (t < 0.58) return 'Midday';
  if (t < 0.7) return 'Afternoon';
  return 'Dusk';
};

// ---- radar ---------------------------------------------------------------------------------------------
const radar = document.getElementById('radar');
const rctx = radar.getContext('2d');
function drawRadar() {
  const RANGE = 720 * (1 + lvl('spyglass') * 0.25);
  const size = radar.clientWidth;
  const dpr = Math.min(devicePixelRatio, 2);
  if (radar.width !== size * dpr) { radar.width = size * dpr; radar.height = size * dpr; }
  rctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const c = size / 2, s = c / RANGE;
  rctx.clearRect(0, 0, size, size);
  rctx.save();
  rctx.beginPath();
  rctx.arc(c, c, c, 0, Math.PI * 2);
  rctx.clip();
  rctx.fillStyle = 'rgba(8, 40, 66, 0.55)';
  rctx.fillRect(0, 0, size, size);
  rctx.strokeStyle = 'rgba(255,255,255,0.10)';
  for (const r of [0.33, 0.66]) { rctx.beginPath(); rctx.arc(c, c, c * r, 0, Math.PI * 2); rctx.stroke(); }

  const bx = boat.position.x, bz = boat.position.z;
  const P = (x, z) => [c - (x - bx) * s, c - (z - bz) * s];
  for (const isl of world.islands) {
    const [px, py] = P(isl.x, isl.z);
    if (Math.hypot(px - c, py - c) > c + 12) continue;
    rctx.globalAlpha = isl.spawn;
    rctx.fillStyle = isl.type === 'peak' ? '#b9c7a0' : isl.type === 'lush' ? '#bfe08f' : '#f0dfab';
    rctx.beginPath();
    rctx.arc(px, py, Math.max(2.5, isl.shoreR * s), 0, Math.PI * 2);
    rctx.fill();
    if (isl.shrine) {
      const d = 5;
      rctx.beginPath();
      rctx.moveTo(px, py - d); rctx.lineTo(px + d * 0.75, py); rctx.lineTo(px, py + d); rctx.lineTo(px - d * 0.75, py);
      rctx.closePath();
      if (isl.shrine.awake) { rctx.fillStyle = isl.shrine.aspect.color; rctx.fill(); }
      else { rctx.fillStyle = 'rgba(10,30,50,0.85)'; rctx.fill(); rctx.strokeStyle = isl.shrine.trial === 'approach' ? '#ffffff' : '#ffd98a'; rctx.lineWidth = 1.3; rctx.stroke(); }
    }
  }
  rctx.globalAlpha = 1;
  for (const bt of world.bottles) {
    const dx = bt.x - bx, dz = bt.z - bz;
    if (dx * dx + dz * dz > 380 * 380 * (1 + lvl('spyglass') * 0.3)) continue;
    rctx.fillStyle = BOTTLE_KINDS[bt.kind].glass;
    rctx.beginPath();
    rctx.arc(c - dx * s, c - dz * s, bt.kind === 'golden' ? 2.8 : 1.9, 0, Math.PI * 2);
    rctx.fill();
  }
  rctx.strokeStyle = '#ff6b5b'; rctx.lineWidth = 2;
  for (const m of treasure.maps) {
    let [px, py] = P(m.x, m.z);
    const d = Math.hypot(px - c, py - c);
    if (d > c - 8) { px = c + (px - c) * (c - 8) / d; py = c + (py - c) * (c - 8) / d; }
    rctx.beginPath(); rctx.moveTo(px - 4, py - 4); rctx.lineTo(px + 4, py + 4); rctx.moveTo(px + 4, py - 4); rctx.lineTo(px - 4, py + 4); rctx.stroke();
  }
  const gate = regatta.active && regatta.current;
  if (gate) {
    const [px, py] = P(gate.x, gate.z);
    rctx.strokeStyle = '#5effd9'; rctx.lineWidth = 2;
    rctx.beginPath(); rctx.arc(px, py, 4, 0, Math.PI * 2); rctx.stroke();
  }
  for (const sp of fishing.spots.list) {
    const [px, py] = P(sp.x, sp.z);
    rctx.strokeStyle = sp.type === 'glimmer' ? `rgba(255,224,138,${sp.fade})` : `rgba(159,233,255,${sp.fade})`;
    rctx.lineWidth = 1.2;
    for (const r of [2.5, 5]) { rctx.beginPath(); rctx.arc(px, py, r + ((time * 3) % 2), 0, Math.PI * 2); rctx.stroke(); }
  }
  if (wildlife.ghostS.active) {
    const [px, py] = P(wildlife.ghost.position.x, wildlife.ghost.position.z);
    rctx.fillStyle = `rgba(127,216,255,${0.5 + 0.5 * Math.sin(time * 4)})`;
    rctx.beginPath(); rctx.arc(px, py, 3.5, 0, Math.PI * 2); rctx.fill();
  }
  if (weather.fog > 0.1) {
    rctx.fillStyle = `rgba(200,215,225,${weather.fog * 0.45})`;
    rctx.fillRect(0, 0, size, size);
  }
  rctx.translate(c, c);
  rctx.rotate(-boat.heading);
  rctx.fillStyle = '#ffffff';
  rctx.beginPath();
  rctx.moveTo(0, -7); rctx.lineTo(4.5, 5); rctx.lineTo(0, 2.5); rctx.lineTo(-4.5, 5);
  rctx.closePath();
  rctx.fill();
  rctx.restore();
  rctx.fillStyle = 'rgba(255,255,255,0.75)';
  rctx.font = '600 10px system-ui';
  rctx.textAlign = 'center';
  rctx.fillText('N', c, 12);
}

// ---- saving -------------------------------------------------------------------------------------------
function saveAll() {
  if (mode === 'voyage' && world) {
    const w = profile.world(seed);
    w.awakened = [...world.awakened];
    w.bottles = [...world.collected];
    w.boat = { x: boat.position.x, z: boat.position.z, h: boat.heading };
    w.maps = treasure.save();
    w.session = session.over ? null : { ...session };
    profile.d.tod = tod;
  }
  profile.save();
}
addEventListener('beforeunload', saveAll);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveAll(); });

// ---- intro ----------------------------------------------------------------------------------------------
const seedInput = document.getElementById('seedInput');
function updateIntro() {
  seedInput.value = profile.d.seed;
  const w = profile.d.worlds[profile.d.seed];
  document.getElementById('voyageGo').textContent = w && w.boat ? 'Continue voyage' : 'Set sail';
  const hv = profile.d.highscores.voyage[0];
  document.getElementById('bestVoyage').textContent = `${profile.d.stats.shrines} shrines woken · ${Math.round(profile.d.pearls)} pearls${hv ? ` · best ${hv.score.toLocaleString()}` : ''}`;
  const dt = profile.d.daily[todayKey()];
  document.getElementById('bestDaily').textContent = dt ? `Today’s best: ${fmtTime(dt)}` : 'Not raced today';
  const hl = profile.d.highscores.lantern[0];
  document.getElementById('bestLantern').textContent = hl ? `Best: ${hl.score.toLocaleString()} · ${fmtTime(hl.time)}` : '';
}
document.querySelectorAll('.mode').forEach((el) => el.addEventListener('click', () => {
  audio.start();
  startMode(el.dataset.mode);
}));
const applySeed = (v) => {
  const n = parseInt(String(v).replace(/\D/g, ''), 10);
  profile.d.seed = Number.isFinite(n) && n > 0 ? n % 1e9 : DEFAULT_SEED;
  profile.save();
  updateIntro();
  startMode('voyage', { begin: false });
};
seedInput.addEventListener('change', () => applySeed(seedInput.value));
document.getElementById('seedRandom').addEventListener('click', () => applySeed(Math.floor(Math.random() * 999999) + 1));
document.getElementById('freshWorld').addEventListener('click', () => {
  if (!confirm(`Reset sea #${profile.d.seed}? Shrines and bottles there will return. Your pearls, upgrades and logbook stay.`)) return;
  delete profile.d.worlds[profile.d.seed];
  profile.save();
  worldKey = '';
  startMode('voyage', { begin: false });
  updateIntro();
});
document.getElementById('wipe').addEventListener('click', () => {
  if (!confirm('Erase ALL progress: pearls, upgrades, logbook, scores and every sea? This cannot be undone.')) return;
  profile.reset();
  location.reload();
});

// ---- frame -----------------------------------------------------------------------------------------------
function resize() {
  const w = Math.max(innerWidth, 128), h = Math.max(innerHeight, 128);
  renderer.setSize(w, h, false);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  constellation.mat.uniforms.uPx.value = renderer.getPixelRatio();
}
addEventListener('resize', resize);
applyQuality();

const clock = { last: performance.now(), elapsedTime: 0, getDelta() { const n = performance.now(); const d = (n - this.last) / 1000; this.last = n; this.elapsedTime += d; return d; } };
const fwd = new THREE.Vector3();
const want = new THREE.Vector3();
let fishW = 0, sprayT = 0, wakeT = 0, saveT = 0, hudT = 0, frameN = 0, thudCool = 0, trackT = 0;
const perf = { n: 0, slow: 0, last: 0, done: profile.d.quality === 'low' };

startMode('voyage', { begin: false });
updateIntro();
updateEnvironment(0);
cam.pos.set(boat.position.x - 20, 9, boat.position.z - 16);

function tick(dt) {
  time += dt;
  frameN++;
  env.uTime.value = time;

  readInput();
  const px = boat.position.x, pz = boat.position.z;
  const m = mods();
  boat.update(dt, input, time, night, m);
  const hit = world.collide(boat);
  thudCool -= dt;
  if (hit > 6 && thudCool <= 0) { audio.thud(hit); thudCool = 0.8; splash.burst(boat.position.x + Math.sin(boat.heading) * 4, boat.position.y, boat.position.z + Math.cos(boat.heading) * 4, 24, 6, 3, 1.1); cam.shake = Math.max(cam.shake, Math.min(1, hit / 25)); }
  const moved = Math.hypot(boat.position.x - px, boat.position.z - pz);
  const sp = Math.abs(boat.speed);
  const knots = sp * 0.62;

  if (started && !session.over) {
    session.time += dt;
    session.distance += moved;
    session.distPts += moved;
    if (session.distPts >= 100) { session.distPts -= 100; addScore(10); }
    session.topKnots = Math.max(session.topKnots, knots);
    pendingLeagues += moved / 500;
    if (weather.storm > 0.6) pendingStorm += moved / 500;
    session.comboT = Math.max(0, session.comboT - dt);
    if (session.comboT <= 0) session.combo = 1;
    profile.d.stats.seconds += dt;
    if (mode === 'lantern') {
      session.score += dt * 2;
      fuel -= dt / (70 * (1 + lvl('lantern') * 0.25));
      if (fuel <= 0) { fuel = 0; endLantern(); }
    }
    trackT -= dt;
    if (trackT <= 0) {
      trackT = 1;
      if (pendingLeagues > 0) { track('leagues', pendingLeagues); pendingLeagues = 0; }
      if (pendingStorm > 0) { track('stormLeagues', pendingStorm); pendingStorm = 0; }
      if (knots > profile.d.stats.topKnots - 0.01 || profile.d.bounties.items.some((b) => b.id === 'speed' && !b.done)) track('topKnots', knots);
      if (world.gulls.near) onSighting('gull');
    }
  }

  world.update({ pos: boat.position, dt, time, night, speed: boat.speed, pickupR: 6.5 + lvl('net') * 3 });
  const wchanged = weather.update(dt, camera.position, boat.position, smoothstep(-0.12, 0.3, sunDir.y));
  if (wchanged && started) ui.toast(weather.name, weather.kind === 'storm' ? 'Batten down: big waves, fast winds, thunder eel weather' : weather.kind === 'fog' ? 'Visibility drops. Trust your radar… mostly.' : weather.kind === 'breezy' ? 'The wind picks up. Good sailing.' : 'The skies clear.', '#cfeeff');
  updateEnvironment(dt);
  wildlife.update({ boat, dt, time, night, nearestIsland: world.nearestIsland() });
  treasure.update(boat.position, dt, time, world.islands);
  regatta.update(boat, dt, time, world.islands);
  const fmsg = fishing.update(boat, dt, time, { islands: world.islands, night });
  splash.update(dt);
  if (fmsg) ui.toast(fmsg, '', '#cfeeff');
  audio.setSpeed(boat.speed / 30);
  audio.updateMusic(dt, clamp(session.shrines / 8, 0, 1), night);

  const isl = ocean.uniforms.uIslands.value;
  for (let i = 0; i < MAX_ISLANDS; i++) {
    const s = world.sorted[i];
    if (s) isl[i].set(s.x, s.z, s.shoreR * s.spawn, 0); else isl[i].set(0, 0, 0, 0);
  }

  const bp = boat.position;
  ocean.mesh.position.set(Math.round(bp.x / OCEAN_GRID) * OCEAN_GRID, 0, Math.round(bp.z / OCEAN_GRID) * OCEAN_GRID);
  seabed.position.x = bp.x;
  seabed.position.z = bp.z;

  // Wake foam
  fwd.set(Math.sin(boat.heading), 0, Math.cos(boat.heading));
  wakeT -= dt * sp;
  if (sp > 2.5 && wakeT <= 0) {
    wakeT = 1.5;
    const k = sp / 26;
    for (const side of [-1, 1]) {
      const ox = fwd.z * side, oz = -fwd.x * side;
      wake.emit(bp.x - fwd.x * 3.4 + ox * 0.7, bp.z - fwd.z * 3.4 + oz * 0.7, 1.2, 3 + k * 4.5, 2.2 + k * 2, ox * 1.6, oz * 1.6);
      if (k > 0.35) wake.emit(bp.x + fwd.x * 2.6 + ox * 0.9, bp.z + fwd.z * 2.6 + oz * 0.9, 0.7, 2.4, 1.1, ox * 3.2 - fwd.x * 2, oz * 3.2 - fwd.z * 2);
    }
  }
  // Bow spray when the boat is really moving.
  sprayT -= dt;
  if (sp > 11 && sprayT <= 0) {
    sprayT = 0.09 - Math.min(0.05, (sp - 11) * 0.003) + (weather.storm > 0.5 ? -0.02 : 0);
    const side = Math.random() < 0.5 ? -1 : 1;
    const ox = fwd.z * side, oz = -fwd.x * side;
    const bx2 = bp.x + fwd.x * 3.6 + ox * 0.5, bz2 = bp.z + fwd.z * 3.6 + oz * 0.5;
    splash.burst(bx2, bp.y + 0.3, bz2, 2 + Math.floor(sp / 10), 3 + sp * 0.08, 0.6, 0.55, { x: ox * 3 + fwd.x * sp * 0.6, z: oz * 3 + fwd.z * sp * 0.6 });
  }
  wake.update(dt);

  // Camera
  if (!started) cam.yaw += dt * 0.12;
  else if (!cam.drag && !photoMode && time - cam.lastDrag > 2.5 && sp > 3) cam.yaw = lerp(cam.yaw, Math.round(cam.yaw / (Math.PI * 2)) * Math.PI * 2, Math.min(1, dt * 1.2));
  cine.t = Math.max(0, cine.t - dt);
  const cineW = cine.t > 0 ? Math.min(1, cine.t / 0.6, (2.8 - cine.t) / 0.5) : 0;
  // While fishing, swing round so the bobber and the boat share the frame.
  const fishCam = fishing.busy && fishing.bobber.visible && time - cam.lastDrag > 1.5;
  fishW = lerp(fishW, fishCam ? 1 : 0, Math.min(1, dt * 1.5));
  let ang = boat.heading + Math.PI + cam.yaw;
  if (fishW > 0.01) {
    const bb = fishing.bobber.position;
    let fa = Math.atan2(bp.x - bb.x, bp.z - bb.z) + 0.75 - ang;
    fa = Math.atan2(Math.sin(fa), Math.cos(fa));
    ang += fa * fishW;
  }
  const dist = cam.dist * (1 + clamp(boat.speed / 26, 0, 1.5) * 0.12) * (1 + cineW * 0.5) * (1 - fishW * 0.3);
  const pitch = cam.pitch + cineW * 0.25 + fishW * 0.12;
  want.set(
    bp.x + Math.sin(ang) * Math.cos(pitch) * dist,
    bp.y + 2.5 + Math.sin(pitch) * dist,
    bp.z + Math.cos(ang) * Math.cos(pitch) * dist,
  );
  cam.pos.lerp(want, 1 - Math.exp(-dt * (cam.drag ? 12 : 3.2)));
  cam.pos.y = Math.max(cam.pos.y, waveHeight(cam.pos.x, cam.pos.z, time) + 1.4);
  want.copy(bp).addScaledVector(fwd, 3.5);
  want.y += 3.2;
  if (cineW > 0) want.lerp(cine.target, cineW * 0.7);
  if (fishW > 0.01) want.lerp(fishing.bobber.position, fishW * 0.55);
  cam.look.lerp(want, 1 - Math.exp(-dt * 6));
  camera.position.copy(cam.pos);
  cam.shake = Math.max(0, cam.shake - dt * 1.8);
  if (cam.shake > 0) camera.position.add(new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).multiplyScalar(cam.shake * 0.8));
  camera.lookAt(cam.look);
  camera.fov = lerp(camera.fov, 58 + (boat.boostT > 0 ? 7 : 0), Math.min(1, dt * 2));
  camera.updateProjectionMatrix();
  sky.position.copy(camera.position);
  constellation.g.position.copy(camera.position);

  sun.target.position.copy(bp);
  sun.position.copy(bp).addScaledVector(env.uLightDir.value, 260);

  // HUD
  hudT -= dt;
  if (hudT <= 0 && started) {
    hudT = 0.1;
    ui.el.speed.textContent = Math.round(knots);
    ui.el.boost.style.opacity = boat.boostT > 0 ? 1 : 0;
    ui.el.leagues.textContent = (session.distance / 500).toFixed(1);
    ui.el.clock.textContent = clockName();
    ui.el.weatherName.textContent = weather.name;
    ui.el.pearls.textContent = Math.round(profile.d.pearls).toLocaleString();
    ui.score(session.score, mode === 'voyage' ? `${fmtTime(session.time)} at sea` : fmtTime(session.time), session.combo, session.comboT / 75);
    ui.goal(goalText(), mode === 'lantern' ? fuel : null);
    const rel = weather.windDir - boat.heading;
    ui.windDial(-rel, pointOfSail(boat.windCos), boat.windEff || 1);
    const rows = [];
    const toward = (x, z) => -(Math.atan2(x - bp.x, z - bp.z) - boat.heading);
    if (regatta.active && regatta.current) {
      const g = regatta.current;
      rows.push({ angle: toward(g.x, g.z), color: '#5effd9', text: `Gate ${regatta.index + 1}/${regatta.total} · ${Math.ceil(regatta.gateT)}s · ${fmtTime(regatta.elapsed)}` });
    }
    const target = world.nearestDormant();
    if (target) {
      const s = target.shrine;
      const d = Math.round(Math.hypot(target.x - bp.x, target.z - bp.z) - target.shoreR);
      let t = `Shrine · ${Math.max(0, d)} m`;
      if (s.trial !== 'approach') t = `Golden shrine (${s.trial === 'circle' ? 'circle it' : s.trial === 'still' ? 'drift still' : 'night only'}) · ${Math.max(0, d)} m${s.progress > 0.02 && s.trial !== 'night' ? ` · ${Math.round(s.progress * 100)}%` : ''}`;
      rows.push({ angle: toward(target.x, target.z), color: s.trial === 'approach' ? '#ffd98a' : '#ffe6b0', text: t });
    } else rows.push({ angle: null, text: 'No shrines in sight. Pick a heading' });
    const spot = fishing.spots.nearest(bp, 420);
    if (spot && !regatta.active) {
      const d = Math.hypot(spot.x - bp.x, spot.z - bp.z);
      rows.push({ angle: toward(spot.x, spot.z), color: spot.type === 'glimmer' ? '#ffe08a' : '#9fe9ff', text: d < 30 ? `${spot.type === 'glimmer' ? 'Glimmering' : 'Fishing'} spot · stop & press F` : `${spot.type === 'glimmer' ? 'Glimmering spot' : 'Fishing spot'} · ${Math.round(d)} m` });
    }
    const tr = treasure.nearest(bp);
    if (tr) rows.push({ angle: toward(tr.map.x, tr.map.z), color: '#ff6b5b', text: `Treasure ✕ · ${Math.round(tr.dist)} m` });
    if (wildlife.ghostS.active && !wildlife.ghostS.caught) {
      const g = wildlife.ghost.position;
      rows.push({ angle: toward(g.x, g.z), color: '#7fd8ff', text: `Ghost ship · ${Math.round(Math.hypot(g.x - bp.x, g.z - bp.z))} m` });
    }
    ui.hints(rows);
  }
  if (started && frameN % 3 === 0) drawRadar();

  saveT += dt;
  if (saveT > 5 && started) { saveT = 0; saveAll(); }

  if (ui.catchOpen) studio.render(time);
  if (quality === 'high' && innerWidth > 96 && innerHeight > 96) composer.render(dt);
  else renderer.render(scene, camera);

  if (captureNext) {
    captureNext = false;
    const a = document.createElement('a');
    a.download = `endless-archipelago-${Date.now()}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
    ui.flash('#ffffff');
  }
}

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  // Auto-drop to performance graphics on slow devices (first seconds of play only).
  if (!perf.done && started && !document.hidden) {
    const raw = clock.elapsedTime - perf.last;
    perf.last = clock.elapsedTime;
    if (raw > 0 && raw < 0.2) { perf.n++; if (raw > 1 / 33) perf.slow++; }
    if (perf.n > 240) {
      perf.done = true;
      if (quality === 'high' && perf.slow / perf.n > 0.7) {
        quality = 'low'; profile.d.quality = quality; applyQuality();
        ui.toast('Switched to performance graphics', 'Press G to turn bloom back on', '#cfeeff');
      }
    }
  }
  tick(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__game = {
  boat, get world() { return world; }, scene, camera, renderer, weather, wildlife, treasure, regatta, fishing, profile, session: () => session,
  setTime: (t) => { tod = t; }, cam, refreshConstellation, studio, splash, advance: (sec) => { for (let i = 0; i < sec * 30; i++) tick(1 / 30); }, start: startMode,
};
