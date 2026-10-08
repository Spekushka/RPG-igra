// Таланты: выбор 1 из 3 при каждом повышении уровня героя. Складываются.
export const TALENTS = {
  might: { name: 'Мощь', desc: '+8% урона', stats: { atk: 8 } },
  vigor: { name: 'Стойкость', desc: '+10% здоровья', stats: { hp: 10 } },
  aim: { name: 'Меткость', desc: '+6% шанс крита', stats: { crit: 6 } },
  thirst: { name: 'Жажда крови', desc: '+4% вампиризм', stats: { ls: 4 } },
  thorns: { name: 'Шипы', desc: 'Отражает 8% урона', stats: { thorns: 8 } },
  grace: { name: 'Милость', desc: '+14% к лечению', stats: { heal: 14 } },
  plate: { name: 'Закалка', desc: '+3% брони', stats: { def: 3 } },
  fury: { name: 'Неистовство', desc: '+10% прироста ярости', stats: { rage: 10 } },
  balance: { name: 'Равновесие', desc: '+5% урона, +5% здоровья', stats: { atk: 5, hp: 5 } },
  edge: { name: 'Остриё', desc: '+4% урона, +3% крита', stats: { atk: 4, crit: 3 } },
};
export const talentKeys = () => Object.keys(TALENTS);
