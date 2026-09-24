/* ============================================================
   RuiC-TextPV — 文本引擎
   字形排版 / 逐字逐块动画钩子 / 描边·立体·渐变·图案 / 字形碎裂
   ============================================================ */
(() => {
'use strict';

/* 「静止」标记：pieceFn 返回它就表示这一块不需要特殊处理 */
Z.REST = Object.freeze({ dx: 0, dy: 0, rot: 0, s: 1, st: 1, sdir: 0, a: 1 });
Z.PIECE = (dx = 0, dy = 0, rot = 0, s = 1, st = 1, sdir = 0, a = 1) => ({ dx, dy, rot, s, st, sdir, a });

/* ---------------- 排版 ----------------
   返回字形数组：{ch,i,li,ci,n,x,y,w,h,rot90,vx,vy}
   坐标相对元素原点（含 align 偏移），未乘 sx/sy */
Z.layoutGlyphs = (it) => {
  const text = String(it.text ?? '');
  const size = it.size, track = it.track || 0, sx = it.sx || 1, sy = it.sy || 1;
  const lines = text.split('\n');
  const out = [];
  const vertical = !!it.vertical;
  const lead = (it.lead || 1.32) * size;
  let gi = 0;
  if (!vertical) {
    const widths = lines.map(line => {
      const arr = [...line];
      let w = 0;
      arr.forEach((ch, i) => { w += Z.glyphs.advance(it.font, ch, size) + (i < arr.length - 1 ? track * size : 0); });
      return w;
    });
    const maxW = Math.max(1, ...widths);
    lines.forEach((line, li) => {
      const arr = [...line];
      let x = it.align === 'left' ? 0 : it.align === 'right' ? -widths[li] : -widths[li] / 2;
      const y = (li - (lines.length - 1) / 2) * lead;
      arr.forEach((ch, ci) => {
        const a = Z.glyphs.advance(it.font, ch, size);
        out.push({ ch, i: gi++, li, ci, n: arr.length, x: x + a / 2, y, w: a, h: size, rot90: false, vx: 0, vy: 0 });
        x += a + track * size;
      });
    });
    out.W = maxW;
    out.H = lines.length * lead - (lead - size);
  } else {
    /* 竖排：拉丁字母与长音符号转 90°，标点偏到右上 */
    const vadv = (ch) => (Z.isLatin(ch) ? Z.glyphs.advance(it.font, ch, size) : size);
    const heights = lines.map(line => [...line].reduce((h, ch) => h + vadv(ch) + track * size, 0) - track * size);
    const maxH = Math.max(1, ...heights);
    lines.forEach((line, li) => {
      const arr = [...line];
      let y = it.align === 'left' ? 0 : -heights[li] / 2;
      const x = -(li - (lines.length - 1) / 2) * lead;
      arr.forEach((ch, ci) => {
        const a = vadv(ch);
        const rot90 = Z.VERT_ROT.includes(ch) || Z.isLatin(ch);
        let vx = 0, vy = 0;
        if (Z.isSmallKana(ch)) { vx = 0.11 * size; vy = -0.11 * size; }
        if (Z.VERT_SHIFT.includes(ch)) { vx = 0.3 * size; vy = -0.3 * size; }
        out.push({ ch, i: gi++, li, ci, n: arr.length, x, y: y + a / 2, w: size, h: a, rot90, vx, vy });
        y += a + track * size;
      });
    });
    out.W = lines.length * lead - (lead - size);
    out.H = maxH;
  }
  out.N = gi;
  return out;
};
Z.measureText = (it) => { const l = Z.layoutGlyphs(it); return { w: l.W * (it.sx || 1), h: l.H * (it.sy || 1), lay: l }; };
Z.measure = (it) => { const l = it._lay || (it._lay = Z.layoutGlyphs(it)); return { w: l.W * (it.sx || 1), h: l.H * (it.sy || 1), lay: l }; };

/* 让文字正好填满一个盒子的字号 */
Z.fitSize = (text, font, maxW, maxH, opt = {}) => {
  const m = Z.measureText(Object.assign({ text, font, size: 100, track: 0 }, opt));
  const k = Math.min(maxW / Math.max(1, m.w), maxH / Math.max(1, m.h));
  return 100 * Math.max(0.05, k);
};

/* ---------------- 图案填充 ---------------- */
const patCache = new Map();
Z.textPattern = (ctx, kind, color, bg, size, scale) => {
  const cell = Math.max(3, Math.round(size * (kind === 'dots' ? 0.078 : 0.062)));
  const px = Math.max(2, Math.round(cell * (scale || 1)));
  const key = kind + '|' + color + '|' + (bg || '') + '|' + px;
  let cv = patCache.get(key);
  if (!cv) {
    cv = document.createElement('canvas'); cv.width = cv.height = px;
    const x = cv.getContext('2d');
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, px, px); }
    x.fillStyle = color; x.strokeStyle = color; x.lineCap = 'butt';
    if (kind === 'dots') { x.beginPath(); x.arc(px / 2, px / 2, px * 0.34, 0, Z.TAU); x.fill(); }
    else if (kind === 'stripes') { x.lineWidth = px * 0.38; x.beginPath(); x.moveTo(-px, px * 2); x.lineTo(px * 2, -px); x.moveTo(-px, px); x.lineTo(px, -px); x.moveTo(0, px * 2); x.lineTo(px * 2, 0); x.stroke(); }
    else if (kind === 'hatch') { x.lineWidth = Math.max(1, px * 0.16); x.beginPath(); x.moveTo(0, 0); x.lineTo(px, px); x.moveTo(px, 0); x.lineTo(0, px); x.stroke(); }
    else if (kind === 'grid') { x.fillRect(0, 0, px, Math.max(1, px * 0.18)); x.fillRect(0, 0, Math.max(1, px * 0.18), px); }
    else if (kind === 'bricks') { x.lineWidth = Math.max(1, px * 0.12); x.strokeRect(0, 0, px, px * 0.5); x.strokeRect(-px * 0.5, px * 0.5, px, px * 0.5); x.strokeRect(px * 0.5, px * 0.5, px, px * 0.5); }
    else { x.fillRect(0, 0, px, Math.max(1, px * 0.44)); }        // 'lines'
    if (patCache.size > 100) patCache.clear();
    patCache.set(key, cv);
  }
  const pat = ctx.createPattern(cv, 'repeat');
  try { if (pat.setTransform && scale && scale !== 1) pat.setTransform(new DOMMatrix().scale(1 / scale)); } catch (e) {}
  return pat;
};

/* ---------------- 整块离屏层（模糊/大阴影统一在层上做，比逐字做快得多） ---------------- */
let layerCv = null;
function drawViaLayer(env, it) {
  const ctx = env.ctx;
  const lay = it._lay || (it._lay = Z.layoutGlyphs(it));
  const size = it.size, sx = it.sx || 1, sy = it.sy || 1;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const g of lay) {
    const c = it.charFn ? it.charFn(g.i, g, lay.N) : null;
    if (c && c.hide) continue;
    const s = c && c.s != null ? Math.abs(c.s) : 1;
    const gw = g.w * sx * s * (c && c.sx ? Math.abs(c.sx) : 1), gh = g.h * sy * s * (c && c.sy ? Math.abs(c.sy) : 1);
    const r = Math.max(gw, gh) * (c && c.rot ? 0.78 : 0.56);
    const gx = g.x * sx + g.vx * sx + (c ? c.dx || 0 : 0), gy = g.y * sy + g.vy * sy + (c ? c.dy || 0 : 0);
    x0 = Math.min(x0, gx - r); x1 = Math.max(x1, gx + r);
    y0 = Math.min(y0, gy - r); y1 = Math.max(y1, gy + r);
  }
  if (x0 > x1) return null;
  const sh = it.shadow, ex = it.extrude;
  const pad = (it.blur || 0) * 2.6 + size * 0.12 + (it.stroke || 0)
    + (sh ? (sh.blur || 0) * 1.3 + Math.abs(sh.dx || 0) + Math.abs(sh.dy || 0) : 0)
    + (ex ? Math.abs(ex.dx || 0) + Math.abs(ex.dy || 0) : 0);
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  const T = ctx.getTransform();
  const k = Math.max(0.05, Math.hypot(T.a, T.b));
  const ow = Math.ceil((x1 - x0) * k), oh = Math.ceil((y1 - y0) * k);
  if (ow < 2 || oh < 2 || ow * oh > ctx.canvas.width * ctx.canvas.height * 1.7) return undefined;
  if (!layerCv) layerCv = document.createElement('canvas');
  if (layerCv.width < ow || layerCv.height < oh) { layerCv.width = Math.max(ow, layerCv.width); layerCv.height = Math.max(oh, layerCv.height); }
  const L = layerCv.getContext('2d');
  L.setTransform(1, 0, 0, 1, 0, 0); L.globalAlpha = 1; L.globalCompositeOperation = 'source-over'; L.filter = 'none';
  L.clearRect(0, 0, ow, oh);
  L.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
  const inner = Object.assign({}, it, { x: 0, y: 0, rot: 0, skew: 0, blur: 0, shadow: null, blend: null });
  const bb = Z.drawText(Object.assign({}, env, { ctx: L, inLayer: true, scale: k }), inner);
  ctx.save();
  ctx.translate(it.x, it.y);
  if (it.rot) ctx.rotate(it.rot * Z.DEG);
  if (it.skew) ctx.transform(1, 0, Math.tan(it.skew * Z.DEG), 1, 0, 0);
  if (it.blend) ctx.globalCompositeOperation = it.blend;
  if (it.blur > 0.4 && env.allowFilter) ctx.filter = `blur(${(it.blur * (env.scale || 1)).toFixed(1)}px)`;
  if (sh && env.pass === 'main') {
    ctx.shadowColor = sh.color || 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = env.allowFilter === false ? 0 : (sh.blur || 0) * (env.scale || 1);
    ctx.shadowOffsetX = (sh.dx || 0) * (env.scale || 1);
    ctx.shadowOffsetY = (sh.dy || 0) * (env.scale || 1);
  }
  ctx.drawImage(layerCv, 0, 0, ow, oh, x0, y0, ow / k, oh / k);
  ctx.restore();
  if (!bb) return null;
  return Object.assign({}, bb, { x0: bb.x0 + it.x, x1: bb.x1 + it.x, y0: bb.y0 + it.y, y1: bb.y1 + it.y, cx: it.x, cy: it.y });
}

/* ---------------- 画一个文本元素 ----------------
   返回设计坐标下的包围盒 {x0,y0,x1,y1,boxes,cx,cy}，供装饰件挂靠 */
Z.drawText = (env, it) => {
  const ctx = env.ctx;
  const ghost = env.pass !== 'main';
  if (ghost && it.ghost === false) return null;
  if (!it.text || it.size <= 0.5) return null;
  /* 大模糊 / 大阴影走离屏层，避免每个字都开一次滤镜 */
  if (!env.inLayer && env.allowFilter && !it.pieceFn
    && ((it.blur || 0) > 0.4 || (it.shadow && !ghost && (it.shadow.blur || 0) * (env.scale || 1) > 6))) {
    const r = drawViaLayer(env, it);
    if (r !== undefined) return r;
  }
  const lay = it._lay || (it._lay = Z.layoutGlyphs(it));
  const size = it.size, sx = it.sx || 1, sy = it.sy || 1;
  const baseA = (it.alpha ?? 1) * (ghost ? (it.ghostAlpha ?? 1) : 1);
  if (baseA <= 0.002) return null;
  const col = ghost ? env.passColor : (it.color || '#fff');
  const sCol = ghost ? env.passColor : (it.strokeColor || it.color || '#fff');
  const fill = it.fill !== false;
  ctx.save();
  ctx.translate(it.x, it.y);
  if (it.rot) ctx.rotate(it.rot * Z.DEG);
  if (it.skew) ctx.transform(1, 0, Math.tan(it.skew * Z.DEG), 1, 0, 0);
  if (it.blend) ctx.globalCompositeOperation = it.blend;
  if (it.blur > 0.4 && env.allowFilter) ctx.filter = `blur(${(it.blur * (env.scale || 1)).toFixed(1)}px)`;
  ctx.font = Z.fontCSS(it.font, size);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let grad = null;
  if (!ghost && it.gradient && fill) {
    grad = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.5);
    if (it.gradient.length === 2) { grad.addColorStop(0, it.gradient[0]); grad.addColorStop(1, it.gradient[1]); }
    else it.gradient.forEach(([o, c]) => grad.addColorStop(o, c));
  }
  if (!ghost && it.pattern && fill && !grad) grad = Z.textPattern(ctx, it.pattern.kind || it.pattern, it.pattern.color || it.color || '#fff', it.pattern.bg, size, env.scale || 1);
  const fillA = it.fillAlpha ?? 1;
  const shadow = !ghost && it.shadow;
  if (shadow) {
    const k = env.scale || 1;
    ctx.shadowColor = shadow.color || 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = env.allowFilter === false ? 0 : (shadow.blur || 0) * k;
    ctx.shadowOffsetX = (shadow.dx || 0) * k;
    ctx.shadowOffsetY = (shadow.dy || 0) * k;
  }
  const ext = !ghost && it.extrude && it.extrude.n > 0 ? it.extrude : null;
  const dash = it.dash != null && it.dash < 1 ? it.dash : null;
  const boxes = [];
  const pxScale = size * Math.max(sx, sy) * (env.scale || 1);
  for (const g of lay) {
    if (g.ch === ' ' || g.ch === '\u3000') continue;
    const c = it.charFn ? it.charFn(g.i, g, lay.N) : null;
    if (c && c.hide) continue;
    const a = baseA * (c && c.a != null ? c.a : 1);
    if (a <= 0.002) continue;
    const ch = (c && c.ch) || g.ch;
    const cs = c && c.s != null ? c.s : 1;
    const gx = g.x * sx + g.vx * sx + (c ? c.dx || 0 : 0);
    const gy = g.y * sy + g.vy * sy + (c ? c.dy || 0 : 0);
    const crot = (c ? c.rot || 0 : 0) + (g.rot90 ? 90 : 0);
    const csx = sx * cs * (c && c.sx ? c.sx : 1), csy = sy * cs * (c && c.sy ? c.sy : 1);
    const gcol = (!ghost && c && c.color) || col;
    boxes.push({ x: gx, y: gy, w: g.w * sx * cs, h: g.h * sy * cs });
    /* ---- 碎裂模式：把字形拆成有笔画的矩形块来画 ---- */
    if (it.pieceFn && fill && !(c && c.ch) && !it.gradient && dash == null && !(c && (c.clipY || c.clipX || c.outline))) {
      if (drawPieces(env, it, g, ch, gx, gy, crot, csx, csy, gcol, a, pxScale * cs)) continue;
    }
    ctx.save();
    ctx.translate(gx, gy);
    if (crot) ctx.rotate(crot * Z.DEG);
    if (c && c.skew) ctx.transform(1, 0, Math.tan(c.skew * Z.DEG), 1, 0, 0);
    if (csx !== 1 || csy !== 1) ctx.scale(csx, csy);
    if (c && (c.clipY || c.clipX)) {
      const cy = c.clipY || [-0.72, 0.72], cx = c.clipX || [-0.72, 0.72];
      ctx.beginPath();
      ctx.rect(cx[0] * g.w, cy[0] * g.h, (cx[1] - cx[0]) * g.w, (cy[1] - cy[0]) * g.h);
      ctx.clip();
    }
    if (c && c.blur > 0.4 && env.allowFilter) ctx.filter = `blur(${(c.blur * (env.scale || 1)).toFixed(1)}px)`;
    ctx.globalAlpha = a;
    const outlineOnly = c && c.outline;
    if (ext && !outlineOnly) {
      ctx.fillStyle = ext.color || '#000';
      const ea = ext.a ?? 1;
      for (let k = ext.n; k >= 1; k--) {
        ctx.globalAlpha = a * ea * (ext.fade ? 1 - (k - 1) / ext.n * 0.85 : 1);
        ctx.fillText(ch, ext.dx * k / ext.n / csx, ext.dy * k / ext.n / csy);
      }
      ctx.globalAlpha = a;
    }
    if (fill && !outlineOnly && fillA > 0.002 && dash == null) {
      ctx.globalAlpha = a * fillA; ctx.fillStyle = grad || gcol; ctx.fillText(ch, 0, 0); ctx.globalAlpha = a;
    }
    if (it.stroke > 0 || outlineOnly || dash != null) {
      if (shadow && fill) ctx.shadowColor = 'rgba(0,0,0,0)';
      ctx.lineJoin = 'round'; ctx.miterLimit = 2;
      ctx.lineWidth = (it.stroke > 0 ? it.stroke : Math.max(1, size * 0.02)) / Math.sqrt(Math.abs(csx * csy));
      ctx.strokeStyle = (!ghost && c && c.color) || sCol;
      if (dash != null) { const L = size * 3.2; ctx.setLineDash([Math.max(0.01, L * dash), L]); }
      else if (it.strokeDash) ctx.setLineDash(it.strokeDash);
      ctx.strokeText(ch, 0, 0);
      ctx.setLineDash([]);
      if (fill && !outlineOnly && (it.strokeUnder || (dash != null && fillA > 0.002))) {
        ctx.globalAlpha = a * (dash != null ? fillA : 1); ctx.fillStyle = grad || gcol; ctx.fillText(ch, 0, 0);
      }
    }
    ctx.restore();
  }
  ctx.restore();
  if (!boxes.length) return null;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const b of boxes) {
    x0 = Math.min(x0, b.x - b.w / 2); x1 = Math.max(x1, b.x + b.w / 2);
    y0 = Math.min(y0, b.y - b.h / 2); y1 = Math.max(y1, b.y + b.h / 2);
  }
  return { x0: it.x + x0, y0: it.y + y0, x1: it.x + x1, y1: it.y + y1, boxes, cx: it.x, cy: it.y };
};

/* 画一块字形碎片；返回 true 表示"已经接管绘制"（说明有块在动） */
function drawPieces(env, it, g, ch, gx, gy, crot, sx, sy, col, alpha, px) {
  const glyph = Z.glyphs.get(it.font, ch, px);
  const list = glyph.pieces;
  if (!list.length) return false;
  const size = it.size, res = glyph.res;
  const cr = Math.cos(crot * Z.DEG), sr = Math.sin(crot * Z.DEG);
  let moving = false;
  const plan = new Array(list.length);
  for (let j = 0; j < list.length; j++) {
    const p = list[j];
    /* 块的本地中心（以 em 为单位，围绕字形中心） */
    const ex = p.cx * size * sx, ey = p.cy * size * sy;
    const ox = gx + ex * cr - ey * sr, oy = gy + ex * sr + ey * cr;
    const t = it.pieceFn(g.i, j, p, ox, oy, g);
    if (t !== Z.REST) moving = true;
    plan[j] = { t, ox, oy, p };
    if (t === null) moving = true;
  }
  if (!moving) return false;
  const ctx = env.ctx;
  for (let j = 0; j < list.length; j++) {
    const { t, ox, oy, p } = plan[j];
    if (!t || t.a <= 0.003) continue;
    const spr = Z.glyphs.sprite(it.font, ch, px, col, 1);
    ctx.save();
    ctx.translate(ox + t.dx, oy + t.dy);
    if (t.st !== 1) { const d = t.sdir * Z.DEG; ctx.rotate(d); ctx.scale(t.st, 1 / Math.sqrt(t.st)); ctx.rotate(-d); }
    ctx.rotate((crot + t.rot) * Z.DEG);
    const k = size / res * t.s;
    ctx.scale(sx * k, sy * k);
    ctx.globalAlpha = alpha * t.a;
    ctx.drawImage(spr, p.sx, p.sy, p.sw, p.sh, p.sx, p.sy, p.sw, p.sh);
    ctx.restore();
  }
  return true;
}

/* ---------------- 组合多个 charFn / pieceFn ---------------- */
Z.combineChar = (fns) => {
  if (!fns.length) return null;
  if (fns.length === 1) return fns[0];
  return (i, g, n) => {
    let o = null;
    for (const f of fns) {
      const r = f(i, g, n); if (!r) continue;
      if (r.hide) return r;
      if (!o) o = { dx: 0, dy: 0, rot: 0, s: 1, a: 1 };
      o.dx += r.dx || 0; o.dy += r.dy || 0; o.rot += r.rot || 0;
      if (r.s != null) o.s *= r.s;
      if (r.a != null) o.a *= r.a;
      if (r.sx) o.sx = (o.sx || 1) * r.sx;
      if (r.sy) o.sy = (o.sy || 1) * r.sy;
      if (r.ch) o.ch = r.ch;
      if (r.color) o.color = r.color;
      if (r.skew) o.skew = (o.skew || 0) + r.skew;
      if (r.blur) o.blur = (o.blur || 0) + r.blur;
      if (r.outline) o.outline = true;
      if (r.clipX) o.clipX = o.clipX ? [Math.max(o.clipX[0], r.clipX[0]), Math.min(o.clipX[1], r.clipX[1])] : r.clipX;
      if (r.clipY) o.clipY = o.clipY ? [Math.max(o.clipY[0], r.clipY[0]), Math.min(o.clipY[1], r.clipY[1])] : r.clipY;
    }
    return o;
  };
};
Z.combinePiece = (fns) => {
  if (!fns.length) return null;
  if (fns.length === 1) return fns[0];
  return (ci, pj, pc, ox, oy, g) => {
    let o = null;
    for (const f of fns) {
      const r = f(ci, pj, pc, ox, oy, g);
      if (r === null) return null;
      if (r === Z.REST) continue;
      if (!o) o = Z.PIECE();
      o.dx += r.dx; o.dy += r.dy; o.rot += r.rot; o.s *= r.s; o.a *= r.a;
      if (r.st > o.st) { o.st = r.st; o.sdir = r.sdir; }
    }
    return o || Z.REST;
  };
};

/* 元素的横/竖向切条（给"切片"类演出用） */
Z.itemBands = (env, it, n, dxFn) => {
  const m = it._m || (it._m = Z.measure(it));
  const h = Math.max(m.h, it.size) * 1.3 + 20, y0 = it.y - h / 2;
  const cuts = [0];
  for (let i = 1; i < n; i++) cuts.push(Z.rnd(it.seed | 0, n, i, 3));
  cuts.push(1); cuts.sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < cuts.length - 1; i++) out.push([y0 + cuts[i] * h, y0 + cuts[i + 1] * h, dxFn(i, cuts.length - 1)]);
  return out;
};
Z.itemVBands = (env, it, n, dyFn) => {
  const m = it._m || (it._m = Z.measure(it));
  const w = Math.max(m.w, it.size) * 1.12 + 20;
  const x0 = it.align === 'left' ? it.x - 10 : it.align === 'right' ? it.x - w + 10 : it.x - w / 2;
  const out = [];
  for (let i = 0; i < n; i++) out.push([x0 + i * w / n, x0 + (i + 1) * w / n + 0.5, dyFn(i, n)]);
  return out;
};
Z.itemBox = (it) => {
  const m = it._m || (it._m = Z.measure(it));
  const x0 = it.vertical ? it.x - m.w / 2 : it.align === 'left' ? it.x : it.align === 'right' ? it.x - m.w : it.x - m.w / 2;
  const y0 = it.vertical && it.align === 'left' ? it.y : it.y - m.h / 2;
  return { x0, y0, x1: x0 + m.w, y1: y0 + m.h, w: m.w, h: m.h, cx: x0 + m.w / 2, cy: y0 + m.h / 2 };
};
})();
