// Состояние забега: карта, герои, награды, события, магазин, колесо фортуны, вербовка.
import { HEROES, unlockedSkills } from '../data/heroes.js';
import { ENEMIES } from '../data/enemies.js';
import { ACTS, FLOORS_PER_ACT } from '../data/acts.js';
import { RELICS, sumMods } from '../data/relics.js';
import { EVENTS } from '../data/events.js';
import { ITEMS, itemStats, itemPower, comboStats, setScore } from '../data/items.js';
import { TALENTS, talentKeys } from '../data/talents.js';
import { makeRng } from './rng.js';
import { forgeMods } from './meta.js';

const R = (run) => { const r = makeRng(run.rs); run.rs = (Math.imul(run.rs, 1664525) + 1013904223) >>> 0; return r; };
export const FIGHT = new Set(['battle', 'elite', 'boss']);
export const MAX_PARTY = 4;
export const RUN_VERSION = 3;
export const BAG_MAX = 10;

export function createRun({ party, meta, asc = 0, mode = 'normal', seed }) {
  const rs = (seed ?? (Math.random() * 4294967296)) >>> 0 || 1;
  const run = {
    v: RUN_VERSION, rs, asc, mode, loop: 0, act: 1, floor: 0, gold: 60, relics: [], metaMods: meta ? forgeMods(meta) : {},
    heroes: [], unlocked: meta ? meta.unlocked.slice() : Object.keys(HEROES).filter((k) => HEROES[k].start),
    forge: meta ? { ...meta.forge } : {},
    bag: [], map: null, node: null, lastFight: true, recruitPending: false, recruitDone: 0, respins: meta?.forge?.respin ?? 0,
    stats: { battles: 0, kills: 0, elites: 0, floors: 0, bosses: 0, items: 0, games: 0 }, over: null, ashEarned: 0,
  };
  for (const id of party) run.heroes.push(newHero(id, 1));
  const startRelics = meta?.forge?.relic ?? 0;
  for (let i = 0; i < startRelics; i++) addRelic(run, pickRelics(run, 1, 1)[0]?.id);
  for (let i = 0; i < (meta?.forge?.startitem ?? 0); i++) giveItem(run, rollItem(run, 1));
  for (const h of run.heroes) h.hp = heroStats(run, h).maxHp;
  genAct(run);
  return run;
}

function newHero(id, lvl) {
  return { id, lvl, xp: 0, hp: 1, skillLv: {}, bonusHp: 0, bonusAtk: 0, items: {}, talents: {}, pendingTalents: 0 };
}

export const mods = (run) => sumMods(run.relics, run.metaMods);
export const xpNeed = (lvl) => 1 + lvl;

// Бонусы героя от предметов и талантов
export function heroMods(h) {
  const m = {};
  for (const it of Object.values(h.items)) for (const [k, v] of Object.entries(itemStats(it))) m[k] = (m[k] ?? 0) + v;
  for (const [k, v] of Object.entries(comboStats(Object.values(h.items)))) m[k] = (m[k] ?? 0) + v;
  for (const [t, n] of Object.entries(h.talents)) for (const [k, v] of Object.entries(TALENTS[t].stats)) m[k] = (m[k] ?? 0) + v * n;
  return m;
}

export function heroStats(run, h) {
  const base = HEROES[h.id];
  const m = mods(run), hm = heroMods(h);
  const f = 1 + 0.07 * (h.lvl - 1);
  const maxHp = Math.round(base.hp * f * (1 + ((m.hpPct ?? 0) + h.bonusHp + (hm.hp ?? 0)) / 100));
  const atk = Math.round(base.atk * f * (1 + (h.bonusAtk + (hm.atk ?? 0)) / 100));
  return { maxHp, atk, def: base.def + (hm.def ?? 0), hm };
}

// Выполнить действие, меняющее максимум HP, и сдвинуть текущее HP на разницу
function keepHp(run, h, fn) {
  const before = heroStats(run, h).maxHp;
  fn();
  const after = heroStats(run, h).maxHp;
  if (after > before) h.hp += after - before;
  h.hp = Math.max(1, Math.min(h.hp, after));
}

export function partyUnits(run) {
  return run.heroes.map((h) => {
    const base = HEROES[h.id], s = heroStats(run, h);
    return { id: h.id, name: base.name, hp: Math.min(h.hp, s.maxHp), maxHp: s.maxHp, atk: s.atk, def: s.def, skills: base.skills, skillLv: h.skillLv, hero: h, lvl: h.lvl,
      hm: { crit: s.hm.crit ?? 0, ls: s.hm.ls ?? 0, thorns: s.hm.thorns ?? 0, heal: s.hm.heal ?? 0, rage: s.hm.rage ?? 0 } };
  });
}
export const heroOf = (run, id) => run.heroes.find((h) => h.id === id);

// ---------- Карта ----------
const TYPE_W = { battle: 40, event: 14, elite: 11, campfire: 8, shop: 8, treasure: 6, minigame: 13 };

function genAct(run) {
  const rng = R(run);
  const floors = [];
  for (let f = 1; f <= FLOORS_PER_ACT; f++) {
    let row;
    if (f === FLOORS_PER_ACT) row = [{ type: 'boss' }];
    else if (f <= 2) row = Array.from({ length: rng.range(2, 3) }, () => ({ type: 'battle' }));
    else if (f === FLOORS_PER_ACT - 1) row = [{ type: 'campfire' }, { type: rng.pick(['shop', 'minigame']) }, { type: rng.pick(['battle', 'elite']) }];
    else if (f === 5) row = [{ type: 'campfire' }, { type: rng.pick(['treasure', 'event', 'minigame', 'shop']) }, { type: 'battle' }];
    else {
      row = [];
      const cnt = rng.range(2, 3);
      for (let i = 0; i < cnt; i++) {
        let t;
        do { t = rng.weighted(Object.entries(TYPE_W).map(([k, w]) => ({ k, w }))).k; } while (t === 'elite' && f < 4);
        row.push({ type: t });
      }
      if (!row.some((n) => FIGHT.has(n.type))) row[rng.int(row.length)].type = 'battle';
    }
    floors.push(row.map((n, i) => ({ ...n, id: `${f}-${i}` })));
  }
  run.map = floors;
  run.floor = 0;
  run.node = null;
  run.lastFight = true;
}

// Список узлов текущего этажа; после отдыха/лавки/игры нужно драться
export function currentChoices(run) {
  const row = run.map[run.floor];
  if (!row) return null;
  return row.map((n) => ({ ...n, locked: !run.lastFight && !FIGHT.has(n.type) }));
}

export function chooseNode(run, idx) {
  const n = run.map[run.floor][idx];
  if (!run.lastFight && !FIGHT.has(n.type)) return null;
  run.lastFight = FIGHT.has(n.type);
  run.node = n;
  const rng = R(run);
  const info = { type: n.type, act: run.act, floor: run.floor + 1 };
  if (FIGHT.has(n.type)) {
    const e = genEncounter(run, n.type, rng);
    info.enemies = e.enemies; info.bg = e.bg; info.scale = e.scale; info.final = e.final;
  } else if (n.type === 'event') info.event = rng.pick(EVENTS);
  else if (n.type === 'shop') info.shop = genShop(run, rng);
  else if (n.type === 'treasure') info.relics = pickRelics(run, 3, run.act >= 2 ? 2 : 1);
  else if (n.type === 'minigame') info.game = rng.pick(['memory', 'forge', 'ghosts', 'cups']);
  run.node = { ...n, info };
  return run.node;
}

export function genEncounter(run, type, rng) {
  const act = ACTS[run.act];
  const f = run.floor + 1;
  const n = run.heroes.length;
  const loopMult = 1 + 0.5 * run.loop;
  const scale = (1 + 0.05 * (f - 1)) * loopMult * 1.18;
  let enemies;
  let bg = rng.pick(act.bgs);
  let final = false;
  if (type === 'boss') {
    if (run.act === 3 && run.floor >= FLOORS_PER_ACT) { enemies = ['ash_god']; final = true; }
    else enemies = [rng.pick(act.bosses)];
    bg = final ? 'void' : act.bossBg;
  } else if (type === 'elite') {
    enemies = [rng.pick(act.elites), ...Array.from({ length: Math.max(0, n - 2 + rng.range(0, 1)) }, () => rng.pick(act.pool))];
  } else {
    let cnt = [0, 1, 2, 3, 3][n];
    if (f >= 4 && rng.chance(0.5)) cnt++;
    cnt = Math.min(cnt, n + 1, 4);
    enemies = Array.from({ length: cnt }, () => rng.pick(act.pool));
  }
  return { enemies, bg, scale, final };
}

// Следующий этаж
export function advance(run) {
  const passed = run.floor;
  run.floor++;
  run.node = null;
  run.stats.floors++;
  if (run.heroes.length < MAX_PARTY && run.act === 1) {
    const need = MAX_PARTY - run.heroes.length - 0;
    const total = need + run.recruitDone;
    const sched = total >= 3 ? [1, 3, 5] : total === 2 ? [1, 4] : [2];
    if (passed === sched[run.recruitDone]) run.recruitPending = true;
  }
  if (run.heroes.length < MAX_PARTY && run.act === 2 && passed === 0) run.recruitPending = true;
}

export function finishFloorAfterBoss(run) {
  if (run.act === 3 && run.floor === FLOORS_PER_ACT - 1) {
    run.map.push([{ type: 'boss', id: 'final', final: true }]);
    advance(run);
    return 'continue';
  }
  if (run.act === 3 && run.floor === FLOORS_PER_ACT) {
    if (run.mode === 'endless') { run.loop++; run.act = 1; genAct(run); run.stats.floors++; return 'loop'; }
    return 'win';
  }
  run.act++;
  run.stats.floors++;
  genAct(run);
  return 'next_act';
}

// ---------- Вербовка ----------
export function recruitOffers(run) {
  const rng = R(run);
  const pool = run.unlocked.filter((id) => !run.heroes.some((h) => h.id === id));
  const n = 3 + (run.forge.scout ?? 0);
  return rng.shuffle(pool).slice(0, n);
}
export function recruit(run, id) {
  const rng = R(run);
  const avg = run.heroes.reduce((s, h) => s + h.lvl, 0) / run.heroes.length;
  const lvl = Math.max(1, Math.round(avg) - 1);
  const h = newHero(id, lvl);
  for (let l = 2; l <= lvl; l++) { const t = rng.pick(talentKeys()); h.talents[t] = (h.talents[t] ?? 0) + 1; }
  h.hp = 1;
  run.heroes.push(h);
  h.hp = heroStats(run, h).maxHp;
  run.recruitPending = false;
  run.recruitDone++;
  return h;
}

// ---------- Опыт, таланты ----------
// Возвращает [{id, from, to, newSkills:[sid]}]
export function grantXp(run, xp) {
  const m = mods(run);
  const ups = [];
  for (const h of run.heroes) {
    h.xp += xp * (1 + (m.xpPct ?? 0) / 100);
    const from = h.lvl;
    for (;;) {
      const need = xpNeed(h.lvl);
      if (h.xp < need) break;
      h.xp -= need; h.lvl++;
      h.pendingTalents++;
      const s = heroStats(run, h);
      h.hp = Math.min(s.maxHp, h.hp + Math.round(s.maxHp * 0.15));
    }
    if (h.lvl > from) {
      const was = new Set(unlockedSkills(h.id, from));
      ups.push({ id: h.id, from, to: h.lvl, newSkills: unlockedSkills(h.id, h.lvl).filter((s) => !was.has(s)) });
    }
  }
  run.newSkills = (run.newSkills ?? []).concat(ups);
  return ups;
}
export function talentChoices(run) {
  const rng = R(run);
  return rng.shuffle(talentKeys()).slice(0, 3);
}
export function applyTalent(run, h, key) {
  keepHp(run, h, () => { h.talents[key] = (h.talents[key] ?? 0) + 1; h.pendingTalents = Math.max(0, h.pendingTalents - 1); });
}
export const heroesWithTalents = (run) => run.heroes.filter((h) => h.pendingTalents > 0);

// ---------- Предметы ----------
export function rollItem(run, rarity) {
  const rng = R(run);
  return { id: rng.pick(Object.keys(ITEMS)), r: rarity };
}
// Выдать предмет случайному (или указанному) герою: пустой слот — сразу надевает, иначе в рюкзак.
export function giveItem(run, it, heroId) {
  const rng = R(run);
  const h = heroId ? heroOf(run, heroId) : rng.pick(run.heroes);
  const slot = ITEMS[it.id].slot;
  run.stats.items++;
  if (!h.items[slot]) {
    keepHp(run, h, () => { h.items[slot] = it; });
    return { hero: h.id, it, equipped: true };
  }
  run.bag.push(it);
  const res = { hero: h.id, it, equipped: false, bagged: true };
  if (run.bag.length > BAG_MAX) { // рюкзак полон: продаётся самый слабый предмет
    let wi = 0;
    run.bag.forEach((x, i) => { if (itemPower(x) < itemPower(run.bag[wi])) wi = i; });
    const sold = run.bag.splice(wi, 1)[0];
    const gold = 10 + 15 * sold.r; run.gold += gold;
    res.soldItem = sold; res.gold = gold;
  }
  return res;
}

// Надеть предмет из рюкзака на героя (старый предмет уходит в рюкзак)
export function equipFromBag(run, heroId, bagIndex) {
  const h = heroOf(run, heroId), it = run.bag[bagIndex];
  if (!it) return false;
  const slot = ITEMS[it.id].slot, old = h.items[slot];
  keepHp(run, h, () => { h.items[slot] = it; });
  run.bag.splice(bagIndex, 1);
  if (old) run.bag.push(old);
  return true;
}
// Снять предмет в рюкзак
export function unequip(run, heroId, slot) {
  const h = heroOf(run, heroId), it = h.items[slot];
  if (!it || run.bag.length >= BAG_MAX) return false;
  keepHp(run, h, () => { delete h.items[slot]; });
  run.bag.push(it);
  return true;
}
// Лучший набор из надетого и рюкзака по слотам (перебор)
export function bestSetFor(run, heroId) {
  const h = heroOf(run, heroId);
  const slots = ['weapon', 'armor', 'trinket'];
  const pool = slots.map((sl) => [...(h.items[sl] ? [h.items[sl]] : []), ...run.bag.filter((x) => ITEMS[x.id].slot === sl)]);
  let best = null, bs = -1;
  const opts = pool.map((p) => (p.length ? p : [null]));
  for (const a of opts[0]) for (const b of opts[1]) for (const c of opts[2]) {
    const set = [a, b, c].filter(Boolean);
    const sc = setScore(set);
    if (sc > bs) { bs = sc; best = [a, b, c]; }
  }
  return best;
}
export function autoEquip(run, heroId) {
  const h = heroOf(run, heroId);
  const best = bestSetFor(run, heroId);
  if (!best) return false;
  const slots = ['weapon', 'armor', 'trinket'];
  // вернуть всё в рюкзак, затем надеть лучшее
  keepHp(run, h, () => {
    for (const sl of slots) if (h.items[sl]) { run.bag.push(h.items[sl]); delete h.items[sl]; }
    best.forEach((it, i) => { if (!it) return; const bi = run.bag.indexOf(it); if (bi >= 0) run.bag.splice(bi, 1); h.items[slots[i]] = it; });
  });
  return true;
}

// ---------- Колесо фортуны ----------
const WEDGES = [
  { t: 'item', r: 1, w: 20 }, { t: 'gold', w: 12 }, { t: 'item', r: 2, w: 14 }, { t: 'heal', w: 10 }, { t: 'item', r: 1, w: 20 },
  { t: 'xp', w: 10 }, { t: 'item', r: 3, w: 6 }, { t: 'relic', w: 6 }, { t: 'item', r: 2, w: 14 }, { t: 'item', r: 4, w: 2 },
];
export const wedgeList = () => WEDGES.map((w) => ({ ...w }));
export function spinWheel(run, kind = 'battle') {
  const rng = R(run);
  const luck = 1 + 0.18 * (run.forge.luck ?? 0);
  const weights = WEDGES.map((w) => {
    let k = 1;
    if (w.t === 'item' && w.r >= 2) k *= luck;
    if (kind === 'elite') k *= w.t === 'item' ? (w.r >= 2 ? 1.8 : 0.6) : 1;
    if (kind === 'boss') k *= w.t === 'item' ? (w.r >= 3 ? 3.5 : w.r === 2 ? 1.2 : 0.2) : (w.t === 'relic' ? 2 : 0.6);
    return w.w * k;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let x = rng() * total, idx = 0;
  for (; idx < weights.length; idx++) { x -= weights[idx]; if (x <= 0) break; }
  idx = Math.min(idx, WEDGES.length - 1);
  return { index: idx, wedge: WEDGES[idx] };
}
// Применить приз клина; возвращает описание
export function applyPrize(run, wedge) {
  switch (wedge.t) {
    case 'item': return { t: 'item', ...giveItem(run, rollItem(run, wedge.r)) };
    case 'gold': { const n = 25 + 10 * run.act + R(run).range(0, 15); run.gold += n; return { t: 'gold', n }; }
    case 'heal': healParty(run, 0.35); return { t: 'heal' };
    case 'xp': return { t: 'xp', ups: grantXp(run, 3) };
    case 'relic': { const r = pickRelics(run, 1, 1)[0]; if (r) { addRelic(run, r.id); return { t: 'relic', id: r.id }; } run.gold += 60; return { t: 'gold', n: 60 }; }
  }
}

// ---------- Мини-игры: приз по результату (0..3) ----------
export function minigamePrizes(run, tier) {
  run.stats.games++;
  const out = [];
  if (tier <= 0) { run.gold += 15; out.push({ t: 'gold', n: 15 }); }
  else if (tier === 1) out.push({ t: 'item', ...giveItem(run, rollItem(run, 1)) });
  else if (tier === 2) { out.push({ t: 'item', ...giveItem(run, rollItem(run, 2)) }); run.gold += 25; out.push({ t: 'gold', n: 25 }); }
  else { out.push({ t: 'item', ...giveItem(run, rollItem(run, 3)) }); run.gold += 50; out.push({ t: 'gold', n: 50 }); const r = pickRelics(run, 1)[0]; if (r && R(run).chance(0.5)) { addRelic(run, r.id); out.push({ t: 'relic', id: r.id }); } }
  return out;
}

// ---------- Реликвии и награды ----------
export function pickRelics(run, n, minRarity = 1) {
  const rng = R(run);
  const pool = Object.values(RELICS).filter((r) => !run.relics.includes(r.id));
  const out = [];
  while (out.length < n && pool.length) {
    const w = pool.map((r) => ({ r, w: r.rarity === 3 ? 1 : r.rarity === 2 ? 3 : 6 }));
    const pick = rng.weighted(w).r;
    pool.splice(pool.indexOf(pick), 1);
    out.push(pick);
  }
  if (minRarity > 1 && out.length && out.every((r) => r.rarity < minRarity)) {
    const better = Object.values(RELICS).filter((r) => r.rarity >= minRarity && !run.relics.includes(r.id) && !out.includes(r));
    if (better.length) out[0] = rng.pick(better);
  }
  return out;
}

export function battleRewards(run, type, rng = R(run)) {
  const m = mods(run);
  const mult = type === 'boss' ? 3.5 : type === 'elite' ? 2 : 1;
  const gold = Math.round((10 + 6 * run.act + rng.range(0, 8)) * mult * (1 + (m.goldPct ?? 0) / 100));
  const xp = type === 'boss' ? 8 : type === 'elite' ? 4 : 2;
  return { gold, xp, choices: genBoons(run, type, rng) };
}

export function upgradable(run) {
  const out = [];
  for (const h of run.heroes) for (const s of unlockedSkills(h.id, h.lvl)) if ((h.skillLv[s] ?? 0) < 3) out.push({ hero: h, skill: s });
  return out;
}

export function genBoons(run, type, rng) {
  const choices = [];
  const count = 3 + ((mods(run).extraChoice ?? 0) > 0 ? 1 : 0);
  if (type === 'elite' || type === 'boss') {
    const rel = pickRelics(run, count, type === 'boss' ? 2 : 1);
    for (const r of rel) choices.push({ kind: 'relic', relic: r.id });
    return choices;
  }
  const ups = rng.shuffle(upgradable(run));
  const make = [];
  for (let i = 0; i < 2 && i < ups.length; i++) make.push({ kind: 'upgrade', hero: ups[i].hero.id, skill: ups[i].skill });
  make.push({ kind: 'hp', hero: rng.pick(run.heroes).id, pct: 12 });
  make.push({ kind: 'atk', hero: rng.pick(run.heroes).id, pct: 10 });
  make.push({ kind: 'heal', pct: 35 });
  make.push({ kind: 'gold', n: 35 + 8 * run.act });
  if (rng.chance(0.18)) { const r = pickRelics(run, 1)[0]; if (r) make.push({ kind: 'relic', relic: r.id }); }
  const used = new Set();
  for (const b of rng.shuffle(make)) {
    const key = b.kind + (b.hero ?? '') + (b.skill ?? '');
    if (used.has(key)) continue;
    used.add(key); choices.push(b);
    if (choices.length >= count) break;
  }
  return choices;
}

export function applyBoon(run, b) {
  const find = (id) => run.heroes.find((h) => h.id === id);
  switch (b.kind) {
    case 'upgrade': { const h = find(b.hero); h.skillLv[b.skill] = (h.skillLv[b.skill] ?? 0) + 1; break; }
    case 'hp': { const h = find(b.hero); keepHp(run, h, () => { h.bonusHp += b.pct; }); break; }
    case 'atk': { find(b.hero).bonusAtk += b.pct; break; }
    case 'heal': healParty(run, b.pct / 100); break;
    case 'gold': run.gold += b.n; break;
    case 'relic': addRelic(run, b.relic); break;
  }
}

export function addRelic(run, id) {
  if (!id || run.relics.includes(id)) return;
  const before = run.heroes.map((h) => heroStats(run, h).maxHp);
  run.relics.push(id);
  run.heroes.forEach((h, i) => { const d = heroStats(run, h).maxHp - before[i]; if (d > 0) h.hp += d; h.hp = Math.min(h.hp, heroStats(run, h).maxHp); });
}

export function healParty(run, frac) {
  for (const h of run.heroes) { const mx = heroStats(run, h).maxHp; h.hp = Math.min(mx, Math.max(h.hp, 0) + Math.round(mx * frac)); }
}

export function applyBattleResult(run, state) {
  for (const u of state.allies) {
    if (u.minion) continue;
    const h = run.heroes.find((x) => x.id === u.id);
    h.hp = u.dead ? Math.max(1, Math.round(u.maxHp * 0.25)) : Math.max(1, u.hp);
  }
  run.stats.battles++;
  for (const e of state.enemies) if (e.dead) { run.stats.kills++; if (e.tier === 1) run.stats.elites++; if (e.tier === 2) run.stats.bosses++; }
}

export function campRest(run) {
  const m = mods(run);
  healParty(run, 0.35 + (m.campHeal ?? 0) / 100);
}

// ---------- Магазин ----------
export function genShop(run, rng) {
  const items = [];
  for (const r of pickRelics(run, 2)) items.push({ kind: 'relic', relic: r.id, price: Math.round(r.price * (0.9 + rng() * 0.3)) });
  const rar = [1, 2, 2, 3];
  for (let i = 0; i < 2; i++) {
    const r = rng.pick(rar), it = { id: rng.pick(Object.keys(ITEMS)), r }, h = rng.pick(run.heroes);
    items.push({ kind: 'item', it, hero: h.id, price: [0, 45, 95, 170][r] + rng.range(0, 10) });
  }
  items.push({ kind: 'heal', pct: 50, price: 45 });
  const ups = rng.shuffle(upgradable(run)).slice(0, 1);
  for (const u of ups) items.push({ kind: 'upgrade', hero: u.hero.id, skill: u.skill, price: 70 + 15 * (u.hero.skillLv[u.skill] ?? 0) });
  return items.map((it, i) => ({ ...it, i, sold: false }));
}

export function buy(run, shop, i) {
  const it = shop[i];
  if (!it || it.sold || run.gold < it.price) return false;
  run.gold -= it.price; it.sold = true;
  if (it.kind === 'item') it.result = giveItem(run, it.it, it.hero);
  else applyBoon(run, it.kind === 'heal' ? { kind: 'heal', pct: it.pct } : it);
  return true;
}

// ---------- События ----------
export function resolveEvent(run, outcome) {
  const rng = R(run);
  const ops = outcome.ops;
  const res = { fight: null, relic: null };
  if (ops.hp) for (const h of run.heroes) { const mx = heroStats(run, h).maxHp; h.hp = Math.max(1, Math.min(mx, h.hp + Math.round(mx * ops.hp))); }
  if (ops.heal) {
    if (ops.heal > 0) healParty(run, ops.heal);
    else for (const h of run.heroes) h.hp = Math.max(1, h.hp + Math.round(heroStats(run, h).maxHp * ops.heal));
  }
  if (ops.gold) run.gold = Math.max(0, run.gold + ops.gold);
  if (ops.maxhp) for (const h of run.heroes) keepHp(run, h, () => { h.bonusHp += ops.maxhp * 100; });
  if (ops.upgrade) { const ups = upgradable(run); if (ups.length) { const u = rng.pick(ups); u.hero.skillLv[u.skill] = (u.hero.skillLv[u.skill] ?? 0) + 1; res.upgrade = { hero: u.hero.id, skill: u.skill }; } }
  if (ops.xp) res.levels = grantXp(run, ops.xp * 2);
  if (ops.relic) { const r = pickRelics(run, 1)[0]; if (r) { addRelic(run, r.id); res.relic = r.id; } }
  if (ops.fight) { res.fight = ops.fight; run.lastFight = true; }
  if (ops.rage) run.startRageBonus = Math.max(0, (run.startRageBonus ?? 0) + ops.rage);
  return res;
}
export function pickOutcome(run, choice) {
  const rng = R(run);
  return rng.weighted(choice.outcomes, (o) => o.p);
}

export function battleMods(run) {
  const m = { ...mods(run) };
  if (run.startRageBonus) { m.startRage = (m.startRage ?? 0) + run.startRageBonus; run.startRageBonus = 0; }
  return m;
}

export function ashForRun(run, outcome) {
  let a = run.stats.floors * 2.5 + run.stats.bosses * 20 + run.stats.elites * 4 + run.stats.items * 1 + (outcome === 'win' ? 80 : 0) + (run.loop * 60);
  a *= 1 + (mods(run).ashPct ?? 0) / 100 + run.asc * 0.1;
  return Math.round(a);
}

export function loadRun() {
  try { const s = globalThis.localStorage?.getItem('pepel_run'); const r = s ? JSON.parse(s) : null; return r && r.v === RUN_VERSION ? r : null; } catch { return null; }
}
export function saveRun(run) { try { if (run) globalThis.localStorage?.setItem('pepel_run', JSON.stringify(run)); else globalThis.localStorage?.removeItem('pepel_run'); } catch {} }
void ENEMIES;
