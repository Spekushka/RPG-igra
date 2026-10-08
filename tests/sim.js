// Симуляция забегов ботом для баланса: node tests/sim.js [runs] [asc]
import { makeRng } from '../src/engine/rng.js';
import { createBattle, startBattle, useSkill, endPlayerPhase, alive, canUse } from '../src/engine/battle.js';
import { SKILLS } from '../src/data/skills.js';
import * as R from '../src/engine/run.js';
import { defaultMeta } from '../src/engine/meta.js';

export function botBattle(run, info, rng) {
  const st = createBattle({ party: R.partyUnits(run), enemies: info.enemies, mods: R.battleMods(run), rng, ascension: run.asc, enemyScale: info.scale });
  startBattle(st);
  for (let guard = 0; guard < 80 && !st.result; guard++) {
    for (const a of alive(st.allies)) {
      if (st.result) break;
      if (a.acted) continue;
      const foes = alive(st.enemies);
      const sorted = foes.slice().sort((x, y) => x.hp - y.hp);
      const weakest = sorted[0];
      const opts = a.skills.filter((s) => canUse(st, a, s).ok).map((s) => SKILLS[s] && s);
      // приоритет: ульта, лечение при низком HP, иначе сильнейший доступный
      let pick = null, target = weakest;
      const hurt = alive(st.allies).slice().sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
      for (const s of opts.slice().reverse()) {
        const sk = SKILLS[s];
        if (sk.fx.some((f) => f.t === 'heal') && sk.tgt === 'friend') { if (hurt.hp / hurt.maxHp < 0.6) { pick = s; target = hurt; break; } else continue; }
        if (sk.tgt === 'friend') { pick = s; target = hurt; break; }
        if (sk.fx.some((f) => f.t === 'revive') && !st.allies.some((x) => x.dead)) continue;
        pick = s; target = sk.tgt === 'foe' ? (foes.find((f) => f.tier >= 1) ?? foes[0]) : weakest; break;
      }
      if (!pick) pick = opts[0];
      if (pick) useSkill(st, a, pick, target);
    }
    if (!st.result) endPlayerPhase(st);
  }
  return st;
}

export function botRun(seed, asc = 0, party = ['knight', 'pyromancer', 'priestess', 'ranger']) {
  const rng = makeRng(seed ^ 0x9e3779b9);
  const run = R.createRun({ party, meta: defaultMeta(), asc, seed });
  let guard = 0;
  while (guard++ < 400) {
    const choices = R.currentChoices(run);
    // бот: предпочитает костёр если ранен, иначе бой, элиту берёт при хорошем HP
    const hpFrac = run.heroes.reduce((s, h) => s + h.hp / R.heroStats(run, h).maxHp, 0) / run.heroes.length;
    let idx = 0;
    const pref = hpFrac < 0.6 ? ['campfire', 'shop', 'event', 'treasure', 'battle', 'elite', 'boss'] : ['elite', 'treasure', 'battle', 'shop', 'event', 'campfire', 'boss'];
    let best = 1e9;
    choices.forEach((c, i) => { const p = pref.indexOf(c.type); if (p < best) { best = p; idx = i; } });
    const node = R.chooseNode(run, idx);
    const info = node.info;
    const t = node.type;
    if (['battle', 'elite', 'boss'].includes(t)) {
      const st = botBattle(run, info, rng);
      R.applyBattleResult(run, st);
      if (st.result === 'lose') return { win: false, act: run.act, floor: run.floor + 1, run };
      const rew = R.battleRewards(run, t);
      run.gold += rew.gold;
      R.grantXp(run, rew.xp);
      const b = rng.pick(rew.choices);
      if (b) R.applyBoon(run, b);
      if (t === 'boss') {
        const r = R.finishFloorAfterBoss(run);
        if (r === 'win') return { win: true, act: run.act, floor: run.floor + 1, run };
        continue;
      }
    } else if (t === 'campfire') {
      R.campRest(run);
    } else if (t === 'shop') {
      for (const it of info.shop) if (it.kind === 'relic' || it.kind === 'upgrade') R.buy(run, info.shop, it.i);
    } else if (t === 'treasure') {
      R.addRelic(run, info.relics[0].id); run.gold += 50;
    } else if (t === 'event') {
      const ch = info.event.choices[0];
      const out = R.pickOutcome(run, ch);
      const res = R.resolveEvent(run, out);
      if (res.fight) {
        const enc = R.genEncounter(run, res.fight, makeRng(rng.int(1e9)));
        const st = botBattle(run, { enemies: enc.enemies, scale: enc.scale }, rng);
        R.applyBattleResult(run, st);
        if (st.result === 'lose') return { win: false, act: run.act, floor: run.floor + 1, run };
      }
    }
    R.advance(run);
  }
  return { win: false, act: run.act, floor: run.floor + 1, run, stuck: true };
}

if (process.argv[1].endsWith('sim.js')) {
  const n = +process.argv[2] || 40, asc = +process.argv[3] || 0;
  let wins = 0; const deaths = {};
  for (let i = 0; i < n; i++) {
    const r = botRun(1000 + i, asc);
    if (r.win) wins++; else { const k = `акт${r.act}-эт${r.floor}`; deaths[k] = (deaths[k] ?? 0) + 1; }
  }
  console.log(`побед ${wins}/${n}`);
  console.log('смерти:', Object.entries(deaths).sort().map(([k, v]) => `${k}:${v}`).join(' '));
}
