import { UPGRADES, SAILS, BOUNTIES, MILESTONES, MUSINGS, RIDDLES, SHANTIES, RECIPES, LETTERS, GOLDEN, STORY } from './data.js';
import { mulberry32 } from './utils.js';

const KEY = 'endless-archipelago-v2';
const OLD_KEY = 'endless-archipelago-v1';
export const DEFAULT_SEED = 90210;

export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function stringSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

const POOLS = { musing: MUSINGS, riddle: RIDDLES, shanty: SHANTIES, recipe: RECIPES, letter: LETTERS, golden: GOLDEN };

function blank() {
  return {
    v: 2, pearls: 0, upgrades: {}, sail: 'classic', owned: ['classic'], aspects: {}, constellation: false,
    notes: { musing: [], story: 0, riddle: [], shanty: [], recipe: [], letter: [], golden: [], revealed: [] },
    creatures: {}, fish: {},
    stats: { shrines: 0, bottles: 0, leagues: 0, fish: 0, gates: 0, trials: 0, chests: 0, nightShrines: 0, stormLeagues: 0, topKnots: 0, seconds: 0 },
    milestones: {}, bounties: null, highscores: { voyage: [], daily: [], lantern: [] }, daily: {}, regattaBest: null,
    worlds: {}, seed: DEFAULT_SEED, tod: 0.34, quality: 'high', seenIntro: false,
  };
}

export class Profile {
  constructor() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(KEY)); } catch { data = null; }
    const base = blank();
    if (data && data.v === 2) {
      // Merge so new fields appear for older saves.
      this.d = { ...base, ...data, notes: { ...base.notes, ...data.notes }, stats: { ...base.stats, ...data.stats }, highscores: { ...base.highscores, ...data.highscores } };
    } else {
      this.d = base;
      try {
        const old = JSON.parse(localStorage.getItem(OLD_KEY));
        if (old) {
          this.d.worlds[DEFAULT_SEED] = { awakened: old.awakened || [], bottles: old.bottles || [], boat: old.boat || null, maps: [] };
          this.d.stats.leagues = (old.sailed || 0) / 500;
          this.d.stats.shrines = (old.awakened || []).length;
          this.d.tod = old.tod ?? 0.34;
          this.d.seenIntro = true;
        }
      } catch { /* ignore */ }
    }
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.d)); } catch { /* storage unavailable */ }
  }

  reset() {
    try { localStorage.removeItem(KEY); localStorage.removeItem(OLD_KEY); } catch { /* ignore */ }
    this.d = blank();
  }

  world(seed) {
    const w = this.d.worlds;
    if (!w[seed]) w[seed] = { awakened: [], bottles: [], boat: null, maps: [] };
    return w[seed];
  }

  // ---- upgrades & cosmetics -------------------------------------------------
  level(id) { return this.d.upgrades[id] || 0; }

  buyUpgrade(id) {
    const def = UPGRADES.find((u) => u.id === id);
    const lvl = this.level(id);
    if (!def || lvl >= def.costs.length) return false;
    const cost = def.costs[lvl];
    if (this.d.pearls < cost) return false;
    this.d.pearls -= cost;
    this.d.upgrades[id] = lvl + 1;
    this.save();
    return true;
  }

  sailStatus(def) {
    if (this.d.owned.includes(def.id)) return { owned: true };
    const u = def.unlock;
    if (!u) return { owned: true };
    if (u.pearls) return { owned: false, buy: u.pearls, text: `${u.pearls} pearls` };
    if (u.aspect) {
      const n = this.d.aspects[u.aspect] || 0;
      return { owned: false, ready: n >= u.count, text: `Wake ${u.count} ${u.aspect} shrines (${Math.min(n, u.count)}/${u.count})` };
    }
    if (u.story) return { owned: false, ready: this.d.notes.story >= STORY.length, text: `Read all ${STORY.length} pages of Wren’s log` };
    if (u.constellation) return { owned: false, ready: this.d.constellation, text: 'Complete the Seven Stars' };
    return { owned: false };
  }

  /** Grants any sails whose conditions are now met; returns newly unlocked defs. */
  checkSails() {
    const fresh = [];
    for (const s of SAILS) {
      const st = this.sailStatus(s);
      if (!st.owned && st.ready) { this.d.owned.push(s.id); fresh.push(s); }
    }
    return fresh;
  }

  buySail(id) {
    const def = SAILS.find((s) => s.id === id);
    const st = this.sailStatus(def);
    if (st.owned || !st.buy || this.d.pearls < st.buy) return false;
    this.d.pearls -= st.buy;
    this.d.owned.push(id);
    this.save();
    return true;
  }

  // ---- notes --------------------------------------------------------------------
  /** Picks the next note of a kind, preferring ones not read yet. */
  nextNote(kind) {
    if (kind === 'story') {
      const i = this.d.notes.story;
      if (i >= STORY.length) return null;
      this.d.notes.story++;
      return { kind, index: i, ...STORY[i] };
    }
    const pool = POOLS[kind];
    const read = this.d.notes[kind];
    const unread = pool.map((_, i) => i).filter((i) => !read.includes(i));
    const index = unread.length ? unread[Math.floor(Math.random() * unread.length)] : Math.floor(Math.random() * pool.length);
    if (!read.includes(index)) read.push(index);
    const item = pool[index];
    return typeof item === 'string' ? { kind, index, text: item } : { kind, index, ...item };
  }

  // ---- stats, bounties, milestones ---------------------------------------------
  ensureBounties() {
    const today = todayKey();
    if (this.d.bounties && this.d.bounties.date === today) return this.d.bounties;
    const rng = mulberry32(stringSeed(today));
    const pool = [...BOUNTIES];
    const items = [];
    while (items.length < 3 && pool.length) {
      const b = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      items.push({ id: b.id, n: b.n[Math.floor(rng() * b.n.length)], prog: 0, done: false });
    }
    this.d.bounties = { date: today, items };
    return this.d.bounties;
  }

  /** Adds to a stat; returns { bounties: [...completed], milestones: [...] } */
  track(stat, amount = 1) {
    const out = { bounties: [], milestones: [] };
    const s = this.d.stats;
    const before = s[stat] || 0;
    if (stat === 'topKnots') s[stat] = Math.max(before, amount);
    else s[stat] = before + amount;
    for (const it of this.ensureBounties().items) {
      const def = BOUNTIES.find((b) => b.id === it.id);
      if (it.done || def.stat !== stat) continue;
      it.prog = stat === 'topKnots' ? Math.max(it.prog, amount) : it.prog + amount;
      if (it.prog >= it.n) { it.done = true; this.d.pearls += def.pearls; out.bounties.push({ ...it, text: def.text(it.n), pearls: def.pearls }); }
    }
    for (const m of MILESTONES) {
      if (m.stat !== stat) continue;
      for (const at of m.at) {
        const key = `${stat}:${at}`;
        if (s[stat] >= at && !this.d.milestones[key]) { this.d.milestones[key] = true; out.milestones.push(m.text(at)); }
      }
    }
    return out;
  }

  addScore(mode, entry) {
    const list = this.d.highscores[mode] || (this.d.highscores[mode] = []);
    list.push(entry);
    list.sort((a, b) => (mode === 'daily' ? (a.time || 1e9) - (b.time || 1e9) || b.score - a.score : b.score - a.score));
    list.length = Math.min(list.length, 8);
    const rank = list.indexOf(entry);
    this.save();
    return rank;
  }
}
