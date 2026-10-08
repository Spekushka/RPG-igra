import { h, img, sleep } from './dom.js';
import { sfx } from './sfx.js';
import { makeRng } from '../engine/rng.js';

export const GAMES = {
  memory: { name: 'Найди пару', icon: 'assets/svg/minigames/card_back.svg', desc: 'Откройте все пары карт за как можно меньшее число ходов.', rules: ['Идеально: до 8 попыток', 'Отлично: до 10', 'Хорошо: до 14'] },
  forge: { name: 'Удар по наковальне', icon: 'assets/svg/minigames/anvil.svg', desc: 'Нажимайте «Ударить!», когда бегунок в зелёной зоне. Пять ударов, бегунок ускоряется.', rules: ['Центр зоны = 2 очка, край = 1', 'Идеально: 9–10 очков'] },
  ghosts: { name: 'Ловля духов', icon: 'assets/svg/minigames/ghost.svg', desc: 'Тапайте духов за 20 секунд. Проклятые маски отнимают очки!', rules: ['Дух = +1, маска = −3', 'Идеально: 16+'] },
  cups: { name: 'Три чаши', icon: 'assets/svg/minigames/cup.svg', desc: 'Следите за шариком и угадайте, под какой чашей он окажется. Три раунда.', rules: ['Каждая угаданная = +1 уровень приза'] },
};

// Каждая игра вызывает finish(tier 0..3, текст-итог)
export function startGame(kind, host, finish) {
  ({ memory, forge, ghosts, cups })[kind](host, finish);
}

// ---------- Найди пару ----------
function memory(host, finish) {
  const icons = ['ancient_key', 'blood_chalice', 'phoenix_ash', 'raven_feather', 'witch_eye', 'holy_water', 'vampire_fang', 'war_drum', 'frost_gem'].sort(() => Math.random() - 0.5).slice(0, 6);
  const cards = makeRng().shuffle([...icons, ...icons]);
  let first = null, lock = false, tries = 0, found = 0;
  const info = h('div', { class: 'gstat' }, 'Попыток: 0');
  const grid = h('div', { class: 'memgrid' });
  cards.forEach((ic, i) => {
    const c = h('div', { class: 'memcard' }, h('div', { class: 'face back' }, img('assets/svg/minigames/card_back.svg')), h('div', { class: 'face front' }, img(`assets/svg/icons/relics/${ic}.svg`)));
    c.addEventListener('click', async () => {
      if (lock || c.classList.contains('open') || c.classList.contains('done')) return;
      sfx.click(); c.classList.add('open');
      if (!first) { first = { c, ic }; return; }
      tries++; info.textContent = `Попыток: ${tries}`;
      if (first.ic === ic) {
        const a = first.c; first = null; a.classList.add('done'); c.classList.add('done'); sfx.heal(); found++;
        if (found === 6) { await sleep(600); finish(tries <= 8 ? 3 : tries <= 10 ? 2 : tries <= 14 ? 1 : 0, `Пары найдены за ${tries} попыток`); }
      } else {
        lock = true; const a = first.c; first = null; await sleep(750); a.classList.remove('open'); c.classList.remove('open'); lock = false;
      }
    });
    grid.append(c);
  });
  host.replaceChildren(info, grid);
}

// ---------- Удар по наковальне ----------
function forge(host, finish) {
  let pos = 0, dir = 1, speed = 0.9, hits = 0, score = 0, running = true, raf = 0, last = performance.now();
  const zone = h('div', { class: 'fzone' }, h('div', { class: 'fperfect' }));
  const cursor = h('div', { class: 'fcursor' });
  const bar = h('div', { class: 'fbar' }, zone, cursor);
  const info = h('div', { class: 'gstat' }, 'Удар 1 из 5 · Очки: 0');
  const spark = img('assets/svg/minigames/spark.svg', 'fspark'); spark.style.opacity = 0;
  const anvil = h('div', { class: 'fanvil' }, img('assets/svg/minigames/anvil.svg'), spark);
  const btn = h('button', { class: 'btn gold bigtap', onclick: strike }, 'Ударить!');
  function loop(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    pos += dir * speed * dt;
    if (pos > 1) { pos = 1; dir = -1; } else if (pos < 0) { pos = 0; dir = 1; }
    cursor.style.left = pos * 100 + '%';
    if (running) raf = requestAnimationFrame(loop);
  }
  async function strike() {
    if (!running) return;
    const d = Math.abs(pos - 0.5);
    const pts = d < 0.05 ? 2 : d < 0.15 ? 1 : 0;
    score += pts; hits++;
    sfx[pts === 2 ? 'crit' : pts === 1 ? 'hit' : 'death']();
    spark.style.opacity = pts ? 1 : 0; setTimeout(() => { spark.style.opacity = 0; }, 220);
    anvil.classList.remove('hit'); void anvil.offsetWidth; anvil.classList.add('hit');
    bar.dataset.last = pts === 2 ? 'Идеально!' : pts === 1 ? 'Хорошо' : 'Мимо';
    info.textContent = `${bar.dataset.last} · Удар ${Math.min(hits + 1, 5)} из 5 · Очки: ${score}`;
    speed += 0.28;
    if (hits >= 5) { running = false; cancelAnimationFrame(raf); await sleep(700); finish(score >= 9 ? 3 : score >= 6 ? 2 : score >= 3 ? 1 : 0, `Очков: ${score} из 10`); }
  }
  host.replaceChildren(info, anvil, bar, btn);
  raf = requestAnimationFrame(loop);
  host.__stop = () => { running = false; cancelAnimationFrame(raf); };
}

// ---------- Ловля духов ----------
function ghosts(host, finish) {
  let score = 0, left = 20, running = true, spawnT = 0;
  const info = h('div', { class: 'gstat' }, 'Очки: 0 · Время: 20');
  const field = h('div', { class: 'ghfield' });
  const slots = Array.from({ length: 9 }, () => h('div', { class: 'ghslot' }));
  slots.forEach((s) => field.append(s));
  const occupied = new Set();
  function spawn() {
    const free = slots.filter((s) => !occupied.has(s));
    if (!free.length || !running) return;
    const slot = free[Math.floor(Math.random() * free.length)];
    occupied.add(slot);
    const bad = Math.random() < 0.22;
    const g = img(bad ? 'assets/svg/minigames/cursed_mask.svg' : 'assets/svg/minigames/ghost.svg', 'ghost ' + (bad ? 'bad' : 'good'));
    let dead = false;
    const rm = () => { dead = true; g.classList.add('gone'); setTimeout(() => { g.remove(); occupied.delete(slot); }, 200); };
    g.addEventListener('pointerdown', (e) => {
      e.preventDefault(); if (dead || !running) return;
      score += bad ? -3 : 1; sfx[bad ? 'death' : 'hit'](); info.textContent = `Очки: ${score} · Время: ${Math.ceil(left)}`;
      const f = h('div', { class: 'gfloat ' + (bad ? 'neg' : 'pos') }, bad ? '−3' : '+1'); slot.append(f); setTimeout(() => f.remove(), 600);
      rm();
    });
    slot.append(g);
    setTimeout(() => { if (!dead) rm(); }, bad ? 1300 : 1000 - Math.min(250, (20 - left) * 14));
  }
  const timer = setInterval(() => {
    left -= 0.1; spawnT += 0.1;
    if (spawnT >= 0.5 - Math.min(0.2, (20 - left) * 0.012)) { spawnT = 0; spawn(); if (Math.random() < 0.3) spawn(); }
    info.textContent = `Очки: ${score} · Время: ${Math.max(0, Math.ceil(left))}`;
    if (left <= 0 && running) { running = false; clearInterval(timer); setTimeout(() => finish(score >= 16 ? 3 : score >= 11 ? 2 : score >= 5 ? 1 : 0, `Очков: ${score}`), 400); }
  }, 100);
  host.__stop = () => { running = false; clearInterval(timer); };
  host.replaceChildren(info, field);
}

// ---------- Три чаши ----------
function cups(host, finish) {
  let round = 0, right = 0, busy = true;
  const info = h('div', { class: 'gstat' }, 'Раунд 1 из 3');
  const table = h('div', { class: 'cuptable' });
  const cs = [0, 1, 2].map((i) => { const c = h('div', { class: 'cup', style: { left: 40 + i * 30 + '%' } }, img('assets/svg/minigames/cup.svg')); table.append(c); return c; });
  const ball = img('assets/svg/minigames/ball.svg', 'cupball'); table.append(ball);
  const msg = h('div', { class: 'dim', style: { fontSize: '18px', minHeight: '24px' } }, '');
  const slotX = [10, 40, 70]; // проценты по горизонтали
  let order = [0, 1, 2]; // order[slot] = чаша
  const place = () => cs.forEach((c, ci) => { c.style.left = slotX[order.indexOf(ci)] + '%'; });
  async function play() {
    busy = true; msg.textContent = 'Следите за шариком…'; info.textContent = `Раунд ${round + 1} из 3`;
    order = [0, 1, 2]; place();
    const ballCup = Math.floor(Math.random() * 3);
    ball.style.left = slotX[ballCup] + 8 + '%'; ball.style.opacity = 1;
    cs.forEach((c) => c.classList.remove('up'));
    cs[ballCup].classList.add('up');
    await sleep(900);
    cs[ballCup].classList.remove('up'); ball.style.opacity = 0;
    await sleep(350);
    const swaps = 7 + round * 3;
    for (let s = 0; s < swaps; s++) {
      const a = Math.floor(Math.random() * 3); let b = Math.floor(Math.random() * 3); if (b === a) b = (a + 1) % 3;
      [order[a], order[b]] = [order[b], order[a]];
      const dur = Math.max(190, 400 - round * 70);
      cs.forEach((c) => { c.style.transition = `left ${dur}ms ease-in-out`; });
      place(); sfx.click(); await sleep(dur + 40);
    }
    msg.textContent = 'Где шарик? Выберите чашу.';
    busy = false;
    cs.forEach((c, ci) => {
      c.onclick = async () => {
        if (busy) return; busy = true;
        const ok = ci === ballCup;
        ball.style.left = slotX[order.indexOf(ballCup)] + 8 + '%'; ball.style.opacity = 1;
        cs[ballCup].classList.add('up'); if (!ok) c.classList.add('up');
        if (ok) { right++; sfx.win(); msg.textContent = 'Верно!'; } else { sfx.death(); msg.textContent = 'Не угадали…'; }
        await sleep(1300);
        cs.forEach((x) => x.classList.remove('up')); ball.style.opacity = 0;
        round++;
        if (round >= 3) { finish(right, `Угадано: ${right} из 3`); } else play();
      };
    });
  }
  host.replaceChildren(info, table, msg);
  play();
}
