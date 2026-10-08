// 2.5D-сцена боя на Three.js: персонажи из SVG режутся на слои (тело, голова, руки, оружие, плащ),
// стоят в настоящей 3D-сцене с перспективной камерой, светом, землёй, частицами и тряской камеры.
import { svgText, assetUrl, view } from './dom.js';

const PX = 132; // пикселей дизайна на 1 единицу мира (на плоскости z=0)
const GLOBAL = () => globalThis.THREE;

export function webglOK() {
  try {
    if (!GLOBAL()) return false;
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl'));
  } catch { return false; }
}

const loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const dataUri = (xml) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);

// ---------- Разбор SVG на слои ----------
const layerCache = new Map();
const KIND_Z = { 'arm-l': -0.05, extra: -0.09, body: 0, head: 0.03, 'arm-r': 0.07, weapon: 0.1, base: 0 };
const KIND_ORDER = { 'arm-l': 0, extra: -1, base: 1, body: 2, head: 3, 'arm-r': 4, weapon: 5 };

function partKind(el) {
  const m = /part-([a-z-]+)/.exec(el.getAttribute('class') || '');
  return m ? m[1] : 'body';
}

async function buildLayers(path, quality = 2) {
  const text = await svgText(path);
  if (!text) return null;
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-9999px;top:0;pointer-events:none;visibility:hidden';
  host.innerHTML = text;
  const svg = host.querySelector('svg');
  if (!svg) return null;
  const vb = (svg.getAttribute('viewBox') || '0 0 200 240').split(/\s+/).map(Number);
  const vbW = vb[2], vbH = vb[3];
  svg.setAttribute('width', vbW); svg.setAttribute('height', vbH);
  document.body.append(host);
  const isPart = (e) => /part-/.test(e.getAttribute('class') || '');
  const all = [...svg.querySelectorAll('[class*="part-"]')];
  const outer = all.filter((e) => !all.some((o) => o !== e && o.contains(e)));
  const base = svg.getBoundingClientRect();
  const rects = outer.map((e) => { const r = e.getBoundingClientRect(); return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height }; });
  host.remove();

  const scale = quality;
  const W = Math.round(vbW * scale), H = Math.round(vbH * scale);
  const layers = [];

  async function render(mode, idx) {
    const clone = svg.cloneNode(true);
    const cAll = [...clone.querySelectorAll('[class*="part-"]')];
    const cOuter = cAll.filter((e) => !cAll.some((o) => o !== e && o.contains(e)));
    clone.setAttribute('width', W); clone.setAttribute('height', H);
    if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    if (mode === 'base') {
      for (const e of cOuter) e.setAttribute('display', 'none');
    } else {
      const target = cOuter[idx];
      clone.setAttribute('visibility', 'hidden');
      for (const e of cOuter) if (e !== target) e.setAttribute('display', 'none');
      target.setAttribute('visibility', 'visible');
    }
    const img = await loadImage(dataUri(new XMLSerializer().serializeToString(clone)));
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0, W, H);
    return cv;
  }
  const nonEmpty = (cv) => {
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    for (let i = 3; i < d.length; i += 4 * 37) if (d[i] > 8) return true;
    return false;
  };

  const baseCv = await render('base');
  const hasBase = outer.length === 0 || nonEmpty(baseCv);
  if (hasBase) layers.push({ kind: 'base', cv: baseCv, pivot: { x: vbW / 2, y: vbH - 12 } });
  for (let i = 0; i < outer.length; i++) {
    const kind = partKind(outer[i]);
    const r = rects[i];
    let pivot;
    if (kind === 'head') pivot = { x: r.x + r.w / 2, y: r.y + r.h * 0.9 };
    else if (kind === 'arm-r' || kind === 'arm-l') pivot = { x: r.x + r.w * (kind === 'arm-r' ? 0.45 : 0.55), y: r.y + r.h * 0.14 };
    else if (kind === 'extra') pivot = { x: r.x + r.w / 2, y: r.y + r.h * 0.2 };
    else if (kind === 'weapon') pivot = { x: r.x + r.w / 2, y: r.y + r.h * 0.7 };
    else pivot = { x: r.x + r.w / 2, y: r.y + r.h }; // body: низ
    layers.push({ kind, cv: await render('part', i), pivot });
  }
  return { vbW, vbH, layers };
}
function getLayers(path, q) { if (!layerCache.has(path)) layerCache.set(path, buildLayers(path, q).catch(() => null)); return layerCache.get(path); }

// ---------- Вспомогательные текстуры ----------
function glowTexture(THREE, inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,.35)') {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, inner); gr.addColorStop(0.35, mid); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const THEMES = {
  graveyard: { amb: 0x8fa0d8, ambI: 0.95, key: 0xb8c8ff, keyI: 0.8, warm: 0xff9a4a, cool: 0x6ea0ff, mote: 0xdfe8ff, motes: 'dust' },
  forest: { amb: 0x93b0a0, ambI: 0.95, key: 0xbfe0d0, keyI: 0.7, warm: 0xffb06a, cool: 0x6ec9a0, mote: 0xd8ffcc, motes: 'fire' },
  castle: { amb: 0xb8909a, ambI: 0.95, key: 0xffd0c0, keyI: 0.75, warm: 0xff8a50, cool: 0xc06a9a, mote: 0xffc9a0, motes: 'fire' },
  crypt: { amb: 0x8fb0a0, ambI: 0.9, key: 0xb0ffd8, keyI: 0.6, warm: 0xffa860, cool: 0x58e0a0, mote: 0xb8ffe0, motes: 'dust' },
  hell: { amb: 0xc08878, ambI: 0.95, key: 0xff9a60, keyI: 0.9, warm: 0xff6a2a, cool: 0xff3a2a, mote: 0xffa050, motes: 'fire' },
  void: { amb: 0x9a88d0, ambI: 0.95, key: 0xc8a8ff, keyI: 0.8, warm: 0xb06aff, cool: 0x5a7aff, mote: 0xd0b0ff, motes: 'dust' },
};

// ---------- Сцена ----------
export class Stage3D {
  static async create(bgName) {
    if (!webglOK()) return null;
    try {
      const s = new Stage3D(bgName);
      await s.initBg();
      return s;
    } catch (e) { console.warn('3D недоступно:', e); return null; }
  }

  constructor(bgName) {
    const THREE = GLOBAL();
    this.THREE = THREE;
    this.theme = THEMES[bgName] ?? THEMES.graveyard;
    this.bgName = bgName;
    const canvas = document.createElement('canvas');
    canvas.className = 'scene3d';
    canvas.width = 1280; canvas.height = 720;
    this.canvas = canvas;
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    const coarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
    const k = Math.max(1, Math.min(coarse ? 1.25 : 1.75, (globalThis.__viewK ?? 1) * (window.devicePixelRatio || 1)));
    r.setPixelRatio(k);
    r.setSize(1280, 720, false);
    r.outputEncoding = THREE.sRGBEncoding;
    r.setClearColor(0x07050b, 1);
    this.renderer = r;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 80);
    this.camBase = new THREE.Vector3(0, 1.7, 9.8);
    this.camLook = new THREE.Vector3(0, 1.15, 0);
    this.cam.position.copy(this.camBase);
    this.units = new Map();
    this.fogs = [];
    this.tweens = [];
    this.parts = [];
    this.t = 0; this.shakeA = 0; this.punchA = 0; this.pointer = { x: 0, y: 0 };
    this.onFrame = null;
    this.running = true;
    this.quality = (navigator.hardwareConcurrency ?? 4) <= 2 ? 1.5 : 2;
    this.initLights();
    this.initParticles();
    this.initMotes();
    this._onPointer = (e) => { if (e.pointerType === 'touch') return; this.pointer.x = (e.clientX / window.innerWidth - 0.5) * 2; this.pointer.y = (e.clientY / window.innerHeight - 0.5) * 2; };
    window.addEventListener('pointermove', this._onPointer);
    this.last = performance.now();
    this._raf = requestAnimationFrame((t) => this.frame(t));
  }

  async initBg() {
    const THREE = this.THREE;
    const text = await svgText(`assets/svg/bg/${this.bgName}.svg`);
    const img = await loadImage(dataUri(text.replace('<svg', '<svg width="1280" height="720"')));
    const mk = (sy, sh) => {
      const c = document.createElement('canvas'); c.width = 1280; c.height = Math.round(sh * (1280 / 1280));
      c.getContext('2d').drawImage(img, 0, sy, 1280, sh, 0, 0, 1280, c.height);
      const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
    };
    const HOR = 500;
    const back = mk(0, HOR), floor = mk(HOR, 720 - HOR);
    const zb = -5.5, bh = 6.4, bw = bh * 1280 / HOR;
    const bm = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), new THREE.MeshBasicMaterial({ map: back, depthWrite: false }));
    bm.position.set(0, bh / 2, zb); bm.renderOrder = -10;
    this.scene.add(bm);
    const depth = 14.5, gw = bw;
    const gm = new THREE.Mesh(new THREE.PlaneGeometry(gw, depth), new THREE.MeshBasicMaterial({ map: floor, depthWrite: false, color: 0xe6e6f0 }));
    gm.rotation.x = -Math.PI / 2; gm.position.set(0, 0, zb + depth / 2); gm.renderOrder = -9;
    this.scene.add(gm);
    this.back = bm; this.ground = gm;
    // световые пятна на земле
    const gl = glowTexture(THREE, 'rgba(255,255,255,.9)', 'rgba(255,255,255,.3)');
    const pool = (x, z, size, color) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 0.55), new THREE.MeshBasicMaterial({ map: gl, color, transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); m.renderOrder = -8; this.scene.add(m); return m;
    };
    const fogTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); for (let i = 0; i < 26; i++) { const x = Math.random() * 256, y = 12 + Math.random() * 40, r = 22 + Math.random() * 36; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 64); } const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(2, 1); return t; })();
    for (const [z, y, op, sp] of [[-3.2, 0.9, 0.22, 0.012], [-0.4, 0.5, 0.14, -0.02], [3.6, 0.45, 0.12, 0.03]]) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(22, 2.6), new THREE.MeshBasicMaterial({ map: fogTex.clone(), color: new THREE.Color(this.theme.cool).multiplyScalar(0.55), transparent: true, opacity: op * 0.7, depthWrite: false, depthTest: false }));
      f.material.map.wrapS = THREE.RepeatWrapping; f.material.map.repeat.set(2, 1); f.material.map.needsUpdate = true;
      f.position.set(0, y, z); f.renderOrder = z > 1 ? 4000 : -6; this.scene.add(f); this.fogs.push({ f, sp });
    }
    this.poolWarm = pool(-3.1, 0.6, 7.5, this.theme.warm);
    this.poolCool = pool(3.6, 0.6, 7.5, this.theme.cool);
  }

  initLights() {
    const THREE = this.THREE, T = this.theme;
    this.scene.add(new THREE.AmbientLight(T.amb, T.ambI));
    const key = new THREE.DirectionalLight(T.key, T.keyI);
    key.position.set(-3, 5, 6); this.scene.add(key);
    this.warm = new THREE.PointLight(T.warm, 1.15, 14, 2); this.warm.position.set(-3.6, 1.6, 2.2); this.scene.add(this.warm);
    this.cool = new THREE.PointLight(T.cool, 0.9, 14, 2); this.cool.position.set(3.8, 1.6, 2.2); this.scene.add(this.cool);
    this.flashL = new THREE.PointLight(0xffffff, 0, 10, 2); this.flashL.position.set(0, 1.5, 2); this.scene.add(this.flashL);
  }

  initParticles() {
    const THREE = this.THREE;
    this.glow = glowTexture(THREE);
    this.pool = [];
    for (let i = 0; i < 90; i++) {
      const m = new THREE.SpriteMaterial({ map: this.glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
      const s = new THREE.Sprite(m);
      s.visible = false; s.renderOrder = 6000; s.userData = { life: 0 };
      this.scene.add(s); this.pool.push(s);
    }
  }
  spawn(x, y, z, color, o = {}) {
    const p = this.pool.find((s) => !s.userData.life);
    if (!p) return;
    const d = p.userData;
    p.position.set(x, y, z);
    p.material.color.setHex(color);
    p.material.opacity = 1;
    const sz = o.size ?? 0.35;
    p.scale.set(sz, sz, 1);
    d.life = d.max = o.life ?? 0.7;
    d.vx = o.vx ?? 0; d.vy = o.vy ?? 0; d.vz = o.vz ?? 0; d.g = o.g ?? 0; d.grow = o.grow ?? 0; d.size = sz;
    p.visible = true;
  }
  burst(x, y, z, color, n = 10, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (o.speed ?? 2.4) * (0.4 + Math.random() * 0.8);
      this.spawn(x, y, z + 0.2, color, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.9 + (o.up ?? 0.8), vz: (Math.random() - 0.3) * sp * 0.5, g: o.g ?? -3.2, life: 0.45 + Math.random() * 0.4, size: (o.size ?? 0.3) * (0.6 + Math.random() * 0.7) });
    }
  }

  initMotes() {
    const THREE = this.THREE, n = 140;
    const pos = new Float32Array(n * 3), vel = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 16; pos[i * 3 + 1] = Math.random() * 5; pos[i * 3 + 2] = -4 + Math.random() * 9; vel[i] = 0.1 + Math.random() * 0.35; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: this.theme.mote, size: 0.07, map: this.glow ?? glowTexture(THREE), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
    this.motes = new THREE.Points(g, m); this.motes.renderOrder = 5000; this.moteVel = vel; this.motePos = pos;
    this.moteFire = this.theme.motes === 'fire';
    this.scene.add(this.motes);
  }

  // ---------- Юниты ----------
  addUnit(uid, path, o) {
    const h = new UnitHandle(this, uid, path, o);
    this.units.set(uid, h);
    return h;
  }
  removeUnit(uid) { const h = this.units.get(uid); if (h) { h.dispose(); this.units.delete(uid); } }
  worldOf(xPx, yPx) { return { x: (xPx - 640) / PX, z: (yPx - 525) / 22 * 0.42 }; }
  tween(dur, fn, done) { this.tweens.push({ t0: this.t, dur, fn, done }); }
  shake(a) { this.shakeA = Math.max(this.shakeA, a); }
  punch(a) { this.punchA = Math.max(this.punchA, a); }
  flash(color, power = 2.2) { this.flashL.color.setHex(color); this.flashL.intensity = power; }

  // орб от одного юнита к другому
  projectile(from, to, color, done) {
    const a = from.chest(), b = to.chest();
    const dur = 0.34;
    this.tween(dur, (p) => {
      const x = a.x + (b.x - a.x) * p, y = a.y + (b.y - a.y) * p + Math.sin(p * Math.PI) * 0.45, z = a.z + (b.z - a.z) * p;
      this.spawn(x, y, z + 0.3, color, { size: 0.55, life: 0.18, grow: 0 });
      this.spawn(x + (Math.random() - 0.5) * 0.15, y + (Math.random() - 0.5) * 0.15, z + 0.3, color, { size: 0.22, life: 0.35, vy: 0.6 });
    }, done);
  }
  aura(h, color) {
    const c = h.chest();
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; this.spawn(c.x + Math.cos(a) * 0.55, c.y - 0.3 + Math.sin(a) * 0.1, c.z + 0.2, color, { vy: 1.4, vx: Math.cos(a) * 0.2, life: 0.7, size: 0.3 }); }
  }

  // ---------- Кадр ----------
  frame(now) {
    if (!this.running) return;
    this._raf = requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.t += dt;
    this.update(dt);
    this.renderer.render(this.scene, this.cam);
    this.onFrame?.();
  }

  update(dt) {
    const t = this.t;
    // твины
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const w = this.tweens[i], p = Math.min(1, (t - w.t0) / w.dur);
      w.fn(p);
      if (p >= 1) { this.tweens.splice(i, 1); w.done?.(); }
    }
    for (const u of this.units.values()) u.update(dt, t);
    // частицы
    for (const p of this.pool) {
      const d = p.userData; if (!d.life) continue;
      d.life -= dt;
      if (d.life <= 0) { d.life = 0; p.visible = false; continue; }
      d.vy += d.g * dt;
      p.position.x += d.vx * dt; p.position.y += d.vy * dt; p.position.z += d.vz * dt;
      const k = d.life / d.max;
      p.material.opacity = Math.min(1, k * 1.6);
      const s = d.size * (0.4 + k * 0.8) + d.grow * (1 - k);
      p.scale.set(s, s, 1);
    }
    // пылинки / искры
    const pos = this.motePos;
    for (let i = 0; i < this.moteVel.length; i++) {
      pos[i * 3 + 1] += this.moteVel[i] * dt * (this.moteFire ? 1.4 : 0.35);
      pos[i * 3] += Math.sin(t * 0.6 + i) * dt * 0.15;
      if (pos[i * 3 + 1] > 5.2) pos[i * 3 + 1] = 0;
    }
    this.motes.geometry.attributes.position.needsUpdate = true;
    for (const { f, sp } of this.fogs) f.material.map.offset.x += sp * dt;
    // свет
    this.warm.intensity = 1.1 + Math.sin(t * 9) * 0.07 + Math.sin(t * 5.3) * 0.08;
    this.flashL.intensity *= Math.pow(0.0008, dt);
    // камера
    this.shakeA *= Math.pow(0.02, dt); this.punchA *= Math.pow(0.05, dt);
    const px = view.rot ? 0 : this.pointer.x, py = view.rot ? 0 : this.pointer.y;
    const sx = (Math.random() - 0.5) * this.shakeA, sy = (Math.random() - 0.5) * this.shakeA;
    this.cam.position.set(this.camBase.x + Math.sin(t * 0.25) * 0.18 + px * 0.28 + sx, this.camBase.y + Math.sin(t * 0.33) * 0.05 - py * 0.1 + sy, this.camBase.z - this.punchA);
    this.cam.lookAt(this.camLook.x + px * 0.1, this.camLook.y, this.camLook.z);
    this.cam.updateMatrixWorld();
  }

  project(x, y, z) {
    const v = new this.THREE.Vector3(x, y, z).project(this.cam);
    return { x: (v.x * 0.5 + 0.5) * 1280, y: (-v.y * 0.5 + 0.5) * 720 };
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this._raf);
    window.removeEventListener('pointermove', this._onPointer);
    for (const u of this.units.values()) u.dispose();
    this.scene.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; if (m) { (Array.isArray(m) ? m : [m]).forEach((x) => { x.map?.dispose?.(); x.dispose(); }); } });
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
  }
}


// ---------- Персонаж ----------
class UnitHandle {
  constructor(stage, uid, path, o) {
    const THREE = stage.THREE;
    this.S = stage; this.uid = uid; this.o = o;
    this.W = o.w / PX; this.H = o.h / PX;
    this.root = new THREE.Group();
    this.flip = new THREE.Group();
    this.flip.scale.x = o.flip ? -1 : 1;
    this.root.add(this.flip);
    this.root.visible = false;
    stage.scene.add(this.root);
    this.phase = Math.random() * 6.28;
    this.pos = { x: 0, z: 0 }; this.target = null;
    this.off = { x: 0, y: 0, z: 0 };
    this.rotZ = 0; this.fade = 1; this.hurtT = 0; this.castT = 0; this.acted = false; this.glow = false; this.dead = false; this.swing = 0;
    this.parts = [];
    this.screen = { x: 0, y: 0, s: 1, top: 0 };
    // тень
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(this.W * 0.95, this.W * 0.3), new THREE.MeshBasicMaterial({ map: stage.shadowTex ??= (() => { const t = glowTexture(THREE, 'rgba(0,0,0,.85)', 'rgba(0,0,0,.45)'); return t; })(), transparent: true, depthWrite: false, depthTest: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.025; sh.renderOrder = -7;
    this.root.add(sh); this.shadow = sh;
    this.ready = getLayers(path, stage.quality).then((L) => { if (L && !this.disposed) this.build(L); });
  }

  build(L) {
    const THREE = this.S.THREE, { W, H } = this;
    const X = (vx) => (vx / L.vbW - 0.5) * W, Y = (vy) => (1 - vy / L.vbH) * H;
    const baseY = -(12 / L.vbH) * H; // земля SVG чуть выше нижнего края
    for (const l of L.layers) {
      const tex = new THREE.CanvasTexture(l.cv);
      tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4; tex.premultiplyAlpha = false;
      const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.02, depthWrite: false, depthTest: false, side: THREE.DoubleSide, emissive: 0x000000 });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
      const piv = new THREE.Group();
      const pxw = X(l.pivot.x), pyw = Y(l.pivot.y) + baseY;
      piv.position.set(pxw, pyw, KIND_Z[l.kind] ?? 0);
      mesh.position.set(-pxw, -pyw + H / 2 + baseY, 0);
      piv.add(mesh);
      this.flip.add(piv);
      this.parts.push({ kind: l.kind, piv, mat, mesh, base: piv.position.clone(), order: KIND_ORDER[l.kind] ?? 2 });
    }
    this.root.visible = true;
    this.update(0, this.S.t);
  }

  chest() { return { x: this.pos.x + this.off.x, y: this.H * 0.5, z: this.pos.z + this.off.z }; }
  head() { return { x: this.pos.x + this.off.x, y: this.H * 0.88, z: this.pos.z + this.off.z }; }

  setPos(xPx, yPx, instant = false) {
    const w = this.S.worldOf(xPx, yPx);
    if (instant || !this.target) { this.pos.x = w.x; this.pos.z = w.z; }
    this.target = w;
  }

  // ---- действия ----
  lunge(toX, dur = 0.46) {
    const S = this.S, sx = this.off.x, dir = Math.sign(toX - this.pos.x) || 1, dist = Math.min(Math.abs(toX - this.pos.x) - 0.9, 3.4);
    S.tween(dur, (p) => {
      const k = p < 0.4 ? p / 0.4 : 1 - (p - 0.4) / 0.6;
      this.off.x = sx + dir * Math.max(0.4, dist) * (k * k * (3 - 2 * k));
      this.swing = p < 0.35 ? -p / 0.35 * 1.2 : p < 0.55 ? -1.2 + (p - 0.35) / 0.2 * 2.6 : 1.4 * (1 - (p - 0.55) / 0.45);
    }, () => { this.off.x = sx; this.swing = 0; });
  }
  cast(dur = 0.5) { this.castT = this.S.t; this.S.tween(dur, (p) => { this.off.y = Math.sin(p * Math.PI) * 0.3; }, () => { this.off.y = 0; }); }
  hurt(dir = 1) {
    this.hurtT = this.S.t;
    const S = this.S, sx = this.off.x;
    S.tween(0.35, (p) => { this.off.x = sx + dir * 0.28 * Math.sin(p * Math.PI) * (1 - p * 0.3); }, () => { this.off.x = sx; });
  }
  die() { if (this.dead) return; this.dead = true; const S = this.S; S.tween(0.7, (p) => { this.rotZ = p * 1.35 * (this.o.flip ? -1 : 1) * (this.o.side === 'ally' ? -1 : 1); this.fade = 1 - p; this.off.y = -p * 0.25; }); }
  revive() { this.dead = false; this.rotZ = 0; this.fade = 1; this.off.y = 0; }
  setActed(b) { this.acted = b; }
  setGlow(b) { this.glow = b; }

  update(dt, t) {
    if (!this.parts.length) return;
    // скольжение к целевой позиции
    if (this.target) {
      const k = 1 - Math.pow(0.0005, dt);
      this.pos.x += (this.target.x - this.pos.x) * k; this.pos.z += (this.target.z - this.pos.z) * k;
    }
    this.root.position.set(this.pos.x + this.off.x, this.off.y, this.pos.z + this.off.z);
    this.root.rotation.z = this.rotZ;
    const ph = t * 2.2 + this.phase, still = this.acted || this.dead ? 0.35 : 1;
    const hurtK = Math.max(0, 1 - (t - this.hurtT) / 0.35), castK = Math.max(0, 1 - (t - this.castT) / 0.5);
    const zRank = Math.round((this.pos.z + this.off.z + 3) * 40) * 12;
    for (const p of this.parts) {
      const v = p.piv;
      v.rotation.z = 0; v.scale.set(1, 1, 1); v.position.copy(p.base);
      switch (p.kind) {
        case 'body': case 'base': v.scale.y = 1 + Math.sin(ph) * 0.014 * still; v.scale.x = 1 - Math.sin(ph) * 0.006 * still; break;
        case 'head': v.rotation.z = Math.sin(ph + 0.6) * 0.035 * still; v.position.y += Math.sin(ph) * 0.012 * still; break;
        case 'arm-r': v.rotation.z = (Math.sin(ph + 1.2) * 0.07 * still) + this.swing * 0.9 * (this.o.flip ? 1 : 1) * -1 + castK * 0.9; break;
        case 'arm-l': v.rotation.z = Math.sin(ph + 2) * -0.06 * still - castK * 0.5; break;
        case 'weapon': v.rotation.z = Math.sin(ph + 1.2) * 0.05 * still + this.swing * -0.5; break;
        case 'extra': v.rotation.z = Math.sin(ph * 0.8 + 2.4) * 0.05 * still; v.scale.x = 1 + Math.sin(ph * 0.8) * 0.02 * still; break;
        default: break;
      }
      const m = p.mat;
      m.opacity = this.fade;
      const g = this.acted && !this.dead ? 0.45 : 1;
      m.color.setScalar(g);
      const em = hurtK * 0.9;
      const gl = this.glow ? 0.28 + Math.sin(t * 7) * 0.12 : 0;
      m.emissive.setRGB(em + gl * 1.0 + castK * 0.25, gl * 0.8 + castK * 0.25, castK * 0.25 + (hurtK ? 0 : 0));
      p.mesh.renderOrder = 100 + zRank + p.order;
    }
    this.shadow.material.opacity = this.fade * 0.9;
    this.shadow.position.x = -this.off.x * 0 ; this.shadow.position.y = 0.025 - this.off.y;
    // экранные координаты для DOM-оверлея
    const f = this.S.project(this.root.position.x, 0, this.root.position.z);
    const tp = this.S.project(this.root.position.x, this.H, this.root.position.z);
    this.screen.x = f.x; this.screen.y = f.y;
    this.screen.s = Math.abs(f.y - tp.y) / (this.o.h * 1);
    this.screen.top = tp.y;
  }

  dispose() {
    this.disposed = true;
    this.S.scene.remove(this.root);
    this.root.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; if (m) { m.map?.dispose?.(); m.dispose?.(); } });
  }
}

export const skillColor = (icon) => ({
  fireball: 0xff7a2a, flame_wave: 0xff7a2a, meteor: 0xff5a1a, torch_throw: 0xff8a3a,
  ice_shard: 0x7ccbff, blizzard: 0x9fdcff, soul_drain: 0x8be07a, raise_dead: 0x8be07a, curse_hex: 0xb36bff, resurrect: 0xffe28a,
  holy_smite: 0xffe28a, heal: 0x65e69a, bless: 0xffe28a, guard: 0x8cc7ff, shield_bash: 0xcfd8ee, taunt: 0xffcf6a,
  poison_blade: 0x7bd96a, throw_flask: 0x7bd96a, arrow_shot: 0xe8dcb0, multishot: 0xe8dcb0, lightning: 0xfff27a, song_of_valor: 0xffd86a,
  rage_strike: 0xff4a3a, whirlwind: 0xffb070, execute: 0xff3a3a, backstab: 0xd0b0ff, smoke_bomb: 0xb0a0c0,
}[icon] ?? 0xffe0c0);
export const statusColor = (id) => ({ poison: 0x7bd96a, burn: 0xff7a2a, bleed: 0xd02a2a, freeze: 0x9fdcff, stun: 0xffe28a, curse: 0xb36bff, weak: 0xaaaaaa, regen: 0x65e69a, atkup: 0xff7a5a, taunt: 0xffcf6a, evade: 0xcccccc }[id] ?? 0xffffff);
void assetUrl;
