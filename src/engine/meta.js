// Мета-прогресс: пепел, кузня, разблокировки, достижения, бестиарий. Хранится в localStorage.
import { HEROES } from '../data/heroes.js';

export const FORGE = {
  hp: { name: 'Закалка', desc: '+4% здоровья героев за уровень', max: 10, cost: (l) => 25 + 20 * l, mod: (l) => ({ hpPct: 4 * l }) },
  dmg: { name: 'Остриё', desc: '+3% урона за уровень', max: 10, cost: (l) => 30 + 25 * l, mod: (l) => ({ dmgPct: 3 * l }) },
  rage: { name: 'Боевой дух', desc: '+8 стартовой ярости за уровень', max: 5, cost: (l) => 30 + 30 * l, mod: (l) => ({ startRage: 8 * l }) },
  gold: { name: 'Кошелёк', desc: '+8% золота за уровень', max: 5, cost: (l) => 25 + 25 * l, mod: (l) => ({ goldPct: 8 * l }) },
  camp: { name: 'Тёплый костёр', desc: '+8% лечения на привалах', max: 5, cost: (l) => 25 + 25 * l, mod: (l) => ({ campHeal: 8 * l }) },
  shield: { name: 'Заговор', desc: '+4% стартового щита за уровень', max: 5, cost: (l) => 35 + 30 * l, mod: (l) => ({ startShield: 4 * l }) },
  xp: { name: 'Мудрость', desc: '+10% опыта за уровень', max: 5, cost: (l) => 30 + 25 * l, mod: (l) => ({ xpPct: 10 * l }) },
  relic: { name: 'Наследие', desc: 'Старт забега с реликвиями (1 за уровень)', max: 3, cost: (l) => 90 + 110 * l, mod: () => ({}) },
  luck: { name: 'Удача фортуны', desc: 'Колесо чаще выпадает на редкие предметы (+18% за уровень)', max: 5, cost: (l) => 40 + 35 * l, mod: () => ({}) },
  respin: { name: 'Вторая попытка', desc: '+1 повторная прокрутка колеса за забег', max: 3, cost: (l) => 60 + 60 * l, mod: () => ({}) },
  startparty: { name: 'Закалённый вожак', desc: 'Начинать забег с двумя героями', max: 1, cost: () => 220, mod: () => ({}) },
  startitem: { name: 'Запасливость', desc: 'Старт забега с обычным предметом (1 за уровень)', max: 3, cost: (l) => 70 + 70 * l, mod: () => ({}) },
  scout: { name: 'Разведчики', desc: 'Вербовка: на выбор на одного героя больше', max: 1, cost: () => 150, mod: () => ({}) },
  revive: { name: 'Последний шанс', desc: 'Один раз за забег отряд воскресает', max: 1, cost: () => 350, mod: (l) => (l ? { reviveOnce: 1 } : {}) },
};

export const ACHIEVEMENTS = {
  first_win: { name: 'Рассвет', desc: 'Победить Бога Пепла.' },
  act1: { name: 'Кладбище позади', desc: 'Победить босса 1 акта.' },
  act2: { name: 'Сквозь багрянец', desc: 'Победить босса 2 акта.' },
  relic10: { name: 'Коллекционер', desc: 'Собрать 10 разных реликвий.' },
  unlock_all: { name: 'Полный отряд', desc: 'Открыть всех героев.' },
  rich: { name: 'Золотая лихорадка', desc: 'Накопить 500 золота за забег.' },
  kills100: { name: 'Охотник', desc: 'Убить 100 врагов.' },
  kills500: { name: 'Мясник', desc: 'Убить 500 врагов.' },
  asc3: { name: 'Закалённый', desc: 'Победить на Ascension 3.' },
  asc10: { name: 'Легенда', desc: 'Победить на Ascension 10.' },
  elite10: { name: 'Элитный охотник', desc: 'Убить 10 элитных врагов.' },
  daily: { name: 'Ежедневный', desc: 'Пройти ежедневный забег.' },
};

export function defaultMeta() {
  return { v: 1, ash: 0, unlocked: Object.keys(HEROES).filter((k) => HEROES[k].start), forge: {}, wins: 0, runs: 0,
    totalAsh: 0, ascUnlocked: 0, bestiary: {}, relicsSeen: {}, ach: {}, kills: 0, elites: 0, bestFloor: 0, endlessBest: 0 };
}

export function loadMeta() {
  try {
    const raw = globalThis.localStorage?.getItem('pepel_meta');
    if (raw) return { ...defaultMeta(), ...JSON.parse(raw) };
  } catch {}
  return defaultMeta();
}
export function saveMeta(meta) { try { globalThis.localStorage?.setItem('pepel_meta', JSON.stringify(meta)); } catch {} }

export const rankOf = (meta) => Math.floor(Math.sqrt((meta.totalAsh ?? 0) / 30));
export const rankNeed = (r) => Math.ceil((r + 1) * (r + 1) * 30);

export function forgeMods(meta) {
  const m = {};
  const rk = rankOf(meta);
  m.hpPct = rk; m.dmgPct = rk; // ранг пепла: +1% здоровья и урона за ранг
  for (const [k, def] of Object.entries(FORGE)) {
    const l = meta.forge[k] ?? 0;
    for (const [mk, mv] of Object.entries(def.mod(l))) m[mk] = (m[mk] ?? 0) + mv;
  }
  return m;
}

export function buyForge(meta, key) {
  const def = FORGE[key], l = meta.forge[key] ?? 0;
  if (l >= def.max) return false;
  const c = def.cost(l);
  if (meta.ash < c) return false;
  meta.ash -= c; meta.forge[key] = l + 1; saveMeta(meta); return true;
}
export function unlockHero(meta, id) {
  if (meta.unlocked.includes(id)) return false;
  const c = HEROES[id].unlock;
  if (meta.ash < c) return false;
  meta.ash -= c; meta.unlocked.push(id); saveMeta(meta); return true;
}

export function grantAch(meta, id, newly) {
  if (!meta.ach[id]) { meta.ach[id] = Date.now(); newly?.push(id); }
}
export function checkAchievements(meta, run, outcome) {
  const n = [];
  if (meta.kills >= 100) grantAch(meta, 'kills100', n);
  if (meta.kills >= 500) grantAch(meta, 'kills500', n);
  if (meta.elites >= 10) grantAch(meta, 'elite10', n);
  if (Object.keys(meta.relicsSeen).length >= 10) grantAch(meta, 'relic10', n);
  if (meta.unlocked.length >= Object.keys(HEROES).length) grantAch(meta, 'unlock_all', n);
  if (run) {
    if (run.gold >= 500) grantAch(meta, 'rich', n);
    if (run.act > 1 || outcome === 'win') grantAch(meta, 'act1', n);
    if (run.act > 2 || outcome === 'win') grantAch(meta, 'act2', n);
    if (outcome === 'win') {
      grantAch(meta, 'first_win', n);
      if (run.asc >= 3) grantAch(meta, 'asc3', n);
      if (run.asc >= 10) grantAch(meta, 'asc10', n);
      if (run.mode === 'daily') grantAch(meta, 'daily', n);
    }
  }
  return n;
}
