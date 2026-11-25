import { ASPECTS, BOTTLE_KINDS, STORY, MUSINGS, RIDDLES, SHANTIES, RECIPES, LETTERS, GOLDEN, FISH, RARITY, CREATURES, UPGRADES, SAILS, BOUNTIES } from './data.js';

const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmtTime = (s) => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
};
const fmt = (n) => Math.round(n).toLocaleString();

export class UI {
  constructor() {
    this.el = {};
    for (const id of ['hud', 'rankName', 'pearls', 'shrines', 'bottles', 'leagues', 'bar', 'bounties', 'score', 'timer', 'combo', 'goal', 'fuel', 'pops',
      'hints', 'windLabel', 'weatherName', 'clock', 'speed', 'boost', 'toasts', 'fishui', 'fishStatus', 'fishBar', 'fishZone', 'fishMarker', 'fishDots', 'fishHelp',
      'note', 'banner', 'bannerText', 'bannerSmall', 'flash', 'modal', 'modalTitle', 'modalTabs', 'modalBody', 'modalClose', 'intro']) this.el[id] = $(id);
    this.wind = $('wind').getContext('2d');
    this.noteTimer = null;
    this.modalName = null;
    this.el.modalClose.addEventListener('click', () => this.closeModal());
    this.el.modal.addEventListener('pointerdown', (e) => { if (e.target === this.el.modal) this.closeModal(); });
    this.el.note.addEventListener('pointerenter', () => clearTimeout(this.noteTimer));
    this.el.note.addEventListener('pointerleave', () => { this.noteTimer = setTimeout(() => this.hideNote(), 4000); });
    this.lastScore = 0;
  }

  // ---- small feedback -----------------------------------------------------------
  toast(title, body, accent) {
    const t = document.createElement('div');
    t.className = 'toast panel';
    if (accent) t.style.setProperty('--accent', accent);
    t.innerHTML = `<h3>${esc(title)}</h3>${body ? `<p>${esc(body)}</p>` : ''}`;
    this.el.toasts.prepend(t);
    while (this.el.toasts.children.length > 3) this.el.toasts.lastElementChild.remove();
    setTimeout(() => t.classList.add('out'), 5200);
    setTimeout(() => t.remove(), 6200);
  }

  pop(text, color = '#ffffff') {
    const p = document.createElement('div');
    p.className = 'pop';
    p.style.color = color;
    p.style.marginLeft = `${(Math.random() - 0.5) * 60}px`;
    p.textContent = text;
    this.el.pops.appendChild(p);
    setTimeout(() => p.remove(), 1500);
    this.el.score.classList.add('bump');
    setTimeout(() => this.el.score.classList.remove('bump'), 130);
  }

  banner(text, small = 'Milestone', color) {
    const b = this.el.banner;
    this.el.bannerText.textContent = text;
    this.el.bannerSmall.textContent = small;
    b.style.setProperty('--bc', color || '');
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  }

  flash(color) {
    const f = this.el.flash;
    f.style.transition = 'none';
    f.style.background = `radial-gradient(circle at 50% 45%, ${color}88, transparent 70%)`;
    f.style.opacity = '1';
    requestAnimationFrame(() => { f.style.transition = ''; f.style.opacity = '0'; });
  }

  // ---- parchment notes ------------------------------------------------------------
  showNote(note, reward, opts = {}) {
    const k = BOTTLE_KINDS[note.kind] || BOTTLE_KINDS.musing;
    const n = this.el.note;
    let html = `<div class="kind"><span>${esc(opts.label || k.label)}</span><button class="x" data-close>close</button></div>`;
    if (note.title) html += `<h3>${esc(note.title)}</h3>`;
    html += `<div class="body">${esc(note.q || note.text || '')}</div>`;
    if (note.from) html += `<div class="from">— ${esc(note.from)}</div>`;
    if (note.a) html += `<div class="reveal" data-reveal>Tap to reveal the answer</div>`;
    if (opts.canvas) html += '<canvas width="340" height="200"></canvas>';
    if (reward) html += `<div class="reward"><span>${esc(reward)}</span><span>${opts.tail ? esc(opts.tail) : 'Logged in your logbook <kbd>L</kbd>'}</span></div>`;
    n.innerHTML = html;
    if (opts.canvas) opts.canvas(n.querySelector('canvas'));
    n.querySelector('[data-close]').onclick = () => this.hideNote();
    const rv = n.querySelector('[data-reveal]');
    if (rv) rv.onclick = () => { rv.textContent = note.a; opts.onReveal?.(); };
    n.classList.add('show');
    clearTimeout(this.noteTimer);
    const len = (note.text || note.q || '').length;
    this.noteTimer = setTimeout(() => this.hideNote(), Math.max(9000, len * 70 + (opts.canvas ? 6000 : 0)));
  }

  hideNote() { this.el.note.classList.remove('show'); }
  get noteOpen() { return this.el.note.classList.contains('show'); }

  // ---- HUD ---------------------------------------------------------------------------
  stats({ rank, pearls, shrines, bottles, leagues, bar }) {
    this.el.rankName.textContent = rank;
    this.el.pearls.textContent = fmt(pearls);
    this.el.shrines.textContent = shrines;
    this.el.bottles.textContent = bottles;
    this.el.leagues.textContent = leagues;
    this.el.bar.firstElementChild.style.width = `${bar * 100}%`;
  }

  bounties(b) {
    const items = b.items.map((it) => {
      const def = BOUNTIES.find((d) => d.id === it.id);
      const prog = it.id === 'speed' ? `${Math.min(it.prog, it.n) | 0}/${it.n}` : `${Math.min(Math.floor(it.prog * 10) / 10, it.n)}/${it.n}`;
      return `<div class="bounty ${it.done ? 'done' : ''}"><span class="chk">${it.done ? '✓' : ''}</span><span>${esc(def.text(it.n))}</span><span class="p">${it.done ? `+${def.pearls}` : prog}</span></div>`;
    }).join('');
    this.el.bounties.innerHTML = `<h4>Today’s bounties</h4>${items}`;
  }

  score(score, time, combo, comboFrac) {
    if (score !== this.lastScore) { this.el.score.textContent = fmt(score); this.lastScore = score; }
    this.el.timer.textContent = time;
    const c = this.el.combo;
    if (combo > 1) {
      c.style.display = 'block';
      c.firstChild.textContent = `Chain ×${combo}`;
      c.lastElementChild.style.width = `${comboFrac * 100}%`;
    } else c.style.display = 'none';
  }

  goal(text, fuel) {
    this.el.goal.style.display = text ? 'block' : 'none';
    if (text) this.el.goal.textContent = text;
    this.el.fuel.style.display = fuel == null ? 'none' : 'block';
    if (fuel != null) this.el.fuel.firstElementChild.style.width = `${Math.max(0, fuel) * 100}%`;
  }

  hints(rows) {
    const h = this.el.hints;
    while (h.children.length < rows.length) {
      const d = document.createElement('div');
      d.className = 'hint panel';
      d.innerHTML = '<span class="arrow">▲</span><span class="t"></span>';
      d.style.marginTop = '8px';
      h.appendChild(d);
    }
    [...h.children].forEach((d, i) => {
      const r = rows[i];
      d.style.display = r ? 'flex' : 'none';
      if (!r) return;
      d.firstChild.style.transform = `rotate(${r.angle}rad)`;
      d.firstChild.style.color = r.color || 'var(--gold)';
      d.firstChild.style.visibility = r.angle == null ? 'hidden' : 'visible';
      d.lastChild.textContent = r.text;
    });
  }

  windDial(rel, label, eff) {
    const c = this.wind, W = 68, R = 30;
    c.clearRect(0, 0, W, W);
    c.save();
    c.translate(W / 2, W / 2);
    c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.stroke();
    // no-go wedge (into the wind)
    c.fillStyle = 'rgba(255,120,120,0.22)';
    c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, rel + Math.PI / 2 - 0.75, rel + Math.PI / 2 + 0.75); c.closePath(); c.fill();
    // boat
    c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(0, -9); c.lineTo(5, 7); c.lineTo(-5, 7); c.closePath(); c.fill();
    // wind arrow (blowing toward)
    c.rotate(rel);
    c.strokeStyle = '#8dfce0'; c.fillStyle = '#8dfce0'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(0, R - 2); c.lineTo(0, R - 16); c.stroke();
    c.beginPath(); c.moveTo(0, -R + 2); c.lineTo(-6, -R + 12); c.lineTo(6, -R + 12); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0, -R + 10); c.lineTo(0, -R + 22); c.stroke();
    c.restore();
    this.el.windLabel.innerHTML = `<b>${esc(label)}</b><span class="dim">sail power ${Math.round(eff * 100)}%</span>`;
  }

  // ---- fishing ---------------------------------------------------------------------------
  fishing(s) {
    const e = this.el;
    if (!s) { e.fishui.classList.remove('on'); return; }
    e.fishui.classList.add('on');
    e.fishStatus.className = '';
    e.fishBar.style.display = 'none';
    e.fishDots.style.display = 'none';
    if (s.state === 'casting' || s.state === 'waiting') { e.fishStatus.textContent = s.spot ? 'Fishing the spot… watch the shadows' : 'Line in the water… wait for a bite'; e.fishHelp.innerHTML = 'Press <kbd>F</kbd> to reel in'; }
    else if (s.state === 'bite') { e.fishStatus.textContent = 'BITE! Hook it!'; e.fishStatus.className = 'bite'; e.fishHelp.innerHTML = 'Press <kbd>F</kbd> / <kbd>Space</kbd> now'; }
    else if (s.state === 'reel') {
      e.fishStatus.innerHTML = `Something <span style="color:${s.rarity.color}">${s.rarity.label.toLowerCase()}</span> is pulling…`;
      e.fishBar.style.display = 'block';
      e.fishZone.style.left = `${(s.zoneC - s.zoneW / 2) * 100}%`;
      e.fishZone.style.width = `${s.zoneW * 100}%`;
      if (s.thumb && e.fishZone.dataset.src !== s.thumb) { e.fishZone.dataset.src = s.thumb; e.fishZone.innerHTML = `<img src="${s.thumb}" alt="" />`; }
      e.fishMarker.style.left = `${s.marker * 100}%`;
      e.fishDots.style.display = 'block';
      e.fishDots.innerHTML = `<span style="color:#7dff8a">${'●'.repeat(s.hits)}${'○'.repeat(s.need - s.hits)}</span>  <span style="color:#ff8a7a">${'✕'.repeat(s.misses)}${'·'.repeat(3 - s.misses)}</span>`;
      e.fishHelp.innerHTML = 'Strike with <kbd>F</kbd> / <kbd>Space</kbd> / click when the marker is in the green';
    }
  }

  // ---- catch reveal card ---------------------------------------------------------------
  showCatch({ fish, size, rarity, isNew, pb, reward, desc, tier }) {
    const el = $('catch');
    const card = el.firstElementChild;
    card.style.setProperty('--rc', rarity.color);
    card.style.setProperty('--rays', tier >= 2 ? 1 : tier === 1 ? 0.5 : 0);
    $('catchNew').style.display = isNew ? 'block' : 'none';
    $('catchNew').textContent = isNew ? 'NEW!' : '';
    $('catchRarity').textContent = `${'★'.repeat(tier + 1)}  ${rarity.label.toUpperCase()}${fish.junk ? ' · JUNK' : ''}`;
    $('catchName').textContent = fish.name;
    $('catchDesc').textContent = desc || '';
    $('catchSize').innerHTML = `<b>${size}</b> cm${pb ? ' · <span style="color:var(--gold)">personal best!</span>' : ''} <span class="dim">(record size ${fish.max} cm)</span>`;
    $('catchReward').textContent = reward;
    const ruler = $('catchRuler');
    ruler.style.transition = 'none'; ruler.style.width = '0';
    requestAnimationFrame(() => requestAnimationFrame(() => { ruler.style.transition = ''; ruler.style.width = `${Math.max(6, ((size - fish.min) / Math.max(1, fish.max - fish.min)) * 100)}%`; }));
    const stage = card.querySelector('.catch-stage');
    stage.querySelectorAll('.spark').forEach((n) => n.remove());
    for (let i = 0; i < (tier >= 2 ? 14 : tier === 1 ? 6 : 0); i++) {
      const sp = document.createElement('i');
      sp.className = 'spark';
      sp.style.left = `${Math.random() * 100}%`; sp.style.top = `${Math.random() * 100}%`;
      sp.style.animationDelay = `${Math.random() * 1.6}s`;
      stage.appendChild(sp);
    }
    el.classList.add('on');
    clearTimeout(this.catchTimer);
    this.catchTimer = setTimeout(() => this.hideCatch(), 7000);
  }

  hideCatch() { $('catch').classList.remove('on'); clearTimeout(this.catchTimer); }
  get catchOpen() { return $('catch').classList.contains('on'); }

  // ---- modal ---------------------------------------------------------------------------------
  openModal(name, title, tabs, render, startTab) {
    this.modalName = name;
    this.hideNote();
    this.el.modal.classList.add('on');
    this.el.modalTitle.textContent = title;
    const tabEl = this.el.modalTabs;
    tabEl.innerHTML = '';
    tabEl.style.display = tabs.length > 1 ? 'flex' : 'none';
    const show = (id) => {
      [...tabEl.children].forEach((b) => b.classList.toggle('on', b.dataset.tab === id));
      this.el.modalBody.innerHTML = '';
      this.currentTab = id;
      render(id, this.el.modalBody);
    };
    for (const t of tabs) {
      const b = document.createElement('button');
      b.dataset.tab = t.id;
      b.textContent = t.label;
      b.onclick = () => show(t.id);
      tabEl.appendChild(b);
    }
    this.rerender = () => show(this.currentTab);
    show(startTab || tabs[0].id);
  }

  closeModal() {
    this.el.modal.classList.remove('on');
    const n = this.modalName;
    this.modalName = null;
    this.onModalClose?.(n);
  }

  // ---- panels -------------------------------------------------------------------------------
  logbook(profile, onReveal, thumb) {
    const d = profile.d;
    const tabs = [
      { id: 'stars', label: 'Shrines & Stars' }, { id: 'log', label: 'Wren’s Log' }, { id: 'notes', label: 'Bottles' },
      { id: 'fish', label: 'Fish' }, { id: 'creatures', label: 'Sightings' }, { id: 'records', label: 'Lifetime' },
    ];
    this.openModal('logbook', 'Captain’s Logbook', tabs, (tab, body) => {
      if (tab === 'stars') {
        const got = ASPECTS.filter((a) => d.aspects[a.name]).length;
        body.innerHTML = `<p class="dim" style="margin-top:0">Wake one shrine of every aspect to join the Seven Stars, low in the northern night sky. ${got}/7 found${d.constellation ? ' — <b style="color:var(--gold)">constellation complete</b>' : ''}.</p>
          <div class="stars">${ASPECTS.map((a) => `<div class="star ${d.aspects[a.name] ? '' : 'off'}" style="--c:${a.color}"><b></b>${a.name}<span class="dim">×${d.aspects[a.name] || 0}</span></div>`).join('')}</div>
          <p class="dim">Some shrines are <b style="color:#ffe6b0">golden</b>: they ask for a trial before they wake, like circling the island, drifting still beside it, or arriving at night. Trials score double.</p>`;
      } else if (tab === 'log') {
        body.innerHTML = STORY.map((s, i) => (i < d.notes.story
          ? `<div class="entry"><b>${esc(s.title)}</b><br /><em>${esc(s.text)}</em></div>`
          : `<div class="entry dim"><b>${esc(s.title.split('.')[0])}. ???</b> — a blue bottle is still out there.</div>`)).join('');
      } else if (tab === 'notes') {
        const sec = (title, pool, read, fmtFn) => `<h4 style="margin:16px 0 4px">${title} <span class="dim">${read.length}/${pool.length}</span></h4>${read.map((i) => `<div class="entry">${fmtFn(pool[i], i)}</div>`).join('') || '<div class="entry dim">None found yet.</div>'}`;
        const revealed = d.notes.revealed || [];
        body.innerHTML = sec('Musings', MUSINGS, d.notes.musing, (t) => `<em>“${esc(t)}”</em>`)
          + sec('Letters', LETTERS, d.notes.letter, (l) => `<em>“${esc(l.text)}”</em><div class="who">— ${esc(l.from)}</div>`)
          + sec('Riddles', RIDDLES, d.notes.riddle, (r, i) => `<em>${esc(r.q)}</em><div class="who">${revealed.includes(i) ? `Answer: ${esc(r.a)}` : `<button class="btn ghost" data-rv="${i}" style="margin-top:6px">Reveal answer</button>`}</div>`)
          + sec('Shanties', SHANTIES, d.notes.shanty, (t) => `<em style="white-space:pre-wrap">${esc(t)}</em>`)
          + sec('Recipes', RECIPES, d.notes.recipe, (t) => esc(t))
          + sec('Golden bottles', GOLDEN, d.notes.golden, (t) => `<em style="color:var(--gold)">${esc(t)}</em>`);
        body.querySelectorAll('[data-rv]').forEach((b) => { b.onclick = () => { onReveal(+b.dataset.rv); this.rerender(); }; });
      } else if (tab === 'fish') {
        const caught = FISH.filter((f) => d.fish[f.id]).length;
        body.innerHTML = `<p class="dim" style="margin-top:0">${caught}/${FISH.length} species. Fish near shores, in deep water, at night and in storms to find them all.</p><div class="grid">${FISH.map((f) => {
          const r = d.fish[f.id];
          const R = RARITY[f.rarity];
          const img = `<div class="fthumb" style="--g:${R.color}"><img src="${thumb(f.id)}" class="${r ? '' : 'sil'}" alt="" /></div>`;
          return r ? `<div class="tile fishtile">${img}<h4>${esc(f.name)}</h4><div class="rar" style="color:${R.color}">${'★'.repeat(['common', 'uncommon', 'rare', 'legendary'].indexOf(f.rarity) + 1)} ${R.label.toUpperCase()}</div><div class="sub">Caught ${r.count} · best ${r.best} cm</div></div>`
            : `<div class="tile fishtile locked">${img}<h4>???</h4><div class="rar" style="color:${R.color}">${R.label.toUpperCase()}</div><div class="sub">Found in: ${esc(f.where === 'any' ? 'open water' : f.where)}</div></div>`;
        }).join('')}</div>`;
      } else if (tab === 'creatures') {
        body.innerHTML = `<div class="grid">${CREATURES.map((c) => (d.creatures[c.id]
          ? `<div class="tile"><h4>${esc(c.name)}</h4><div class="sub">${esc(c.hint)}</div></div>`
          : `<div class="tile locked"><h4>???</h4><div class="sub">${esc(c.hint)}</div></div>`)).join('')}</div>`;
      } else if (tab === 'records') {
        const s = d.stats;
        body.innerHTML = `<div class="kv">
          <div><b>${fmt(s.shrines)}</b><span>shrines woken</span></div><div><b>${fmt(s.bottles)}</b><span>bottles read</span></div>
          <div><b>${s.leagues.toFixed(1)}</b><span>leagues sailed</span></div><div><b>${fmt(s.fish)}</b><span>fish caught</span></div>
          <div><b>${fmt(s.chests)}</b><span>treasure chests</span></div><div><b>${fmt(s.trials)}</b><span>shrine trials</span></div>
          <div><b>${fmt(s.gates)}</b><span>regatta gates</span></div><div><b>${s.topKnots | 0}</b><span>top speed (kn)</span></div>
          <div><b>${fmtTime(s.seconds)}</b><span>time at sea</span></div><div><b>${d.regattaBest ? fmtTime(d.regattaBest) : '—'}</b><span>best regatta</span></div>
        </div>`;
      }
    });
  }

  shipwright(profile, cb) {
    const d = profile.d;
    this.openModal('shop', 'The Shipwright', [{ id: 'up', label: 'Upgrades' }, { id: 'sails', label: 'Sails & Paint' }], (tab, body) => {
      if (tab === 'up') {
        body.innerHTML = `<p class="dim" style="margin-top:0">You have <b style="color:var(--ink)">${fmt(d.pearls)} pearls</b>. Earn more from shrines, bottles, chests, fish, regattas and daily bounties.</p><div class="grid">${UPGRADES.map((u) => {
          const lvl = profile.level(u.id), max = lvl >= u.costs.length, cost = u.costs[lvl];
          return `<div class="tile"><h4>${esc(u.name)}</h4><div class="sub">${esc(u.desc)}</div><div class="pips">${u.costs.map((_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>
            <button class="btn" data-buy="${u.id}" ${max || d.pearls < cost ? 'disabled' : ''}>${max ? 'Maxed' : `Upgrade · ${cost}`}</button></div>`;
        }).join('')}</div>`;
        body.querySelectorAll('[data-buy]').forEach((b) => { b.onclick = () => { if (cb.buy(b.dataset.buy)) this.rerender(); }; });
      } else {
        body.innerHTML = `<div class="grid">${SAILS.map((s) => {
          const st = profile.sailStatus(s);
          const eq = d.sail === s.id;
          const btn = eq ? '<button class="btn ghost" disabled>Equipped</button>'
            : st.owned ? `<button class="btn" data-eq="${s.id}">Equip</button>`
              : st.buy ? `<button class="btn" data-bs="${s.id}" ${d.pearls < st.buy ? 'disabled' : ''}>Buy · ${st.buy}</button>`
                : `<div class="sub" style="margin-top:10px">🔒 ${esc(st.text)}</div>`;
          return `<div class="tile ${eq ? 'equipped' : ''} ${!st.owned && !st.buy ? 'locked' : ''}"><div class="swatch"><i style="background:${s.main}"></i><i style="background:${s.jib}"></i><i style="background:${s.hull}"></i><i style="background:${s.flag}"></i></div><h4>${esc(s.name)}</h4>${btn}</div>`;
        }).join('')}</div>`;
        body.querySelectorAll('[data-eq]').forEach((b) => { b.onclick = () => { cb.equip(b.dataset.eq); this.rerender(); }; });
        body.querySelectorAll('[data-bs]').forEach((b) => { b.onclick = () => { if (cb.buySail(b.dataset.bs)) this.rerender(); }; });
      }
    });
  }

  scorecard(profile, session, mode, cb) {
    const d = profile.d;
    const MODE = { voyage: 'Voyage', daily: 'Daily Voyage', lantern: 'Lantern Run' };
    this.openModal('scores', 'Scorecard', [{ id: 'now', label: 'This voyage' }, { id: 'best', label: 'High scores' }], (tab, body) => {
      if (tab === 'now') {
        body.innerHTML = `<div class="dim" style="text-align:center">${MODE[mode]} · ${fmtTime(session.time)}</div><div class="big">${fmt(session.score)}</div>
          ${statsGrid(session)}
          <div class="row-btns">${mode === 'voyage' ? '<button class="btn" data-end>Bank this score &amp; start a new run</button>' : ''}<button class="btn ghost" data-menu>Main menu</button></div>`;
        body.querySelector('[data-end]')?.addEventListener('click', cb.end);
        body.querySelector('[data-menu]').addEventListener('click', cb.menu);
      } else {
        body.innerHTML = ['voyage', 'daily', 'lantern'].map((m) => {
          const list = d.highscores[m] || [];
          return `<h4 style="margin:14px 0 4px">${MODE[m]}</h4>${list.length ? `<table><tr><th>#</th><th>Score</th>${m === 'daily' ? '<th>Time</th>' : '<th>Length</th>'}<th>Shrines</th><th>Date</th></tr>${list.map((e, i) => `<tr><td>${i + 1}</td><td><b>${fmt(e.score)}</b></td><td>${fmtTime(e.time)}</td><td>${e.shrines}</td><td class="dim">${esc(e.date)}</td></tr>`).join('')}</table>` : '<div class="entry dim">No runs yet.</div>'}`;
        }).join('');
      }
    });
  }

  results({ title, subtitle, session, best, share }, cb) {
    this.openModal('results', title, [{ id: 'r', label: '' }], (tab, body) => {
      body.innerHTML = `<div class="dim" style="text-align:center">${esc(subtitle)}</div><div class="big">${fmt(session.score)}</div>
        ${best ? `<span class="badge">${esc(best)}</span>` : ''}
        ${statsGrid(session)}
        <div class="row-btns"><button class="btn" data-again>Play again</button>${share ? '<button class="btn ghost" data-share>Copy result</button>' : ''}<button class="btn ghost" data-menu>Main menu</button></div>`;
      body.querySelector('[data-again]').onclick = cb.again;
      body.querySelector('[data-menu]').onclick = cb.menu;
      const sh = body.querySelector('[data-share]');
      if (sh) sh.onclick = () => { navigator.clipboard?.writeText(share).then(() => { sh.textContent = 'Copied!'; }, () => { sh.textContent = 'Copy failed'; }); };
    });
  }
}

function statsGrid(s) {
  return `<div class="kv">
    <div><b>${s.shrines}</b><span>shrines</span></div><div><b>${s.bottles}</b><span>bottles</span></div>
    <div><b>${s.fish}</b><span>fish</span></div><div><b>${s.chests}</b><span>chests</span></div>
    <div><b>${(s.distance / 500).toFixed(1)}</b><span>leagues</span></div><div><b>${s.topKnots | 0}</b><span>top speed (kn)</span></div>
    <div><b>×${s.bestCombo}</b><span>best chain</span></div><div><b>${s.gates}</b><span>regatta gates</span></div>
  </div>`;
}
