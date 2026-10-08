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
import { combos, comboStats, setScore } from '../src/data/items.js';
test('комбинации предметов дают бонусы', () => {
  const two = [{ id: 'bone_blade', r: 1 }, { id: 'bone_plate', r: 1 }];
  assert.deepEqual(combos(two).map((c) => c.tag).sort(), ['blood', 'shadow']);
  const three = [...two, { id: 'skull_trophy', r: 1 }];
  assert.ok(combos(three).find((c) => c.tag === 'blood' && c.n === 3));
  assert.ok(setScore(three) > setScore([{ id: 'bone_blade', r: 1 }]));
  assert.equal(Object.keys(comboStats([{ id: 'bone_blade', r: 1 }])).length, 0);
});
test('рюкзак: занятый слот, надеть, снять, подобрать лучшее', () => {
  const run = R.createRun({ party: ['knight'], meta: defaultMeta(), seed: 21 });
  R.giveItem(run, { id: 'rusty_axe', r: 1 }, 'knight');
  const r = R.giveItem(run, { id: 'bone_blade', r: 3 }, 'knight');
  assert.equal(r.bagged, true);
  assert.equal(run.bag.length, 1);
  R.giveItem(run, { id: 'bone_plate', r: 2 }, 'knight');
  R.giveItem(run, { id: 'skull_trophy', r: 2 }, 'knight');
  R.autoEquip(run, 'knight');
  const h = run.heroes[0];
  assert.equal(Object.keys(h.items).length, 3);
  assert.equal(run.bag.length, 1);
  assert.ok(R.unequip(run, 'knight', 'armor'));
  assert.equal(h.items.armor, undefined);
  for (let i = 0; i < 20; i++) R.giveItem(run, { id: 'rusty_axe', r: 1 }, 'knight');
  assert.ok(run.bag.length <= R.BAG_MAX);
});
import { exportSave, importSave } from '../src/engine/save.js';
test('экспорт и импорт прогресса', () => {
  const meta = defaultMeta(); meta.ash = 123; meta.unlocked.push('berserker'); meta.forge.hp = 3; meta.wins = 2;
  const run = R.createRun({ party: ['knight', 'priestess'], meta, seed: 3 });
  const code = exportSave(meta, run, { mute: 1 });
  assert.ok(code.startsWith('PEPEL1:'));
  const back = importSave(code);
  assert.equal(back.meta.ash, 123); assert.ok(back.meta.unlocked.includes('berserker')); assert.equal(back.meta.forge.hp, 3);
  assert.equal(back.run.heroes.length, 2); assert.equal(back.settings.mute, 1);
  assert.throws(() => importSave('мусор'));
  assert.throws(() => importSave(code.slice(0, -6) + 'AAAAAA'));
  const bad = importSave(exportSave({ ash: -5, unlocked: ['хакер', 'knight'], forge: { hp: 999, fake: 5 } }, null));
  assert.equal(bad.meta.ash, 0); assert.deepEqual(bad.meta.unlocked.includes('хакер'), false); assert.equal(bad.meta.forge.hp, 10); assert.equal(bad.meta.forge.fake, undefined); assert.equal(bad.run, null);
});
console.log(`${n} tests passed`);
