import { h, img, sprite, tooltip, goFullscreen } from './dom.js';
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

const NODE_NAMES = { battle: 'Бой', elite: 'Элита', boss: 'Босс', campfire: 'Привал', shop: 'Лавка', event: 'Событие', treasure: 'Сокровище' };
const clsTag = (c) => h('div', { class: 'cl ' + c }, CLASS_NAMES[c]);

export function createGame(stage) {
  const G = { stage, meta: M.loadMeta(), run: null, fast: false };
  G.show = (el) => { stage.replaceChildren(el); };
  const save = () => { R.saveRun(G.run); M.saveMeta(G.meta); };
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
          h('p', {}, '🗺 На карте выбирайте путь: бои, элиты (даёт реликвию), привалы, лавки, события. Босс ждёт в конце каждого акта; всего 3 акта и финал.'),
          h('p', {}, '⬆️ После боя выберите награду: улучшение навыка, бонус героя, реликвию. Герои растут с уровнем.'),
          h('p', {}, '💀 Проиграли — получите «пепел» и потратьте его на героев и улучшения в Кузне. Горячие клавиши: 1–5 навыки, Пробел — конец хода, Tab — смена героя, Esc — отмена.')),
        h('button', { class: 'btn', style: { marginTop: '10px' }, onclick: () => m.remove() }, 'Понятно')));
    stage.append(m);
  }

  // ============ ВЫБОР ОТРЯДА ============
  function pickParty(mode, fixed) {
    const unlocked = G.meta.unlocked;
    const picked = [];
    for (const id of unlocked.slice(0, 4)) picked.push(id);
    let asc = Math.min(G.meta.ascUnlocked, 0);
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
          if (i >= 0) picked.splice(i, 1); else if (picked.length < 4) picked.push(id); else picked.shift(), picked.push(id);
          sfx.click(); draw();
        } }, clsTag(hd.cls), img(`assets/svg/heroes/${id}.svg`), h('div', { class: 'nm' }, hd.name), h('div', { class: 'ti' }, lock ? `🔒 ${hd.unlock} пепла` : hd.title));
        tooltip(c, `<b>${hd.name}</b> — ${hd.title}<br>HP ${hd.hp} · Атака ${hd.atk} · Броня ${hd.def}%<br><span class="sub">${hd.blurb}</span><br>${hd.skills.map((s) => '• ' + SKILLS[s].name).join('<br>')}`);
        return c;
      }));
      startBtn.disabled = picked.length !== 4;
      startBtn.textContent = picked.length === 4 ? 'В путь!' : `Выберите 4 героя (${picked.length}/4)`;
      ascEl.textContent = asc;
    };
    draw();
    const s = h('div', { class: 'screen pick' }, img('assets/svg/bg/camp.svg', 'bg'), h('div', { class: 'shade' }), backBtn(menu),
      h('h2', { class: 'title' }, 'Соберите отряд'), h('div', { class: 'dim' }, 'Выберите четырёх героев. Новые герои открываются за пепел в Кузне.'), grid,
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
    const party = rng.shuffle(Object.keys(HEROES)).slice(0, 4);
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
      const need = Math.ceil(1 + hr.lvl * 0.35);
      const c = h('div', { class: 'pcard panel', onclick: () => heroModal(hr) },
        img(`assets/svg/heroes/${hr.id}.svg`, 'pt'),
        h('div', { style: { flex: 1 } }, h('div', { style: { fontWeight: 800, fontSize: '14px' } }, `${hd.name} `, h('span', { class: 'gold' }, `ур.${hr.lvl}`)),
          h('div', { class: 'bar', style: { margin: '3px 0' } }, h('i', { style: { width: Math.min(100, hr.hp / st.maxHp * 100) + '%' } }), h('span', {}, `${hr.hp}/${st.maxHp}`)),
          h('div', { class: 'bar xp' }, h('i', { style: { width: Math.min(100, hr.xp / need * 100) + '%' } }))));
      return c;
    }));
  }

  function heroModal(hr) {
    const hd = HEROES[hr.id], st = R.heroStats(G.run, hr);
    const m = h('div', { class: 'modal', onclick: (e) => e.target === m && m.remove() },
      h('div', { class: 'box panel' },
        h('div', { style: { display: 'flex', gap: '18px', alignItems: 'center' } }, img(`assets/svg/heroes/${hr.id}.svg`, '', '', ), h('div', {}, h('h2', { class: 'title' }, `${hd.name} — ${hd.title}`), h('div', {}, `Уровень ${hr.lvl} · HP ${hr.hp}/${st.maxHp} · Атака ${st.atk} · Броня ${st.def}%`), h('div', { class: 'dim' }, hd.blurb))),
        h('div', { style: { marginTop: '12px' } }, hd.skills.map((sid) => {
          const sk = SKILLS[sid], lv = hr.skillLv[sid] ?? 0;
          return h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #ffffff14' } },
            img(`assets/svg/icons/skills/${sk.icon}.svg`, '', ''), h('div', {}, h('b', {}, sk.name), lv ? h('span', { class: 'gold' }, ' ' + '★'.repeat(lv)) : '', sk.cost ? h('span', { style: { color: '#ff8a5a' } }, ` · ярость ${sk.cost}`) : sk.cd ? h('span', { class: 'dim' }, ` · перезарядка ${sk.cd}`) : '', h('div', { class: 'dim', style: { fontSize: '14px' } }, describeSkill(sk, lv))));
        })),
        h('button', { class: 'btn', style: { marginTop: '12px' }, onclick: () => m.remove() }, 'Закрыть')));
    m.querySelectorAll('img').forEach((i) => { i.style.width = '56px'; i.style.height = '56px'; });
    m.querySelector('img').style.width = '90px'; m.querySelector('img').style.height = '108px';
    stage.append(m);
  }

  function mapScreen() {
    const run = G.run;
    const act = ACTS[run.act];
    const choices = R.currentChoices(run);
    const cols = h('div', { class: 'cols' });
    run.map.forEach((row, f) => {
      const col = h('div', { class: 'col' });
      row.forEach((n, i) => {
        const avail = f === run.floor;
        const b = h('button', { class: `node ${n.type}${avail ? ' avail' : f < run.floor ? ' done' : ' future'}`, disabled: !avail, onclick: () => { sfx.click(); pickNode(i); } }, img(`assets/svg/icons/map/${n.type === 'boss' && n.final ? 'boss' : n.type}.svg`));
        tooltip(b, `<b>${NODE_NAMES[n.type]}</b>${avail ? '<br>Нажмите, чтобы идти' : ''}`);
        col.append(b);
      });
      col.append(h('div', { class: 'dim', style: { fontSize: '12px' } }, f + 1));
      cols.append(col);
    });
    const bg = ['graveyard', 'castle', 'void'][run.act - 1];
    const s = h('div', { class: 'screen map' }, img(`assets/svg/bg/${bg}.svg`, 'bg'), h('div', { class: 'shade' }),
      h('div', { class: 'topbar' }, h('div', { style: { fontWeight: 900, fontSize: '22px', color: 'var(--gold)' } }, `Акт ${run.act}${run.loop ? ` (круг ${run.loop + 1})` : ''}: ${act.name}`), goldChip(), relicRow(),
        h('button', { class: 'iconbtn', title: 'В меню', onclick: () => { save(); menu(); } }, '☰')),
      h('div', { style: { position: 'absolute', top: '70px', left: 0, right: 0, textAlign: 'center', fontSize: '22px', fontWeight: 800, textShadow: '0 2px 4px #000' } }, choices && choices[0].final ? 'Бог Пепла ждёт' : 'Выберите путь'),
      cols, partyStrip());
    G.show(s);
    save();
    void choices;
  }

  // ============ УЗЛЫ ============
  function pickNode(i) {
    const node = R.chooseNode(G.run, i);
    save();
    const info = node.info;
    switch (node.type) {
      case 'battle': case 'elite': case 'boss': return fight({ ...info, type: node.type }, node.type);
      case 'campfire': return camp();
      case 'shop': return shop(info.shop);
      case 'event': return eventScreen(info.event);
      case 'treasure': return treasure(info.relics);
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
      const levels = R.grantXp(G.run, rew.xp);
      if (type === 'boss') R.healParty(G.run, 0.3);
      save();
      rewardScreen(rew, type, levels, isEvent);
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
        h('div', { class: 'statline' }, h('span', { class: 'chip' }, img('assets/svg/ui/coin.svg'), `+${rew.gold}`), levels.length ? h('span', { class: 'gold' }, `⬆ Уровень: ${[...new Set(levels)].map((id) => HEROES[id].name).join(', ')}`) : null),
        h('div', { class: 'dim', style: { fontSize: '20px' } }, type === 'normal' || type === 'battle' ? 'Выберите награду' : 'Выберите реликвию'),
        h('div', { class: 'cards' }, rew.choices.map(cardFor)),
        h('button', { class: 'btn alt small', onclick: () => afterReward(type, isEvent) }, 'Пропустить')));
    sfx.win();
    G.show(s);
  }

  function afterReward(type, isEvent) {
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

  // ---- Привал ----
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
        let icon, title, desc, cls = '';
        const hd = it.hero ? HEROES[it.hero] : null;
        if (it.kind === 'relic') { const r = RELICS[it.relic]; icon = `assets/svg/icons/relics/${it.relic}.svg`; title = r.name; desc = r.desc; cls = 'r' + r.rarity; }
        else if (it.kind === 'heal') { icon = 'assets/svg/icons/skills/heal.svg'; title = 'Лечебное зелье'; desc = `Отряд лечится на ${it.pct}%.`; }
        else if (it.kind === 'upgrade') { const sk = SKILLS[it.skill]; icon = `assets/svg/icons/skills/${sk.icon}.svg`; title = `Заточка: ${sk.name}`; desc = `${hd.name}: +20% силы навыка.`; }
        else { icon = 'assets/svg/icons/relics/soul_lantern.svg'; title = `Учитель: ${hd.name}`; desc = '+1 уровень герою.'; }
        return h('div', { class: `card panel ${cls}${it.sold ? ' sold' : ''}${run.gold < it.price && !it.sold ? ' poor' : ''}`, style: { width: '190px', minHeight: '270px' }, onclick: () => { if (R.buy(run, items, it.i)) { sfx.buy(); save(); draw(); } } },
          img(icon), h('div', { class: 't', style: { fontSize: '17px' } }, title), h('div', { class: 'd' }, desc), h('div', { class: 'price' }, it.sold ? 'Продано' : [img('assets/svg/ui/coin.svg'), it.price]));
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
    meta.ash += ash; meta.runs++;
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
        h('div', { class: 'statline' }, h('span', {}, `⚔ Боёв: ${run.stats.battles}`), h('span', {}, `💀 Убито: ${run.stats.kills}`), h('span', {}, `🏺 Реликвий: ${run.relics.length}`), h('span', { class: 'chip' }, img('assets/svg/ui/ash.svg'), `+${ash} пепла`)),
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
      h('div', { class: 'chip', style: { position: 'absolute', right: '24px', top: '16px', zIndex: 30 } }, img('assets/svg/ui/ash.svg'), meta.ash, ' пепла'), h('div', { style: { height: '10px' } }), tabs, body);
    s.firstElementChild.nextElementSibling;
    G.show(s);
    // отступ шапки
    tabs.style.marginTop = '4px';
  }

  G.menu = menu;
  return G;
}
