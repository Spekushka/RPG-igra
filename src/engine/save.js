// Экспорт и импорт прогресса: строка «PEPEL1:<base64>» с метапрогрессом, текущим забегом и настройками.
import { HEROES } from '../data/heroes.js';
import { ENEMIES } from '../data/enemies.js';
import { RELICS } from '../data/relics.js';
import { ITEMS } from '../data/items.js';
import { FORGE, ACHIEVEMENTS, defaultMeta } from './meta.js';
import { RUN_VERSION } from './run.js';

const PREFIX = 'PEPEL1:';

const toB64 = (s) => { const b = new TextEncoder().encode(s); let bin = ''; for (const x of b) bin += String.fromCharCode(x); return btoa(bin); };
const fromB64 = (s) => { const bin = atob(s); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return new TextDecoder().decode(b); };
const checksum = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };

export function exportSave(meta, run, settings = {}) {
  const payload = JSON.stringify({ app: 'pepelny-otryad', t: Date.now(), meta, run: run ?? null, settings });
  return PREFIX + checksum(payload) + ':' + toB64(payload);
}

const num = (v, lo, hi, d = 0) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, Math.floor(+v))) : d);

// Приводит метапрогресс к допустимому виду (защита от битых и поддельных данных)
export function sanitizeMeta(m) {
  const d = defaultMeta();
  const out = { ...d };
  out.ash = num(m.ash, 0, 1e9); out.totalAsh = num(m.totalAsh, 0, 1e10);
  out.wins = num(m.wins, 0, 1e6); out.runs = num(m.runs, 0, 1e6); out.kills = num(m.kills, 0, 1e7); out.elites = num(m.elites, 0, 1e6);
  out.ascUnlocked = num(m.ascUnlocked, 0, 10); out.bestFloor = num(m.bestFloor, 0, 1e4); out.endlessBest = num(m.endlessBest, 0, 1e4);
  out.unlocked = Array.from(new Set([...d.unlocked, ...(Array.isArray(m.unlocked) ? m.unlocked : []).filter((id) => HEROES[id])]));
  out.forge = {};
  for (const [k, v] of Object.entries(m.forge ?? {})) if (FORGE[k]) out.forge[k] = num(v, 0, FORGE[k].max);
  out.bestiary = {}; for (const [k, v] of Object.entries(m.bestiary ?? {})) if (ENEMIES[k]) out.bestiary[k] = num(v, 0, 1e6);
  out.relicsSeen = {}; for (const k of Object.keys(m.relicsSeen ?? {})) if (RELICS[k]) out.relicsSeen[k] = 1;
  out.ach = {}; for (const [k, v] of Object.entries(m.ach ?? {})) if (ACHIEVEMENTS[k]) out.ach[k] = num(v, 0, 1e15);
  return out;
}

function sanitizeRun(r) {
  if (!r || r.v !== RUN_VERSION || !Array.isArray(r.heroes) || !r.heroes.length || r.heroes.length > 4) return null;
  if (!r.heroes.every((h) => HEROES[h.id] && Number.isFinite(h.lvl) && h.items && h.talents)) return null;
  if (!Array.isArray(r.map) || !Array.isArray(r.relics) || !r.relics.every((id) => RELICS[id])) return null;
  if (!Array.isArray(r.bag) || !r.bag.every((it) => ITEMS[it?.id] && it.r >= 1 && it.r <= 4)) return null;
  return r;
}

// → { meta, run, settings, t } или бросает Error с понятным текстом
export function importSave(text) {
  const s = (text ?? '').trim().replace(/\s+/g, '');
  if (!s.startsWith(PREFIX)) throw new Error('Это не код сохранения «Пепельного Отряда».');
  const rest = s.slice(PREFIX.length), i = rest.indexOf(':');
  if (i < 0) throw new Error('Код сохранения повреждён.');
  let payload;
  try { payload = fromB64(rest.slice(i + 1)); } catch { throw new Error('Код сохранения повреждён (не читается).'); }
  if (checksum(payload) !== rest.slice(0, i)) throw new Error('Код сохранения повреждён (не сходится контрольная сумма). Скопируйте его целиком.');
  let data;
  try { data = JSON.parse(payload); } catch { throw new Error('Код сохранения повреждён.'); }
  if (data.app !== 'pepelny-otryad' || typeof data.meta !== 'object') throw new Error('Неизвестный формат сохранения.');
  return { meta: sanitizeMeta(data.meta), run: sanitizeRun(data.run), settings: data.settings ?? {}, t: data.t };
}
