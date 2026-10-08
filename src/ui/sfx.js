// Простые звуки на WebAudio, без файлов.
let ctx = null;
let muted = false;
try { muted = localStorage.getItem('pepel_mute') === '1'; } catch {}
export const isMuted = () => muted;
export function toggleMute() { muted = !muted; try { localStorage.setItem('pepel_mute', muted ? '1' : '0'); } catch {} return muted; }

function tone(freq, dur, type = 'square', vol = 0.06, slide = 0, delay = 0) {
  if (muted) return;
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  } catch {}
}
function noise(dur, vol = 0.08) {
  if (muted) return;
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    const n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = vol; s.buffer = buf; s.connect(g).connect(ctx.destination); s.start();
  } catch {}
}
export const sfx = {
  click: () => tone(520, 0.06, 'square', 0.04),
  hit: () => { noise(0.12, 0.09); tone(140, 0.12, 'sawtooth', 0.06, -60); },
  crit: () => { noise(0.18, 0.12); tone(200, 0.2, 'sawtooth', 0.08, -120); tone(600, 0.1, 'square', 0.05, 300, 0.05); },
  heal: () => { tone(520, 0.12, 'sine', 0.06, 200); tone(780, 0.16, 'sine', 0.05, 200, 0.08); },
  shield: () => tone(300, 0.15, 'triangle', 0.07, 150),
  magic: () => { tone(300, 0.3, 'sine', 0.06, 500); },
  ult: () => { tone(110, 0.5, 'sawtooth', 0.08, 300); noise(0.4, 0.1); },
  death: () => tone(180, 0.4, 'sawtooth', 0.07, -140),
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'square', 0.05, 0, i * 0.12)),
  lose: () => [330, 262, 196, 147].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.05, 0, i * 0.18)),
  buy: () => { tone(900, 0.06, 'square', 0.04); tone(1200, 0.08, 'square', 0.04, 0, 0.06); },
  status: () => tone(420, 0.1, 'triangle', 0.05, -100),
};
