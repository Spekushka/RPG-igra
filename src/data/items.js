// Предметы героев: 3 слота. Статы масштабируются редкостью.
// stats: atk% hp% def crit(% шанс) ls(% вампиризм) thorns(%) heal(% к лечению) rage(% к приросту ярости)
export const SLOTS = { weapon: 'Оружие', armor: 'Броня', trinket: 'Талисман' };
export const RARITY = [
  null,
  { id: 1, name: 'Обычный', color: '#b8b2c9', mult: 1, sec: 0 },
  { id: 2, name: 'Редкий', color: '#4aa3ff', mult: 1.7, sec: 1 },
  { id: 3, name: 'Эпический', color: '#b36bff', mult: 2.6, sec: 2 },
  { id: 4, name: 'Легендарный', color: '#ffb02a', mult: 4, sec: 2 },
];
const I = (id, name, slot, main, sec = []) => ({ id, name, slot, main, sec });
const W = 'weapon', A = 'armor', T = 'trinket';
export const ITEMS = Object.fromEntries([
  I('bone_blade', 'Костяной клинок', W, { atk: 8 }, [{ crit: 3 }, { ls: 3 }]),
  I('rusty_axe', 'Ржавый топор', W, { atk: 9 }, [{ ls: 3 }, { hp: 4 }]),
  I('holy_mace', 'Святая булава', W, { atk: 7 }, [{ heal: 8 }, { hp: 4 }]),
  I('ember_staff', 'Угольный посох', W, { atk: 9 }, [{ crit: 3 }, { rage: 6 }]),
  I('frost_wand', 'Ледяная палочка', W, { atk: 7 }, [{ rage: 6 }, { def: 2 }]),
  I('night_dagger', 'Ночной кинжал', W, { atk: 6, crit: 3 }, [{ crit: 3 }, { atk: 3 }]),
  I('hunter_bow', 'Охотничий лук', W, { atk: 8 }, [{ crit: 4 }, { atk: 3 }]),
  I('plague_scythe', 'Чумная коса', W, { atk: 8 }, [{ ls: 3 }, { rage: 6 }]),
  I('storm_hammer', 'Грозовой молот', W, { atk: 10 }, [{ rage: 6 }, { crit: 3 }]),
  I('soul_spear', 'Копьё душ', W, { atk: 8 }, [{ ls: 4 }, { heal: 6 }]),
  I('silver_rapier', 'Серебряная рапира', W, { atk: 7, crit: 3 }, [{ crit: 3 }, { atk: 3 }]),
  I('ash_sword', 'Пепельный меч', W, { atk: 9 }, [{ thorns: 6 }, { hp: 4 }]),
  I('iron_helm', 'Железный шлем', A, { hp: 8, def: 2 }, [{ def: 2 }, { thorns: 4 }]),
  I('bone_plate', 'Костяной нагрудник', A, { hp: 10 }, [{ def: 2 }, { thorns: 4 }]),
  I('holy_robe', 'Священная ряса', A, { hp: 7 }, [{ heal: 8 }, { def: 2 }]),
  I('shadow_cloak', 'Плащ теней', A, { hp: 6, crit: 2 }, [{ crit: 2 }, { def: 2 }]),
  I('dragon_mail', 'Кольчуга дракона', A, { hp: 9, def: 3 }, [{ def: 2 }, { hp: 4 }]),
  I('thorn_vest', 'Шипастый жилет', A, { hp: 7, thorns: 8 }, [{ thorns: 6 }, { hp: 4 }]),
  I('frost_mantle', 'Ледяная мантия', A, { hp: 8 }, [{ rage: 6 }, { def: 2 }]),
  I('gravewalker_boots', 'Сапоги могильщика', A, { hp: 6, def: 2 }, [{ ls: 3 }, { hp: 4 }]),
  I('knight_shield', 'Щит стража', A, { hp: 8, def: 3 }, [{ def: 2 }, { thorns: 4 }]),
  I('wolf_pelt', 'Волчья шкура', A, { hp: 9 }, [{ crit: 3 }, { ls: 3 }]),
  I('ember_gauntlets', 'Угольные перчатки', A, { hp: 6, atk: 4 }, [{ atk: 3 }, { thorns: 4 }]),
  I('bone_crown_helm', 'Шлем-череп', A, { hp: 8, atk: 3 }, [{ atk: 3 }, { def: 2 }]),
  I('ruby_ring', 'Рубиновое кольцо', T, { atk: 6, hp: 3 }, [{ crit: 3 }, { atk: 3 }]),
  I('fang_necklace', 'Ожерелье из клыков', T, { ls: 4 }, [{ atk: 3 }, { crit: 3 }]),
  I('ghost_lantern', 'Призрачный фонарь', T, { rage: 10 }, [{ hp: 4 }, { heal: 6 }]),
  I('blood_vial', 'Флакон крови', T, { ls: 5 }, [{ hp: 4 }, { heal: 6 }]),
  I('lucky_coin', 'Счастливая монета', T, { crit: 5 }, [{ atk: 3 }, { rage: 6 }]),
  I('war_horn', 'Боевой рог', T, { rage: 12 }, [{ atk: 3 }, { hp: 4 }]),
  I('rune_tablet', 'Рунная табличка', T, { def: 3, hp: 4 }, [{ def: 2 }, { heal: 6 }]),
  I('spider_brooch', 'Паучья брошь', T, { crit: 4, atk: 3 }, [{ ls: 3 }, { crit: 3 }]),
  I('sun_pendant', 'Солнечный кулон', T, { heal: 14 }, [{ hp: 4 }, { rage: 6 }]),
  I('moon_charm', 'Лунный оберег', T, { hp: 6, rage: 6 }, [{ crit: 3 }, { def: 2 }]),
  I('skull_trophy', 'Трофей-череп', T, { atk: 6, thorns: 5 }, [{ ls: 3 }, { hp: 4 }]),
  I('ash_phial', 'Пепельная склянка', T, { atk: 5, rage: 8 }, [{ heal: 6 }, { crit: 3 }]),
].map((x) => [x.id, x]));

export const STAT_NAMES = { atk: 'Урон', hp: 'Здоровье', def: 'Броня', crit: 'Шанс крита', ls: 'Вампиризм', thorns: 'Отражение', heal: 'Лечение', rage: 'Ярость' };
const PCT = new Set(['atk', 'hp', 'crit', 'ls', 'thorns', 'heal', 'rage']);

// Статы конкретного экземпляра предмета {id, r}
export function itemStats(it) {
  const def = ITEMS[it.id], R = RARITY[it.r];
  const out = {};
  const add = (o, k) => { for (const [s, v] of Object.entries(o)) out[s] = (out[s] ?? 0) + Math.round(v * k * (s === 'def' ? 0.8 : 1)) ; };
  add(def.main, R.mult);
  for (let i = 0; i < R.sec; i++) if (def.sec[i]) add(def.sec[i], R.mult * 0.7);
  return out;
}
export const fmtStat = (s, v) => `+${v}${PCT.has(s) ? '%' : ''} ${STAT_NAMES[s]}`;
export const itemPower = (it) => Object.values(itemStats(it)).reduce((a, b) => a + b, 0) + it.r * 3;
