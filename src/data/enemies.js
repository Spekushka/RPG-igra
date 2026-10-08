// Враги. tier: 0 обычный, 1 элита, 2 босс. Ходы: tgt foe|foes|foeRand|foeLow|friend|friends|self
// Условия хода: cd (перезарядка), hpBelow (доля HP врага), min (с какого раунда)
const D = (m, o = {}) => ({ t: 'dmg', m, ...o });
const S = (id, t, v = 0, o = {}) => ({ t: 'status', id, turns: t, v, ...o });
const mv = (name, tgt, fx, o = {}) => ({ name, tgt, fx, w: 1, ...o });
const atk = (name, m, w = 3, extra = []) => mv(name, 'foe', [D(m), ...extra], { w });
const aoe = (name, m, o = {}, extra = []) => mv(name, 'foes', [D(m), ...extra], o);
const summon = (id, o = {}) => mv('Призыв', 'self', [{ t: 'summon', id }], { w: 1, cd: 4, ...o });

const E = (id, name, act, tier, hp, atkv, def, moves) => ({ id, name, act, tier, hp, atk: atkv, def, moves });

export const ENEMIES = {};
const add = (e) => { ENEMIES[e.id] = e; };

// ===== Акт 1: Проклятое кладбище =====
add(E('skeleton', 'Скелет', 1, 0, 38, 8, 0, [atk('Рубит', 1.0), mv('Костяной щит', 'self', [{ t: 'shield', m: 0.9 }], { w: 1, cd: 3 })]));
add(E('skeleton_archer', 'Скелет-лучник', 1, 0, 30, 9, 0, [atk('Выстрел', 1.1), aoe('Град стрел', 0.5, { w: 1, cd: 3 })]));
add(E('zombie', 'Зомби', 1, 0, 58, 7, 0, [atk('Гнилой укус', 1.0, 3, [S('poison', 3, 0.2)]), mv('Шаркает', 'self', [], { w: 1 })]));
add(E('cultist', 'Культист', 1, 0, 34, 8, 0, [atk('Кинжал', 1.0), mv('Проклятие', 'foe', [S('curse', 3)], { w: 1, cd: 3 })]));
add(E('ghoul', 'Гуль', 1, 0, 44, 9, 0, [atk('Когти', 1.0, 3, [S('bleed', 2, 0.25)]), mv('Вопль', 'foes', [S('weak', 2)], { w: 1, cd: 4 })]));
add(E('crow_swarm', 'Стая ворон', 1, 0, 26, 7, 0, [mv('Клёв', 'foeRand', [D(0.45, { hits: 3 })], { w: 3 }), mv('Пронзительный крик', 'foe', [S('weak', 2)], { w: 1, cd: 3 })]));
add(E('wolf_dire', 'Лютый волк', 1, 0, 42, 10, 0, [atk('Прыжок', 1.4), mv('Вой', 'friends', [S('atkup', 2)], { w: 1, cd: 4 })]));
add(E('bone_hound', 'Костяная гончая', 1, 0, 36, 9, 0, [atk('Укус', 1.1), atk('Рывок', 1.6, 1)]));
add(E('grave_robber', 'Мародёр', 1, 0, 40, 9, 5, [atk('Лопата', 1.2), mv('Горсть песка', 'foe', [S('weak', 2)], { w: 1, cd: 3 })]));
add(E('wraith', 'Призрак', 1, 0, 32, 8, 0, [atk('Ледяное касание', 0.9, 3, [S('weak', 2)]), mv('Ускользание', 'self', [S('evade', 2, 1)], { w: 1, cd: 4 })]));
add(E('bone_knight', 'Костяной рыцарь', 1, 1, 120, 11, 25, [atk('Рубка', 1.2), mv('Щит стража', 'self', [{ t: 'shield', m: 1.6 }], { w: 1, cd: 3 }), mv('Сокрушение', 'foe', [D(1.8), S('stun', 1)], { w: 1, cd: 4 })]));
add(E('cult_priest', 'Жрец культа', 1, 1, 100, 11, 0, [atk('Кровавый посох', 1.0), mv('Исцеление культа', 'friend', [{ t: 'heal', m: 1.6 }], { w: 1, cd: 2 }), mv('Проклятие всех', 'foes', [S('curse', 3)], { w: 1, cd: 5 }), summon('cultist', { cd: 5 })]));
add(E('dire_alpha', 'Вожак стаи', 1, 1, 130, 13, 5, [atk('Рвёт', 1.4, 3, [S('bleed', 3, 0.3)]), mv('Вой стаи', 'friends', [S('atkup', 3)], { w: 1, cd: 4 }), summon('wolf_dire', { cd: 5 })]));
add(E('gravewarden', 'Страж могил', 1, 2, 420, 13, 15, [atk('Цепной удар', 1.3), aoe('Взмах фонаря', 0.7, { w: 2, cd: 2 }, [S('burn', 2, 0.2)]), summon('skeleton', { cd: 4, w: 2 }), mv('Кара стража', 'foe', [D(2.0), S('stun', 1)], { w: 2, cd: 3, hpBelow: 0.5 })]));
add(E('lich_apprentice', 'Ученик лича', 1, 2, 360, 15, 5, [atk('Костяной снаряд', 1.2), mv('Проклятие смерти', 'foes', [S('curse', 3), D(0.4)], { w: 2, cd: 3 }), summon('wraith', { cd: 4, w: 2 }), mv('Поглощение', 'foe', [D(1.4, { lifesteal: 1 })], { w: 2, cd: 2, hpBelow: 0.5 })]));

// ===== Акт 2: Багровый замок =====
add(E('vampire_thrall', 'Слуга-вампир', 2, 0, 78, 15, 0, [atk('Укус', 1.0, 3, [])  , mv('Кровавый поцелуй', 'foe', [D(0.9, { lifesteal: 0.6 })], { w: 2 }), mv('Гипноз', 'foe', [S('curse', 3)], { w: 1, cd: 4 })]));
add(E('gargoyle', 'Горгулья', 2, 0, 98, 15, 25, [atk('Удар крыла', 1.0), mv('Каменная кожа', 'self', [{ t: 'shield', m: 1.5 }], { w: 1, cd: 3 })]));
add(E('haunted_armor', 'Проклятые доспехи', 2, 0, 92, 16, 30, [atk('Удар мечом', 1.1), mv('Проклятый клинок', 'foe', [D(1.5), S('weak', 2)], { w: 1, cd: 3 })]));
add(E('bat_swarm', 'Рой летучих мышей', 2, 0, 56, 12, 0, [mv('Налёт', 'foeRand', [D(0.5, { hits: 3 })], { w: 3 }), mv('Кровососы', 'foe', [D(0.8, { lifesteal: 0.8 })], { w: 1 })]));
add(E('blood_mage', 'Маг крови', 2, 0, 72, 18, 0, [atk('Кровавый шар', 1.2, 3, [S('bleed', 3, 0.25)]), mv('Кровавый ритуал', 'friends', [{ t: 'heal', m: 0.7 }], { w: 1, cd: 4 })]));
add(E('werewolf', 'Оборотень', 2, 0, 105, 19, 0, [atk('Когти', 1.1, 3, [S('bleed', 2, 0.3)]), mv('Ярость луны', 'self', [S('atkup', 3)], { w: 1, cd: 4 }), atk('Прыжок', 1.8, 1)]));
add(E('spider_giant', 'Гигантский паук', 2, 0, 82, 14, 0, [atk('Ядовитый укус', 0.9, 3, [S('poison', 4, 0.3)]), mv('Паутина', 'foe', [S('stun', 1), S('weak', 2)], { w: 1, cd: 4 })]));
add(E('plague_doctor', 'Чумной доктор', 2, 0, 74, 13, 0, [atk('Удар тростью', 1.0), aoe('Зелье чумы', 0.3, { w: 2, cd: 2 }, [S('poison', 3, 0.25)])]));
add(E('executioner', 'Палач', 2, 0, 135, 22, 15, [atk('Удар топором', 1.3), mv('Казнь', 'foeLow', [D(2.2)], { w: 1, cd: 4 })]));
add(E('banshee', 'Банши', 2, 0, 68, 14, 0, [aoe('Вопль', 0.6, { w: 3 }, [S('weak', 2)]), atk('Леденящее касание', 1.1, 2)]));
add(E('blood_knight', 'Багровый рыцарь', 2, 1, 230, 20, 25, [atk('Багровый клинок', 1.2, 3, [S('bleed', 3, 0.3)]), mv('Кровавый щит', 'self', [{ t: 'shield', m: 2 }], { w: 1, cd: 4 }), mv('Кровавая жатва', 'foes', [D(0.8, { lifesteal: 0.5 })], { w: 2, cd: 3 })]));
add(E('gargoyle_elder', 'Старейшина горгулий', 2, 1, 260, 18, 35, [atk('Каменный кулак', 1.3), mv('Обвал', 'foes', [D(0.7), S('stun', 1)], { w: 1, cd: 5 }), mv('Гранитная кожа', 'self', [{ t: 'shield', m: 2.5 }], { w: 1, cd: 4 }), summon('gargoyle', { cd: 6 })]));
add(E('crimson_witch', 'Багровая ведьма', 2, 1, 200, 24, 0, [atk('Багровая молния', 1.2), mv('Котёл', 'friends', [{ t: 'heal', m: 0.8 }, S('atkup', 2)], { w: 1, cd: 4 }), mv('Порча', 'foes', [S('curse', 3), S('weak', 2)], { w: 1, cd: 4 }), summon('bat_swarm', { cd: 6 })]));
add(E('countess', 'Графиня Кармилла', 2, 2, 720, 23, 10, [atk('Когти графини', 1.2, 3, [S('bleed', 2, 0.3)]), mv('Кровавый поцелуй', 'foe', [D(1.3, { lifesteal: 1 })], { w: 2 }), aoe('Алый вихрь', 0.9, { w: 2, cd: 3 }, [S('bleed', 2, 0.2)]), summon('bat_swarm', { cd: 5 }), mv('Багровая ночь', 'foes', [D(1.4, { lifesteal: 1 }), S('curse', 2)], { w: 3, cd: 4, hpBelow: 0.5 })]));
add(E('hollow_king', 'Пустой король', 2, 2, 800, 21, 30, [atk('Королевский удар', 1.3), mv('Железный указ', 'friends', [{ t: 'shield', m: 1.2 }], { w: 1, cd: 3 }), summon('haunted_armor', { cd: 5, w: 2 }), mv('Падение короны', 'foe', [D(2.4), S('stun', 1)], { w: 2, cd: 4 }), aoe('Гнев безглавого', 1.0, { w: 3, cd: 3, hpBelow: 0.5 }, [S('weak', 2)])]));

// ===== Акт 3: Бездна =====
add(E('imp', 'Бес', 3, 0, 72, 18, 0, [atk('Вилы', 1.2), atk('Огненный плевок', 0.8, 2, [S('burn', 2, 0.25)])]));
add(E('hellhound', 'Адская гончая', 3, 0, 132, 26, 0, [atk('Огненный укус', 1.2, 3, [S('burn', 3, 0.25)]), aoe('Дыхание ада', 0.7, { w: 1, cd: 3 }, [S('burn', 2, 0.2)])]));
add(E('demon_brute', 'Демон-громила', 3, 0, 225, 30, 15, [atk('Кулак ада', 1.3), mv('Топот', 'foes', [D(0.8), S('stun', 1)], { w: 1, cd: 5 }), mv('Рёв', 'self', [S('atkup', 3)], { w: 1, cd: 4 })]));
add(E('succubus', 'Суккуб', 3, 0, 135, 24, 0, [atk('Хлыст', 1.0, 3, [S('weak', 2)]), mv('Поцелуй', 'foe', [D(1.0, { lifesteal: 0.8 })], { w: 2 }), mv('Очарование', 'foe', [S('stun', 1)], { w: 1, cd: 4 })]));
add(E('fire_elemental', 'Огненный элементаль', 3, 0, 120, 28, 0, [atk('Вспышка', 1.0, 3, [S('burn', 3, 0.3)]), aoe('Пламенный вал', 0.8, { w: 1, cd: 3 }, [S('burn', 2, 0.2)])]));
add(E('obsidian_golem', 'Обсидиановый голем', 3, 0, 290, 26, 40, [atk('Удар', 1.2), mv('Лавовая кожа', 'self', [{ t: 'shield', m: 2 }], { w: 1, cd: 3 })]));
add(E('chaos_cultist', 'Безумный культист', 3, 0, 112, 27, 0, [atk('Сгусток пустоты', 1.3), mv('Безумие', 'foe', [S('curse', 3), S('weak', 2)], { w: 1, cd: 3 }), summon('imp', { cd: 5 })]));
add(E('abyss_eye', 'Око бездны', 3, 0, 145, 24, 0, [mv('Луч', 'foeLow', [D(1.3)], { w: 3 }), mv('Взгляд бездны', 'foe', [S('stun', 1)], { w: 1, cd: 4 }), mv('Щупальца', 'foeRand', [D(0.5, { hits: 3 })], { w: 2 })]));
add(E('shadow_stalker', 'Тень-охотник', 3, 0, 105, 32, 0, [atk('Удар из тени', 1.6, 3, [S('bleed', 3, 0.3)]), mv('Исчезновение', 'self', [S('evade', 2, 2)], { w: 1, cd: 3 })]));
add(E('horned_knight', 'Рогатый рыцарь', 3, 0, 240, 30, 30, [atk('Сокрушающий удар', 1.4), mv('Боевой клич', 'friends', [S('atkup', 3)], { w: 1, cd: 4 })]));
add(E('hell_champion', 'Чемпион ада', 3, 1, 400, 34, 25, [atk('Пылающий меч', 1.3, 3, [S('burn', 3, 0.3)]), aoe('Огненный шторм', 0.9, { w: 2, cd: 3 }), mv('Закалка', 'self', [{ t: 'shield', m: 2 }, S('atkup', 2)], { w: 1, cd: 4 })]));
add(E('void_priest', 'Жрец пустоты', 3, 1, 330, 32, 5, [atk('Копьё пустоты', 1.3), mv('Печать пустоты', 'foes', [S('curse', 3), S('weak', 2)], { w: 2, cd: 4 }), mv('Поглощение', 'friend', [{ t: 'heal', m: 1.6 }], { w: 1, cd: 3 }), summon('abyss_eye', { cd: 6 })]));
add(E('obsidian_titan', 'Обсидиановый титан', 3, 1, 500, 30, 45, [atk('Громовой удар', 1.4), mv('Землетрясение', 'foes', [D(0.8), S('stun', 1)], { w: 1, cd: 5 }), mv('Каменная броня', 'self', [{ t: 'shield', m: 3 }], { w: 1, cd: 4 })]));
add(E('archdemon', 'Архидемон Валгор', 3, 2, 1300, 36, 25, [atk('Удар когтей', 1.3, 3, [S('burn', 3, 0.3)]), aoe('Адское пламя', 1.0, { w: 2, cd: 3 }, [S('burn', 3, 0.3)]), summon('imp', { cd: 4, w: 2 }), mv('Пакт', 'self', [S('atkup', 3), { t: 'shield', m: 2 }], { w: 1, cd: 5 }), mv('Падение небес', 'foes', [D(1.7), S('stun', 1)], { w: 3, cd: 5, hpBelow: 0.5 })]));
add(E('void_dragon', 'Дракон Пустоты', 3, 2, 1250, 38, 25, [atk('Клык бездны', 1.3), aoe('Дыхание пустоты', 0.9, { w: 2, cd: 3 }, [S('curse', 2)]), mv('Хвост', 'foeRand', [D(0.7, { hits: 3 })], { w: 2 }), mv('Пожирание', 'foeLow', [D(1.8, { lifesteal: 1 })], { w: 2, cd: 4 }), mv('Взгляд бездны', 'foes', [D(1.2), S('stun', 1), S('weak', 2)], { w: 3, cd: 5, hpBelow: 0.5 })]));
add(E('ash_god', 'Бог Пепла', 3, 2, 2200, 40, 25, [atk('Рука пепла', 1.2, 3, [S('burn', 3, 0.3)]), aoe('Пепельная буря', 0.9, { w: 2, cd: 2 }, [S('weak', 2)]), summon('fire_elemental', { cd: 5, w: 2 }), mv('Возрождение из пепла', 'self', [{ t: 'heal', m: 3 }, { t: 'shield', m: 2 }], { w: 3, cd: 6, hpBelow: 0.4 }), mv('Конец света', 'foes', [D(1.8), S('burn', 3, 0.4), S('stun', 1)], { w: 3, cd: 4, hpBelow: 0.5 })]));

// Файл SVG для врага
export function enemySvgPath(e) {
  const dir = e.tier === 2 ? 'bosses' : e.tier === 1 ? 'elites' : 'enemies';
  return `assets/svg/${dir}/${e.id}.svg`;
}
