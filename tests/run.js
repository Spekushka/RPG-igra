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
import * as R from '../src/engine/run.js';
import { defaultMeta } from '../src/engine/meta.js';
import { ITEMS } from '../src/data/items.js';
import { canUse as cu } from '../src/engine/battle.js';
test('старт с одним героем, навыки открываются с уровнем', () => {
  const run = R.createRun({ party: ['knight'], meta: defaultMeta(), seed: 7 });
  assert.equal(run.heroes.length, 1);
  const st = createBattle({ party: R.partyUnits(run), enemies: ['skeleton'], rng: makeRng(1) });
  startBattle(st);
  const k = st.allies[0];
  assert.ok(cu(st, k, 'k_slash').ok);
  assert.equal(cu(st, k, 'k_bash').ok, false);
});
test('после небоевого узла следующий должен быть боем', () => {
  const run = R.createRun({ party: ['knight'], meta: defaultMeta(), seed: 9 });
  run.floor = 3; run.map[3] = [{ type: 'campfire', id: 'a' }, { type: 'battle', id: 'b' }];
  run.map[4] = [{ type: 'shop', id: 'c' }, { type: 'battle', id: 'd' }];
  assert.ok(R.chooseNode(run, 0));
  R.advance(run);
  const ch = R.currentChoices(run);
  assert.equal(ch[0].locked, true);
  assert.equal(R.chooseNode(run, 0), null);
  assert.ok(R.chooseNode(run, 1));
});
test('вербовка до 4 героев и выдача предмета', () => {
  const run = R.createRun({ party: ['knight'], meta: defaultMeta(), seed: 11 });
  for (let i = 0; i < 3; i++) { const o = R.recruitOffers(run); assert.ok(o.length); R.recruit(run, o[0]); }
  assert.equal(run.heroes.length, 4);
  const r = R.giveItem(run, { id: 'bone_blade', r: 3 }, 'knight');
  assert.ok(r.equipped);
  const r2 = R.giveItem(run, { id: 'rusty_axe', r: 1 }, 'knight');
  assert.equal(r2.equipped, false);
  assert.ok(Object.keys(ITEMS).length >= 36);
});
test('колесо и мини-игры выдают призы', () => {
  const run = R.createRun({ party: ['knight', 'priestess'], meta: defaultMeta(), seed: 13 });
  for (let i = 0; i < 30; i++) assert.ok(R.applyPrize(run, R.spinWheel(run, 'battle').wedge));
  for (let t = 0; t <= 3; t++) assert.ok(R.minigamePrizes(run, t).length);
});
console.log(`${n} tests passed`);
