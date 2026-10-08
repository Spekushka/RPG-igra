// Сборка одного HTML-файла: node tools/build.js [out.html]
// Бандлит ES-модули без зависимостей, инлайнит CSS и все SVG (window.__SVG).
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const entry = path.join(root, 'src/main.js');
const mods = new Map();

function load(file) {
  if (mods.has(file)) return;
  let src = fs.readFileSync(file, 'utf8');
  const names = [];
  src = src.replace(/^import\s+\*\s+as\s+(\w+)\s+from\s+'([^']+)';?/gm, (_, n, p) => `const ${n} = __req(${JSON.stringify(res(file, p))});`);
  src = src.replace(/^import\s+\{([^}]*)\}\s+from\s+'([^']+)';?/gm, (_, list, p) => {
    const d = list.split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/\s+as\s+/, ': ')).join(', ');
    return `const { ${d} } = __req(${JSON.stringify(res(file, p))});`;
  });
  src = src.replace(/^export\s+(async\s+function|function|const|let|class)\s+(\w+)/gm, (_, kw, n) => { names.push(n); return `${kw} ${n}`; });
  src = src.replace(/^\s*import\s.*from\s.*$/gm, (m) => { throw new Error('unhandled import: ' + m); });
  mods.set(file, { src, names });
  for (const m of src.matchAll(/__req\("([^"]+)"\)/g)) load(m[1]);
}
const res = (from, p) => path.resolve(path.dirname(from), p);

load(entry);
const order = [];
const seen = new Set();
(function visit(f) {
  if (seen.has(f)) return; seen.add(f);
  for (const m of mods.get(f).src.matchAll(/__req\("([^"]+)"\)/g)) visit(m[1]);
  order.push(f);
})(entry);

let js = 'const __mods = {}; const __cache = {};\nfunction __req(id) { if (!__cache[id]) { __cache[id] = {}; __mods[id](__cache[id]); } return __cache[id]; }\n';
for (const f of order) {
  const { src, names } = mods.get(f);
  js += `__mods[${JSON.stringify(f)}] = function (__exp) {\n${src}\n${names.map((n) => `__exp.${n} = ${n};`).join('\n')}\n};\n`;
}
js += `__req(${JSON.stringify(entry)});\n`;

const svg = {};
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith('.svg')) svg[path.relative(root, p)] = fs.readFileSync(p, 'utf8').replace(/<\?xml[^>]*>\s*/, '').trim();
  }
})(path.join(root, 'assets/svg'));

const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const body = fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/<body>([\s\S]*?)<script/)[1];
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');
const three = fs.readFileSync(path.join(root, 'vendor/three.min.js'), 'utf8');
const out = `<title>Пепельный Отряд</title>
<style>${css}</style>
${body}
<script>${safe(three)}</script>
<script>window.__SVG = ${safe(JSON.stringify(svg))};</script>
<script>
${safe(js)}
</script>
`;
const dest = process.argv[2] ?? path.join(root, 'dist/index.html');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out);
console.log('built', dest, (out.length / 1024).toFixed(0) + ' KB,', Object.keys(svg).length, 'svg');
