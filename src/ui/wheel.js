import { h, img, assetUrl, sleep } from './dom.js';
import { sfx } from './sfx.js';
import * as R from '../engine/run.js';
import { RARITY } from '../data/items.js';
import { prizeView } from './widgets.js';

const NS = 'http://www.w3.org/2000/svg';
const COLORS = { gold: '#d9a526', heal: '#2f9e60', xp: '#3d6fd1', relic: '#d9642a' };
const wedgeColor = (w) => (w.t === 'item' ? RARITY[w.r].color : COLORS[w.t]);
const wedgeIcon = (w) => ({ item: 'assets/svg/icons/map/treasure.svg', gold: 'assets/svg/ui/coin.svg', heal: 'assets/svg/icons/skills/heal.svg', xp: 'assets/svg/icons/relics/soul_lantern.svg', relic: 'assets/svg/icons/relics/ancient_key.svg' }[w.t]);

function svgEl(tag, attrs = {}) { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; }

function buildWheel() {
  const wedges = R.wedgeList();
  const n = wedges.length, step = 360 / n, r = 210;
  const svg = svgEl('svg', { viewBox: '-230 -230 460 460', class: 'wheelsvg' });
  const g = svgEl('g', { class: 'wheelrot' });
  wedges.forEach((w, i) => {
    const a0 = (i * step - 90) * Math.PI / 180, a1 = ((i + 1) * step - 90) * Math.PI / 180;
    const p = svgEl('path', { d: `M0 0 L${r * Math.cos(a0)} ${r * Math.sin(a0)} A${r} ${r} 0 0 1 ${r * Math.cos(a1)} ${r * Math.sin(a1)} Z`, fill: wedgeColor(w), stroke: '#14101c', 'stroke-width': 4 });
    p.style.opacity = i % 2 ? 0.88 : 1;
    g.append(p);
    const mid = ((i + 0.5) * step - 90) * Math.PI / 180, rr = r * 0.68;
    const im = svgEl('image', { href: assetUrl(wedgeIcon(w)), x: rr * Math.cos(mid) - 22, y: rr * Math.sin(mid) - 22, width: 44, height: 44, transform: `rotate(${(i + 0.5) * step} ${rr * Math.cos(mid)} ${rr * Math.sin(mid)})` });
    g.append(im);
    if (w.t === 'item') {
      const t = svgEl('text', { x: (r * 0.9) * Math.cos(mid), y: (r * 0.9) * Math.sin(mid), 'text-anchor': 'middle', 'dominant-baseline': 'middle', fill: '#14101c', 'font-size': 15, 'font-weight': 900, transform: `rotate(${(i + 0.5) * step} ${(r * 0.9) * Math.cos(mid)} ${(r * 0.9) * Math.sin(mid)})` });
      t.textContent = '★'.repeat(w.r);
      g.append(t);
    }
  });
  g.append(svgEl('circle', { r: r, fill: 'none', stroke: '#f2c94c', 'stroke-width': 8 }));
  g.append(svgEl('circle', { r: 34, fill: '#1b1528', stroke: '#f2c94c', 'stroke-width': 6 }));
  svg.append(g);
  svg.append(svgEl('path', { d: 'M-18 -232 L18 -232 L0 -190 Z', fill: '#ff4a3a', stroke: '#14101c', 'stroke-width': 4 }));
  return { svg, g, step };
}

export function mountWheel(G, kind, next) {
  const run = G.run;
  const { svg, g, step } = buildWheel();
  let rot = 0, busy = false, last = null;
  const title = h('h1', { class: 'title', style: { fontSize: '40px' } }, 'Колесо фортуны');
  const sub = h('div', { class: 'dim', style: { fontSize: '18px' } }, kind === 'boss' ? 'Награда за босса — шансы на редкое повышены!' : kind === 'elite' ? 'Награда за элиту: шансы на редкое выше' : 'Крутите колесо — предмет достанется случайному герою');
  const out = h('div', { class: 'wheelout' });
  const btns = h('div', { class: 'wheelbtns' });
  const wheelBox = h('div', { class: 'wheelbox' }, svg);

  function showSpin() {
    btns.replaceChildren(h('button', { class: 'btn gold', onclick: spin }, 'Крутить!'));
  }
  async function spin() {
    if (busy) return;
    busy = true; sfx.click();
    btns.replaceChildren();
    last = R.spinWheel(run, kind);
    const target = 360 * 6 - (last.index * step + step / 2) + (Math.random() * 20 - 10);
    rot = Math.ceil(rot / 360) * 360 + target;
    g.style.transition = 'transform 4.4s cubic-bezier(.1,.62,.12,1)';
    g.style.transform = `rotate(${rot}deg)`;
    // тики
    const t0 = performance.now();
    (function tick() { const el = performance.now() - t0; if (el < 4300) { if (Math.floor(el / (80 + el / 18)) !== Math.floor((el - 40) / (80 + el / 18))) sfx.click(); requestAnimationFrame(tick); } })();
    await sleep(4600);
    busy = false;
    landed();
  }
  function landed() {
    const w = last.wedge;
    sfx.win();
    const labels = { item: `Предмет: ${RARITY[w.r ?? 1]?.name ?? ''}`, gold: 'Золото', heal: 'Исцеление', xp: 'Опыт', relic: 'Реликвия' };
    out.replaceChildren(h('div', { class: 'landed', style: { color: wedgeColor(w) } }, labels[w.t]));
    btns.replaceChildren(
      h('button', { class: 'btn gold', onclick: take }, 'Забрать'),
      run.respins > 0 ? h('button', { class: 'btn alt', onclick: () => { run.respins--; out.replaceChildren(); spin(); } }, `Крутить ещё (${run.respins})`) : null);
  }
  function take() {
    sfx.buy();
    const prize = R.applyPrize(run, last.wedge);
    G.save?.();
    out.replaceChildren(prizeView(run, prize));
    btns.replaceChildren(h('button', { class: 'btn', onclick: () => next() }, 'Дальше'));
  }

  const screen = h('div', { class: 'screen wheelscreen' }, img('assets/svg/bg/camp.svg', 'bg'), h('div', { class: 'shade' }),
    h('div', { class: 'center', style: { gap: '8px', background: '#0009' } }, title, sub, h('div', { class: 'wheelrow' }, wheelBox, h('div', { class: 'wheelside' }, out, btns))));
  G.show(screen);
  showSpin();
}
