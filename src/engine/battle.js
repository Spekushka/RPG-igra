// Боевая логика без DOM. Все функции мутируют state и возвращают массив событий для анимации.
import { SKILLS } from '../data/skills.js';
import { ENEMIES } from '../data/enemies.js';

let UID = 1;
const MAX_ENEMIES = 5;
const MAX_ALLIES = 5;

export function makeUnit(side, base) {
  return {
    uid: UID++, side, id: base.id, name: base.name, hp: base.hp, maxHp: base.maxHp ?? base.hp,
    atk: base.atk, def: base.def ?? 0, shield: 0, st: {}, cd: {}, mcd: {},
    skills: base.skills ?? [], skillLv: base.skillLv ?? {}, tier: base.tier ?? 0,
    minion: !!base.minion, dead: false, acted: false, intent: null, hero: base.hero ?? null,
    moves: base.moves ?? null,
  };
}

export function enemyUnit(id, scale = 1, asc = 1) {
  const e = ENEMIES[id];
  const hp = Math.round(e.hp * scale * asc);
  return makeUnit('enemy', { id, name: e.name, hp, maxHp: hp, atk: Math.round(e.atk * scale * (1 + (asc - 1) * 0.6)), def: e.def, tier: e.tier, moves: e.moves });
}

export function createBattle({ party, enemies, mods = {}, rng, ascension = 0, enemyScale = 1 }) {
  const asc = 1 + 0.08 * ascension;
  const st = {
    allies: party.map((h) => {
      const u = makeUnit('ally', h);
      u.hp = Math.max(1, h.hp);
      u.maxHp = h.maxHp;
      u.shield = mods.startShield ? Math.round(h.maxHp * mods.startShield / 100) : 0;
      return u;
    }),
    enemies: enemies.map((id) => enemyUnit(id, enemyScale, asc)),
    rage: Math.min(100, mods.startRage ?? 0), round: 0, result: null, mods, rng, ascension,
    revivesUsed: 0, scale: enemyScale, asc,
  };
  return st;
}

export const alive = (list) => list.filter((u) => !u.dead);
export const hasSt = (u, id) => !!u.st[id];

function snap(u) { return { hp: u.hp, shield: u.shield, max: u.maxHp }; }

// ---------- Урон / лечение ----------
function critInfo(state, src) {
  if (src.side !== 'ally') return { chance: 0, mult: 1 };
  const m = state.mods;
  return { chance: 0.08 + (m.critChance ?? 0) / 100, mult: 1.5 + (m.critMult ?? 0) };
}

function calcDamage(state, src, tgt, m, fx = {}) {
  const rng = state.rng;
  let d = src.atk * m;
  if (src.side === 'ally') d *= 1 + (state.mods.dmgPct ?? 0) / 100;
  if (hasSt(src, 'atkup')) d *= 1.3;
  if (hasSt(src, 'weak')) d *= 0.7;
  if (hasSt(tgt, 'curse')) d *= 1.3;
  if (fx.vsStatus && hasSt(tgt, fx.vsStatus)) d *= fx.mult ?? 1.5;
  if (fx.executeBelow && tgt.hp / tgt.maxHp < fx.executeBelow) d *= fx.mult ?? 2;
  if (fx.vsElite && tgt.tier >= 1) d *= fx.vsElite;
  let crit = false;
  const c = critInfo(state, src);
  if (c.chance && rng() < c.chance) { d *= c.mult; crit = true; }
  d *= 0.92 + rng() * 0.16;
  const def = Math.min(60, tgt.def + (tgt.side === 'ally' ? state.mods.defFlat ?? 0 : 0));
  d *= 1 - def / 100;
  return { amount: Math.max(1, Math.round(d)), crit };
}

// Применить урон цели; возвращает фактически снятые HP.
function dealDamage(state, ev, src, tgt, amount, o = {}) {
  if (tgt.dead) return 0;
  if (!o.dot && hasSt(tgt, 'evade')) {
    const e = tgt.st.evade;
    e.v -= 1;
    if (e.v <= 0) delete tgt.st.evade;
    ev.push({ t: 'miss', tgt: tgt.uid, ...snap(tgt) });
    return 0;
  }
  let left = amount;
  let absorbed = 0;
  if (tgt.shield > 0) {
    absorbed = Math.min(tgt.shield, left);
    tgt.shield -= absorbed;
    left -= absorbed;
  }
  const real = Math.min(tgt.hp, left);
  tgt.hp -= real;
  ev.push({ t: 'hit', src: src?.uid, tgt: tgt.uid, n: amount, hpLost: real, absorbed, crit: !!o.crit, dot: o.dot ?? null, ...snap(tgt) });
  // ярость
  if (state.mods && !o.dot) {
    const g = (state.mods.rageGain ?? 0) / 100 + 1;
    if (src && src.side === 'ally' && tgt.side === 'enemy') state.rage = Math.min(100, state.rage + 4 * g);
    if (tgt.side === 'ally') state.rage = Math.min(100, state.rage + 6 * g);
  }
  if (tgt.hp <= 0) kill(state, ev, tgt, src);
  else if (!o.dot && !o.noThorns && tgt.side === 'ally' && src && !src.dead && state.mods.thornsPct) {
    const back = Math.max(1, Math.round(amount * state.mods.thornsPct / 100));
    dealDamage(state, ev, tgt, src, back, { dot: 'thorns', noThorns: true });
  }
  return real;
}

function kill(state, ev, u, killer) {
  u.dead = true; u.hp = 0; u.st = {}; u.shield = 0; u.intent = null;
  ev.push({ t: 'death', tgt: u.uid });
  if (u.side === 'enemy' && killer && killer.side === 'ally' && state.mods.killHeal) {
    for (const a of alive(state.allies)) healUnit(state, ev, a, Math.round(a.maxHp * state.mods.killHeal / 100), null);
  }
}

function healUnit(state, ev, tgt, amount, src) {
  if (tgt.dead) return 0;
  const real = Math.min(tgt.maxHp - tgt.hp, amount);
  if (real <= 0) return 0;
  tgt.hp += real;
  ev.push({ t: 'heal', tgt: tgt.uid, n: real, src: src?.uid, ...snap(tgt) });
  return real;
}

function addStatus(state, ev, src, tgt, id, turns, v = 0) {
  if (tgt.dead) return;
  const kind = (id === 'poison' || id === 'burn' || id === 'bleed') ? 'dot' : (['regen', 'atkup', 'taunt', 'evade'].includes(id) ? 'buff' : 'debuff');
  if (src && src.side === 'ally' && tgt.side === 'enemy' && kind !== 'buff') turns += state.mods.debuffPlus ?? 0;
  let val = v;
  if (kind === 'dot') {
    const plus = (state.mods[id + 'Pct'] ?? 0) / 100;
    val = Math.max(1, Math.round(src.atk * v * (1 + plus)));
  } else if (id === 'regen') val = Math.max(1, Math.round(src.atk * v * (1 + (state.mods.healPct ?? 0) / 100)));
  const cur = tgt.st[id];
  if (cur) { cur.t = Math.max(cur.t, turns); cur.v = kind === 'dot' ? cur.v + val : Math.max(cur.v, val); }
  else tgt.st[id] = { t: turns, v: val };
  ev.push({ t: 'status', tgt: tgt.uid, id });
}

// ---------- Цели ----------
function foesOf(state, u) { return alive(u.side === 'ally' ? state.enemies : state.allies); }
function friendsOf(state, u) { return alive(u.side === 'ally' ? state.allies : state.enemies); }

function pickEnemyTarget(state, user, kind) {
  const foes = foesOf(state, user);
  if (!foes.length) return null;
  const taunters = foes.filter((f) => hasSt(f, 'taunt'));
  const pool = taunters.length && kind !== 'foeLow' ? taunters : foes;
  if (kind === 'foeLow') return pool.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  return state.rng.pick(pool);
}

export function resolveTargets(state, user, tgtKind, chosen) {
  switch (tgtKind) {
    case 'self': return [user];
    case 'foes': return foesOf(state, user);
    case 'friends': return friendsOf(state, user);
    case 'foe': {
      if (user.side === 'ally') return chosen && !chosen.dead ? [chosen] : foesOf(state, user).slice(0, 1);
      return [pickEnemyTarget(state, user, 'foe')].filter(Boolean);
    }
    case 'foeLow': return [pickEnemyTarget(state, user, 'foeLow')].filter(Boolean);
    case 'foeRand': return [null]; // выбирается на каждый удар
    case 'friend': {
      if (user.side === 'ally') return chosen && !chosen.dead ? [chosen] : [user];
      const fr = friendsOf(state, user).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
      return fr.slice(0, 1);
    }
    default: return [];
  }
}

// ---------- Исполнение эффектов ----------
function runEffects(state, ev, user, fxList, tgtKind, chosen, lv = 0) {
  const k = 1 + 0.2 * lv;
  const targets = resolveTargets(state, user, tgtKind, chosen);
  const sub = (to) => to === 'self' ? [user] : to === 'friends' ? friendsOf(state, user) : null;
  for (const fx of fxList) {
    switch (fx.t) {
      case 'dmg': {
        const hits = fx.hits ?? 1;
        const list = tgtKind === 'foeRand' ? null : targets;
        for (let h = 0; h < hits; h++) {
          const group = list ?? [state.rng.pick(foesOf(state, user))].filter(Boolean);
          for (const tg of group) {
            if (!tg || tg.dead) continue;
            const { amount, crit } = calcDamage(state, user, tg, fx.m * k, fx);
            const real = dealDamage(state, ev, user, tg, amount, { crit });
            if (fx.lifesteal && real > 0) healUnit(state, ev, user, Math.max(1, Math.round(real * fx.lifesteal)), user);
            const ls = user.side === 'ally' ? (state.mods.lifesteal ?? 0) / 100 : 0;
            if (ls && real > 0) healUnit(state, ev, user, Math.max(1, Math.round(real * ls)), user);
          }
        }
        break;
      }
      case 'heal': {
        const to = sub(fx.to) ?? targets;
        for (const tg of to) {
          if (!tg) continue;
          const amt = Math.round(user.atk * fx.m * k * (1 + (state.mods.healPct ?? 0) / 100));
          healUnit(state, ev, tg, amt, user);
        }
        break;
      }
      case 'shield': {
        for (const tg of (sub(fx.to) ?? targets)) {
          if (!tg || tg.dead) continue;
          const amt = Math.round(user.atk * fx.m * k * (1 + (state.mods.shieldPct ?? 0) / 100));
          tg.shield += amt;
          ev.push({ t: 'shield', tgt: tg.uid, n: amt, ...snap(tg) });
        }
        break;
      }
      case 'status': {
        const to = fx.to === 'self' ? [user] : targets;
        for (const tg of to) if (tg) addStatus(state, ev, user, tg, fx.id, fx.turns, fx.v);
        break;
      }
      case 'cleanse':
        for (const tg of targets) {
          if (!tg) continue;
          for (const id of ['poison', 'burn', 'bleed', 'freeze', 'stun', 'curse', 'weak']) delete tg.st[id];
          ev.push({ t: 'cleanse', tgt: tg.uid });
        }
        break;
      case 'rage':
        if (user.side === 'ally') { state.rage = Math.min(100, state.rage + fx.v); ev.push({ t: 'rage', v: state.rage }); }
        break;
      case 'selfDmg': {
        const n = Math.max(1, Math.round(user.maxHp * fx.pct));
        dealDamage(state, ev, null, user, n, { dot: 'self' });
        break;
      }
      case 'summonAlly': {
        if (alive(state.allies).length >= MAX_ALLIES) break;
        const hp = Math.round(user.atk * 3);
        const m = makeUnit('ally', { id: 'skeleton_minion', name: 'Скелет', hp, maxHp: hp, atk: Math.round(user.atk * 0.55), def: 0, minion: true });
        state.allies.push(m);
        ev.push({ t: 'summon', unit: m.uid, side: 'ally' });
        break;
      }
      case 'summon': {
        if (alive(state.enemies).length >= MAX_ENEMIES) break;
        const u = enemyUnit(fx.id, state.scale, state.asc);
        state.enemies.push(u);
        chooseIntent(state, u);
        ev.push({ t: 'summon', unit: u.uid, side: 'enemy' });
        break;
      }
      case 'revive': {
        const dead = state.allies.filter((a) => a.dead && !a.minion);
        for (const a of dead) {
          a.dead = false; a.hp = Math.max(1, Math.round(a.maxHp * fx.m)); a.acted = true;
          ev.push({ t: 'revive', tgt: a.uid, ...snap(a) });
        }
        break;
      }
    }
    if (checkEnd(state, ev)) return;
  }
}

// ---------- Условия окончания ----------
function checkEnd(state, ev) {
  if (state.result) return true;
  if (!alive(state.enemies).length) { state.result = 'win'; ev.push({ t: 'end', result: 'win' }); return true; }
  const heroesAlive = state.allies.some((a) => !a.dead && !a.minion);
  if (!heroesAlive) {
    if ((state.mods.reviveOnce ?? 0) > state.revivesUsed) {
      state.revivesUsed++;
      for (const a of state.allies) if (!a.minion) { a.dead = false; a.hp = Math.round(a.maxHp * 0.4); ev.push({ t: 'revive', tgt: a.uid, ...snap(a) }); }
      ev.push({ t: 'msg', text: 'Пепел Феникса возрождает отряд!' });
      return false;
    }
    state.result = 'lose'; ev.push({ t: 'end', result: 'lose' }); return true;
  }
  return false;
}

// ---------- Намерения врагов ----------
export function chooseIntent(state, e) {
  if (e.dead) return;
  if (hasSt(e, 'stun') || hasSt(e, 'freeze')) { e.intent = { skip: true }; return; }
  const frac = e.hp / e.maxHp;
  const ok = e.moves.filter((m) =>
    (!m.cd || !e.mcd[m.name]) && (!m.hpBelow || frac < m.hpBelow) && (!m.min || state.round >= m.min) &&
    !(m.tgt === 'friend' && !friendsOf(state, e).some((f) => f.hp < f.maxHp)) &&
    !(m.fx.some((f) => f.t === 'summon') && alive(state.enemies).length >= MAX_ENEMIES));
  const pool = ok.length ? ok : e.moves.filter((m) => !m.cd);
  let move = state.rng.weighted(pool.length ? pool : e.moves);
  // в «фазе» боссы предпочитают фазовые ходы
  const phased = pool.filter((m) => m.hpBelow);
  if (phased.length && state.rng() < 0.6) move = state.rng.weighted(phased);
  e.intent = { move };
}

export function intentInfo(e) {
  const mv = e.intent?.move;
  if (e.intent?.skip) return { kind: 'skip', label: 'Оглушён' };
  if (!mv) return { kind: 'none', label: '' };
  const dmgFx = mv.fx.find((f) => f.t === 'dmg');
  if (dmgFx) {
    const per = Math.round(e.atk * dmgFx.m * (hasSt(e, 'atkup') ? 1.3 : 1) * (hasSt(e, 'weak') ? 0.7 : 1));
    return { kind: 'attack', label: mv.name, value: per, hits: dmgFx.hits ?? 1, aoe: mv.tgt === 'foes' };
  }
  const f0 = mv.fx[0];
  const kind = !f0 ? 'idle' : f0.t === 'heal' ? 'heal' : f0.t === 'shield' ? 'defend' : f0.t === 'summon' ? 'summon' : 'debuff';
  const buff = f0 && f0.t === 'status' && ['atkup', 'evade', 'taunt', 'regen'].includes(f0.id);
  return { kind: buff ? 'buff' : kind, label: mv.name };
}

// ---------- Фазы ----------
function tickStart(state, ev, u) {
  // периодический урон и регенерация; возвращает true, если юнит пропускает ход
  for (const id of ['poison', 'burn', 'bleed']) {
    const s = u.st[id];
    if (s && !u.dead) dealDamage(state, ev, null, u, s.v, { dot: id });
  }
  if (u.st.regen && !u.dead) healUnit(state, ev, u, u.st.regen.v, null);
  if (u.dead) return true;
  if (hasSt(u, 'stun') || hasSt(u, 'freeze')) { ev.push({ t: 'skip', tgt: u.uid, why: hasSt(u, 'freeze') ? 'freeze' : 'stun' }); return true; }
  return false;
}

function tickEnd(u) {
  for (const id of Object.keys(u.st)) {
    u.st[id].t -= 1;
    if (u.st[id].t <= 0) delete u.st[id];
  }
  for (const k of Object.keys(u.mcd)) if (u.mcd[k] > 0) u.mcd[k]--;
}

export function startBattle(state) {
  const ev = [];
  for (const e of state.enemies) chooseIntent(state, e);
  beginPlayerPhase(state, ev);
  return ev;
}

function beginPlayerPhase(state, ev) {
  state.round++;
  ev.push({ t: 'phase', side: 'ally', round: state.round });
  for (const a of state.allies) {
    if (a.dead) continue;
    for (const k of Object.keys(a.cd)) if (a.cd[k] > 0) a.cd[k]--;
    a.acted = tickStart(state, ev, a) || a.acted;
    if (state.result) return;
  }
  for (const a of state.allies) if (a.dead) a.acted = true;
  checkEnd(state, ev);
  // если все ходы пропущены — сразу фаза врагов
}

export function canUse(state, unit, skillId) {
  const sk = SKILLS[skillId];
  if (!sk || unit.dead || unit.acted || state.result) return { ok: false, why: 'Недоступно' };
  if (unit.cd[skillId] > 0) return { ok: false, why: `Перезарядка: ${unit.cd[skillId]}` };
  if (sk.cost && state.rage < sk.cost) return { ok: false, why: `Нужно ярости: ${sk.cost}` };
  return { ok: true };
}

export function useSkill(state, unit, skillId, target) {
  const ev = [];
  const c = canUse(state, unit, skillId);
  if (!c.ok) return ev;
  const sk = SKILLS[skillId];
  if (sk.cost) { state.rage -= sk.cost; ev.push({ t: 'rage', v: state.rage }); }
  unit.cd[skillId] = sk.cd ?? 0;
  unit.acted = true;
  ev.push({ t: 'act', src: unit.uid, name: sk.name, skill: skillId, tgt: target?.uid ?? null, melee: ['foe', 'foes'].includes(sk.tgt) && !['fireball', 'meteor'].includes(sk.icon) });
  runEffects(state, ev, unit, sk.fx, sk.tgt, target, unit.skillLv[skillId] ?? 0);
  return ev;
}

export function allActed(state) { return alive(state.allies).every((a) => a.acted); }

// Конец хода игрока: миньоны, ход врагов, начало нового раунда.
export function endPlayerPhase(state) {
  const ev = [];
  if (state.result) return ev;
  for (const a of state.allies) {
    if (a.dead) continue;
    if (a.minion && !state.result) {
      const t = state.rng.pick(alive(state.enemies));
      if (t) { ev.push({ t: 'act', src: a.uid, name: 'Удар', tgt: t.uid, melee: true }); dealDamage(state, ev, a, t, calcDamage(state, a, t, 1).amount, {}); }
      checkEnd(state, ev);
    }
    tickEnd(a);
  }
  if (state.result) return ev;
  // ход врагов
  ev.push({ t: 'phase', side: 'enemy' });
  for (const e of state.enemies.slice()) {
    if (e.dead || state.result) continue;
    const skip = tickStart(state, ev, e);
    if (e.dead) { checkEnd(state, ev); continue; }
    if (!skip && e.intent?.move) {
      const mvv = e.intent.move;
      if (mvv.cd) e.mcd[mvv.name] = mvv.cd;
      ev.push({ t: 'act', src: e.uid, name: mvv.name, melee: mvv.tgt === 'foe' || mvv.tgt === 'foes', tgt: null });
      runEffects(state, ev, e, mvv.fx, mvv.tgt, null, 0);
    }
    checkEnd(state, ev);
  }
  if (state.result) return ev;
  for (const e of state.enemies) if (!e.dead) tickEnd(e);
  for (const a of state.allies) if (!a.dead) a.acted = false;
  for (const e of state.enemies) chooseIntent(state, e);
  beginPlayerPhase(state, ev);
  return ev;
}

// Если после начала фазы все герои оглушены, UI вызывает endPlayerPhase автоматически.
export function needsAutoEnd(state) {
  return !state.result && alive(state.allies).filter((a) => !a.minion || true).every((a) => a.acted);
}
