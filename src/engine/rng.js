// Детерминированный ГСЧ (mulberry32) — нужен для сидов и ежедневного забега.
export function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h >>> 0) || 1;
}

export function makeRng(seed = Date.now()) {
  let a = (typeof seed === 'string' ? hashSeed(seed) : seed) >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.int = (n) => Math.floor(rng() * n);
  rng.range = (lo, hi) => lo + rng.int(hi - lo + 1);
  rng.pick = (arr) => arr[rng.int(arr.length)];
  rng.chance = (p) => rng() < p;
  rng.shuffle = (arr) => {
    const r = arr.slice();
    for (let i = r.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [r[i], r[j]] = [r[j], r[i]];
    }
    return r;
  };
  rng.weighted = (items, wf = (x) => x.w ?? 1) => {
    const total = items.reduce((s, x) => s + wf(x), 0);
    let r = rng() * total;
    for (const it of items) {
      r -= wf(it);
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  };
  rng.state = () => a;
  return rng;
}
