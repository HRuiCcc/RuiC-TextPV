/* ============================================================
   RuiC-TextPV — 字体：目录、按需加载、字形栅格化
   中文优先：黑体 / 宋体 / 楷体 / 圆体 / 书法 / 装饰 / 像素
   ============================================================ */
(() => {
'use strict';

/* 本地兜底字体栈（Google Fonts 不可达时仍然能画） */
const FB_SANS = '"PingFang SC","Microsoft YaHei","Hiragino Sans GB","Noto Sans CJK SC","Source Han Sans SC",sans-serif';
const FB_SERIF = '"Songti SC","SimSun","Hiragino Mincho ProN","Noto Serif CJK SC",serif';
const FB_KAI = '"Kaiti SC","STKaiti","KaiTi",serif';
const FB_MONO = '"SF Mono",Menlo,Consolas,"Noto Sans Mono CJK SC",monospace';

/* roles: display(标题) serif(衬线) body(正文) mono(数据/HUD)
   每个 role 是一组候选 key，规划器从里面挑一个用 */
Z.FONTS = {
  /* ---- 黑体 / 现代 ---- */
  sans_black: { label: '思源黑体 Heavy', family: '"Noto Sans SC"', weight: 900, kind: 'sans', fb: FB_SANS, gf: 'Noto+Sans+SC:wght@400;500;700;900' },
  sans_bold: { label: '思源黑体 Bold', family: '"Noto Sans SC"', weight: 700, kind: 'sans', fb: FB_SANS, gf: 'Noto+Sans+SC:wght@400;500;700;900' },
  sans_med: { label: '思源黑体 Medium', family: '"Noto Sans SC"', weight: 500, kind: 'sans', fb: FB_SANS, gf: 'Noto+Sans+SC:wght@400;500;700;900' },
  sans_light: { label: '思源黑体 Light', family: '"Noto Sans SC"', weight: 400, kind: 'sans', fb: FB_SANS, gf: 'Noto+Sans+SC:wght@400;500;700;900' },
  /* ---- 宋体 / 衬线 ---- */
  serif_black: { label: '思源宋体 Heavy', family: '"Noto Serif SC"', weight: 900, kind: 'serif', fb: FB_SERIF, gf: 'Noto+Serif+SC:wght@400;700;900' },
  serif_bold: { label: '思源宋体 Bold', family: '"Noto Serif SC"', weight: 700, kind: 'serif', fb: FB_SERIF, gf: 'Noto+Serif+SC:wght@400;700;900' },
  serif: { label: '思源宋体 Regular', family: '"Noto Serif SC"', weight: 400, kind: 'serif', fb: FB_SERIF, gf: 'Noto+Serif+SC:wght@400;700;900' },
  wenkai: { label: '霞鹜文楷', family: '"LXGW WenKai TC"', weight: 400, kind: 'serif', fb: FB_KAI, gf: 'LXGW+WenKai+TC' },
  /* ---- 楷 / 手写 / 书法 ---- */
  mashan: { label: '马善政毛笔楷书', family: '"Ma Shan Zheng"', weight: 400, kind: 'brush', fb: FB_KAI, gf: 'Ma+Shan+Zheng' },
  longcang: { label: '龙藏体', family: '"Long Cang"', weight: 400, kind: 'hand', fb: FB_KAI, gf: 'Long+Cang' },
  zhimang: { label: '志莽行书', family: '"Zhi Mang Xing"', weight: 400, kind: 'hand', fb: FB_KAI, gf: 'Zhi+Mang+Xing' },
  liujian: { label: '柳建毛草', family: '"Liu Jian Mao Cao"', weight: 400, kind: 'hand', fb: FB_KAI, gf: 'Liu+Jian+Mao+Cao' },
  /* ---- 装饰 / 展示 ---- */
  xiaowei: { label: '站酷小薇', family: '"ZCOOL XiaoWei"', weight: 400, kind: 'display', fb: FB_SERIF, gf: 'ZCOOL+XiaoWei' },
  kuaile: { label: '站酷快乐体', family: '"ZCOOL KuaiLe"', weight: 400, kind: 'display', fb: FB_SANS, gf: 'ZCOOL+KuaiLe' },
  qingke: { label: '站酷庆科黄油体', family: '"ZCOOL QingKe HuangYou"', weight: 400, kind: 'display', fb: FB_SANS, gf: 'ZCOOL+QingKe+HuangYou' },
  round: { label: 'M PLUS 圆体', family: '"M PLUS Rounded 1c"', weight: 800, kind: 'round', fb: FB_SANS, gf: 'M+PLUS+Rounded+1c:wght@800' },
  dela: { label: 'Dela 特粗黑', family: '"Dela Gothic One"', weight: 400, kind: 'display', fb: FB_SANS, gf: 'Dela+Gothic+One' },
  /* ---- 像素 / 等宽 ---- */
  dot: { label: '点阵像素', family: '"DotGothic16"', weight: 400, kind: 'pixel', fb: FB_SANS, gf: 'DotGothic16' },
  mono: { label: '等宽数据体', family: '"IBM Plex Mono"', weight: 500, kind: 'mono', fb: FB_MONO, gf: 'IBM+Plex+Mono:wght@500;600' },
};
Z.FONT_KEYS = Object.keys(Z.FONTS);

/* 用户自定义字体 */
Z.addFont = (key, label, family, weight = 400, kind = 'custom') => {
  Z.FONTS[key] = { label, family: `"${String(family).replace(/"/g, '')}"`, weight, kind, fb: FB_SANS, user: true };
  Z.glyphs.clear();
};
Z.loadFontFile = async (file) => {
  const buf = await file.arrayBuffer();
  const fam = 'ZF_' + file.name.replace(/\.[^.]+$/, '').replace(/[^\w]/g, '_');
  const face = new FontFace(fam, buf);
  await face.load();
  document.fonts.add(face);
  const key = 'user_' + fam;
  Z.addFont(key, file.name.replace(/\.[^.]+$/, ''), fam, 400, 'custom');
  return key;
};

Z.fontCSS = (key, px) => {
  const f = Z.FONTS[key] || Z.FONTS.sans_bold;
  return `${f.weight} ${px.toFixed(2)}px ${f.family},${f.fb}`;
};
Z.fontLabel = key => (Z.FONTS[key] ? Z.FONTS[key].label : key);

/* ---- Google Fonts 按需加载：一个 family 一个 <link>，用到才加载 ---- */
const gfJobs = new Map();
function attachGoogle(spec, onReady) {
  if (!spec || typeof document === 'undefined' || !document.head) return Promise.resolve();
  if (gfJobs.has(spec)) { const p = gfJobs.get(spec); if (onReady) p.then(onReady); return p; }
  const job = new Promise(res => {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + spec + '&display=swap';
    let done = false;
    const finish = () => { if (done) return; done = true; res(); setTimeout(() => { if (onReady) onReady(); }, 60); };
    l.onload = finish; l.onerror = finish;
    setTimeout(finish, 6000);
    document.head.appendChild(l);
  });
  gfJobs.set(spec, job);
  return job;
}
/* 加载一份计划里实际用到的字体 */
Z.ensureFonts = async (plan) => {
  const keys = Z.fontsOfPlan(plan);
  const specs = [];
  for (const k of keys) if (Z.FONTS[k] && Z.FONTS[k].gf) specs.push(Z.FONTS[k].gf);
  await Promise.all([...new Set(specs)].map(s => attachGoogle(s)));
  try { await document.fonts.ready; } catch (e) {}
};
/* 计划用到的所有字体 key */
Z.fontsOfPlan = (plan) => {
  const set = new Set(['mono']);
  if (!plan) return [...set];
  for (const arr of Object.values((plan.style && plan.style.fonts) || {})) for (const k of arr) set.add(k);
  for (const c of plan.cuts || []) {
    for (const v of Object.values(c.params || {})) {
      if (typeof v === 'string' && Z.FONTS[v]) set.add(v);
      else if (Array.isArray(v)) for (const x of v) if (typeof x === 'string' && Z.FONTS[x]) set.add(x);
    }
    for (const k of [c.fontDisplay, c.fontSerif, c.fontBody]) if (k) set.add(k);
  }
  return [...set];
};

/* ============================================================
   字形栅格化：把字符画进离屏 canvas
   用于「字形分解 / 爆散 / 崩落」等需要把字拆成碎块的演出。
   pieces = 只覆盖有笔画像素的矩形块（按行合并），
   这样碎块数量少、视觉上又贴着字形轮廓走。
   ============================================================ */
class GlyphStore {
  constructor() { this.map = new Map(); this.maxRes = 512; }
  clear() { this.map.clear(); }
  /* 返回 {cv, res, pieces:[{sx,sy,sw,sh,cx,cy,id}], ink} */
  get(fontKey, ch, px) {
    const res = Math.min(this.maxRes, Math.max(64, Math.round(px / 64) * 64 || 256));
    const key = fontKey + '\u0001' + ch + '\u0001' + res;
    let g = this.map.get(key);
    if (g) return g;
    if (this.map.size > 900) this.map.clear();
    const cv = document.createElement('canvas');
    cv.width = cv.height = res;
    const x = cv.getContext('2d', { willReadFrequently: true });
    const f = Z.FONTS[fontKey] || Z.FONTS.sans_bold;
    const size = res * 0.82;
    x.clearRect(0, 0, res, res);
    x.font = `${f.weight} ${size}px ${f.family},${f.fb}`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#fff';
    x.fillText(ch, res / 2, res / 2 + res * 0.02);
    const data = x.getImageData(0, 0, res, res).data;
    g = { cv, res, pieces: [], ink: 0, w: res, h: res, cx: res / 2, cy: res / 2 };
    /* 细网格扫描 → 找出有墨水的格子 → 同行相邻合并成一块 */
    const cell = Math.max(4, Math.round(res / 14));
    const cols = Math.ceil(res / cell), rows = Math.ceil(res / cell);
    const grid = new Uint8Array(cols * rows);
    let ink = 0, minX = res, maxX = 0, minY = res, maxY = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let hit = 0, total = 0;
        const x0 = c * cell, y0 = r * cell;
        for (let y = y0; y < Math.min(res, y0 + cell); y += 2) {
          for (let xx = x0; xx < Math.min(res, x0 + cell); xx += 2) {
            total++;
            if (data[(y * res + xx) * 4 + 3] > 40) hit++;
          }
        }
        if (total && hit / total > 0.06) {
          grid[r * cols + c] = 1; ink++;
          if (x0 < minX) minX = x0; if (x0 + cell > maxX) maxX = x0 + cell;
          if (y0 < minY) minY = y0; if (y0 + cell > maxY) maxY = y0 + cell;
        }
      }
    }
    let id = 0;
    for (let r = 0; r < rows; r++) {
      let c = 0;
      while (c < cols) {
        if (!grid[r * cols + c]) { c++; continue; }
        let c2 = c;
        while (c2 + 1 < cols && grid[r * cols + c2 + 1]) c2++;
        const sx = c * cell, sw = Math.min(res, (c2 + 1) * cell) - sx;
        const sy = r * cell, sh = Math.min(res, (r + 1) * cell) - sy;
        g.pieces.push({ sx, sy, sw, sh, cx: (sx + sw / 2) / res - 0.5, cy: (sy + sh / 2) / res - 0.5, id: id++, area: sw * sh });
        c = c2 + 1;
      }
    }
    /* 墨水范围：用于排版时把字画到视觉中心 */
    g.ink = ink;
    g.bx = maxX > minX ? (minX + maxX) / 2 / res - 0.5 : 0;
    g.by = maxY > minY ? (minY + maxY) / 2 / res - 0.5 : 0;
    if (g.pieces.length > 90) g.pieces.sort((a, b) => b.area - a.area).length = 90;
    this.map.set(key, g);
    return g;
  }
  /* 把字形染成指定颜色的贴图（缓存） */
  sprite(fontKey, ch, px, color, alpha = 1) {
    const g = this.get(fontKey, ch, px);
    const key = fontKey + '\u0001' + ch + '\u0001' + g.res + '\u0001' + color + '\u0001' + alpha.toFixed(2);
    let s = this.map.get(key);
    if (s) return s;
    const cv = document.createElement('canvas');
    cv.width = g.res; cv.height = g.res;
    const x = cv.getContext('2d');
    x.drawImage(g.cv, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color; x.globalAlpha = alpha;
    x.fillRect(0, 0, g.res, g.res);
    this.map.set(key, cv);
    return cv;
  }
  /* 字体度量（缺失字形的宽度用 size2 近似） */
  advance(fontKey, ch, size) {
    const f = Z.FONTS[fontKey] || Z.FONTS.sans_bold;
    const key = 'adv:' + fontKey + ':' + size.toFixed(1);
    let ctx = this._mctx;
    if (!ctx) ctx = this._mctx = document.createElement('canvas').getContext('2d');
    const ck = key + ':' + ch;
    let v = this.map.get(ck);
    if (v === undefined) {
      ctx.font = `${f.weight} ${size}px ${f.family},${f.fb}`;
      v = ctx.measureText(ch).width;
      if (!(v > 0)) v = size;
      this.map.set(ck, v);
      if (this.map.size > 6000) this.map.clear();
    }
    return v;
  }
}
Z.glyphs = new GlyphStore();
})();
