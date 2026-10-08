import { h, img, tooltip } from './dom.js';
import { ITEMS, RARITY, SLOTS, itemStats, fmtStat } from '../data/items.js';
import { HEROES } from '../data/heroes.js';
import { RELICS } from '../data/relics.js';
import { TALENTS } from '../data/talents.js';

export const itemIconPath = (id) => `assets/svg/icons/items/${id}.svg`;

// Иконка предмета в рамке цвета редкости
export function itemBox(it, size = 56) {
  const R = RARITY[it.r];
  const box = h('div', { class: 'itembox', style: { width: size + 'px', height: size + 'px', borderColor: R.color, boxShadow: it.r >= 3 ? `0 0 ${it.r * 4}px ${R.color}99` : 'none' } }, img(itemIconPath(it.id)));
  tooltip(box, () => itemTip(it));
  return box;
}

export function itemTip(it) {
  const def = ITEMS[it.id], R = RARITY[it.r];
  const st = itemStats(it);
  return `<b style="color:${R.color}">${def.name}</b><div class="sub">${R.name} · ${SLOTS[def.slot]}</div>${Object.entries(st).map(([k, v]) => `<div>${fmtStat(k, v)}</div>`).join('')}`;
}

export const itemName = (it) => ITEMS[it.id].name;
export const rarityColor = (r) => RARITY[r].color;

export function talentTip(key, n = 1) {
  const t = TALENTS[key];
  return `<b>${t.name}${n > 1 ? ' ×' + n : ''}</b><br>${t.desc}`;
}

// Три слота героя (мини-ряд)
export function slotRow(hero, size = 30) {
  return h('div', { class: 'slotrow' }, Object.keys(SLOTS).map((s) => {
    const it = hero.items[s];
    if (it) return itemBox(it, size);
    const e = h('div', { class: 'itembox empty', style: { width: size + 'px', height: size + 'px' } }, '');
    tooltip(e, `<span class="sub">${SLOTS[s]}: пусто</span>`);
    return e;
  }));
}

// Описание приза (колесо / мини-игры / лавка)
export function prizeView(run, p) {
  const heroName = (id) => HEROES[id].name;
  if (p.t === 'item') {
    const R = RARITY[p.it.r];
    let msg;
    if (p.equipped) msg = p.replaced ? `${heroName(p.hero)} меняет «${itemName(p.replaced)}» на новый предмет` : `${heroName(p.hero)} экипирует предмет`;
    else msg = `У ${heroName(p.hero)} уже есть лучше — предмет продан за ${p.gold} золота`;
    return h('div', { class: 'prize' }, itemBox(p.it, 84), h('div', { class: 'ptxt' }, h('div', { class: 'pn', style: { color: R.color } }, `${itemName(p.it)}`), h('div', { class: 'dim' }, `${R.name} · ${SLOTS[ITEMS[p.it.id].slot]}`),
      ...Object.entries(itemStats(p.it)).map(([k, v]) => h('div', {}, fmtStat(k, v))), h('div', { class: 'gold', style: { marginTop: '4px' } }, msg)));
  }
  if (p.t === 'gold') return h('div', { class: 'prize' }, img('assets/svg/ui/coin.svg', 'pico'), h('div', { class: 'ptxt' }, h('div', { class: 'pn gold' }, `+${p.n} золота`)));
  if (p.t === 'heal') return h('div', { class: 'prize' }, img('assets/svg/icons/skills/heal.svg', 'pico'), h('div', { class: 'ptxt' }, h('div', { class: 'pn', style: { color: 'var(--green)' } }, 'Отряд исцелён на 35%')));
  if (p.t === 'xp') return h('div', { class: 'prize' }, img('assets/svg/icons/relics/soul_lantern.svg', 'pico'), h('div', { class: 'ptxt' }, h('div', { class: 'pn', style: { color: 'var(--blue)' } }, '+3 опыта всему отряду'), p.ups?.length ? h('div', { class: 'gold' }, 'Новый уровень!') : null));
  if (p.t === 'relic') return h('div', { class: 'prize' }, img(`assets/svg/icons/relics/${p.id}.svg`, 'pico'), h('div', { class: 'ptxt' }, h('div', { class: 'pn', style: { color: 'var(--orange)' } }, RELICS[p.id].name), h('div', { class: 'dim' }, RELICS[p.id].desc)));
  return h('div');
}
