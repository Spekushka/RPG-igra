import assert from 'node:assert/strict';
import { makeRng } from '../src/engine/rng.js';
import { createBattle, startBattle, useSkill, endPlayerPhase, alive, canUse } from '../src/engine/battle.js';
import { HEROES } from '../src/data/heroes.js';
import { SKILLS } from '../src/data/skills.js';
import { ENEMIES } from '../src/data/enemies.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok', name); };

const mkHero = (id) => { const h = HEROES[id]; return { id, name: h.name, hp: h.hp, maxHp: h.hp, atk: h.atk, def: h.def, skills: h.skills, skillLv: {} }; };

test('все навыки героев существуют', () => {
  for (const [id, h] of Object.entries(HEROES)) for (const s of h.skills) assert.ok(SKILLS[s], `${id}:${s}`);
});
test('все summon-цели и ходы врагов валидны', () => {
  for (const e of Object.values(ENEMIES)) {
    assert.ok(e.moves.length, e.id);
    for (const m of e.moves) for (const f of m.fx) if (f.t === 'summon') assert.ok(ENEMIES[f.id], f.id);
  }
});
test('базовая атака наносит урон', () => {
  const st = createBattle({ party: [mkHero('knight')], enemies: ['skeleton'], rng: makeRng(1) });
  startBattle(st);
  const k = st.allies[0], e = st.enemies[0];
  const ev = useSkill(st, k, 'k_slash', e);
  assert.ok(e.hp < e.maxHp);
  assert.ok(ev.some((x) => x.t === 'hit'));
});
test('перезарядка и ярость работают', () => {
  const st = createBattle({ party: [mkHero('knight')], enemies: ['skeleton', 'zombie'], rng: makeRng(2), mods: { startRage: 60 } });
  startBattle(st);
  assert.ok(canUse(st, st.allies[0], 'k_ult').ok);
  useSkill(st, st.allies[0], 'k_ult');
  assert.equal(st.rage < 60, true);
});
test('полный бой до конца', () => {
  const st = createBattle({ party: ['knight', 'pyromancer', 'priestess', 'ranger'].map(mkHero), enemies: ['skeleton', 'skeleton'], rng: makeRng(3) });
  startBattle(st);
  for (let i = 0; i < 40 && !st.result; i++) {
    for (const a of alive(st.allies)) { if (st.result) break; if (!a.acted) useSkill(st, a, a.skills[0], alive(st.enemies)[0]); }
    if (!st.result) endPlayerPhase(st);
  }
  assert.ok(st.result);
});
console.log(`${n} tests passed`);
