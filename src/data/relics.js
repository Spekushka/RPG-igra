// Реликвии. mods суммируются. rarity: 1 обычная, 2 редкая, 3 легендарная.
const R = (id, name, rarity, desc, mods, price) => ({ id, name, rarity, desc, mods, price: price ?? [0, 60, 110, 180][rarity] });
export const RELICS = Object.fromEntries([
  R('amulet_ember', 'Амулет углей', 1, 'Горение сильнее на 40%.', { burnPct: 40 }),
  R('skull_ring', 'Перстень с черепом', 1, 'После убийства врага отряд лечится на 5% HP.', { killHeal: 5 }),
  R('crown_thorns', 'Терновый венец', 2, 'Враги получают 25% от нанесённого вам урона обратно.', { thornsPct: 25 }),
  R('blood_chalice', 'Чаша крови', 2, 'Вампиризм 8%.', { lifesteal: 8 }),
  R('iron_heart', 'Железное сердце', 1, '+15% к здоровью.', { hpPct: 15 }),
  R('silver_dagger', 'Серебряный кинжал', 1, '+10% шанс крита.', { critChance: 10 }),
  R('lantern', 'Фонарь странника', 1, 'Каждый бой начинается со щитом 15% HP.', { startShield: 15 }),
  R('black_book', 'Чёрная книга', 2, '+12% к урону.', { dmgPct: 12 }),
  R('raven_feather', 'Перо ворона', 1, 'Крит наносит ещё +30% урона.', { critMult: 0.3 }),
  R('cracked_hourglass', 'Треснувшие часы', 1, 'Ярость растёт на 25% быстрее.', { rageGain: 25 }),
  R('golden_tooth', 'Золотой зуб', 1, '+25% золота.', { goldPct: 25 }),
  R('witch_eye', 'Глаз ведьмы', 2, 'Ваши дебаффы длятся на 1 ход дольше.', { debuffPlus: 1 }),
  R('bone_dice', 'Костяные кости', 1, '+5% шанс крита, +10% золота.', { critChance: 5, goldPct: 10 }),
  R('rune_stone', 'Рунный камень', 1, '+6% к броне.', { defFlat: 6 }),
  R('holy_water', 'Святая вода', 1, 'Лечение сильнее на 25%.', { healPct: 25 }),
  R('cursed_coin', 'Проклятая монета', 2, '+50% золота, но -8% здоровья.', { goldPct: 50, hpPct: -8 }),
  R('phoenix_ash', 'Пепел феникса', 3, 'Один раз за забег отряд воскресает после поражения.', { reviveOnce: 1 }, 220),
  R('spider_silk', 'Паучий шёлк', 1, 'Яд сильнее на 40%.', { poisonPct: 40 }),
  R('wolf_fang', 'Клык волка', 1, 'Кровотечение сильнее на 40%.', { bleedPct: 40 }),
  R('mirror_shard', 'Осколок зеркала', 2, 'Враги получают 35% отражённого урона.', { thornsPct: 35 }),
  R('ancient_key', 'Древний ключ', 3, 'После боя можно выбрать награду из 4 вариантов.', { extraChoice: 1 }, 200),
  R('torn_banner', 'Рваное знамя', 1, '+6% урона и +6% здоровья.', { dmgPct: 6, hpPct: 6 }),
  R('vampire_fang', 'Клык вампира', 2, 'Вампиризм 12%, но -5% здоровья.', { lifesteal: 12, hpPct: -5 }),
  R('healing_herb', 'Целебная трава', 1, 'Привал лечит на 20% больше.', { campHeal: 20 }),
  R('war_drum', 'Боевой барабан', 1, 'Бой начинается с 25 ярости.', { startRage: 25 }),
  R('demon_horn', 'Рог демона', 2, '+15% урона, -3% брони.', { dmgPct: 15, defFlat: -3 }),
  R('void_shard', 'Осколок пустоты', 2, 'Крит +40% урона, +5% шанс.', { critMult: 0.4, critChance: 5 }),
  R('frost_gem', 'Морозный самоцвет', 1, 'Щиты сильнее на 25%.', { shieldPct: 25 }),
  R('thunder_charm', 'Громовой оберег', 1, '+8% урона, +10 стартовой ярости.', { dmgPct: 8, startRage: 10 }),
  R('plague_mask', 'Чумная маска', 1, 'Яд +20%, +3% брони.', { poisonPct: 20, defFlat: 3 }),
  R('grave_dirt', 'Могильная земля', 1, 'Убийство лечит на 3%, +5% здоровья.', { killHeal: 3, hpPct: 5 }),
  R('knight_medal', 'Медаль рыцаря', 1, '+5% брони, +5% здоровья.', { defFlat: 5, hpPct: 5 }),
  R('mage_orb', 'Сфера мага', 2, '+12% урона.', { dmgPct: 12 }),
  R('rogue_glove', 'Перчатка вора', 1, '+8% шанс крита.', { critChance: 8 }),
  R('bard_pipe', 'Дудка барда', 1, 'Ярость растёт на 20% быстрее.', { rageGain: 20 }),
  R('alchemy_vial', 'Алхимический флакон', 1, 'Лечение +15%, яд +15%.', { healPct: 15, poisonPct: 15 }),
  R('dragon_scale', 'Драконья чешуя', 2, '+8% брони, +8% здоровья.', { defFlat: 8, hpPct: 8 }),
  R('chain_link', 'Звено цепи', 1, 'Отражает 15% урона, +3% брони.', { thornsPct: 15, defFlat: 3 }),
  R('soul_lantern', 'Фонарь душ', 1, '+30% опыта.', { xpPct: 30 }),
  R('ash_crown', 'Корона пепла', 3, '+30% пепла за забег, +5% урона.', { ashPct: 30, dmgPct: 5 }, 190),
].map((r) => [r.id, r]));

export function sumMods(relicIds, extra = {}) {
  const m = { ...extra };
  for (const id of relicIds) {
    const r = RELICS[id];
    if (!r) continue;
    for (const [k, v] of Object.entries(r.mods)) m[k] = (m[k] ?? 0) + v;
  }
  return m;
}
