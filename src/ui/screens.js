import { h, img, sprite, tooltip, goFullscreen } from './dom.js';
import { mountWheel } from './wheel.js';
import { GAMES, startGame } from './minigames.js';
import { itemBox, itemTip, itemName, slotRow, prizeView, talentTip, comboView } from './widgets.js';
import { ITEMS, RARITY, itemStats, fmtStat, SLOTS, setScore } from '../data/items.js';
import { TALENTS } from '../data/talents.js';
import { skillUnlockLv, unlockedSkills } from '../data/heroes.js';
import { sfx } from './sfx.js';
import { HEROES, CLASS_NAMES } from '../data/heroes.js';
import { SKILLS, describeSkill } from '../data/skills.js';
import { ENEMIES, enemySvgPath } from '../data/enemies.js';
import { ACTS } from '../data/acts.js';
import { RELICS } from '../data/relics.js';
import * as R from '../engine/run.js';
import * as M from '../engine/meta.js';
import { hashSeed, makeRng } from '../engine/rng.js';
import { mountBattle } from './battle-scene.js';

const NODE_NAMES = { battle: 'Бой', elite: 'Элита', boss: 'Босс', campfire: 'Привал', shop: 'Лавка', event: 'Событие', treasure: 'Сокровище', minigame: 'Мини-игра' };
const clsTag = (c) => h('div', { class: 'cl ' + c }, CLASS_NAMES[c]);

export function createGame(stage) {
  const G = { stage, meta: M.loadMeta(), run: null, fast: false };
  G.show = (el) => { stage.replaceChildren(el); };
  const save = () => { R.saveRun(G.run); M.saveMeta(G.meta); };
  G.save = save;
  const goldChip = () => h('div', { class: 'chip' }, img('assets/svg/ui/coin.svg'), G.run.gold);
  const relicRow = () => h('div', { class: 'relics' }, G.run.relics.map((r) => { const i = img(`assets/svg/icons/relics/${r}.svg`); tooltip(i, `<b>${RELICS[r].name}</b><br>${RELICS[r].desc}`); return i; }));

  function toast(text) {
    const t = h('div', { class: 'toast panel' }, text);
    stage.append(t); setTimeout(() => t.remove(), 3500);
  }
  const backBtn = (fn) => h('button', { class: 'btn alt small', style: { position: 'absolute', left: '20px', top: '14px', zIndex: 30 }, onclick: () => { sfx.click(); fn(); } }, '← Назад');

  // ============ МЕНЮ ============
  function menu() {
    const saved = R.loadRun();
    const s = h('div', { class: 'screen menu' },
      img('assets/svg/bg/menu.svg', 'bg'), h('div', { class: 'shade' }),
      img('assets/svg/ui/logo.svg', 'logo'),
      h('button', { class: 'iconbtn fsbtn', title: 'Во весь экран', onclick: goFullscreen }, '⛶'),
      h('div', { class: 'chip ash' }, img('assets/svg/ui/ash.svg'), G.meta.ash, h('span', { class: 'dim', style: { fontSize: '14px' } }, ' пепла')),
      h('div', { class: 'btns' },
        saved ? h('button', { class: 'btn gold', onclick: () => { sfx.click(); G.run = saved; mapScreen(); } }, `Продолжить (акт ${saved.act}, этаж ${saved.floor + 1})`) : null,
        h('button', { class: 'btn', onclick: () => { sfx.click(); pickParty('normal'); } }, 'Новый забег'),
        h('button', { class: 'btn alt', onclick: () => { sfx.click(); hub('heroes'); } }, 'Герои и Кузня'),
        h('button', { class: 'btn alt', onclick: () => { sfx.click(); dailyRun(); } }, 'Ежедневный забег'),
        h('button', { class: 'btn alt', onclick: () => { sfx.click(); howTo(); } }, 'Как играть')),
      h('div', { class: 'foot' }, `Побед: ${G.meta.wins} · Забегов: ${G.meta.runs} · Убито врагов: ${G.meta.kills}`));
    G.show(s);
  }

  function howTo() {
    const m = h('div', { class: 'modal', onclick: (e) => e.target === m && m.remove() },
      h('div', { class: 'box panel' }, h('h2', { class: 'title' }, 'Как играть'),
        h('div', { style: { fontSize: '17px', lineHeight: 1.55, marginTop: '10px' } },
          h('p', {}, '⚔️ Бой пошаговый: щёлкните героя, выберите навык, затем цель. Каждый герой ходит один раз за раунд, потом ходят враги.'),
          h('p', {}, '👁 Над врагами видно, что они сделают в свой ход (удар, щит, призыв…). Оглушайте и замораживайте сильных врагов, убивайте лекарей первыми.'),
          h('p', {}, '🔥 Ярость копится от ударов. Когда ярости хватает (50), открываются мощные навыки героев — иконки с красным значком.'),
          h('p', {}, '🌱 Вы начинаете один и с одним навыком. Новые навыки открываются с уровнем героя, а у костра к отряду присоединяются новые герои (до четырёх).'),
          h('p', {}, '🗺 На карте после отдыха, лавки, события или мини-игры следующий узел — только бой (🔒). Босс ждёт в конце каждого акта; всего 3 акта и финал.'),
          h('p', {}, '🎡 После каждой победы — колесо фортуны: предмет (оружие, броня, талисман) достаётся случайному герою. Редкость растёт у элит и боссов.'),
          h('p', {}, '⬆️ С уровнем выбирайте талант героя. Мини-игры на карте (пары, наковальня, духи, чаши) дают предметы и золото.'),
          h('p', {}, '💀 Проиграли — получите «пепел» и потратьте его на героев и улучшения в Кузне. Горячие клавиши: 1–5 навыки, Пробел — конец хода, Tab — смена героя, Esc — отмена.')),
        h('button', { class: 'btn', style: { marginTop: '10px' }, onclick: () => m.remove() }, 'Понятно')));
    stage.append(m);
  }

  // ============ ВЫБОР ОТРЯДА ============
  function pickParty(mode) {
    const unlocked = G.meta.unlocked;
    const N = 1 + (G.meta.forge.startparty ?? 0);
    const picked = unlocked.slice(0, N);
    let asc = 0;
    let endless = false;
    const grid = h('div', { class: 'grid' });
    const ascEl = h('span', { class: 'gold', style: { fontWeight: 800, fontSize: '20px', minWidth: '30px', textAlign: 'center' } }, '0');
    const startBtn = h('button', { class: 'btn gold', onclick: () => { sfx.click(); startRun([...picked], asc, endless ? 'endless' : mode); } }, 'В путь!');
    const draw = () => {
      grid.replaceChildren(...Object.entries(HEROES).map(([id, hd]) => {
        const lock = !unlocked.includes(id);
        const c = h('div', { class: 'hcard' + (picked.includes(id) ? ' sel' : '') + (lock ? ' locked' : ''), onclick: () => {
          if (lock) return;
          const i = picked.indexOf(id);
          if (i >= 0) { if (picked.length > 1) picked.splice(i, 1); } else { if (picked.length >= N) picked.shift(); picked.push(id); }
          sfx.click(); draw();
        } }, clsTag(hd.cls), img(`assets/svg/heroes/${id}.svg`), h('div', { class: 'nm' }, hd.name), h('div', { class: 'ti' }, lock ? `🔒 ${hd.unlock} пепла` : hd.title));
        tooltip(c, `<b>${hd.name}</b> — ${hd.title}<br>HP ${hd.hp} · Атака ${hd.atk} · Броня ${hd.def}%<br><span class="sub">${hd.blurb}</span><br>${hd.skills.map((sid, i) => `• ${SKILLS[sid].name} <span class="sub">(ур. ${skillUnlockLv(id, i)})</span>`).join('<br>')}`);
        return c;
      }));
      startBtn.disabled = picked.length !== N;
      ascEl.textContent = asc;
    };
    draw();
    const s = h('div', { class: 'screen pick' }, img('assets/svg/bg/camp.svg', 'bg'), h('div', { class: 'shade' }), backBtn(menu),
      h('h2', { class: 'title' }, N === 1 ? 'Выберите героя' : `Выберите ${N} героев`),
      h('div', { class: 'dim' }, 'Вы начнёте один и с одним навыком. Остальные герои присоединятся по пути, навыки откроются с уровнями. Новые герои — в Кузне за пепел.'), grid,
      h('div', { class: 'row panel', style: { padding: '10px 18px', width: 'fit-content' } },
        h('span', { style: { fontWeight: 800 } }, 'Сложность (Ascension):'),
        h('button', { class: 'btn small alt', onclick: () => { asc = Math.max(0, asc - 1); draw(); } }, '−'), ascEl,
        h('button', { class: 'btn small alt', onclick: () => { asc = Math.min(G.meta.ascUnlocked, asc + 1); draw(); } }, '+'),
        h('span', { class: 'dim' }, `(открыто до ${G.meta.ascUnlocked})`),
        G.meta.wins > 0 ? h('label', { style: { marginLeft: '14px', fontWeight: 700 } }, h('input', { type: 'checkbox', onchange: (e) => { endless = e.target.checked; } }), ' Бесконечный режим') : null),
      h('div', { style: { marginTop: '14px' } }, startBtn));
    G.show(s);
  }

  function dailyRun() {
    const date = new Date().toISOString().slice(0, 10);
    const seed = hashSeed('daily' + date);
    const rng = makeRng(seed);
    const party = rng.shuffle(G.meta.unlocked).slice(0, 1 + (G.meta.forge.startparty ?? 0));
    startRun(party, 2, 'daily', seed);
  }

  function startRun(party, asc, mode, seed) {
    G.run = R.createRun({ party, meta: G.meta, asc, mode, seed });
    save();
    mapScreen();
  }

  // ============ КАРТА ============
  function partyStrip() {
    return h('div', { class: 'party-strip' }, G.run.heroes.map((hr) => {
      const hd = HEROES[hr.id], st = R.heroStats(G.run, hr);
      const need = R.xpNeed(hr.lvl);
      return h('div', { class: 'pcard panel', onclick: () => heroModal(hr) },
        hr.pendingTalents ? h('div', { class: 'badge' }, '!') : null,
        img(`assets/svg/heroes/${hr.id}.svg`, 'pt'),
        h('div', { style: { flex: 1 } }, h('div', { style: { fontWeight: 800, fontSize: '14px' } }, `${hd.name} `, h('span', { class: 'gold' }, `ур.${hr.lvl}`)),
          h('div', { class: 'bar', style: { margin: '3px 0' } }, h('i', { style: { width: Math.min(100, hr.hp / st.maxHp * 100) + '%' } }), h('span', {}, `${hr.hp}/${st.maxHp}`)),
          h('div', { class: 'bar xp' }, h('i', { style: { width: Math.min(100, hr.xp / need * 100) + '%' } })),
          slotRow(hr, 28)));
    }));
  }

  function heroModal(hr) {
    const hd = HEROES[hr.id];
    const slots = Object.keys(SLOTS);
    const close = () => { m.remove(); mapScreen(); };
    const m = h('div', { class: 'modal', onclick: (e) => e.target === m && close() });
    const build = () => {
      const st = R.heroStats(G.run, hr);
      const tal = Object.entries(hr.talents);
      const bag = G.run.bag;
      const eq = Object.values(hr.items);
      const curScore = setScore(eq);
      const slotEls = slots.map((sl) => {
        const it = hr.items[sl];
        const cell = h('div', { class: 'slotcell' }, h('div', { class: 'dim', style: { fontSize: '12px' } }, SLOTS[sl]));
        if (it) { const b = itemBox(it, 60); b.style.cursor = 'pointer'; b.addEventListener('click', () => { if (R.unequip(G.run, hr.id, sl)) { sfx.click(); save(); render(); } else toast('Рюкзак полон'); }); cell.append(b, h('div', { class: 'dim', style: { fontSize: '11px' } }, 'снять')); }
        else { const e = h('div', { class: 'itembox empty', style: { width: '60px', height: '60px' } }); cell.append(e, h('div', { class: 'dim', style: { fontSize: '11px' } }, 'пусто')); }
        return cell;
      });
      const bagEls = bag.map((it, idx) => {
        const sl = ITEMS[it.id].slot;
        const after = eq.filter((x) => ITEMS[x.id].slot !== sl).concat([it]);
        const better = setScore(after) > curScore;
        const b = itemBox(it, 54); b.style.cursor = 'pointer';
        if (better) b.classList.add('better');
        b.addEventListener('click', () => { if (R.equipFromBag(G.run, hr.id, idx)) { sfx.buy(); save(); render(); } });
        return b;
      });
      return h('div', { class: 'box panel' },
        h('div', { style: { display: 'flex', gap: '18px', alignItems: 'center' } }, img(`assets/svg/heroes/${hr.id}.svg`, 'mbig'), h('div', {}, h('h2', { class: 'title' }, `${hd.name} — ${hd.title}`), h('div', {}, `Уровень ${hr.lvl} · HP ${hr.hp}/${st.maxHp} · Атака ${st.atk} · Броня ${st.def}%`), h('div', { class: 'dim' }, hd.blurb))),
        h('div', { class: 'eqrow' }, h('div', {}, h('div', { class: 'dim', style: { marginBottom: '4px' } }, 'Экипировка (3 слота, нажмите на предмет, чтобы снять)'), h('div', { class: 'slotline' }, slotEls)),
          h('div', { style: { flex: 1 } }, h('div', { class: 'dim', style: { marginBottom: '4px' } }, 'Комбинации'), comboView(eq))),
        h('div', { style: { marginTop: '10px' } }, h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '4px' } }, h('span', { class: 'dim' }, `Рюкзак (${bag.length}/${R.BAG_MAX}) — нажмите, чтобы надеть; ▲ = усилит героя`),
          h('button', { class: 'btn small alt', onclick: () => { R.autoEquip(G.run, hr.id); sfx.buy(); save(); render(); } }, 'Подобрать лучшее')),
          bag.length ? h('div', { class: 'bagrow' }, bagEls) : h('div', { class: 'dim', style: { fontSize: '14px' } }, 'Пусто. Когда слот занят, новые предметы попадают сюда.')),
        tal.length ? h('div', { style: { marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' } }, h('span', { class: 'dim' }, 'Таланты:'), ...tal.map(([k, n]) => { const c = h('span', { class: 'chip', style: { fontSize: '14px', padding: '2px 10px', border: '1px solid var(--line)', borderRadius: '12px' } }, `${TALENTS[k].name}${n > 1 ? ' ×' + n : ''}`); tooltip(c, talentTip(k, n)); return c; })) : null,
        h('div', { style: { marginTop: '10px' } }, hd.skills.map((sid, idx) => {
          const sk = SKILLS[sid], lv = hr.skillLv[sid] ?? 0, need = skillUnlockLv(hr.id, idx), lock = hr.lvl < need;
          return h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #ffffff14', opacity: lock ? 0.5 : 1 } },
            img(`assets/svg/icons/skills/${sk.icon}.svg`, 'mskill'), h('div', {}, h('b', {}, sk.name), lock ? h('span', { class: 'dim' }, ` 🔒 откроется на уровне ${need}`) : null, lv ? h('span', { class: 'gold' }, ' ' + '★'.repeat(lv)) : '', sk.cost ? h('span', { style: { color: '#ff8a5a' } }, ` · ярость ${sk.cost}`) : sk.cd ? h('span', { class: 'dim' }, ` · перезарядка ${sk.cd}`) : '', h('div', { class: 'dim', style: { fontSize: '13px' } }, describeSkill(sk, lv))));
        })),
        h('button', { class: 'btn', style: { marginTop: '12px' }, onclick: close }, 'Закрыть'));
    };
    const render = () => { const sc = m.firstChild?.scrollTop ?? 0; m.replaceChildren(build()); m.firstChild.scrollTop = sc; };
    render();
    stage.append(m);
  }

  function mapScreen() {
    const run = G.run;
    if (R.heroesWithTalents(run).length || run.newSkills?.length) return levelupScreen(() => mapScreen());
    if (run.recruitPending) return recruitScreen();
    const act = ACTS[run.act];
    const cur = R.currentChoices(run);
    const cols = h('div', { class: 'cols' });
    run.map.forEach((row, f) => {
      const col = h('div', { class: 'col' });
      row.forEach((n, i) => {
        const avail = f === run.floor;
        const locked = avail && cur[i].locked;
        const b = h('button', { class: `node ${n.type}${avail ? (locked ? ' locked' : ' avail') : f < run.floor ? ' done' : ' future'}`, onclick: () => { if (!avail) return; if (locked) { sfx.death(); toast('Сначала нужен бой!'); return; } sfx.click(); pickNode(i); } }, img(`assets/svg/icons/map/${n.type === 'boss' && n.final ? 'boss' : n.type}.svg`));
        tooltip(b, `<b>${NODE_NAMES[n.type]}</b>${avail ? (locked ? '<br>Сначала нужен бой: после отдыха, лавки, события или игры придётся сразиться' : '<br>Нажмите, чтобы идти') : ''}`);
        col.append(b);
      });
      col.append(h('div', { class: 'dim', style: { fontSize: '12px' } }, f + 1));
      cols.append(col);
    });
    const bg = ['graveyard', 'castle', 'void'][run.act - 1];
    const s = h('div', { class: 'screen map' }, img(`assets/svg/bg/${bg}.svg`, 'bg'), h('div', { class: 'shade' }),
      h('div', { class: 'topbar' }, h('div', { style: { fontWeight: 900, fontSize: '22px', color: 'var(--gold)' } }, `Акт ${run.act}${run.loop ? ` (круг ${run.loop + 1})` : ''}: ${act.name}`), goldChip(), (() => { const c = h('div', { class: 'chip' }, '🎒 ', run.bag.length); tooltip(c, `<b>Рюкзак: ${run.bag.length}/${R.BAG_MAX}</b><br>Нажмите на героя внизу, чтобы надеть предметы и собрать комбинации`); return c; })(), relicRow(),
        h('button', { class: 'iconbtn', title: 'В меню', onclick: () => { save(); menu(); } }, '☰')),
      h('div', { style: { position: 'absolute', top: '70px', left: 0, right: 0, textAlign: 'center', fontSize: '22px', fontWeight: 800, textShadow: '0 2px 4px #000' } },
        cur && cur[0].final ? 'Бог Пепла ждёт' : run.lastFight ? 'Выберите путь' : '⚔ Следующий узел — только бой (🔒 закрыто)'),
      cols, partyStrip());
    G.show(s);
    save();
  }

  // ============ УЗЛЫ ============
  function pickNode(i) {
    const node = R.chooseNode(G.run, i);
    if (!node) { toast('Сначала нужен бой!'); return; }
    save();
    const info = node.info;
    switch (node.type) {
      case 'battle': case 'elite': case 'boss': return fight({ ...info, type: node.type }, node.type);
      case 'campfire': return camp();
      case 'shop': return shop(info.shop);
      case 'event': return eventScreen(info.event);
      case 'treasure': return treasure(info.relics);
      case 'minigame': return minigameScreen(info.game);
    }
  }

  function recordKills(state) {
    for (const e of state.enemies) if (e.dead) { G.meta.bestiary[e.id] = (G.meta.bestiary[e.id] ?? 0) + 1; G.meta.kills++; if (e.tier === 1) G.meta.elites++; }
  }

  function fight(info, type, isEvent) {
    mountBattle(G, info, (state) => {
      R.applyBattleResult(G.run, state);
      recordKills(state);
      if (state.result === 'lose') return endRun('lose');
      const rew = R.battleRewards(G.run, type);
      G.run.gold += rew.gold;
      const ups = R.grantXp(G.run, rew.xp);
      if (type === 'boss') R.healParty(G.run, 0.3);
      save();
      rewardScreen(rew, type, ups, isEvent);
    });
  }

  function rewardScreen(rew, type, levels, isEvent) {
    const cardFor = (b) => {
      let icon, title, desc, cls = '';
      const hd = b.hero ? HEROES[b.hero] : null;
      if (b.kind === 'relic') { const r = RELICS[b.relic]; icon = `assets/svg/icons/relics/${b.relic}.svg`; title = r.name; desc = r.desc; cls = 'r' + r.rarity; }
      else if (b.kind === 'upgrade') { const sk = SKILLS[b.skill]; icon = `assets/svg/icons/skills/${sk.icon}.svg`; title = `Улучшить: ${sk.name}`; desc = `${hd.name}: сила навыка +20%.`; }
      else if (b.kind === 'hp') { icon = 'assets/svg/ui/heart.svg'; title = `${hd.name}: +${b.pct}% HP`; desc = 'Максимальное здоровье героя растёт.'; }
      else if (b.kind === 'atk') { icon = 'assets/svg/icons/skills/slash.svg'; title = `${hd.name}: +${b.pct}% урона`; desc = 'Навсегда в этом забеге.'; }
      else if (b.kind === 'heal') { icon = 'assets/svg/icons/skills/heal.svg'; title = 'Привал на ходу'; desc = `Отряд лечится на ${b.pct}%.`; }
      else { icon = 'assets/svg/ui/coin.svg'; title = `+${b.n} золота`; desc = 'Звонкая монета.'; }
      return h('div', { class: 'card panel ' + cls, onclick: () => { sfx.buy(); R.applyBoon(G.run, b); afterReward(type, isEvent); } }, img(icon), h('div', { class: 't' }, title), h('div', { class: 'd' }, desc));
    };
    const s = h('div', { class: 'screen' }, img('assets/svg/bg/camp.svg', 'bg'),
      h('div', { class: 'center' }, h('h1', { class: 'title', style: { fontSize: '44px' } }, 'Победа!'),
        h('div', { class: 'statline' }, h('span', { class: 'chip' }, img('assets/svg/ui/coin.svg'), `+${rew.gold}`), levels.length ? h('span', { class: 'gold' }, `⬆ Новый уровень: ${levels.map((u) => HEROES[u.id].name).join(', ')}`) : null),
        h('div', { class: 'dim', style: { fontSize: '20px' } }, type === 'normal' || type === 'battle' ? 'Выберите награду' : 'Выберите реликвию'),
        h('div', { class: 'cards' }, rew.choices.map(cardFor)),
        h('button', { class: 'btn alt small', onclick: () => afterReward(type, isEvent) }, 'Пропустить')));
    sfx.win();
    G.show(s);
  }

  function afterReward(type, isEvent) {
    const kind = type === 'boss' ? 'boss' : type === 'elite' ? 'elite' : 'battle';
    mountWheel(G, kind, () => proceed(type, isEvent));
  }

  function proceed(type, isEvent) {
    const run = G.run;
    if (isEvent) { R.advance(run); save(); return mapScreen(); }
    if (type === 'boss') {
      const r = R.finishFloorAfterBoss(run);
      save();
      if (r === 'win') return endRun('win');
      if (r === 'next_act' || r === 'loop') R.healParty(run, 0.25);
      return mapScreen();
    }
    R.advance(run);
    save();
    mapScreen();
  }

  // ---- Повышение уровня: выбор талантов ----
  function levelupScreen(next) {
    const run = G.run;
    const news = run.newSkills ?? [];
    const heroesIn = run.heroes.filter((hr) => hr.pendingTalents > 0 || news.some((n) => n.id === hr.id));
    const doneBtn = h('button', { class: 'btn gold', onclick: () => { sfx.click(); run.newSkills = []; save(); next(); } }, 'Дальше');
    const body = h('div', { class: 'levelup panel' }, h('h1', { class: 'title', style: { marginBottom: '6px' } }, 'Новый уровень!'), h('div', { class: 'dim' }, 'Выберите талант для каждого героя. Новые навыки открываются автоматически.'));
    const rows = new Map();
    const refreshDone = () => { doneBtn.disabled = R.heroesWithTalents(run).length > 0; };
    const drawRow = (hr) => {
      const hd = HEROES[hr.id];
      const nw = news.filter((n) => n.id === hr.id).flatMap((n) => n.newSkills);
      const row = rows.get(hr.id);
      let cards;
      if (hr.pendingTalents > 0) {
        cards = R.talentChoices(run).map((key) => {
          const t = TALENTS[key];
          return h('div', { class: 'tcard', onclick: () => { sfx.buy(); R.applyTalent(run, hr, key); save(); drawRow(hr); refreshDone(); } }, h('div', { class: 'tn' }, t.name), h('div', { class: 'td' }, t.desc));
        });
      } else cards = [h('div', { class: 'gold', style: { fontWeight: 800 } }, '✔ Талант выбран')];
      row.replaceChildren(img(`assets/svg/heroes/${hr.id}.svg`, 'pt'),
        h('div', { class: 'who' }, h('div', { style: { fontWeight: 800, fontSize: '18px' } }, hd.name), h('div', { class: 'gold' }, `Уровень ${hr.lvl}`),
          nw.length ? h('div', { class: 'newskills' }, nw.map((sid) => { const i = img(`assets/svg/icons/skills/${SKILLS[sid].icon}.svg`); tooltip(i, `<b>Новый навык: ${SKILLS[sid].name}</b><br>${describeSkill(SKILLS[sid])}`); return i; })) : null,
          nw.length ? h('div', { class: 'dim', style: { fontSize: '12px' } }, 'Новый навык!') : null),
        h('div', { class: 'tcards' }, cards));
    };
    for (const hr of heroesIn) { const row = h('div', { class: 'lvrow' }); rows.set(hr.id, row); body.append(row); drawRow(hr); }
    refreshDone();
    sfx.win();
    G.show(h('div', { class: 'screen' }, img('assets/svg/bg/camp.svg', 'bg'), h('div', { class: 'center', style: { background: '#000b' } }, body, h('div', { style: { display: 'flex', gap: '12px' } },
      h('button', { class: 'btn alt small', onclick: () => { for (const hr of run.heroes) while (hr.pendingTalents > 0) R.applyTalent(run, hr, R.talentChoices(run)[0]); save(); run.newSkills = []; next(); } }, 'Выбрать случайно'), doneBtn))));
  }

  // ---- Вербовка ----
  function recruitScreen() {
    const run = G.run;
    const offers = R.recruitOffers(run);
    if (!offers.length) { run.recruitPending = false; save(); return mapScreen(); }
    const avg = Math.max(1, Math.round(run.heroes.reduce((a, b) => a + b.lvl, 0) / run.heroes.length) - 1);
    const s = h('div', { class: 'screen' }, img('assets/svg/bg/camp.svg', 'bg'),
      h('div', { class: 'topbar' }, goldChip(), relicRow()),
      h('div', { class: 'center' }, h('h1', { class: 'title' }, 'У костра новый союзник'), h('div', { class: 'dim', style: { fontSize: '18px' } }, `Кто присоединится к отряду? (уровень ${avg})`),
        h('div', { class: 'cards' }, offers.map((id) => {
          const hd = HEROES[id];
          return h('div', { class: 'recruitcard panel', onclick: () => { sfx.buy(); R.recruit(run, id); save(); toast(`${hd.name} вступает в отряд!`); mapScreen(); } },
            img(`assets/svg/heroes/${id}.svg`, 'big'), h('div', { style: { fontWeight: 800, fontSize: '20px' } }, hd.name), h('div', {}, clsTag(hd.cls), ' ', h('span', { class: 'dim' }, hd.title)),
            h('div', { class: 'dim', style: { margin: '6px 0', fontSize: '14px' } }, hd.blurb), h('div', { style: { fontSize: '14px' } }, `HP ${hd.hp} · Атака ${hd.atk} · Броня ${hd.def}%`),
            h('div', { style: { display: 'flex', gap: '4px', justifyContent: 'center', marginTop: '6px' } }, hd.skills.map((sid) => { const i = img(`assets/svg/icons/skills/${SKILLS[sid].icon}.svg`); i.style.cssText = 'width:34px;height:34px'; tooltip(i, `<b>${SKILLS[sid].name}</b><br>${describeSkill(SKILLS[sid])}`); return i; })));
        }))));
    G.show(s);
  }

  // ---- Мини-игры ----
  function minigameScreen(kind) {
    const run = G.run;
    const gm = GAMES[kind];
    const host = h('div', { class: 'gamehost' });
    const box = h('div', { class: 'gamebox panel' }, h('h1', { class: 'title' }, gm.name), host);
    const result = (tier, text) => {
      host.__stop?.();
      const prizes = R.minigamePrizes(run, tier);
      save();
      sfx[tier >= 2 ? 'win' : 'buy']();
      host.replaceChildren(h('h2', { style: { color: ['#ff8a7a', 'var(--text)', 'var(--gold)', '#8ef0b4'][tier], fontSize: '34px' } }, ['Не повезло…', 'Неплохо!', 'Отлично!', 'Идеально!'][tier]), h('div', { class: 'dim' }, text),
        ...prizes.map((p) => prizeView(run, p)), h('button', { class: 'btn gold', onclick: () => { sfx.click(); leaveNode(); } }, 'Дальше'));
    };
    host.replaceChildren(img(gm.icon, '', ''), h('div', { style: { fontSize: '19px', textAlign: 'center', maxWidth: '560px' } }, gm.desc), h('div', { class: 'dim', style: { fontSize: '15px' } }, gm.rules.join(' · ')),
      h('div', { class: 'dim', style: { fontSize: '15px' } }, 'Призы: золото, предметы, реликвии. Чем лучше результат, тем ценнее награда.'),
      h('div', { style: { display: 'flex', gap: '12px' } }, h('button', { class: 'btn gold', onclick: () => { sfx.click(); startGame(kind, host, result); } }, 'Играть'), h('button', { class: 'btn alt', onclick: () => leaveNode() }, 'Пропустить')));
    host.firstChild.style.cssText = 'width:96px;height:96px';
    G.show(h('div', { class: 'screen' }, img('assets/svg/bg/camp.svg', 'bg'), h('div', { class: 'topbar' }, goldChip(), relicRow()), h('div', { class: 'center' }, box)));
  }

  function camp() {
    const run = G.run;
    const heal = Math.round((0.35 + (R.mods(run).campHeal ?? 0) / 100) * 100);
    const s = h('div', { class: 'screen' }, img('assets/svg/bg/camp.svg', 'bg'),
      h('div', { class: 'topbar' }, goldChip(), relicRow()),
      h('div', { class: 'center' }, h('h1', { class: 'title' }, 'Привал'), h('div', { class: 'dim' }, 'Костёр трещит. Выберите одно действие.'),
        h('div', { class: 'cards' },
          h('div', { class: 'card panel', onclick: () => { sfx.heal(); R.campRest(run); leaveNode(); } }, img('assets/svg/icons/skills/heal.svg'), h('div', { class: 't' }, 'Отдохнуть'), h('div', { class: 'd' }, `Отряд восстанавливает ${heal}% здоровья.`)),
          h('div', { class: 'card panel', onclick: () => upgradeModal(() => leaveNode()) }, img('assets/svg/icons/skills/bless.svg'), h('div', { class: 't' }, 'Улучшить навык'), h('div', { class: 'd' }, 'Выберите навык героя: сила +20%.')),
          h('div', { class: 'card panel', onclick: () => { sfx.buy(); const hr = G.run.heroes.slice().sort((a, b) => a.lvl - b.lvl)[0]; R.grantXp(G.run, 1); leaveNode(); void hr; } }, img('assets/svg/icons/relics/soul_lantern.svg'), h('div', { class: 't' }, 'Размышления'), h('div', { class: 'd' }, 'Все герои получают опыт.')))));
    G.show(s);
  }

  function upgradeModal(done) {
    const list = R.upgradable(G.run);
    const m = h('div', { class: 'modal' }, h('div', { class: 'box panel' }, h('h2', { class: 'title' }, 'Что улучшить?'),
      h('div', { class: 'grid4', style: { marginTop: '12px' } }, list.map((u) => {
        const sk = SKILLS[u.skill], lv = u.hero.skillLv[u.skill] ?? 0;
        const c = h('div', { class: 'hcard', onclick: () => { sfx.buy(); u.hero.skillLv[u.skill] = lv + 1; m.remove(); done(); } },
          img(`assets/svg/icons/skills/${sk.icon}.svg`, '', ''), h('div', { class: 'nm', style: { fontSize: '13px' } }, sk.name), h('div', { class: 'ti' }, `${HEROES[u.hero.id].name} ${'★'.repeat(lv)}→${'★'.repeat(lv + 1)}`));
        c.querySelector('img').style.cssText = 'width:50px;height:50px';
        tooltip(c, describeSkill(sk, lv + 1));
        return c;
      })), h('button', { class: 'btn alt small', style: { marginTop: '12px' }, onclick: () => m.remove() }, 'Отмена')));
    stage.append(m);
  }

  function leaveNode() { R.advance(G.run); save(); mapScreen(); }

  // ---- Лавка ----
  function shop(items) {
    const run = G.run;
    const draw = () => {
      const cards = items.map((it) => {
        let icon, title, desc, cls = '', iconEl = null;
        const hd = it.hero ? HEROES[it.hero] : null;
        if (it.kind === 'relic') { const r = RELICS[it.relic]; icon = `assets/svg/icons/relics/${it.relic}.svg`; title = r.name; desc = r.desc; cls = 'r' + r.rarity; }
        else if (it.kind === 'item') { const R2 = RARITY[it.it.r]; iconEl = itemBox(it.it, 84); title = itemName(it.it); desc = Object.entries(itemStats(it.it)).map(([k, v]) => fmtStat(k, v)).join(', ') + `. Для: ${hd.name}`; cls = 'r' + Math.min(3, it.it.r); void R2; }
        else if (it.kind === 'heal') { icon = 'assets/svg/icons/skills/heal.svg'; title = 'Лечебное зелье'; desc = `Отряд лечится на ${it.pct}%.`; }
        else if (it.kind === 'upgrade') { const sk = SKILLS[it.skill]; icon = `assets/svg/icons/skills/${sk.icon}.svg`; title = `Заточка: ${sk.name}`; desc = `${hd.name}: +20% силы навыка.`; }
        else { icon = 'assets/svg/icons/relics/soul_lantern.svg'; title = `Учитель: ${hd.name}`; desc = '+1 уровень герою.'; }
        return h('div', { class: `card panel ${cls}${it.sold ? ' sold' : ''}${run.gold < it.price && !it.sold ? ' poor' : ''}`, style: { width: '190px', minHeight: '270px' }, onclick: () => { if (R.buy(run, items, it.i)) { sfx.buy(); save(); draw(); if (it.result && !it.result.equipped) toast(`${HEROES[it.result.hero].name}: слот занят, предмет в рюкзаке`); else if (it.result) toast(`${HEROES[it.result.hero].name}: предмет надет`); } } },
          iconEl ?? img(icon), h('div', { class: 't', style: { fontSize: '17px' } }, title), h('div', { class: 'd' }, desc), h('div', { class: 'price' }, it.sold ? 'Продано' : [img('assets/svg/ui/coin.svg'), it.price]));
      });
      const s = h('div', { class: 'screen' }, img('assets/svg/bg/camp.svg', 'bg'), h('div', { class: 'topbar' }, goldChip(), relicRow()),
        h('div', { class: 'center' }, h('h1', { class: 'title' }, 'Лавка странника'), h('div', { class: 'cards', style: { flexWrap: 'wrap', justifyContent: 'center', width: '1180px', gap: '14px' } }, cards),
          h('button', { class: 'btn', onclick: () => leaveNode() }, 'Уйти')));
      G.show(s);
    };
    draw();
  }

  // ---- Сокровище ----
  function treasure(relics) {
    const gold = 30 + 10 * G.run.act;
    G.run.gold += gold;
    const s = h('div', { class: 'screen' }, img('assets/svg/bg/crypt.svg', 'bg'), h('div', { class: 'topbar' }, goldChip(), relicRow()),
      h('div', { class: 'center' }, h('h1', { class: 'title' }, 'Сокровищница'), h('div', { class: 'gold' }, `+${gold} золота. Выберите одну реликвию:`),
        h('div', { class: 'cards' }, relics.map((r) => h('div', { class: 'card panel r' + r.rarity, onclick: () => { sfx.buy(); R.addRelic(G.run, r.id); leaveNode(); } }, img(`assets/svg/icons/relics/${r.id}.svg`), h('div', { class: 't' }, r.name), h('div', { class: 'd' }, r.desc)))),
        h('button', { class: 'btn alt small', onclick: leaveNode }, 'Уйти')));
    G.show(s);
  }

  // ---- События ----
  function eventScreen(ev) {
    const run = G.run;
    const bg = ['crypt', 'forest', 'castle'][(run.act + run.floor) % 3];
    const box = h('div', { class: 'evbox panel' });
    const showChoices = () => {
      box.replaceChildren(h('h2', { class: 'title' }, ev.title), h('p', {}, ev.text),
        h('div', { class: 'choices' }, ev.choices.map((c) => {
          const need = /\((?:-?\d+) золота\)|за (\d+) золота/.exec(c.text);
          void need;
          return h('button', { class: 'btn alt', onclick: () => resolve(c) }, c.text);
        })));
    };
    const resolve = (c) => {
      const out = R.pickOutcome(run, c);
      const res = R.resolveEvent(run, out);
      sfx.status(); save();
      const extra = [];
      if (res.relic) extra.push(h('div', { class: 'chip', style: { margin: '6px 0' } }, img(`assets/svg/icons/relics/${res.relic}.svg`), `Реликвия: ${RELICS[res.relic].name}`));
      if (res.upgrade) extra.push(h('div', { class: 'gold' }, `Навык улучшен: ${SKILLS[res.upgrade.skill].name} (${HEROES[res.upgrade.hero].name})`));
      if (res.levels?.length) extra.push(h('div', { class: 'gold' }, `Уровень повышен: ${[...new Set(res.levels)].map((i) => HEROES[i].name).join(', ')}`));
      box.replaceChildren(h('h2', { class: 'title' }, ev.title), h('p', {}, out.text), ...extra,
        h('button', { class: 'btn', onclick: () => {
          if (res.fight) {
            const enc = R.genEncounter(run, res.fight, makeRng());
            fight({ enemies: enc.enemies, bg: enc.bg, scale: enc.scale, type: res.fight === 'elite' ? 'elite' : 'battle' }, res.fight === 'elite' ? 'elite' : 'battle', true);
          } else leaveNode();
        } }, res.fight ? 'К оружию!' : 'Дальше'));
    };
    showChoices();
    G.show(h('div', { class: 'screen' }, img(`assets/svg/bg/${bg}.svg`, 'bg'), h('div', { class: 'topbar' }, goldChip(), relicRow()), h('div', { class: 'center' }, box)));
  }

  // ============ КОНЕЦ ЗАБЕГА ============
  function endRun(outcome) {
    const run = G.run;
    const ash = R.ashForRun(run, outcome);
    const meta = G.meta;
    meta.ash += ash; meta.totalAsh = (meta.totalAsh ?? 0) + ash; meta.runs++;
    const rankBefore = M.rankOf({ totalAsh: meta.totalAsh - ash });
    if (outcome === 'win') { meta.wins++; if (run.mode !== 'daily' && run.asc >= meta.ascUnlocked && meta.ascUnlocked < 10) meta.ascUnlocked = run.asc + 1; }
    meta.bestFloor = Math.max(meta.bestFloor, (run.act - 1) * 10 + run.floor);
    if (run.mode === 'endless') meta.endlessBest = Math.max(meta.endlessBest, run.loop);
    for (const r of run.relics) meta.relicsSeen[r] = 1;
    const newAch = M.checkAchievements(meta, run, outcome);
    R.saveRun(null); M.saveMeta(meta);
    G.run = null;
    sfx[outcome === 'win' ? 'win' : 'lose']();
    const s = h('div', { class: 'screen end ' + outcome }, img(`assets/svg/bg/${outcome === 'win' ? 'camp' : 'crypt'}.svg`, 'bg'),
      h('div', { class: 'center' }, h('h1', {}, outcome === 'win' ? 'Рассвет настал!' : 'Отряд пал…'),
        h('div', { class: 'dim', style: { fontSize: '20px' } }, outcome === 'win' ? 'Бог Пепла повержен. Но тьма всегда возвращается.' : `Вы дошли до акта ${run.act}, этаж ${run.floor + 1}.`),
        h('div', { class: 'statline' }, h('span', {}, `⚔ Боёв: ${run.stats.battles}`), h('span', {}, `💀 Убито: ${run.stats.kills}`), h('span', {}, `🏺 Реликвий: ${run.relics.length}`), h('span', {}, `🎁 Предметов: ${run.stats.items}`), h('span', { class: 'chip' }, img('assets/svg/ui/ash.svg'), `+${ash} пепла`)),
        M.rankOf(meta) > rankBefore ? h('div', { class: 'gold', style: { fontSize: '20px', fontWeight: 800 } }, `⭐ Ранг пепла повышен: ${M.rankOf(meta)} (+1% к здоровью и урону навсегда)`) : null,
        newAch.length ? h('div', { class: 'gold', style: { fontSize: '18px' } }, '🏆 Достижения: ' + newAch.map((a) => M.ACHIEVEMENTS[a].name).join(', ')) : null,
        h('div', { style: { display: 'flex', gap: '14px' } }, h('button', { class: 'btn gold', onclick: () => hub('heroes') }, 'Кузня и герои'), h('button', { class: 'btn', onclick: menu }, 'В меню'))));
    G.show(s);
  }

  // ============ ХАБ ============
  function hub(tab = 'heroes') {
    const meta = G.meta;
    const body = h('div', { class: 'scroll' });
    const tabs = h('div', { class: 'tabs' }, [['heroes', 'Герои'], ['forge', 'Кузня'], ['bestiary', 'Бестиарий'], ['ach', 'Достижения']].map(([k, n]) => h('button', { class: 'tab' + (k === tab ? ' on' : ''), onclick: () => { sfx.click(); hub(k); } }, n)));
    if (tab === 'heroes') {
      for (const [id, hd] of Object.entries(HEROES)) {
        const has = meta.unlocked.includes(id);
        body.append(h('div', { class: 'herodet panel' }, img(`assets/svg/heroes/${id}.svg`, 'big'),
          h('div', { style: { flex: 1 } }, h('h3', {}, `${hd.name} — ${hd.title}`, ' ', clsTag(hd.cls)), h('div', { class: 'dim' }, hd.blurb), h('div', { style: { margin: '4px 0 8px' } }, `HP ${hd.hp} · Атака ${hd.atk} · Броня ${hd.def}%`),
            h('div', { class: 'sk' }, hd.skills.map((s) => { const i = img(`assets/svg/icons/skills/${SKILLS[s].icon}.svg`); tooltip(i, `<b>${SKILLS[s].name}</b><br>${describeSkill(SKILLS[s])}`); return i; }))),
          has ? h('div', { class: 'gold', style: { fontWeight: 800 } }, '✔ Открыт') : h('button', { class: 'btn gold', disabled: meta.ash < hd.unlock, onclick: () => { if (M.unlockHero(meta, id)) { sfx.buy(); hub('heroes'); } } }, [`Открыть: ${hd.unlock} `, img('assets/svg/ui/ash.svg', '', '')])));
      }
      body.querySelectorAll('.btn img').forEach((i) => { i.style.cssText = 'width:20px;height:20px;vertical-align:middle'; });
    } else if (tab === 'forge') {
      for (const [k, f] of Object.entries(M.FORGE)) {
        const l = meta.forge[k] ?? 0, max = l >= f.max, c = f.cost(l);
        body.append(h('div', { class: 'forge-row panel' }, h('div', { class: 'info' }, h('h3', {}, f.name), h('div', { class: 'dim' }, f.desc), h('div', { class: 'pips' }, Array.from({ length: f.max }, (_, i) => h('i', { class: i < l ? 'on' : '' })))),
          h('button', { class: 'btn gold', disabled: max || meta.ash < c, onclick: () => { if (M.buyForge(meta, k)) { sfx.buy(); hub('forge'); } } }, max ? 'Максимум' : [`${c} `, img('assets/svg/ui/ash.svg')])));
      }
      body.querySelectorAll('.btn img').forEach((i) => { i.style.cssText = 'width:20px;height:20px;vertical-align:middle'; });
    } else if (tab === 'bestiary') {
      const grid = h('div', { class: 'grid4' });
      for (const e of Object.values(ENEMIES)) {
        const k = meta.bestiary[e.id] ?? 0;
        const c = h('div', { class: 'bes panel' + (k ? '' : ' unk') }, img(enemySvgPath(e)), h('div', { style: { fontWeight: 800 } }, k ? e.name : '???'), h('div', { class: 'dim', style: { fontSize: '12px' } }, k ? `Побеждён: ${k} · ${e.tier === 2 ? 'босс' : e.tier === 1 ? 'элита' : 'акт ' + e.act}` : 'Не встречен'));
        if (k) tooltip(c, `<b>${e.name}</b><br>HP ${e.hp} · Атака ${e.atk} · Броня ${e.def}%<div class="sub">${e.moves.map((m) => '• ' + m.name).join('<br>')}</div>`);
        grid.append(c);
      }
      body.append(grid);
    } else {
      for (const [k, a] of Object.entries(M.ACHIEVEMENTS)) body.append(h('div', { class: 'ach panel' + (meta.ach[k] ? '' : ' no'), style: { marginBottom: '8px' } }, h('div', { class: 'st' }, meta.ach[k] ? '🏆' : '🔒'), h('div', {}, h('b', {}, a.name), h('div', { class: 'dim' }, a.desc))));
    }
    const s = h('div', { class: 'screen hub' }, img('assets/svg/bg/menu.svg', 'bg'), h('div', { class: 'shade' }), backBtn(menu),
      h('div', { class: 'chip', style: { position: 'absolute', right: '24px', top: '16px', zIndex: 30 } }, h('span', { class: 'gold' }, `⭐ Ранг ${M.rankOf(meta)}`), h('span', { class: 'dim', style: { fontSize: '13px' } }, ` (${meta.totalAsh ?? 0}/${M.rankNeed(M.rankOf(meta))})`), '  ', img('assets/svg/ui/ash.svg'), meta.ash, ' пепла'), h('div', { style: { height: '10px' } }), tabs, body);
    s.firstElementChild.nextElementSibling;
    G.show(s);
    // отступ шапки
    tabs.style.marginTop = '4px';
  }

  G.menu = menu; G.minigameScreen = minigameScreen; G.mapScreen = mapScreen;
  return G;
}
