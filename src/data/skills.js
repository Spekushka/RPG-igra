// Навыки героев. tgt: foe | foes | foeRand | friend | friends | self
// fx: dmg{m,hits,lifesteal,vsStatus,mult,executeBelow,vsElite} heal{m,to} shield{m,to}
//     status{id,t,v,to} cleanse{to} rage{v} summonAlly{unit} revive{m} selfDmg{pct}
// cost — ярость (ульта), cd — перезарядка в раундах.
const D = (m, o = {}) => ({ t: 'dmg', m, ...o });
const S = (id, t, v = 0, o = {}) => ({ t: 'status', id, turns: t, v, ...o });
const H = (m, o = {}) => ({ t: 'heal', m, ...o });
const SH = (m, o = {}) => ({ t: 'shield', m, ...o });

export const SKILLS = {
  // Рыцарь
  k_slash: { name: 'Рубящий удар', icon: 'slash', tgt: 'foe', cd: 0, fx: [D(1.0)] },
  k_bash: { name: 'Удар щитом', icon: 'shield_bash', tgt: 'foe', cd: 3, fx: [D(0.9), S('stun', 1)] },
  k_taunt: { name: 'Вызов', icon: 'taunt', tgt: 'self', cd: 3, fx: [S('taunt', 2), SH(1.3)] },
  k_ult: { name: 'Праведный гнев', icon: 'whirlwind', tgt: 'foes', cost: 50, fx: [D(1.5)] },
  // Берсерк
  b_cleave: { name: 'Рассечение', icon: 'cleave', tgt: 'foe', cd: 0, fx: [D(1.2)] },
  b_blood: { name: 'Кровавый топор', icon: 'slash', tgt: 'foe', cd: 2, fx: [D(0.9), S('bleed', 3, 0.3)] },
  b_rage: { name: 'Бешенство', icon: 'rage_strike', tgt: 'self', cd: 3, fx: [S('atkup', 3), { t: 'selfDmg', pct: 0.1 }, { t: 'rage', v: 15 }] },
  b_ult: { name: 'Вихрь смерти', icon: 'whirlwind', tgt: 'foes', cost: 50, fx: [D(1.5), S('bleed', 2, 0.25)] },
  // Паладин
  p_smite: { name: 'Священный удар', icon: 'holy_smite', tgt: 'foe', cd: 0, fx: [D(1.0), H(0.3, { to: 'self' })] },
  p_bless: { name: 'Благословение', icon: 'bless', tgt: 'friend', cd: 2, fx: [SH(1.0), S('regen', 3, 0.15)] },
  p_guard: { name: 'Щит веры', icon: 'guard', tgt: 'friends', cd: 3, fx: [SH(0.7)] },
  p_ult: { name: 'Божественная кара', icon: 'holy_smite', tgt: 'foes', cost: 50, fx: [D(1.2), H(0.5, { to: 'friends' })] },
  // Пиромант
  f_fireball: { name: 'Огненный шар', icon: 'fireball', tgt: 'foe', cd: 0, fx: [D(1.2), S('burn', 3, 0.25)] },
  f_wave: { name: 'Волна пламени', icon: 'flame_wave', tgt: 'foes', cd: 2, fx: [D(0.65), S('burn', 2, 0.2)] },
  f_ignite: { name: 'Поджог', icon: 'torch_throw', tgt: 'foe', cd: 3, fx: [D(0.5), S('burn', 4, 0.5)] },
  f_ult: { name: 'Метеорит', icon: 'meteor', tgt: 'foes', cost: 50, fx: [D(2.0), S('burn', 3, 0.3)] },
  // Криомант
  c_shard: { name: 'Ледяной осколок', icon: 'ice_shard', tgt: 'foe', cd: 0, fx: [D(1.1)] },
  c_freeze: { name: 'Сковывание', icon: 'ice_shard', tgt: 'foe', cd: 3, fx: [D(0.8), S('freeze', 1)] },
  c_blizzard: { name: 'Метель', icon: 'blizzard', tgt: 'foes', cd: 2, fx: [D(0.65), S('weak', 2)] },
  c_armor: { name: 'Ледяная броня', icon: 'guard', tgt: 'friend', cd: 3, fx: [SH(1.4)] },
  c_ult: { name: 'Абсолютный ноль', icon: 'blizzard', tgt: 'foes', cost: 50, fx: [D(1.3), S('freeze', 1)] },
  // Некромант
  n_bolt: { name: 'Похищение души', icon: 'soul_drain', tgt: 'foe', cd: 0, fx: [D(0.95, { lifesteal: 0.4 })] },
  n_curse: { name: 'Порча', icon: 'curse_hex', tgt: 'foe', cd: 2, fx: [S('curse', 3), D(0.4)] },
  n_raise: { name: 'Поднять мертвеца', icon: 'raise_dead', tgt: 'self', cd: 4, fx: [{ t: 'summonAlly' }] },
  n_ult: { name: 'Жатва душ', icon: 'soul_drain', tgt: 'foes', cost: 50, fx: [D(1.1), H(0.4, { to: 'friends' })] },
  // Жрица
  h_smite: { name: 'Луч света', icon: 'holy_smite', tgt: 'foe', cd: 0, fx: [D(0.9)] },
  h_heal: { name: 'Исцеление', icon: 'heal', tgt: 'friend', cd: 1, fx: [H(1.6)] },
  h_bless: { name: 'Благодать', icon: 'bless', tgt: 'friends', cd: 3, fx: [S('regen', 3, 0.2), S('atkup', 2)] },
  h_cleanse: { name: 'Очищение', icon: 'guard', tgt: 'friend', cd: 3, fx: [{ t: 'cleanse' }, SH(0.9)] },
  h_ult: { name: 'Воскрешение', icon: 'resurrect', tgt: 'friends', cost: 50, fx: [{ t: 'revive', m: 0.5 }, H(1.0)] },
  // Бард
  d_chord: { name: 'Звонкий аккорд', icon: 'song_of_valor', tgt: 'foe', cd: 0, fx: [D(0.9), { t: 'rage', v: 6 }] },
  d_valor: { name: 'Песнь доблести', icon: 'song_of_valor', tgt: 'friends', cd: 3, fx: [S('atkup', 2)] },
  d_lullaby: { name: 'Колыбельная', icon: 'smoke_bomb', tgt: 'foes', cd: 3, fx: [S('weak', 2)] },
  d_inspire: { name: 'Вдохновение', icon: 'bless', tgt: 'friend', cd: 2, fx: [SH(0.8), { t: 'rage', v: 15 }] },
  d_ult: { name: 'Финальный аккорд', icon: 'lightning', tgt: 'foes', cost: 50, fx: [D(1.0), S('stun', 1)] },
  // Алхимик
  a_flask: { name: 'Едкая склянка', icon: 'throw_flask', tgt: 'foe', cd: 0, fx: [D(0.9), S('poison', 3, 0.25)] },
  a_acid: { name: 'Кислота', icon: 'throw_flask', tgt: 'foe', cd: 2, fx: [D(0.6), S('weak', 3), S('curse', 2)] },
  a_elixir: { name: 'Эликсир', icon: 'heal', tgt: 'friend', cd: 2, fx: [H(1.0), { t: 'cleanse' }] },
  a_ult: { name: 'Взрывной коктейль', icon: 'fireball', tgt: 'foes', cost: 50, fx: [D(1.4), S('poison', 3, 0.3)] },
  // Следопыт
  r_shot: { name: 'Меткий выстрел', icon: 'arrow_shot', tgt: 'foe', cd: 0, fx: [D(1.15)] },
  r_multi: { name: 'Веер стрел', icon: 'multishot', tgt: 'foeRand', cd: 2, fx: [D(0.6, { hits: 3 })] },
  r_trap: { name: 'Капкан', icon: 'arrow_shot', tgt: 'foe', cd: 3, fx: [D(0.7), S('bleed', 3, 0.3), S('stun', 1)] },
  r_ult: { name: 'Дождь стрел', icon: 'multishot', tgt: 'foes', cost: 50, fx: [D(1.0, { hits: 2 })] },
  // Убийца
  s_stab: { name: 'Удар в спину', icon: 'backstab', tgt: 'foe', cd: 0, fx: [D(1.1, { vsStatus: 'bleed', mult: 1.5 })] },
  s_blade: { name: 'Ядовитый клинок', icon: 'poison_blade', tgt: 'foe', cd: 2, fx: [D(0.7), S('poison', 4, 0.3)] },
  s_smoke: { name: 'Дымовая завеса', icon: 'smoke_bomb', tgt: 'self', cd: 3, fx: [S('evade', 2, 2), { t: 'rage', v: 10 }] },
  s_ult: { name: 'Казнь', icon: 'execute', tgt: 'foe', cost: 50, fx: [D(2.8, { executeBelow: 0.4, mult: 2 })] },
  // Охотник на ведьм
  w_stake: { name: 'Серебряный кол', icon: 'silver_stake', tgt: 'foe', cd: 0, fx: [D(1.15, { vsElite: 1.25 })] },
  w_torch: { name: 'Факел', icon: 'torch_throw', tgt: 'foe', cd: 2, fx: [D(0.6), S('burn', 3, 0.3)] },
  w_seal: { name: 'Печать охотника', icon: 'curse_hex', tgt: 'foe', cd: 3, fx: [S('curse', 3), S('weak', 2)] },
  w_ult: { name: 'Допрос', icon: 'execute', tgt: 'foe', cost: 50, fx: [D(2.4), S('stun', 1)] },
};

// Описание навыка (автоматически из эффектов).
export function describeSkill(sk, lv = 0) {
  const k = 1 + 0.2 * lv;
  const pct = (m) => Math.round(m * k * 100) + '%';
  const parts = [];
  for (const f of sk.fx) {
    if (f.t === 'dmg') {
      let s = `Урон ${pct(f.m)}`;
      if (f.hits > 1) s += `×${f.hits}`;
      if (f.vsStatus) s += `, ×${f.mult} по «${f.vsStatus === 'bleed' ? 'кровоточащим' : f.vsStatus}»`;
      if (f.executeBelow) s += `, ×${f.mult} если HP < ${f.executeBelow * 100}%`;
      if (f.vsElite) s += `, +25% по элитам и боссам`;
      if (f.lifesteal) s += `, вампиризм ${f.lifesteal * 100}%`;
      parts.push(s);
    } else if (f.t === 'heal') parts.push(`Лечение ${pct(f.m)}${f.to === 'self' ? ' (себе)' : f.to === 'friends' ? ' (всем)' : ''}`);
    else if (f.t === 'shield') parts.push(`Щит ${pct(f.m)}`);
    else if (f.t === 'status') parts.push(`${statusName(f.id)} ${f.turns} х.`);
    else if (f.t === 'cleanse') parts.push('Снимает дебаффы');
    else if (f.t === 'rage') parts.push(`+${f.v} ярости`);
    else if (f.t === 'selfDmg') parts.push(`Теряет ${f.pct * 100}% HP`);
    else if (f.t === 'summonAlly') parts.push('Призывает скелета');
    else if (f.t === 'revive') parts.push(`Воскрешает павших (${f.m * 100}% HP)`);
  }
  return parts.join('. ');
}
import { STATUSES } from './statuses.js';
function statusName(id) { return STATUSES[id]?.name ?? id; }
