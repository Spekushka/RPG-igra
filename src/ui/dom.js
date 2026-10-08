// Мини-хелперы DOM и загрузка SVG-ассетов.
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

const dataUris = new Map();
export function assetUrl(path) {
  const b = globalThis.__SVG;
  if (!b) return path;
  if (!dataUris.has(path)) dataUris.set(path, 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(b[path] ?? ''));
  return dataUris.get(path);
}

const textCache = new Map();
export async function svgText(path) {
  if (globalThis.__SVG) return globalThis.__SVG[path] ?? '';
  if (!textCache.has(path)) textCache.set(path, fetch(path).then((r) => (r.ok ? r.text() : '')).catch(() => ''));
  return textCache.get(path);
}

export function img(path, cls = '', alt = '') {
  const i = h('img', { class: cls, src: assetUrl(path), alt, draggable: 'false' });
  i.onerror = () => { i.style.visibility = 'hidden'; };
  return i;
}

// Инлайн-SVG (для анимируемых спрайтов). Возвращает элемент-контейнер сразу, содержимое подгружается.
export function sprite(path, cls = '') {
  const box = h('div', { class: 'sprite ' + cls });
  svgText(path).then((t) => { box.innerHTML = t; const s = box.querySelector('svg'); if (s) { s.removeAttribute('width'); s.removeAttribute('height'); } });
  return box;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Всплывающая подсказка: наведение мышью или долгое нажатие на телефоне
const tip = () => document.getElementById('tip');
function placeTip(x, y, above) {
  const t = tip();
  const w = t.offsetWidth, hh = t.offsetHeight;
  t.classList.toggle('rot', view.rot);
  if (view.rot) { // сцена повёрнута: подсказку тоже кладём на бок («вверх» сцены = вправо на экране)
    const left = above ? x + 26 + hh : x - 14;
    t.style.left = Math.max(hh + 6, Math.min(window.innerWidth - 6, left)) + 'px';
    t.style.top = Math.max(6, Math.min(window.innerHeight - w - 6, y - (above ? w / 2 : 0))) + 'px';
    return;
  }
  const top = above ? y - hh - 26 : y + 14;
  t.style.left = Math.max(6, Math.min(window.innerWidth - w - 6, above ? x - w / 2 : x + 14)) + 'px';
  t.style.top = Math.max(6, Math.min(window.innerHeight - hh - 6, top)) + 'px';
}
let tipTimer = 0;
export function tooltip(el, getHtml) {
  const html = () => (typeof getHtml === 'function' ? getHtml() : getHtml);
  el.addEventListener('mouseenter', () => { if (globalThis.__touching) return; const t = tip(); t.innerHTML = html(); t.hidden = false; });
  el.addEventListener('mousemove', (e) => { if (!globalThis.__touching && !tip().hidden) placeTip(e.clientX, e.clientY, false); });
  el.addEventListener('mouseleave', () => { if (!globalThis.__touching) tip().hidden = true; });
  el.addEventListener('click', (e) => {
    if (el.__lp) { el.__lp = false; e.stopImmediatePropagation(); e.preventDefault(); return; }
    tip().hidden = true;
  }, true);
  let timer = 0, sx = 0, sy = 0;
  el.addEventListener('touchstart', (e) => {
    const t0 = e.touches[0]; sx = t0.clientX; sy = t0.clientY;
    clearTimeout(timer);
    timer = setTimeout(() => {
      el.__lp = true;
      const t = tip(); t.innerHTML = html(); t.hidden = false; placeTip(sx, sy, true);
      clearTimeout(tipTimer);
    }, 380);
  }, { passive: true });
  const end = () => {
    clearTimeout(timer);
    if (el.__lp) { clearTimeout(tipTimer); tipTimer = setTimeout(() => { tip().hidden = true; }, 2200); setTimeout(() => { el.__lp = false; }, 400); }
  };
  el.addEventListener('touchend', end, { passive: true });
  el.addEventListener('touchcancel', end, { passive: true });
  el.addEventListener('touchmove', (e) => { const t0 = e.touches[0]; if (Math.hypot(t0.clientX - sx, t0.clientY - sy) > 12) clearTimeout(timer); }, { passive: true });
}

// Масштаб сцены 1280×720. В портретной ориентации сцена поворачивается на бок.
export const view = { rot: false, k: 1 };
export function fitStage() {
  const s = document.getElementById('stage');
  const w = window.innerWidth, hh = window.innerHeight;
  view.rot = hh > w * 1.1;
  view.k = view.rot ? Math.min(hh / 1280, w / 720) : Math.min(w / 1280, hh / 720);
  s.style.transform = `translate(-50%,-50%)${view.rot ? ' rotate(90deg)' : ''} scale(${view.k})`;
  const touch = globalThis.__touching || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
  s.classList.toggle('touch', !!touch);
}

// Тач: ручная прокрутка списков (нативная ломается в повёрнутой сцене), блок зума.
export function installTouch(stage) {
  window.addEventListener('touchstart', () => { if (!globalThis.__touching) { globalThis.__touching = true; fitStage(); } }, { passive: true, capture: true });
  let sc = null, lx = 0, ly = 0, total = 0, vel = 0, raf = 0;
  stage.addEventListener('touchstart', (e) => {
    cancelAnimationFrame(raf);
    sc = e.target.closest?.('.scroll, .modal .box') ?? null;
    const t = e.touches[0]; lx = t.clientX; ly = t.clientY; total = 0; vel = 0;
  }, { passive: true });
  stage.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) { e.preventDefault(); return; }
    if (!sc) return;
    const t = e.touches[0];
    const d = (view.rot ? -(t.clientX - lx) : (t.clientY - ly)) / view.k;
    lx = t.clientX; ly = t.clientY; total += Math.abs(d);
    sc.scrollTop -= d; vel = d;
    if (total > 6) e.preventDefault();
  }, { passive: false });
  const end = () => {
    if (total > 8) {
      const blocker = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      window.addEventListener('click', blocker, true);
      setTimeout(() => window.removeEventListener('click', blocker, true), 60);
      const el = sc; let v = vel;
      const step = () => { if (!el || Math.abs(v) < 0.4) return; el.scrollTop -= v; v *= 0.93; raf = requestAnimationFrame(step); };
      step();
    }
    sc = null;
  };
  stage.addEventListener('touchend', end, { passive: true });
  stage.addEventListener('touchcancel', end, { passive: true });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => { if (globalThis.__touching) e.preventDefault(); });
}

export function goFullscreen() {
  try {
    const d = document.documentElement;
    (d.requestFullscreen?.() ?? d.webkitRequestFullscreen?.())?.then?.(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
  } catch {}
}
