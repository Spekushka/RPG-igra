import { h, img, sprite, sleep, tooltip } from './dom.js';
import { sfx, toggleMute, isMuted } from './sfx.js';
import { SKILLS, describeSkill } from '../data/skills.js';
import { HEROES } from '../data/heroes.js';
import { ENEMIES, enemySvgPath } from '../data/enemies.js';
import { STATUSES } from '../data/statuses.js';
import { RELICS } from '../data/relics.js';
import { makeRng } from '../engine/rng.js';
import * as B from '../engine/battle.js';
import { partyUnits, battleMods } from '../engine/run.js';

const INTENT_ICON = { attack: '⚔️', heal: '💚', defend: '🛡️', buff: '⬆️', debuff: '☠️', summon: '👥', skip: '💤', idle: '…', none: '' };

function size(u) {
  if (u.side === 'ally') return u.minion ? [130, 156] : [190, 228];
  return u.tier === 2 ? [310, 310] : u.tier === 1 ? [230, 268] : [180, 216];
}
function spritePath(u) {
  if (u.side === 'ally') return u.minion ? 'assets/svg/enemies/skeleton.svg' : `assets/svg/heroes/${u.id}.svg`;
  return enemySvgPath(ENEMIES[u.id]);
}

// info: {enemies, scale, bg, type}. done(state) вызывается после финального баннера.
export function mountBattle(G, info, done) {
  const { run } = G;
  const state = B.createBattle({ party: partyUnits(run), enemies: info.enemies, mods: battleMods(run), rng: makeRng(), ascension: run.asc, enemyScale: info.scale });
  const els = new Map(); // uid -> {root, bar, shbar, hptxt, sts, intent, hit}
  let selected = null, targeting = null, busy = true;

  const field = h('div', { class: 'field' });
  const hud = h('div', { class: 'hud' });
  const hint = h('div', { class: 'hint' });
  const roundChip = h('div', { class: 'chip' }, 'Раунд 1');
  const screen = h('div', { class: 'screen battle' },
    img(`assets/svg/bg/${info.bg}.svg`, 'bg'), h('div', { class: 'shade' }), field,
    h('div', { class: 'topbar' }, roundChip,
      h('div', { class: 'chip' }, img('assets/svg/ui/coin.svg'), h('span', { id: 'goldv' }, run.gold)),
      h('div', { class: 'relics' }, run.relics.map((r) => { const i = img(`assets/svg/icons/relics/${r}.svg`); tooltip(i, `<b>${RELICS[r].name}</b><br>${RELICS[r].desc}`); return i; })),
      h('button', { class: 'iconbtn', title: 'Скорость', onclick: (e) => { G.fast = !G.fast; e.target.textContent = G.fast ? '⏩' : '▶'; } }, G.fast ? '⏩' : '▶'),
      h('button', { class: 'iconbtn', title: 'Звук', onclick: (e) => { e.target.textContent = toggleMute() ? '🔇' : '🔊'; } }, isMuted() ? '🔇' : '🔊')),
    hint, hud);

  const T = (ms) => sleep(G.fast ? ms / 2.2 : ms);

  // ---------- Расстановка ----------
  function layout() {
    const allies = state.allies.filter((a) => !a.minion);
    allies.forEach((a, i) => place(a, 110 + i * 162, 520 + (i % 2) * 26));
    state.allies.filter((a) => a.minion).forEach((a, i) => place(a, 40 + i * 30, 560));
    const en = state.enemies.filter((e) => !e.dead || els.get(e.uid));
    const n = en.length, gap = Math.min(190, 600 / Math.max(1, n));
    en.forEach((e, i) => place(e, 930 + (i - (n - 1) / 2) * gap, 525 + (i % 2) * 18 - (e.tier === 2 ? 10 : 0)));
  }
  function place(u, x, y) {
    const o = els.get(u.uid) ?? create(u);
    o.root.style.left = x + 'px'; o.root.style.top = y + 'px';
    o.x = x; o.y = y;
  }

  function create(u) {
    const [w, hh] = size(u);
    const spr = sprite(spritePath(u));
    spr.style.width = w + 'px'; spr.style.height = hh + 'px';
    const hit = h('div', { class: 'hit', style: { width: w * 0.7 + 'px', height: hh + 'px' } });
    const bar = h('i'), shbar = h('i', { class: 'sh' }), hptxt = h('span');
    const sts = h('div', { class: 'sts' });
    const intent = u.side === 'enemy' ? h('div', { class: 'intent', style: { bottom: hh + 8 + 'px' } }) : null;
    const root = h('div', { class: `unit ${u.side}${u.side === 'enemy' ? '' : ' ally'}${u.minion ? ' flip' : ''}`, style: { '--d': -Math.random() * 2.8 + 's' } },
      h('div', { class: 'shadow', style: { width: w * 0.85 + 'px' } }), h('div', { class: 'ring' }), spr, hit,
      h('div', { class: 'ui' }, h('div', { class: 'nm' }, u.name), h('div', { class: 'bar' }, shbar, bar, hptxt), sts),
      intent);
    field.append(root);
    const o = { root, bar, shbar, hptxt, sts, intent, hit, u, w, h: hh };
    els.set(u.uid, o);
    hit.addEventListener('click', () => onUnitClick(u));
    tooltip(hit, () => unitTip(u));
    setBar(u, u.hp, u.shield, u.maxHp);
    return o;
  }

  function setBar(u, hp, shield, max) {
    const o = els.get(u.uid); if (!o) return;
    o.bar.style.width = Math.max(0, hp / max * 100) + '%';
    const tot = hp + shield;
    o.shbar.style.width = Math.min(100, tot / Math.max(max, tot) * 100) + '%';
    if (shield > 0) o.bar.style.width = (hp / Math.max(max, tot) * 100) + '%';
    o.hptxt.textContent = shield > 0 ? `${hp} (+${shield})` : `${hp}/${max}`;
  }

  function unitTip(u) {
    if (u.side === 'ally') {
      return `<b>${u.name}</b><br>HP ${u.hp}/${u.maxHp} · Атака ${u.atk} · Броня ${u.def + (state.mods.defFlat ?? 0)}%`;
    }
    const e = ENEMIES[u.id];
    const mv = e.moves.map((m) => `• ${m.name}`).join('<br>');
    return `<b>${u.name}</b>${u.tier === 2 ? ' (босс)' : u.tier === 1 ? ' (элита)' : ''}<br>HP ${u.hp}/${u.maxHp} · Атака ${u.atk} · Броня ${u.def}%<div class="sub">${mv}</div>`;
  }

  // ---------- Обновление ----------
  function refresh() {
    for (const u of [...state.allies, ...state.enemies]) {
      const o = els.get(u.uid); if (!o) continue;
      o.root.classList.toggle('dead', u.dead);
      o.root.classList.toggle('acted', u.side === 'ally' && u.acted && !u.dead);
      o.root.classList.toggle('sel', selected === u);
      setBar(u, u.hp, u.shield, u.maxHp);
      o.sts.replaceChildren(...Object.entries(u.st).map(([id, s]) => {
        const info = STATUSES[id];
        const el = h('div', { class: 's' }, img(`assets/svg/icons/status/${info.icon}.svg`), h('b', {}, s.t));
        tooltip(el, `<b>${info.name}</b> (${s.t} х.)${s.v && ['poison', 'burn', 'bleed', 'regen'].includes(id) ? ` · ${s.v}/ход` : ''}<br><span class="sub">${info.desc}</span>`);
        return el;
      }));
      if (o.intent) {
        if (u.dead) o.intent.style.display = 'none';
        else {
          const it = B.intentInfo(u);
          o.intent.style.display = it.kind === 'none' ? 'none' : '';
          o.intent.className = 'intent ' + it.kind;
          o.intent.textContent = (INTENT_ICON[it.kind] ?? '') + (it.value ? ` ${it.value}${it.hits > 1 ? '×' + it.hits : ''}${it.aoe ? ' все' : ''}` : '');
          o.intent.onmouseenter = () => { const t = document.getElementById('tip'); t.innerHTML = `<b>${it.label}</b>`; t.hidden = false; };
          o.intent.onmousemove = (e) => { const t = document.getElementById('tip'); t.style.left = e.clientX + 14 + 'px'; t.style.top = e.clientY + 14 + 'px'; };
          o.intent.onmouseleave = () => { document.getElementById('tip').hidden = true; };
        }
      }
    }
    roundChip.textContent = `Раунд ${state.round}`;
    renderHud();
  }

  function renderHud() {
    const sel = selected && !selected.dead && !selected.acted ? selected : null;
    const rageFull = state.rage >= 50;
    const rage = h('div', { class: 'ragebox' }, h('div', { class: 'heroline' }, 'Ярость'),
      h('div', { class: 'ragebar' + (rageFull ? ' full' : '') }, h('i', { style: { width: state.rage + '%' } }), h('span', {}, `${Math.floor(state.rage)}/100`)));
    const skills = h('div', { class: 'skills' });
    if (sel && !busy) {
      sel.skills.forEach((sid, idx) => {
        const sk = SKILLS[sid];
        const can = B.canUse(state, sel, sid);
        const lv = sel.skillLv[sid] ?? 0;
        const b = h('button', { class: 'skill' + (sk.cost ? ' ult' : '') + (targeting?.sid === sid ? ' on' : ''), disabled: !can.ok, onclick: () => pickSkill(sid) },
          img(`assets/svg/icons/skills/${sk.icon}.svg`), h('div', { class: 'sn' }, sk.name + (lv ? ' ' + '★'.repeat(lv) : '')),
          sk.cost ? h('div', { class: 'cost' }, sk.cost) : null,
          sel.cd[sid] > 0 ? h('div', { class: 'cdv' }, sel.cd[sid]) : null);
        b.dataset.idx = idx + 1;
        tooltip(b, () => skillTip(sel, sid, can));
        skills.append(b);
      });
    } else {
      skills.append(h('div', { class: 'heroline dim', style: { alignSelf: 'center' } }, busy ? '' : 'Выберите героя'));
    }
    const end = h('button', { class: 'btn gold', disabled: busy || !!state.result, onclick: () => endTurn() }, 'Конец хода');
    hud.replaceChildren(rage, skills, end);
    hint.textContent = targeting ? 'Выберите цель (Esc — отмена)' : '';
  }

  function skillTip(u, sid, can) {
    const sk = SKILLS[sid], lv = u.skillLv[sid] ?? 0;
    const k = 1 + 0.2 * lv, m = state.mods;
    const parts = [];
    for (const f of sk.fx) {
      if (f.t === 'dmg') parts.push(`Урон ≈ ${Math.round(u.atk * f.m * k * (1 + (m.dmgPct ?? 0) / 100))}${f.hits > 1 ? '×' + f.hits : ''}${f.lifesteal ? `, вампиризм ${f.lifesteal * 100}%` : ''}${f.vsStatus ? `, ×${f.mult} по кровоточащим` : ''}${f.executeBelow ? `, ×${f.mult} добивание (<${f.executeBelow * 100}% HP)` : ''}${f.vsElite ? ', +25% по элитам' : ''}`);
      else if (f.t === 'heal') parts.push(`Лечение ≈ ${Math.round(u.atk * f.m * k * (1 + (m.healPct ?? 0) / 100))}${f.to === 'friends' ? ' всем' : f.to === 'self' ? ' себе' : ''}`);
      else if (f.t === 'shield') parts.push(`Щит ≈ ${Math.round(u.atk * f.m * k * (1 + (m.shieldPct ?? 0) / 100))}`);
      else if (f.t === 'status') { const s = STATUSES[f.id]; parts.push(`${s.name} на ${f.turns} х.${f.v && s.kind === 'dot' ? ` (≈${Math.round(u.atk * f.v)}/ход)` : ''}`); }
      else if (f.t === 'cleanse') parts.push('Снимает дебаффы');
      else if (f.t === 'rage') parts.push(`+${f.v} ярости`);
      else if (f.t === 'selfDmg') parts.push(`Теряет ${f.pct * 100}% HP`);
      else if (f.t === 'summonAlly') parts.push('Призывает скелета-помощника');
      else if (f.t === 'revive') parts.push(`Воскрешает павших (${f.m * 100}% HP)`);
    }
    const tg = { foe: 'Цель: враг', foes: 'Все враги', foeRand: 'Случайные враги', friend: 'Цель: союзник', friends: 'Все союзники', self: 'На себя' }[sk.tgt];
    return `<b>${sk.name}</b>${lv ? ` ★${lv}` : ''}<br>${parts.join('<br>')}<div class="sub">${tg} · ${sk.cost ? `Ярость ${sk.cost}` : sk.cd ? `Перезарядка ${sk.cd}` : 'Без перезарядки'}${can.ok ? '' : ` · ${can.why}`}</div>`;
  }

  // ---------- Ввод ----------
  function pickSkill(sid) {
    if (busy || state.result) return;
    sfx.click();
    const u = selected, sk = SKILLS[sid];
    if (targeting?.sid === sid) { cancelTarget(); return; }
    if (sk.tgt === 'foe' || sk.tgt === 'friend') {
      const list = sk.tgt === 'foe' ? B.alive(state.enemies) : B.alive(state.allies);
      if (sk.tgt === 'foe' && list.length === 1) { cast(u, sid, list[0]); return; }
      targeting = { sid, kind: sk.tgt };
      for (const x of list) els.get(x.uid)?.root.classList.add('target-ok');
      renderHud();
    } else cast(u, sid, null);
  }
  function cancelTarget() {
    targeting = null;
    for (const o of els.values()) o.root.classList.remove('target-ok');
    renderHud();
  }
  function onUnitClick(u) {
    if (busy || state.result) return;
    if (targeting) {
      const ok = targeting.kind === 'foe' ? u.side === 'enemy' && !u.dead : u.side === 'ally' && !u.dead;
      if (ok) { const sid = targeting.sid; const s = selected; cancelTarget(); cast(s, sid, u); }
      else cancelTarget();
      return;
    }
    if (u.side === 'ally' && !u.dead && !u.acted && !u.minion) { selected = u; sfx.click(); refresh(); }
  }

  async function cast(u, sid, target) {
    busy = true; renderHud();
    const ev = B.useSkill(state, u, sid, target);
    await play(ev);
    afterAction();
  }

  function nextHero() {
    return state.allies.find((a) => !a.dead && !a.acted && !a.minion);
  }

  async function afterAction() {
    if (state.result) return finish();
    selected = nextHero() ?? null;
    busy = false;
    refresh();
    if (!selected) { await T(350); endTurn(); }
  }

  async function endTurn() {
    if (busy && !state.allies.every((a) => a.dead || a.acted)) return;
    if (state.result) return;
    busy = true; cancelTarget(); refresh();
    for (let g = 0; g < 6; g++) {
      const ev = B.endPlayerPhase(state);
      await play(ev);
      if (state.result) return finish();
      if (nextHero()) break; // есть кому ходить
    }
    selected = nextHero() ?? null;
    busy = false;
    refresh();
  }

  // ---------- Проигрывание событий ----------
  function floatAt(u, text, cls, dy = 0) {
    const o = els.get(u.uid); if (!o) return;
    const n = h('div', { class: 'float ' + cls }, text);
    n.style.left = o.x + (Math.random() * 30 - 15) + 'px';
    n.style.top = (o.y - o.h * 0.7 + dy) + 'px';
    field.append(n);
    setTimeout(() => n.remove(), 1200);
  }
  const byUid = (uid) => [...state.allies, ...state.enemies].find((u) => u.uid === uid);
  function anim(u, cls, ms) {
    const o = els.get(u.uid); if (!o) return;
    o.root.classList.remove(cls); void o.root.offsetWidth; o.root.classList.add(cls);
    setTimeout(() => o.root.classList.remove(cls), ms);
  }
  function banner(text, red) {
    const b = h('div', { class: 'banner' + (red ? ' red' : '') }, text);
    screen.append(b);
    setTimeout(() => b.remove(), 1400);
  }

  async function play(events) {
    for (const e of events) {
      switch (e.t) {
        case 'phase':
          if (e.side === 'enemy') { banner('ХОД ВРАГОВ', true); await T(650); }
          else if (e.round > 1) { banner(`РАУНД ${e.round}`); await T(500); }
          break;
        case 'act': {
          const u = byUid(e.src); if (!u) break;
          const sk = e.skill ? SKILLS[e.skill] : null;
          const o = els.get(u.uid);
          if (o) {
            const n = h('div', { class: 'skillname' }, e.name);
            n.style.left = o.x + 'px'; n.style.top = (o.y - o.h - 6) + 'px'; field.append(n); setTimeout(() => n.remove(), 1200);
          }
          if (e.melee) anim(u, u.side === 'ally' ? 'lunge-r' : 'lunge-l', 460); else anim(u, 'cast', 520);
          if (sk?.cost) sfx.ult(); else if (!e.melee) sfx.magic();
          await T(e.melee ? 260 : 300);
          break;
        }
        case 'hit': {
          const u = byUid(e.tgt); if (!u) break;
          setBar(u, e.hp, e.shield, e.max);
          if (e.dot) floatAt(u, `${e.n}`, e.dot === 'thorns' ? 'dmg' : 'dot');
          else floatAt(u, e.hpLost === 0 && e.absorbed ? `🛡 ${e.n}` : `${e.n}${e.crit ? '!' : ''}`, e.crit ? 'crit' : 'dmg');
          anim(u, 'hurt', 360);
          e.crit ? sfx.crit() : sfx.hit();
          await T(e.dot ? 170 : 230);
          break;
        }
        case 'heal': { const u = byUid(e.tgt); if (!u) break; setBar(u, e.hp, e.shield, e.max); floatAt(u, `+${e.n}`, 'heal'); sfx.heal(); await T(150); break; }
        case 'shield': { const u = byUid(e.tgt); if (!u) break; setBar(u, e.hp, e.shield, e.max); floatAt(u, `+${e.n}`, 'shield'); sfx.shield(); await T(120); break; }
        case 'status': { const u = byUid(e.tgt); if (!u) break; floatAt(u, STATUSES[e.id].name, 'msg', -22); sfx.status(); refresh(); await T(130); break; }
        case 'cleanse': { const u = byUid(e.tgt); if (u) floatAt(u, 'Очищено', 'heal'); refresh(); break; }
        case 'miss': { const u = byUid(e.tgt); if (u) floatAt(u, 'Мимо!', 'msg'); break; }
        case 'skip': { const u = byUid(e.tgt); if (u) floatAt(u, e.why === 'freeze' ? 'Заморожен' : 'Оглушён', 'msg'); await T(250); break; }
        case 'death': { const u = byUid(e.tgt); if (!u) break; els.get(u.uid)?.root.classList.add('dead'); sfx.death(); await T(260); break; }
        case 'summon': { layout(); refresh(); await T(300); break; }
        case 'revive': { const u = byUid(e.tgt); if (!u) break; els.get(u.uid)?.root.classList.remove('dead'); setBar(u, e.hp, e.shield, e.max); floatAt(u, 'Воскрес!', 'heal'); sfx.heal(); await T(260); break; }
        case 'rage': renderHud(); break;
        case 'msg': banner(e.text); await T(600); break;
        default: break;
      }
    }
    refresh();
  }

  async function finish() {
    refresh();
    busy = true; renderHud();
    await T(500);
    if (state.result === 'win') { sfx.win(); banner('ПОБЕДА!'); }
    else { sfx.lose(); banner('ПОРАЖЕНИЕ', true); }
    await T(1500);
    window.removeEventListener('keydown', onKey);
    done(state);
  }

  function onKey(e) {
    if (e.key === 'Escape') cancelTarget();
    else if (e.key === ' ') { e.preventDefault(); if (!busy) endTurn(); }
    else if (/^[1-5]$/.test(e.key) && !busy && selected) { const sid = selected.skills[+e.key - 1]; if (sid && B.canUse(state, selected, sid).ok) pickSkill(sid); }
    else if (e.key === 'Tab' && !busy) {
      e.preventDefault();
      const list = state.allies.filter((a) => !a.dead && !a.acted && !a.minion);
      if (list.length) { selected = list[(list.indexOf(selected) + 1) % list.length]; refresh(); }
    }
  }
  window.addEventListener('keydown', onKey);
  screen.addEventListener('contextmenu', (e) => { e.preventDefault(); cancelTarget(); });

  // ---------- Старт ----------
  G.show(screen);
  layout();
  const ev0 = B.startBattle(state);
  refresh();
  (async () => {
    banner(info.type === 'boss' ? 'БОСС!' : info.type === 'elite' ? 'ЭЛИТА!' : 'БОЙ!', info.type !== 'battle');
    await T(900);
    await play(ev0);
    selected = nextHero() ?? null;
    busy = false;
    refresh();
    if (!selected) endTurn();
  })();
  return screen;
}
