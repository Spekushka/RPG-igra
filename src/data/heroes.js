// Герои. cls: warrior | mage | support | rogue. start — открыт с начала.
export const HEROES = {
  knight: { name: 'Сэр Рэйвен', title: 'Рыцарь', cls: 'warrior', hp: 130, atk: 14, def: 20, start: true,
    skills: ['k_slash', 'k_bash', 'k_taunt', 'k_ult'], unlock: 0, blurb: 'Несокрушимый щит отряда.' },
  berserker: { name: 'Грорг', title: 'Берсерк', cls: 'warrior', hp: 115, atk: 18, def: 5, start: false,
    skills: ['b_cleave', 'b_blood', 'b_rage', 'b_ult'], unlock: 60, blurb: 'Чем больнее, тем веселее.' },
  paladin: { name: 'Люциан', title: 'Паладин', cls: 'warrior', hp: 125, atk: 13, def: 15, start: false,
    skills: ['p_smite', 'p_bless', 'p_guard', 'p_ult'], unlock: 90, blurb: 'Свет бьёт больнее стали.' },
  pyromancer: { name: 'Искра', title: 'Пиромант', cls: 'mage', hp: 85, atk: 17, def: 0, start: true,
    skills: ['f_fireball', 'f_wave', 'f_ignite', 'f_ult'], unlock: 0, blurb: 'Сжигает всё, включая мосты.' },
  cryomancer: { name: 'Иней', title: 'Криомант', cls: 'mage', hp: 90, atk: 15, def: 0, start: false,
    skills: ['c_shard', 'c_freeze', 'c_blizzard', 'c_armor', 'c_ult'], unlock: 80, blurb: 'Холодный расчёт, ледяной взгляд.' },
  necromancer: { name: 'Морвен', title: 'Некромант', cls: 'mage', hp: 90, atk: 15, def: 0, start: false,
    skills: ['n_bolt', 'n_curse', 'n_raise', 'n_ult'], unlock: 120, blurb: 'Мёртвые — лучшие слуги.' },
  priestess: { name: 'Сестра Аурелия', title: 'Жрица', cls: 'support', hp: 95, atk: 12, def: 0, start: true,
    skills: ['h_smite', 'h_heal', 'h_bless', 'h_cleanse', 'h_ult'], unlock: 0, blurb: 'Последняя надежда отряда.' },
  bard: { name: 'Лютик', title: 'Бард', cls: 'support', hp: 90, atk: 12, def: 0, start: false,
    skills: ['d_chord', 'd_valor', 'd_lullaby', 'd_inspire', 'd_ult'], unlock: 70, blurb: 'Споёт даже над могилой.' },
  alchemist: { name: 'Колба', title: 'Алхимик', cls: 'support', hp: 95, atk: 14, def: 0, start: false,
    skills: ['a_flask', 'a_acid', 'a_elixir', 'a_ult'], unlock: 100, blurb: 'Что взорвётся — то и лекарство.' },
  ranger: { name: 'Тэсс', title: 'Следопыт', cls: 'rogue', hp: 95, atk: 16, def: 5, start: true,
    skills: ['r_shot', 'r_multi', 'r_trap', 'r_ult'], unlock: 0, blurb: 'Не промахивается. Почти.' },
  assassin: { name: 'Тень', title: 'Убийца', cls: 'rogue', hp: 80, atk: 19, def: 0, start: false,
    skills: ['s_stab', 's_blade', 's_smoke', 's_ult'], unlock: 110, blurb: 'Вы его не видели.' },
  witchhunter: { name: 'Вальд', title: 'Охотник на ведьм', cls: 'rogue', hp: 105, atk: 16, def: 8, start: false,
    skills: ['w_stake', 'w_torch', 'w_seal', 'w_ult'], unlock: 140, blurb: 'Серебро, огонь, терпение.' },
};

export const CLASS_NAMES = { warrior: 'Воин', mage: 'Маг', support: 'Поддержка', rogue: 'Стрелок/Вор' };

// Навыки открываются с уровнем героя: 4 навыка — [1,2,3,5], 5 навыков — [1,2,3,4,6]
export function skillUnlockLv(heroId, idx) {
  const n = HEROES[heroId].skills.length;
  return (n >= 5 ? [1, 2, 3, 4, 6] : [1, 2, 3, 5])[idx];
}
export const unlockedSkills = (heroId, lvl) => HEROES[heroId].skills.filter((_, i) => skillUnlockLv(heroId, i) <= lvl);
