/* ============================================================
   RuiC-TextPV — 核心工具层
   数学 / 缓动 / 确定性随机 / 色彩 / 中日文判断
   ============================================================ */
'use strict';
const Z = (window.Z = window.Z || {});

/* ---------- 数学 ---------- */
Z.clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
Z.lerp = (a, b, t) => a + (b - a) * t;
Z.inv = (a, b, x) => (b === a ? 0 : (x - a) / (b - a));
Z.smoothstep = (a, b, x) => { const t = Z.clamp(Z.inv(a, b, x)); return t * t * (3 - 2 * t); };
Z.TAU = Math.PI * 2;
Z.DEG = Math.PI / 180;
Z.dist = (x0, y0, x1, y1) => Math.hypot(x1 - x0, y1 - y0);

/* ---------- 缓动 ---------- */
Z.E = {
  lin: x => Z.clamp(x),
  inQuad: x => { x = Z.clamp(x); return x * x; },
  outQuad: x => { x = Z.clamp(x); return 1 - (1 - x) * (1 - x); },
  inCubic: x => { x = Z.clamp(x); return x * x * x; },
  outCubic: x => { x = Z.clamp(x); return 1 - Math.pow(1 - x, 3); },
  inOutCubic: x => { x = Z.clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; },
  inQuart: x => { x = Z.clamp(x); return x * x * x * x; },
  outQuart: x => { x = Z.clamp(x); return 1 - Math.pow(1 - x, 4); },
  outQuint: x => { x = Z.clamp(x); return 1 - Math.pow(1 - x, 5); },
  outExpo: x => { x = Z.clamp(x); return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); },
  inExpo: x => { x = Z.clamp(x); return x <= 0 ? 0 : Math.pow(2, 10 * x - 10); },
  inOutExpo: x => { x = Z.clamp(x); if (x <= 0 || x >= 1) return x; return x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2; },
  outBack: (x, s = 1.9) => { x = Z.clamp(x); const c = s + 1; return 1 + c * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); },
  outElastic: x => { x = Z.clamp(x); if (x === 0 || x === 1) return x; return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (Z.TAU / 3)) + 1; },
  outBounce: x => {
    x = Z.clamp(x); const n = 7.5625, d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
    return n * (x -= 2.625 / d) * x + 0.984375;
  },
  inOutSine: x => { x = Z.clamp(x); return -(Math.cos(Math.PI * x) - 1) / 2; },
  outSine: x => { x = Z.clamp(x); return Math.sin(x * Math.PI / 2); },
};

/* ---------- 确定性哈希随机 ----------
   同一个 seed 在任何机器、任何帧率下都得到同一串数值：
   所有"随机"演出都必须走这里，否则导出结果不可复现。 */
const _hashCache = new Map();
Z.sid = s => {
  let v = _hashCache.get(s);
  if (v !== undefined) return v;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  v = h >>> 0; _hashCache.set(s, v);
  if (_hashCache.size > 4000) _hashCache.clear();
  return v;
};
/* 最多 5 个整数 key → uint32 */
Z.h = function (a, b, c, d, e) {
  let h = 0x9e3779b9 ^ (a | 0);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = (h + Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35)) | 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h = (h + Math.imul((c | 0) + 0x5bd1e995, 0x27d4eb2f)) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x165667b1);
  h = (h + Math.imul((d | 0) + 0x1b873593, 0x85ebca6b)) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x27d4eb2f);
  h = (h + Math.imul((e | 0) + 0x68e31da4, 0x9e3779b1)) | 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return h >>> 0;
};
Z.rnd = (a, b, c, d, e) => Z.h(a, b, c, d, e) / 4294967296;        // 0..1
Z.rsign = (a, b, c, d, e) => Z.rnd(a, b, c, d, e) * 2 - 1;         // -1..1
Z.rrange = (lo, hi, a, b, c, d, e) => lo + (hi - lo) * Z.rnd(a, b, c, d, e);
Z.rpick = (arr, a, b, c, d) => arr[Math.floor(Z.rnd(a, b, c, d) * arr.length) % arr.length];

/* 可复现随机流（mulberry32）：规划阶段用来抽签 */
Z.seeded = seed => {
  let s = seed >>> 0;
  const f = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.range = (lo, hi) => lo + (hi - lo) * f();
  f.rr = f.range;
  f.rsign = (scale = 1) => (f() * 2 - 1) * scale;
  f.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * f());
  f.pick = arr => arr[Math.floor(f() * arr.length) % arr.length];
  f.chance = p => f() < p;
  /* 加权抽签：接受 [{w,v}] / [[v,w]] */
  f.weighted = list => {
    let tot = 0; for (const it of list) tot += Array.isArray(it) ? it[1] : it.w;
    if (!(tot > 0)) return null;
    let x = f() * tot;
    for (const it of list) { const w = Array.isArray(it) ? it[1] : it.w; if ((x -= w) <= 0) return Array.isArray(it) ? it[0] : it.v; }
    const last = list[list.length - 1]; return Array.isArray(last) ? last[0] : last.v;
  };
  return f;
};

/* 平滑一维值噪声（漂移 / 摇曳） */
Z.noise1 = (x, seed = 0) => {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return Z.lerp(Z.rsign(seed, i), Z.rsign(seed, i + 1), u);
};
Z.noise2 = (x, y, seed = 0) => Z.lerp(Z.noise1(x, seed), Z.noise1(x, seed + 977), Z.smoothstep(0, 1, y - Math.floor(y)));

/* ---------- 色彩 ---------- */
Z.hex2rgb = h => {
  h = String(h || '#000').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
Z.rgba = (h, a = 1) => { const [r, g, b] = Z.hex2rgb(h); return `rgba(${r},${g},${b},${a})`; };
Z.mix = (h1, h2, t) => {
  const a = Z.hex2rgb(h1), b = Z.hex2rgb(h2);
  return '#' + a.map((v, i) => Math.round(Z.lerp(v, b[i], t)).toString(16).padStart(2, '0')).join('');
};
Z.lum = h => { const [r, g, b] = Z.hex2rgb(h); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
Z.isDark = h => Z.lum(h) < 0.5;
Z.rgb2hex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(Z.clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
Z.hsl2hex = (h, s, l) => {
  h = ((h % 360) + 360) % 360 / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return Z.rgb2hex(f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255);
};
Z.hex2hsl = hex => {
  const [r, g, b] = Z.hex2rgb(hex).map(v => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};
/* WCAG 对比度 */
Z.contrast = (a, b) => {
  const L = h => { const c = Z.hex2rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const x = L(a), y = L(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
/* 背景上读不出来的颜色，逐级提亮/压暗到可读 */
Z.readable = (hex, bg, min = 3) => {
  if (Z.contrast(hex, bg) >= min) return hex.toUpperCase();
  let [h, s, l] = Z.hex2hsl(hex);
  const dark = Z.isDark(bg);
  for (let i = 0; i < 26; i++) {
    l = dark ? Math.min(0.97, l + 0.032) : Math.max(0.03, l - 0.032);
    const c = Z.hsl2hex(h, s, l);
    if (Z.contrast(c, bg) >= min) return c;
  }
  return dark ? '#FFFFFF' : '#111111';
};
/* 色彩搭配：一半用调好的互补对，一半现算 */
Z.PAIRS = [['#16F4D4', '#F5A50C'], ['#FF2A2A', '#2AA8FF'], ['#FF2BD6', '#2BFF88'], ['#FFE600', '#7B2BFF'],
  ['#FF6A00', '#00C2B8'], ['#FF6FAE', '#B6FF3B'], ['#00E0FF', '#FF3D6E'], ['#C8FF00', '#FF00A8'],
  ['#4D6BFF', '#FFB000'], ['#FF4B2B', '#2BD9FF'], ['#8CFF00', '#FF0090'], ['#00FFC2', '#FF5500']];
Z.rollPalette = (bg, rnd = Math.random) => {
  const dark = Z.isDark(bg);
  let a, b, mode;
  if (rnd() < 0.42) {
    mode = 'curated';
    [a, b] = Z.PAIRS[Math.floor(rnd() * Z.PAIRS.length)];
    if (rnd() < 0.5) [a, b] = [b, a];
    if (!dark) { a = Z.hsl2hex(Z.hex2hsl(a)[0], 0.95, 0.46); b = Z.hsl2hex(Z.hex2hsl(b)[0], 0.95, 0.46); }
  } else {
    mode = 'harmony';
    const h = rnd() * 360, gap = [180, 160, 145, 130][Math.floor(rnd() * 4)] * (rnd() < 0.5 ? 1 : -1);
    const s = 0.82 + rnd() * 0.18, l = dark ? 0.53 + rnd() * 0.1 : 0.43 + rnd() * 0.08;
    a = Z.hsl2hex(h, s, l); b = Z.hsl2hex(h + gap, s, l);
  }
  const r = rnd();
  const ha = Z.hex2hsl(a)[0], hb = Z.hex2hsl(b)[0];
  let accent = r < 0.35 ? a : r < 0.6 ? b : Z.hsl2hex((ha + hb) / 2 + (rnd() < 0.5 ? 0 : 180), 0.9, dark ? 0.6 : 0.45);
  accent = Z.readable(accent, bg, 3);
  return { accent, ghostA: a, ghostB: b, mode };
};

/* ---------- 文字脚本判断 ---------- */
Z.isHan = c => /[\u3400-\u9FFF\uF900-\uFAFF々〆ヶ]/.test(c);
Z.isHira = c => /[\u3041-\u309F]/.test(c);
Z.isKata = c => /[\u30A0-\u30FF\u31F0-\u31FF\uFF66-\uFF9F]/.test(c);
Z.isSmallKana = c => 'ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ'.includes(c);
Z.isPunct = c => /[、。，．,.!?！？…‥・「」『』（）()【】〈〉《》〔〕［］\[\]'"“”‘’ー〜～:：;；\-—―~·]/.test(c);
Z.isLatin = c => /[A-Za-z0-9]/.test(c);
Z.isCJK = c => Z.isHan(c) || Z.isHira(c) || Z.isKata(c);
/* 竖排时需要旋转 90° 的字符 */
Z.VERT_ROT = 'ー〜～…‥―—-()（）「」『』【】〈〉《》〔〕[]［］→←:：;；=＝';
/* 标点压缩：这些字符在竖排里要偏到右上/右下 */
Z.VERT_SHIFT = '、。，．';

Z.fmtTime = (t, fps) => {
  t = Math.max(0, t);
  const m = Math.floor(t / 60), s = Math.floor(t % 60), f = Math.floor((t % 1) * (fps || 100));
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${fps ? ':' + String(f).padStart(2, '0') : '.' + String(f).padStart(2, '0')}`;
};
Z.fmtBytes = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
