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

// Всплывающая подсказка
const tip = () => document.getElementById('tip');
export function tooltip(el, getHtml) {
  el.addEventListener('mouseenter', () => { const t = tip(); t.innerHTML = typeof getHtml === 'function' ? getHtml() : getHtml; t.hidden = false; });
  el.addEventListener('mousemove', (e) => {
    const t = tip();
    const w = t.offsetWidth, hh = t.offsetHeight;
    t.style.left = Math.min(window.innerWidth - w - 8, e.clientX + 14) + 'px';
    t.style.top = Math.min(window.innerHeight - hh - 8, e.clientY + 14) + 'px';
  });
  el.addEventListener('mouseleave', () => { tip().hidden = true; });
  el.addEventListener('click', () => { tip().hidden = true; });
}

export function fitStage() {
  const s = document.getElementById('stage');
  const k = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  s.style.transform = `translate(-50%,-50%) scale(${k})`;
}
