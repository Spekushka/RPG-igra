// Статусы: kind — buff/debuff/dot; icon — файл в assets/svg/icons/status
export const STATUSES = {
  poison: { name: 'Яд', icon: 'poison', kind: 'dot', desc: 'Каждый ход наносит урон, игнорируя броню.' },
  burn: { name: 'Горение', icon: 'burn', kind: 'dot', desc: 'Каждый ход наносит урон огнём.' },
  bleed: { name: 'Кровотечение', icon: 'bleed', kind: 'dot', desc: 'Каждый ход наносит урон.' },
  freeze: { name: 'Заморозка', icon: 'freeze', kind: 'debuff', desc: 'Пропускает действие.' },
  stun: { name: 'Оглушение', icon: 'stun', kind: 'debuff', desc: 'Пропускает действие.' },
  curse: { name: 'Проклятие', icon: 'curse', kind: 'debuff', desc: 'Получает на 30% больше урона.' },
  weak: { name: 'Слабость', icon: 'weak', kind: 'debuff', desc: 'Наносит на 30% меньше урона.' },
  regen: { name: 'Регенерация', icon: 'regen', kind: 'buff', desc: 'Восстанавливает здоровье каждый ход.' },
  atkup: { name: 'Ярость', icon: 'rage_buff', kind: 'buff', desc: 'Наносит на 30% больше урона.' },
  taunt: { name: 'Вызов', icon: 'shield', kind: 'buff', desc: 'Враги обязаны атаковать этого героя.' },
  evade: { name: 'Уклонение', icon: 'shield', kind: 'buff', desc: 'Следующие атаки не попадают.' },
};
