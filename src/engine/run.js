// Состояние забега: карта, герои, награды, события, магазин.
import { HEROES } from '../data/heroes.js';
import { SKILLS } from '../data/skills.js';
import { ENEMIES } from '../data/enemies.js';
import { ACTS, FLOORS_PER_ACT } from '../data/acts.js';
import { RELICS, sumMods } from '../data/relics.js';
import { EVENTS } from '../data/events.js';
import { makeRng } from './rng.js';
import { forgeMods } from './meta.js';

const R = (run) => { const r = makeRng(run.rs); run.rs = (Math.imul(run.rs, 1664525) + 1013904223) >>> 0; return r; };

export function createRun({ party, meta, asc = 0, mode = 'normal', seed }) {
  const rs = (seed ?? (Math.random() * 4294967296)) >>> 0 || 1;
  const run = {
    v: 1, rs, asc, mode, loop: 0, act: 1, floor: 0, gold: 60, relics: [], metaMods: meta ? forgeMods(meta) : {},
    heroes: party.map((id) => ({ id, lvl: 1, xp: 0, hp: 1, skillLv: {}, bonusHp: 0, bonusAtk: 0 })),
    map: null, node: null, stats: { battles: 0, kills: 0, elites: 0, floors: 0, bosses: 0 }, over: null, ashEarned: 0,
  };
  const n = run.metaMods.relicsStart ?? 0;
  const startRelics = meta?.forge?.relic ?? 0;
  for (let i = 0; i < startRelics; i++) addRelic(run, pickRelics(run, 1, 1)[0]?.id);
  for (const h of run.heroes) h.hp = heroStats(run, h).maxHp;
  genAct(run);
  void n;
  return run;
}

export const mods = (run) => sumMods(run.relics, run.metaMods);

export function heroStats(run, h) {
  const base = HEROES[h.id];
  const m = mods(run);
  const f = 1 + 0.07 * (h.lvl - 1);
  const maxHp = Math.round(base.hp * f * (1 + ((m.hpPct ?? 0) + h.bonusHp) / 100));
  const atk = Math.round(base.atk * f * (1 + h.bonusAtk / 100));
  return { maxHp, atk, def: base.def };
}

export function partyUnits(run) {
  return run.heroes.map((h) => {
    const base = HEROES[h.id], s = heroStats(run, h);
    return { id: h.id, name: base.name, hp: Math.min(h.hp, s.maxHp), maxHp: s.maxHp, atk: s.atk, def: s.def, skills: base.skills, skillLv: h.skillLv, hero: h };
  });
}

// ---------- Карта ----------
const TYPE_W = { battle: 44, event: 18, elite: 13, campfire: 9, shop: 9, treasure: 7 };

function genAct(run) {
  const rng = R(run);
  const floors = [];
  for (let f = 1; f <= FLOORS_PER_ACT; f++) {
    let row;
    if (f === FLOORS_PER_ACT) row = [{ type: 'boss' }];
    else if (f === 1) row = Array.from({ length: rng.range(2, 3) }, () => ({ type: 'battle' }));
    else if (f === FLOORS_PER_ACT - 1) row = [{ type: 'campfire' }, { type: rng.pick(['shop', 'elite', 'campfire']) }];
    else if (f === 5) row = [{ type: 'campfire' }, { type: rng.pick(['treasure', 'event', 'shop']) }, { type: 'battle' }];
    else {
      row = [];
      const cnt = rng.range(2, 3);
      for (let i = 0; i < cnt; i++) {
        let t;
        do { t = rng.weighted(Object.entries(TYPE_W).map(([k, w]) => ({ k, w }))).k; } while (t === 'elite' && f < 3);
        row.push({ type: t });
      }
      if (row.every((n) => n.type === row[0].type)) row[0].type = 'battle';
    }
    floors.push(row.map((n, i) => ({ ...n, id: `${f}-${i}` })));
  }
  run.map = floors;
  run.floor = 0;
  run.node = null;
}

export function currentChoices(run) {
  return run.map[run.floor] ?? null;
}

export function chooseNode(run, idx) {
  const n = run.map[run.floor][idx];
  run.node = n;
  const rng = R(run);
  const info = { type: n.type, act: run.act, floor: run.floor + 1 };
  if (n.type === 'battle' || n.type === 'elite' || n.type === 'boss') {
    const e = genEncounter(run, n.type, rng);
    info.enemies = e.enemies; info.bg = e.bg; info.scale = e.scale; info.final = e.final;
  } else if (n.type === 'event') info.event = rng.pick(EVENTS);
  else if (n.type === 'shop') info.shop = genShop(run, rng);
  else if (n.type === 'treasure') info.relics = pickRelics(run, 3, run.act >= 2 ? 2 : 1);
  run.node = { ...n, info };
  return run.node;
}

export function genEncounter(run, type, rng) {
  const act = ACTS[run.act];
  const f = run.floor + 1;
  const loopMult = 1 + 0.5 * run.loop;
  const scale = (1 + 0.04 * (f - 1)) * loopMult;
  let enemies;
  let bg = rng.pick(act.bgs);
  let final = false;
  if (type === 'boss') {
    if (run.act === 3 && run.floor >= FLOORS_PER_ACT) { enemies = ['ash_god']; final = true; }
    else enemies = [run.bossPick?.[run.act] ?? rng.pick(act.bosses)];
    bg = final ? 'void' : act.bossBg;
  } else if (type === 'elite') {
    enemies = [rng.pick(act.elites), ...Array.from({ length: rng.range(1, 2) }, () => rng.pick(act.pool))];
  } else {
    const cnt = f <= 2 ? 2 : f <= 6 ? 3 : rng.range(3, 4);
    enemies = Array.from({ length: cnt }, () => rng.pick(act.pool));
  }
  return { enemies, bg, scale, final };
}

// Следующий узел: после победы/ухода
export function advance(run) {
  run.floor++;
  run.node = null;
  run.stats.floors++;
  if (run.act === 3 && run.floor === FLOORS_PER_ACT + 1 - 1) { /* босс акта 3 пройден — идём в финал */ }
}

export function finishFloorAfterBoss(run) {
  // вызывается после победы над боссом акта
  if (run.act === 3 && run.floor === FLOORS_PER_ACT - 1) {
    // босс акта 3 убит: добавляем этаж с Богом Пепла
    run.map.push([{ type: 'boss', id: 'final', final: true }]);
    advance(run);
    return 'continue';
  }
  if (run.act === 3 && run.floor === FLOORS_PER_ACT) {
    // победа над Богом Пепла
    if (run.mode === 'endless') { run.loop++; run.act = 1; genAct(run); run.stats.floors++; return 'loop'; }
    return 'win';
  }
  run.act++;
  run.stats.floors++;
  genAct(run);
  return 'next_act';
}

// ---------- Награды ----------
export function battleRewards(run, type, rng = R(run)) {
  const m = mods(run);
  const mult = type === 'boss' ? 3.5 : type === 'elite' ? 2 : 1;
  const gold = Math.round((10 + 6 * run.act + rng.range(0, 8)) * mult * (1 + (m.goldPct ?? 0) / 100));
  const xp = (type === 'boss' ? 3 : type === 'elite' ? 2 : 1);
  return { gold, xp, choices: genBoons(run, type, rng) };
}

export function grantXp(run, xp) {
  const m = mods(run);
  const up = [];
  for (const h of run.heroes) {
    h.xp += xp * (1 + (m.xpPct ?? 0) / 100);
    for (;;) {
      const need = Math.ceil(1 + h.lvl * 0.35);
      if (h.xp < need) break;
      h.xp -= need; h.lvl++;
      const s = heroStats(run, h);
      h.hp = Math.min(s.maxHp, h.hp + Math.round(s.maxHp * 0.15));
      up.push(h.id);
    }
  }
  return up;
}

export function upgradable(run) {
  const out = [];
  for (const h of run.heroes) for (const s of HEROES[h.id].skills) if ((h.skillLv[s] ?? 0) < 3) out.push({ hero: h, skill: s });
  return out;
}

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
  const hr = rng.pick(run.heroes);
  make.push({ kind: 'hp', hero: hr.id, pct: 12 });
  make.push({ kind: 'atk', hero: rng.pick(run.heroes).id, pct: 10 });
  make.push({ kind: 'heal', pct: 35 });
  make.push({ kind: 'gold', n: 35 + 8 * run.act });
  if (rng.chance(0.18)) { const r = pickRelics(run, 1)[0]; if (r) make.push({ kind: 'relic', relic: r.id }); }
  const shuffled = rng.shuffle(make);
  const used = new Set();
  for (const b of shuffled) {
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
    case 'hp': { const h = find(b.hero); const before = heroStats(run, h).maxHp; h.bonusHp += b.pct; h.hp += heroStats(run, h).maxHp - before; break; }
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

// После боя: павшие возвращаются с 25% HP
export function applyBattleResult(run, state) {
  for (const u of state.allies) {
    if (u.minion) continue;
    const h = run.heroes.find((x) => x.id === u.id);
    h.hp = u.dead ? Math.max(1, Math.round(u.maxHp * 0.25)) : Math.max(1, u.hp);
  }
  run.stats.battles++;
  for (const e of state.enemies) if (e.dead) { run.stats.kills++; if (e.tier === 1) run.stats.elites++; if (e.tier === 2) run.stats.bosses++; }
}

// ---------- Привал ----------
export function campRest(run) {
  const m = mods(run);
  healParty(run, 0.35 + (m.campHeal ?? 0) / 100);
}

// ---------- Магазин ----------
export function genShop(run, rng) {
  const items = [];
  for (const r of pickRelics(run, 3)) items.push({ kind: 'relic', relic: r.id, price: Math.round(r.price * (0.9 + rng() * 0.3)) });
  items.push({ kind: 'heal', pct: 50, price: 45 });
  const ups = rng.shuffle(upgradable(run)).slice(0, 2);
  for (const u of ups) items.push({ kind: 'upgrade', hero: u.hero.id, skill: u.skill, price: 70 + 15 * (u.hero.skillLv[u.skill] ?? 0) });
  items.push({ kind: 'level', hero: rng.pick(run.heroes).id, price: 95 });
  return items.map((it, i) => ({ ...it, i, sold: false }));
}

export function buy(run, shop, i) {
  const it = shop[i];
  if (!it || it.sold || run.gold < it.price) return false;
  run.gold -= it.price; it.sold = true;
  if (it.kind === 'level') grantLevel(run, it.hero);
  else applyBoon(run, it.kind === 'heal' ? { kind: 'heal', pct: it.pct } : it);
  return true;
}
function grantLevel(run, id) {
  const h = run.heroes.find((x) => x.id === id);
  const before = heroStats(run, h).maxHp;
  h.lvl++; h.hp += heroStats(run, h).maxHp - before;
}

// ---------- События ----------
export function resolveEvent(run, outcome) {
  const rng = R(run);
  const ops = outcome.ops;
  const res = { fight: null, relic: null };
  if (ops.hp) for (const h of run.heroes) { const mx = heroStats(run, h).maxHp; h.hp = Math.max(1, Math.min(mx, h.hp + Math.round(mx * ops.hp))); }
  if (ops.heal) healParty(run, ops.heal > 0 ? ops.heal : 0);
  if (ops.heal && ops.heal < 0) for (const h of run.heroes) h.hp = Math.max(1, h.hp + Math.round(heroStats(run, h).maxHp * ops.heal));
  if (ops.gold) run.gold = Math.max(0, run.gold + ops.gold);
  if (ops.maxhp) for (const h of run.heroes) { const b = heroStats(run, h).maxHp; h.bonusHp += ops.maxhp * 100; const d = heroStats(run, h).maxHp - b; h.hp = Math.max(1, Math.min(heroStats(run, h).maxHp, h.hp + (d > 0 ? d : 0))); }
  if (ops.upgrade) { const ups = upgradable(run); if (ups.length) { const u = rng.pick(ups); u.hero.skillLv[u.skill] = (u.hero.skillLv[u.skill] ?? 0) + 1; res.upgrade = { hero: u.hero.id, skill: u.skill }; } }
  if (ops.xp) res.levels = grantXp(run, ops.xp * 2);
  if (ops.relic) { const r = pickRelics(run, 1)[0]; if (r) { addRelic(run, r.id); res.relic = r.id; } }
  if (ops.fight) res.fight = ops.fight;
  if (ops.rage) run.startRageBonus = Math.max(0, (run.startRageBonus ?? 0) + ops.rage);
  return res;
}
export function pickOutcome(run, choice) {
  const rng = R(run);
  return rng.weighted(choice.outcomes, (o) => o.p);
}

// ---------- Бой ----------
export function battleMods(run) {
  const m = { ...mods(run) };
  if (run.startRageBonus) { m.startRage = (m.startRage ?? 0) + run.startRageBonus; run.startRageBonus = 0; }
  return m;
}

// ---------- Итог ----------
export function ashForRun(run, outcome) {
  let a = run.stats.floors * 2.5 + run.stats.bosses * 20 + run.stats.elites * 4 + (outcome === 'win' ? 80 : 0) + (run.loop * 60);
  a *= 1 + (mods(run).ashPct ?? 0) / 100 + run.asc * 0.1;
  return Math.round(a);
}

export function serializeRun(run) { return JSON.stringify(run); }
export function loadRun() { try { const s = globalThis.localStorage?.getItem('pepel_run'); return s ? JSON.parse(s) : null; } catch { return null; } }
export function saveRun(run) { try { if (run) globalThis.localStorage?.setItem('pepel_run', JSON.stringify(run)); else globalThis.localStorage?.removeItem('pepel_run'); } catch {} }
