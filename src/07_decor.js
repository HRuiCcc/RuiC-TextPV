/* ============================================================
   RuiC-TextPV — 装饰件 / 背景图形 / 文字加工
   装饰件：叠在文字前后的图形（坐标圆、引出线、胶带、花瓣…）
   背景图形：整屏的底纹（同心圆、网格、星空…），逐行挑选
   文字加工：直接把文字本身改个样子（描边、立体、霓虹…）
   ============================================================ */
(() => {
'use strict';

/* ============================================================
   装饰件
   draw(env, bb, d)   bb = 主文字包围盒（可能是 null）
   可选 layer: 'back' 画在文字下面 / 'front' 画在上面（默认 front）
   可选 subtle: true 表示"安静"，繁忙的排版也能用
   ============================================================ */
Z.registerAll('decor', {
  crosshair: {
    name: '十字准线', layer: 'back', subtle: true, w: 0.8,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H;
      const x = d.right ? W * 0.78 : W * 0.22, y = d.low ? H * 0.72 : H * 0.28;
      const r = Math.min(W, H) * (d.big ? 0.16 : 0.1);
      const col = d.accent ? sc.accent : sc.sub;
      env.circle(x, y, r, null, col, Math.max(1.5, r * 0.02), 0.6);
      env.line([[x - r * 1.5, y], [x + r * 1.5, y]], col, Math.max(1.5, r * 0.02), 0.6);
      env.line([[x, y - r * 1.5], [x, y + r * 1.5]], col, Math.max(1.5, r * 0.02), 0.6);
      env.rect(x - r * 0.06, y - r * 0.06, r * 0.12, r * 0.12, col, 0.9);
    },
  },
  rings: {
    name: '同心圆', layer: 'back', subtle: true, w: 1,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H;
      const x = d.right ? W * 0.76 : W * 0.24, y = d.low ? H * 0.7 : H * 0.3;
      const col = d.accent ? sc.accent : sc.sub;
      for (let i = 1; i <= d.n + 2; i++) env.circle(x, y, Math.min(W, H) * 0.03 * i, null, col, Math.max(1, W * 0.0012), 0.55 - i * 0.05);
    },
  },
  dots: {
    name: '圆点矩阵', layer: 'back', subtle: true, w: 1,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H, seed = d.seed;
      const cx = d.right ? W * 0.76 : W * 0.24, cy = d.low ? H * 0.7 : H * 0.3;
      const cols = 5 + (d.n | 0), R = Math.min(W, H) * 0.2;
      for (let i = 0; i < cols; i++) {
        const a = i / cols * Z.TAU;
        const r = R * (0.6 + Z.rnd(seed, i) * 0.5);
        env.circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.min(W, H) * 0.006 * (1 + Z.rnd(seed, i, 1)), d.accent ? sc.accent : sc.fg, null, 1, 0.8);
      }
    },
  },
  grid: {
    name: '细网格', layer: 'back', subtle: true, w: 1,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H;
      const col = d.accent ? sc.accent : sc.sub;
      const step = Math.min(W, H) / (10 + (d.n | 0) * 2);
      const x0 = d.right ? W * 0.5 : 0, w = W * 0.5;
      for (let x = x0; x < x0 + w; x += step) env.rect(x, 0, Math.max(1, W * 0.0008), H, col, 0.28);
      for (let y = 0; y < H; y += step) env.rect(x0, y, w, Math.max(1, H * 0.0008), col, 0.28);
    },
  },
  leaders: {
    name: '引出线', w: 1.1,
    draw(env, bb, d) {
      if (!bb) return;
      const sc = env.sc, W = env.W;
      const side = d.right ? 1 : -1;
      const x0 = side > 0 ? bb.x1 + W * 0.01 : bb.x0 - W * 0.01;
      const x1 = W * (side > 0 ? 0.94 : 0.06);
      const y0 = bb.y0 + (bb.y1 - bb.y0) * (d.low ? 0.8 : 0.2);
      const y1 = y0 + (d.low ? H_OFF(env) : -H_OFF(env));
      const col = d.accent ? sc.accent : sc.sub;
      env.line([[x0, y0], [Z.lerp(x0, x1, 0.55), y0], [x1, y1]], col, Math.max(1.5, W * 0.0016), 0.75);
      env.circle(x1, y1, Math.max(3, W * 0.004), col, null, 1, 0.9);
      env.rect(x0 - side * W * 0.006, y0 - Math.max(1.5, W * 0.0016) / 2, side * W * 0.012, Math.max(1.5, W * 0.0016), col, 0.75);
    },
  },
  dimension: {
    name: '尺寸标注', w: 0.9,
    draw(env, bb, d) {
      if (!bb) return;
      const sc = env.sc, W = env.W;
      const col = d.accent ? sc.accent : sc.sub;
      const y = d.low ? bb.y1 + W * 0.05 : bb.y0 - W * 0.05;
      const lw = Math.max(1.5, W * 0.0016);
      env.line([[bb.x0, y], [bb.x1, y]], col, lw, 0.8);
      env.line([[bb.x0, y - W * 0.012], [bb.x0, y + W * 0.012]], col, lw, 0.8);
      env.line([[bb.x1, y - W * 0.012], [bb.x1, y + W * 0.012]], col, lw, 0.8);
      const mid = (bb.x0 + bb.x1) / 2;
      for (let i = -1; i <= 1; i++) if (i !== 0) env.line([[mid + i * W * 0.012, y - W * 0.008], [mid + i * W * 0.012, y + W * 0.008]], col, lw, 0.6);
    },
  },
  bars: {
    name: '信号条', layer: 'back', subtle: true, w: 1,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H, seed = d.seed;
      const col = d.accent ? sc.accent : sc.fg;
      const n = 3 + (d.n | 0);
      const x0 = d.right ? W * 0.82 : W * 0.06, y0 = H * 0.12;
      env.rect(x0 - W * 0.01, y0 - H * 0.02, W * 0.13, H * 0.008, col, 0.5);
      for (let i = 0; i < n; i++) {
        const y = y0 + i * H * 0.026;
        const w = W * (0.02 + Z.rnd(seed, i) * 0.1);
        env.rect(x0, y, w, H * 0.011, i === 0 ? sc.accent : col, 0.8 - i * 0.05);
      }
    },
  },
  barcode: {
    name: '条码', w: 0.9,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H, seed = d.seed;
      const x0 = d.right ? W * 0.7 : W * 0.06, y0 = d.low ? H * 0.86 : H * 0.1;
      let x = x0;
      for (let i = 0; i < 42; i++) {
        const w = W * (0.001 + Z.rnd(seed, i) * 0.0045);
        env.rect(x, y0, w, H * (0.03 + Z.rnd(seed, i, 1) * 0.04), sc.fg, 0.85);
        x += w + W * 0.0018;
      }
    },
  },
  counter: {
    name: '大数字', w: 1,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H;
      const num = String(d.mode === 'count' ? Z.rnd(d.seed, 3) * 100 | 0 : d.from + Math.floor(env.lt * 12) % 40).padStart(2, '0');
      const size = Math.min(W, H) * (d.big ? 0.3 : 0.16);
      const x = d.right ? W * 0.84 : W * 0.16, y = d.low ? H * 0.78 : H * 0.22;
      Z.drawText(env, {
        text: num, font: 'mono', size, x, y, color: d.accent ? sc.accent : sc.dim,
        alpha: 0.55, enter: 'cut', exit: 'cut', hold: 'still', seed: d.seed,
      });
      env.rect(x - size * 0.62, y + size * 0.42, size * 1.24, Math.max(1.5, size * 0.02), d.accent ? sc.accent : sc.sub, 0.5);
    },
  },
  slash: {
    name: '斜杠组', w: 1.1,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H, seed = d.seed;
      const n = 2 + (d.n | 0);
      for (let i = 0; i < n; i++) {
        const x = (d.right ? W * 0.72 : W * 0.2) + i * W * 0.045;
        const y = (d.low ? H * 0.66 : H * 0.3) + i * H * 0.02;
        const len = W * (0.06 + Z.rnd(seed, i) * 0.08);
        env.line([[x, y - len / 2], [x + len * 0.5, y + len / 2]], i === 0 ? sc.accent : sc.fg, Math.max(2, W * 0.005), 0.85);
      }
    },
  },
  stripeBlock: {
    name: '斜纹块', layer: 'back', w: 0.9,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H;
      const x0 = d.right ? W * 0.68 : W * 0.04, y0 = d.low ? H * 0.62 : H * 0.14;
      const w = W * 0.24, h = H * 0.22;
      env.rect(x0, y0, w, h, sc.dim, 0.5);
      for (let i = -h; i < w; i += w * 0.1) {
        const x = x0 + Math.max(0, i);
        env.line([[x, y0 + h], [Math.min(x0 + w, x + h), y0]], d.accent ? sc.accent : sc.sub, Math.max(1.5, W * 0.0022), 0.5);
      }
    },
  },
  halftone: {
    name: '网点', layer: 'back', subtle: true, w: 1,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H;
      const x0 = d.right ? W * 0.6 : W * 0.02, y0 = d.low ? H * 0.56 : H * 0.08;
      const step = Math.min(W, H) * 0.028;
      for (let y = 0; y < H * 0.34; y += step) {
        for (let x = 0; x < W * 0.36; x += step) {
          const u = 1 - (x / (W * 0.36)) * 0.8 - (y / (H * 0.34)) * 0.4;
          if (u <= 0.05) continue;
          env.circle(x0 + x, y0 + y, step * 0.34 * Z.clamp(u), d.accent ? sc.accent : sc.fg, null, 1, 0.5);
        }
      }
    },
  },
  scribble: {
    name: '涂鸦圈', w: 1,
    draw(env, bb, d) {
      if (!bb) return;
      const sc = env.sc, seed = d.seed;
      const cx = bb.cx, cy = bb.cy;
      const rx = (bb.x1 - bb.x0) * 0.62 + 10, ry = (bb.y1 - bb.y0) * 0.78 + 10;
      const pts = [];
      const N = 46;
      for (let i = 0; i <= N; i++) {
        const a = i / N * Z.TAU * 1.05 - 0.4;
        const k = 1 + Z.rsign(seed, i, 2) * 0.06;
        pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
      }
      env.polyPartial(pts, 1, d.accent ? sc.accent : sc.fg, Math.max(2, sc_size(env) * 0.012), 0.9);
    },
  },
  shapes: {
    name: '几何拼贴', layer: 'back', w: 1.2,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H, seed = d.seed;
      const n = 1 + (d.n | 0);
      for (let i = 0; i < n; i++) {
        const cx = W * (0.1 + Z.rnd(seed, i, 1) * 0.8), cy = H * (0.12 + Z.rnd(seed, i, 2) * 0.76);
        const s = Math.min(W, H) * (0.05 + Z.rnd(seed, i, 3) * 0.12);
        const col = i % 3 === 0 ? sc.accent : (i % 3 === 1 ? sc.fg : sc.dim);
        const kind = Z.rnd(seed, i, 4);
        if (kind < 0.34) env.circle(cx, cy, s / 2, col, null, 1, d.accent && i !== 0 ? 0.5 : 0.42);
        else if (kind < 0.68) env.rect(cx - s / 2, cy - s / 2, s, s, col, 0.4);
        else env.poly([[cx, cy - s / 2], [cx + s / 2, cy + s / 2], [cx - s / 2, cy + s / 2]], col, 0.42);
      }
    },
  },
  sparks: {
    name: '星芒', w: 1.2,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H, seed = d.seed;
      const n = 4 + (d.n | 0) * 3;
      for (let i = 0; i < n; i++) {
        const x = W * (0.06 + Z.rnd(seed, i, 1) * 0.88);
        const y = H * (0.08 + Z.rnd(seed, i, 2) * 0.84);
        const r = Math.min(W, H) * (0.006 + Z.rnd(seed, i, 3) * 0.014);
        const col = i % 4 === 0 ? sc.accent : sc.fg;
        env.circle(x, y, r, col, null, 1, 0.8);
        env.line([[x - r * 2.4, y], [x + r * 2.4, y]], col, Math.max(1, r * 0.35), 0.5);
        env.line([[x, y - r * 2.4], [x, y + r * 2.4]], col, Math.max(1, r * 0.35), 0.5);
      }
    },
  },
  bokeh: {
    name: '光斑', layer: 'back', w: 1.1,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H, seed = d.seed;
      const n = 4 + (d.n | 0) * 2;
      for (let i = 0; i < n; i++) {
        const x = W * Z.rnd(seed, i, 1), y = H * Z.rnd(seed, i, 2);
        const r = Math.min(W, H) * (0.03 + Z.rnd(seed, i, 3) * 0.09);
        env.circle(x, y, r, d.accent ? Z.rgba(sc.accent, 0.16) : Z.rgba(sc.fg, 0.1), null, 1, 1);
      }
    },
  },
  blobs: {
    name: '墨块', layer: 'back', subtle: true, w: 1,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H, seed = d.seed;
      for (let i = 0; i < 1 + (d.n | 0); i++) {
        const cx = W * Z.rnd(seed, i, 1), cy = H * Z.rnd(seed, i, 2);
        const R = Math.min(W, H) * (0.1 + Z.rnd(seed, i, 3) * 0.2);
        const pts = [];
        for (let k = 0; k < 9; k++) {
          const a = k / 9 * Z.TAU;
          const rr = R * (0.6 + Z.rnd(seed, i, k, 5) * 0.7);
          pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8]);
        }
        env.blob(pts, i === 0 && d.accent ? sc.accent : sc.dim, 0.34);
      }
    },
  },
  glowDisc: {
    name: '发光圆盘', layer: 'back', w: 1.1,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H;
      const cx = d.right ? W * 0.72 : W * 0.3, cy = d.low ? H * 0.7 : H * 0.32;
      const R = Math.min(W, H) * (d.big ? 0.24 : 0.16);
      const ctx = env.ctx;
      ctx.save();
      const col = env.pass !== 'main' ? env.passColor : sc.accent;
      const grd = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      if (env.pass !== 'main') { grd.addColorStop(0, col); grd.addColorStop(1, col); }
      else { grd.addColorStop(0, sc.accent); grd.addColorStop(0.5, sc.accent2 || sc.fg); grd.addColorStop(1, Z.mix(sc.bg, sc.accent, 0.1)); }
      ctx.globalAlpha = env.pass !== 'main' ? 0.4 : 0.75;
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Z.TAU); ctx.fill();
      ctx.restore();
    },
  },
  scanBar: {
    name: '扫描条', w: 1,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H;
      const y = (env.lt * 0.22 % 1) * H;
      env.rect(0, y - H * 0.006, W, H * 0.012, sc.accent, 0.5);
      env.rect(0, y + H * 0.012, W, Math.max(1, H * 0.002), sc.fg, 0.3);
    },
  },
  waveform: {
    name: '波形', w: 1,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H, seed = d.seed;
      const y0 = d.low ? H * 0.84 : H * 0.16;
      const pts = [];
      const N = 60;
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const amp = env.energy ? (env.energy[Math.min(env.energy.length - 1, Math.max(0, Math.floor(u * env.energy.length)))]) : 0.4;
        const v = Z.noise1(u * 22 + env.lt * 3, seed) * (0.3 + amp * 1.4);
        pts.push([W * 0.06 + u * W * 0.88, y0 + v * H * 0.05]);
      }
      env.line(pts, d.accent ? sc.accent : sc.fg, Math.max(1.5, W * 0.0022), 0.8);
      env.rect(W * 0.06, y0, W * 0.88, Math.max(1, H * 0.0015), sc.sub, 0.35);
    },
  },
  crossStitch: {
    name: '十字缝', w: 0.9,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H;
      const col = d.accent ? sc.accent : sc.fg;
      const n = 6 + (d.n | 0) * 2;
      const x0 = W * 0.1, y0 = d.low ? H * 0.9 : H * 0.1;
      for (let i = 0; i < n; i++) {
        const x = x0 + i * W * 0.8 / n;
        env.line([[x - W * 0.008, y0 - H * 0.012], [x + W * 0.008, y0 + H * 0.012]], col, Math.max(1.5, W * 0.0018), 0.7);
        env.line([[x - W * 0.008, y0 + H * 0.012], [x + W * 0.008, y0 - H * 0.012]], col, Math.max(1.5, W * 0.0018), 0.7);
      }
    },
  },
  tape: {
    name: '胶带', w: 1.3,
    draw(env, bb, d) {
      const sc = env.sc;
      if (!bb) return;
      const w = (bb.x1 - bb.x0) * 0.5 + 20, h = Math.min(bb.cy, env.H - bb.cy) * 0.1 + 12;
      const spots = [
        [bb.x0 + w * 0.4, bb.y0 + 4, -12],
        [bb.x1 - w * 0.4, bb.y1 - 4, -12],
      ];
      for (const [x, y, rot] of spots) {
        const ctx = env.ctx;
        ctx.save();
        ctx.translate(x, y); ctx.rotate(rot * Z.DEG);
        ctx.globalAlpha = env.pass !== 'main' ? 0.5 : 0.62;
        ctx.fillStyle = env.pass !== 'main' ? env.passColor : sc.sub;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.restore();
      }
    },
  },
  stampMark: {
    name: '印章', w: 1.2,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H;
      const x = d.right ? W * 0.82 : W * 0.18, y = d.low ? H * 0.8 : H * 0.2;
      const r = Math.min(W, H) * (d.big ? 0.09 : 0.062);
      const col = sc.accent;
      env.circle(x, y, r, null, col, Math.max(2.5, r * 0.09), 0.9);
      const ctx = env.ctx;
      ctx.save();
      ctx.translate(x, y); ctx.rotate((d.seed % 30 - 15) * Z.DEG);
      Z.drawText(env, {
        text: '印', font: 'mashan', size: r * 1.3, x, y,
        color: col, alpha: 0.9, enter: 'cut', exit: 'cut', hold: 'still', seed: d.seed,
      });
      ctx.restore();
    },
  },
  sealStk: {
    name: '落款印', w: 1.3,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H;
      const r = Math.min(W, H) * 0.055;
      const x = d.right ? W * 0.86 : W * 0.14, y = d.low ? H * 0.82 : H * 0.2;
      env.rect(x - r, y - r, r * 2, r * 2, sc.accent, 0.94);
      Z.drawText(env, { text: '文字PV', font: 'mashan', size: r * 0.5, x, y, color: sc.ink, enter: 'cut', exit: 'cut', hold: 'still', seed: d.seed });
    },
  },
  petals: {
    name: '花瓣', w: 1.1,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H, seed = d.seed;
      const n = 6 + (d.n | 0) * 4;
      for (let i = 0; i < n; i++) {
        const ph = Z.rnd(seed, i, 1);
        const x = ((Z.rnd(seed, i, 2) + env.lt * 0.03 * (0.5 + ph)) % 1) * W;
        const y = ((Z.rnd(seed, i, 3) + env.lt * 0.05 * (0.5 + ph)) % 1) * H;
        const s = Math.min(W, H) * (0.008 + Z.rnd(seed, i, 4) * 0.012);
        const a = env.lt * 1.2 + i;
        const ctx = env.ctx;
        ctx.save();
        ctx.translate(x, y); ctx.rotate(a);
        ctx.globalAlpha = env.pass !== 'main' ? 0.5 : 0.72;
        ctx.fillStyle = env.pass !== 'main' ? env.passColor : (i % 3 === 0 ? sc.accent : sc.fg);
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.quadraticCurveTo(s * 0.9, -s * 0.2, 0, s);
        ctx.quadraticCurveTo(-s * 0.9, -s * 0.2, 0, -s);
        ctx.fill();
        ctx.restore();
      }
    },
  },
  courtyard: {
    name: '灯笼', w: 1, wa: true,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H, seed = d.seed;
      const n = 1 + (d.n | 0);
      for (let i = 0; i < n; i++) {
        const x = W * (0.14 + i * 0.72 / Math.max(1, n)) + Z.rsign(seed, i, 1) * W * 0.06;
        const y = H * (0.14 + Z.rnd(seed, i, 2) * 0.14);
        const w = Math.min(W, H) * 0.075, h = w * 1.25;
        const swing = Math.sin(env.lt * 1.2 + i) * 2.5;
        const ctx = env.ctx;
        ctx.save();
        ctx.translate(x, y); ctx.rotate(swing * Z.DEG);
        ctx.globalAlpha = env.pass !== 'main' ? 0.5 : 0.85;
        ctx.fillStyle = env.pass !== 'main' ? env.passColor : sc.accent;
        ctx.beginPath(); ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Z.TAU); ctx.fill();
        ctx.globalAlpha = env.pass !== 'main' ? 0.4 : 0.5;
        ctx.strokeStyle = env.pass !== 'main' ? env.passColor : sc.bg;
        ctx.lineWidth = Math.max(1, w * 0.03);
        for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.ellipse(0, 0, w / 2 * Math.abs(k) / 2.7, h / 2, 0, 0, Z.TAU); ctx.stroke(); }
        ctx.globalAlpha = env.pass !== 'main' ? 0.5 : 0.8;
        ctx.fillStyle = env.pass !== 'main' ? env.passColor : sc.fg;
        ctx.fillRect(-w * 0.1, -h * 0.62, w * 0.2, h * 0.1);
        ctx.fillRect(-w * 0.16, h * 0.5, w * 0.32, h * 0.08);
        ctx.restore();
      }
    },
  },
  waves: {
    name: '水波', layer: 'back', subtle: true, w: 1, wa: true,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H;
      const col = d.accent ? sc.accent : sc.sub;
      const rows = 3 + (d.n | 0);
      const y0 = H * (d.low ? 0.7 : 0.12);
      for (let r = 0; r < rows; r++) {
        const pts = [];
        const N = 40;
        for (let i = 0; i <= N; i++) {
          const u = i / N;
          pts.push([u * W, y0 + r * H * 0.05 + Math.sin(u * 14 + r * 1.3 + env.lt * 0.8) * H * 0.008 + r * H * 0.02]);
        }
        env.line(pts, col, Math.max(1.5, W * 0.0016), 0.45);
      }
    },
  },
  glitchBits: {
    name: '故障碎片', w: 1.2,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H, seed = d.seed, step = env.step;
      for (let i = 0; i < 9; i++) {
        if (Z.rnd(seed, step, i, 1) > 0.45) continue;
        const y = Z.rnd(seed, step, i, 2) * H;
        const h = H * (0.004 + Z.rnd(seed, step, i, 3) * 0.02);
        const x = Z.rnd(seed, step, i, 4) * W * 0.6;
        const w = W * (0.06 + Z.rnd(seed, step, i, 5) * 0.3);
        env.rect(x, y, w, h, i % 3 === 0 ? sc.accent : (i % 3 === 1 ? sc.accent2 || sc.fg : sc.fg), 0.6);
      }
    },
  },
  scanlines: {
    name: '扫描线', layer: 'back', subtle: true, w: 1,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H;
      const step = H * 0.012;
      for (let y = 0; y < H; y += step * 2) env.rect(0, y, W, step * 0.5, sc.fg, 0.16);
    },
  },
  cornerMark: {
    name: '角标', w: 1,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H;
      const l = Math.min(W, H) * 0.07, m = Math.min(W, H) * 0.05;
      const col = d.accent ? sc.accent : sc.fg;
      const lw = Math.max(2.5, W * 0.0035);
      const corners = d.corner ? [[0, 0, 1, 1], [1, 0, -1, 1], [0, 1, 1, -1], [1, 1, -1, -1]] : [[0, 0, 1, 1], [1, 0, -1, 1]];
      for (const [cx, cy, dx, dy] of corners) {
        const x = m + (W - m * 2) * cx, y = m + (H - m * 2) * cy;
        env.rect(x, y, dx * l, lw, col, 0.85);
        env.rect(x, y, lw, dy * l, col, 0.85);
      }
    },
  },
  curveArrow: {
    name: '弧形箭头', w: 1,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H;
      const cx = d.right ? W * 0.76 : W * 0.24, cy = d.low ? H * 0.72 : H * 0.28;
      const R = Math.min(W, H) * 0.14;
      const col = d.accent ? sc.accent : sc.fg;
      env.arc(cx, cy, R, -140, 40, col, Math.max(2, W * 0.0035), 0.85);
      const a = 40 * Z.DEG;
      const tx = cx + Math.cos(a) * R, ty = cy + Math.sin(a) * R;
      const s = Math.min(W, H) * 0.022;
      env.poly([[tx + s * 0.6, ty + s * 0.1], [tx - s * 0.5, ty - s * 0.7], [tx - s * 0.3, ty + s * 0.8]], col, 0.9);
    },
  },
  plusGrid: {
    name: '加号阵列', layer: 'back', subtle: true, w: 0.8,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H;
      const step = Math.min(W, H) / 12;
      const col = d.accent ? sc.accent : sc.sub;
      const s = step * 0.14;
      for (let y = step / 2; y < H; y += step) {
        for (let x = step / 2; x < W; x += step) {
          env.rect(x - s, y - s * 0.24, s * 2, s * 0.48, col, 0.4);
          env.rect(x - s * 0.24, y - s, s * 0.48, s * 2, col, 0.4);
        }
      }
    },
  },
  scratch: {
    name: '划痕', w: 1,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H, seed = d.seed;
      for (let i = 0; i < 4 + (d.n | 0); i++) {
        const x = Z.rnd(seed, i, 1) * W;
        const y0 = Z.rnd(seed, i, 2) * H, y1 = y0 + H * (0.1 + Z.rnd(seed, i, 3) * 0.5);
        env.line([[x + Z.rsign(seed, i, 4) * W * 0.01, y0], [x + Z.rsign(seed, i, 5) * W * 0.01, y1]], i % 3 === 0 ? sc.accent : sc.fg, Math.max(1, W * 0.0012), 0.28);
      }
    },
  },
  notesMark: {
    name: '音符', w: 0.9,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H, seed = d.seed;
      for (let i = 0; i < 3 + (d.n | 0); i++) {
        const x = W * (0.08 + Z.rnd(seed, i, 1) * 0.84);
        const y = H * (0.15 + Z.rnd(seed, i, 2) * 0.7);
        const s = Math.min(W, H) * (0.012 + Z.rnd(seed, i, 3) * 0.014);
        const col = d.accent && i === 0 ? sc.accent : sc.fg;
        env.circle(x, y + s, s * 0.62, col, null, 1, 0.7);
        env.rect(x + s * 0.5, y - s * 1.4, Math.max(1.5, s * 0.16), s * 2.4, col, 0.7);
        env.rect(x + s * 0.5, y - s * 1.4, s * 1.1, Math.max(1.5, s * 0.3), col, 0.7);
      }
    },
  },
  confetti: {
    name: '彩带纸屑', w: 1.1,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H, seed = d.seed;
      const n = 10 + (d.n | 0) * 5;
      for (let i = 0; i < n; i++) {
        const ph = Z.rnd(seed, i, 1);
        const x = ((Z.rnd(seed, i, 2) + env.lt * 0.04 * (0.4 + ph)) % 1) * W;
        const y = ((Z.rnd(seed, i, 3) + env.lt * 0.08 * (0.3 + ph)) % 1) * H;
        const s = Math.min(W, H) * (0.004 + Z.rnd(seed, i, 4) * 0.008);
        const col = [sc.accent, sc.accent2 || sc.fg, sc.fg][i % 3];
        const ctx = env.ctx;
        ctx.save();
        ctx.translate(x, y); ctx.rotate((env.lt * 2 + i) % Z.TAU);
        ctx.globalAlpha = env.pass !== 'main' ? 0.5 : 0.8;
        ctx.fillStyle = env.pass !== 'main' ? env.passColor : col;
        ctx.fillRect(-s / 2, -s / 4, s, s / 2);
        ctx.restore();
      }
    },
  },

  /* ---------- 文字型装饰：最出"编辑感"的两个装置 ---------- */
  microText: {
    name: '微字散点', w: 1.6,
    draw(env, bb, d) {
      Z.extrasText(env, { text: env.cut.lineText || env.cut.text, count: 5 + (d.n | 0) * 2 });
    },
  },
  bgRows: {
    name: '背景字行', layer: 'back', w: 0.9,
    draw(env, bb, d) {
      Z.bgRowsText(env, {
        text: env.cut.lineText || env.cut.text,
        rows: 10 + (d.n | 0) * 3,
        font: d.font || 'sans_med',
        alpha: 0.3 + (d.big ? 0.18 : 0),
        flicker: d.accent,
        speed: 18 + d.n * 4,
      });
    },
  },

  /* ---------- 会动的元素 ---------- */
  tickRing: {
    name: '刻度环', layer: 'back', subtle: true, w: 1.2,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H, s = d.seed;
      const cx = d.right ? W * 0.78 : W * 0.22, cy = d.low ? H * 0.72 : H * 0.28;
      const R = Math.min(W, H) * (d.big ? 0.18 : 0.12);
      const col = d.accent ? sc.accent : sc.sub;
      const n = 36;
      const spin = env.lt * 0.25 * (d.r < 0.5 ? 1 : -1);
      for (let i = 0; i < n; i++) {
        const a = i / n * Z.TAU + spin;
        const major = i % 6 === 0;
        const r0 = R * (major ? 0.86 : 0.92), r1 = R;
        env.line([[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]],
          col, Math.max(1, W * (major ? 0.0022 : 0.0012)), major ? 0.85 : 0.5);
      }
      env.circle(cx, cy, R * 0.62, null, col, Math.max(1, W * 0.0012), 0.4);
      /* 一根随拍点跳动的指针 */
      const beat = env.beat ? Math.max(0, 1 - env.beat.since / env.beat.len) : 0;
      const pa = -Math.PI / 2 + env.lt * 0.9 + beat * 0.6;
      env.line([[cx, cy], [cx + Math.cos(pa) * R * 0.8, cy + Math.sin(pa) * R * 0.8]], sc.accent, Math.max(1.5, W * 0.0028), 0.95);
      env.circle(cx, cy, Math.max(2, W * 0.004), sc.accent, null, 1, 1);
    },
  },
  driftMotes: {
    name: '浮尘', w: 1.3,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H, s = d.seed;
      const n = 14 + (d.n | 0) * 8;
      for (let i = 0; i < n; i++) {
        const sp = 0.02 + Z.rnd(s, i, 3) * 0.06;
        const x = ((Z.rnd(s, i, 1) + env.lt * sp * (d.right ? 1 : -1)) % 1 + 1) % 1 * W;
        const y = ((Z.rnd(s, i, 2) - env.lt * sp * 1.3) % 1 + 1) % 1 * H;
        const r = Math.min(W, H) * (0.0015 + Z.rnd(s, i, 4) * 0.0035);
        env.circle(x, y, r, i % 5 === 0 ? sc.accent : sc.fg, null, 1, 0.25 + Z.rnd(s, i, 5) * 0.5);
      }
    },
  },
  waveBars: {
    name: '波动条', w: 1.2,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H, s = d.seed, step = env.step;
      const n = 18 + (d.n | 0) * 8;
      const y0 = d.low ? H * 0.86 : H * 0.12, hMax = H * 0.09;
      for (let i = 0; i < n; i++) {
        const u = i / n;
        const e = env.energy != null ? env.energy[Math.min(env.energy.length - 1, Math.floor(u * env.energy.length))] : null;
        const v = (Z.noise1(u * 16 + env.lt * 3.2, s) * 0.5 + 0.5) * (e != null ? 0.4 + e : 1);
        const bh = hMax * Z.clamp(v);
        env.rect(W * 0.06 + u * W * 0.88, y0 - bh, Math.max(1.5, W * 0.004), bh, i % 7 === 0 ? sc.accent : sc.fg, 0.7);
      }
      env.rect(W * 0.06, y0, W * 0.88, Math.max(1, H * 0.0014), sc.sub, 0.4);
    },
  },
  orbitDots: {
    name: '环绕点', layer: 'back', w: 1.1,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H, s = d.seed;
      const cx = d.right ? W * 0.76 : W * 0.24, cy = d.low ? H * 0.7 : H * 0.3;
      const rings = 2 + (d.n | 0);
      for (let r = 0; r < rings; r++) {
        const R = Math.min(W, H) * (0.06 + r * 0.045);
        const k = 4 + r * 2, sp = (0.5 - r * 0.1) * (d.r < 0.5 ? 1 : -1);
        for (let i = 0; i < k; i++) {
          const a = i / k * Z.TAU + env.lt * sp;
          env.circle(cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.72, Math.min(W, H) * (0.004 + Z.rnd(s, r, i, 1) * 0.004),
            i === 0 ? sc.accent : sc.fg, null, 1, 0.8);
        }
      }
    },
  },
  marqueeMini: {
    name: '走马小字', w: 1.2,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H;
      const size = H * (d.big ? 0.038 : 0.026);
      const txt = (env.cut.lineText || env.cut.text || '') + '\u3000\u00b7\u3000';
      const unit = txt.repeat(3);
      const dir = d.right ? 1 : -1;
      const y = d.low ? H * 0.9 : H * 0.085;
      const period = Math.max(1, Z.measureText({ text: unit, font: 'mono', size, track: 0.06 }).w);
      const t = ((env.lt * 90 * dir) % period + period) % period;
      Z.drawText(env, {
        text: unit.repeat(3), font: 'mono', size, track: 0.06, align: 'left',
        x: -period + t, y, color: d.accent ? sc.accent : sc.sub, alpha: 0.8,
        ghost: false, enter: 'cut', exit: 'cut', hold: 'still', noLettering: true,
      });
    },
  },
  recDot: {
    name: '记录点', w: 1,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H;
      const blink = Math.sin(env.lt * 4) > -0.2;
      const x = d.right ? W * 0.94 : W * 0.06, y = d.low ? H * 0.9 : H * 0.08;
      const r = Math.min(W, H) * 0.008;
      if (blink) env.circle(x, y, r, sc.accent, null, 1, 0.95);
      else env.circle(x, y, r, null, sc.accent, Math.max(1, r * 0.3), 0.6);
      Z.drawText(env, {
        text: 'REC', font: 'mono', size: r * 2.4, align: 'left', x: x + r * 2.4, y,
        color: sc.sub, alpha: blink ? 0.85 : 0.4, ghost: false,
        enter: 'cut', exit: 'cut', hold: 'still', noLettering: true,
      });
    },
  },
  cornerTicks: {
    name: '边角刻度', subtle: true, w: 1.1,
    draw(env, bb, d) {
      const sc = env.sc, W = env.W, H = env.H;
      const col = d.accent ? sc.accent : sc.sub;
      const m = Math.min(W, H) * 0.05, step = Math.min(W, H) * 0.018;
      const n = Math.floor((W - m * 2) / step);
      for (let i = 0; i <= n; i++) {
        const x = m + i * step;
        const major = i % 5 === 0;
        const h = major ? Math.min(W, H) * 0.014 : Math.min(W, H) * 0.007;
        env.rect(x, Math.min(W, H) * 0.028, Math.max(1, W * 0.001), h, col, major ? 0.75 : 0.4);
        env.rect(x, H - Math.min(W, H) * 0.028 - h, Math.max(1, W * 0.001), h, col, major ? 0.75 : 0.4);
      }
      /* 一排随播放前进的游标 */
      const cx = m + (env.lt / Math.max(0.4, env.cut.dur)) * (W - m * 2);
      env.rect(cx - Math.max(1, W * 0.0012), Math.min(W, H) * 0.022, Math.max(2, W * 0.0024), Math.min(W, H) * 0.026, sc.accent, 1);
    },
  },
}, 'core');

function sc_size(env) { return Math.min(env.W, env.H); }
function H_OFF(env) { return Math.min(env.W, env.H) * 0.06; }

/* ============================================================
   背景图形（整屏，逐行挑选）
   ============================================================ */
Z.registerAll('bg', {
  radial: {
    name: '放射爆闪', w: 1.2,
    draw(env, p) {
      const sc = env.sc, W = env.W, H = env.H;
      const n = 18 + (p.n | 0) * 4;
      const cx = W / 2, cy = H * 0.46;
      for (let i = 0; i < n; i++) {
        const a = i / n * Z.TAU + (p.rot || 0);
        const w = Z.rnd(p.seed, i, 1) * 0.03 + 0.006;
        env.poly([[cx, cy],
          [cx + Math.cos(a - w) * W * 1.2, cy + Math.sin(a - w) * H * 1.2],
          [cx + Math.cos(a + w) * W * 1.2, cy + Math.sin(a + w) * H * 1.2]], i % 3 === 0 ? sc.accent : sc.dim, 0.18);
      }
    },
  },
  concentric: {
    name: '同心圆', w: 1.1,
    draw(env, p) {
      const sc = env.sc, W = env.W, H = env.H;
      const cx = W * (p.x || 0.5), cy = H * (p.y || 0.45);
      for (let i = 1; i <= 12; i++) {
        env.circle(cx, cy, Math.min(W, H) * 0.06 * i, null, i % 4 === 0 ? sc.accent : sc.dim, Math.max(1.5, W * 0.0012), i % 4 === 0 ? 0.4 : 0.28);
      }
    },
  },
  giantText: {
    name: '巨型水印字', w: 1.3,
    draw(env, p) {
      const sc = env.sc, W = env.W, H = env.H;
      const txt = p.text || '字';
      const size = Math.min(W, H) * (p.big ? 1.1 : 0.72);
      Z.drawText(env, {
        text: txt, font: p.font || 'sans_black', size, x: W / 2, y: H / 2,
        color: sc.dim, alpha: 0.5, enter: 'cut', exit: 'cut', hold: 'still', seed: p.seed,
      });
    },
  },
  retroGrid: {
    name: '透视网格', w: 1.2,
    draw(env, p) {
      const sc = env.sc, W = env.W, H = env.H;
      const hz = H * (p.horizon || 0.55);
      const col = sc.accent;
      for (let i = -10; i <= 10; i++) {
        env.line([[W / 2 + i * W * 0.08, H], [W / 2 + i * W * 0.012, hz]], col, Math.max(1, W * 0.0012), 0.35);
      }
      let y = hz, step = H * 0.012;
      while (y < H) { env.rect(0, y, W, Math.max(1, H * 0.0015), col, 0.3); y += step; step *= 1.28; }
      env.rect(0, hz - H * 0.002, W, Math.max(2, H * 0.004), col, 0.5);
    },
  },
  polka: {
    name: '圆点', w: 1,
    draw(env, p) {
      const sc = env.sc, W = env.W, H = env.H;
      const step = Math.min(W, H) / (9 + (p.n | 0));
      for (let y = step / 2; y < H; y += step) {
        for (let x = ((Math.round(y / step) % 2) ? step : step / 2); x < W; x += step) {
          env.circle(x, y, step * (p.dot || 0.16), sc.dim, null, 1, 0.7);
        }
      }
    },
  },
  aurora: {
    name: '极光', w: 1.2,
    draw(env, p) {
      const sc = env.sc, W = env.W, H = env.H;
      const ctx = env.ctx;
      ctx.save();
      for (let i = 0; i < 4; i++) {
        const grd = ctx.createLinearGradient(0, 0, W, H);
        const col = i % 2 ? sc.accent : (sc.accent2 || sc.fg);
        grd.addColorStop(0, Z.rgba(col, 0));
        grd.addColorStop(0.4 + i * 0.06, Z.rgba(col, 0.2 * (1 - i * 0.15)));
        grd.addColorStop(1, Z.rgba(col, 0));
        ctx.fillStyle = grd;
        const y0 = H * (0.1 + i * 0.2) + Math.sin(env.lt * 0.3 + i) * H * 0.04;
        ctx.save();
        ctx.translate(0, y0);
        ctx.rotate((i - 1.5) * 4 * Z.DEG);
        ctx.fillRect(-W, -H * 0.2, W * 3, H * 0.34);
        ctx.restore();
      }
      ctx.restore();
    },
  },
  meshGrad: {
    name: '网格渐变', w: 1.1,
    draw(env, p) {
      const sc = env.sc, W = env.W, H = env.H, ctx = env.ctx;
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const cx = W * (0.2 + i * 0.3 + (Z.rnd(p.seed, i, 1) - 0.5) * 0.2);
        const cy = H * (0.3 + (Z.rnd(p.seed, i, 2) - 0.5) * 0.4);
        const R = Math.min(W, H) * (0.4 + Z.rnd(p.seed, i, 3) * 0.3);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        const col = [sc.accent, sc.accent2 || sc.fg, sc.dim][i];
        g.addColorStop(0, Z.rgba(col, 0.3));
        g.addColorStop(1, Z.rgba(col, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
    },
  },
  seigaiha: {
    name: '青海波', w: 1, wa: true,
    draw(env, p) {
      const sc = env.sc, W = env.W, H = env.H;
      const r = Math.min(W, H) / (7 + (p.n | 0));
      const col = sc.dim;
      for (let y = -r; y < H + r; y += r * 0.5) {
        const off = (Math.round(y / (r * 0.5)) % 2) ? r : 0;
        for (let x = -r; x < W + r; x += r * 2) {
          env.arc(x + off, y, r * 0.5, 180, 360, col, Math.max(1, W * 0.0014), 0.5);
          env.arc(x + off, y, r * 0.34, 180, 360, col, Math.max(1, W * 0.0014), 0.35);
        }
      }
    },
  },
  asanoha: {
    name: '麻叶纹', w: 0.9, wa: true,
    draw(env, p) {
      const sc = env.sc, W = env.W, H = env.H;
      const s = Math.min(W, H) / (7 + (p.n | 0));
      const col = sc.dim;
      for (let y = 0; y < H + s; y += s) {
        for (let x = 0; x < W + s; x += s) {
          const cx = x + ((Math.round(y / s) % 2) ? s / 2 : 0);
          for (let k = 0; k < 6; k++) {
            const a = k / 6 * Z.TAU + Math.PI / 6;
            env.line([[cx, y], [cx + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.55]], col, Math.max(1, W * 0.0012), 0.35);
          }
        }
      }
    },
  },
  houndstooth: {
    name: '千鸟格', w: 0.9,
    draw(env, p) {
      const sc = env.sc, W = env.W, H = env.H;
      const s = Math.min(W, H) / (8 + (p.n | 0));
      for (let y = 0; y < H + s; y += s) {
        for (let x = 0; x < W + s; x += s) {
          if ((Math.round(x / s) + Math.round(y / s)) % 2) continue;
          env.poly([[x, y], [x + s * 0.5, y], [x + s * 0.5, y + s * 0.5], [x + s, y + s * 0.5], [x + s, y + s], [x + s * 0.5, y + s], [x + s * 0.5, y + s * 0.5], [x, y + s * 0.5]], sc.dim, 0.55);
        }
      }
    },
  },
  tartan: {
    name: '格纹', w: 0.9,
    draw(env, p) {
      const sc = env.sc, W = env.W, H = env.H;
      const s = Math.min(W, H) / (8 + (p.n | 0));
      for (let x = 0; x < W; x += s * 3) {
        env.rect(x, 0, s, H, sc.accent, 0.16);
        env.rect(x + s * 1.5, 0, Math.max(1.5, s * 0.12), H, sc.fg, 0.1);
      }
      for (let y = 0; y < H; y += s * 3) {
        env.rect(0, y, W, s, sc.accent, 0.16);
        env.rect(0, y + s * 1.5, W, Math.max(1.5, s * 0.12), sc.fg, 0.1);
      }
    },
  },
  contour: {
    name: '等高线', w: 1,
    draw(env, p) {
      const sc = env.sc, W = env.W, H = env.H, seed = p.seed;
      for (let i = 0; i < 9; i++) {
        const pts = [];
        const N = 60;
        for (let k = 0; k <= N; k++) {
          const u = k / N;
          const y = H * (0.1 + i * 0.1) + Z.noise1(u * 6 + i * 2.4, seed) * H * 0.05;
          pts.push([u * W, y]);
        }
        env.line(pts, i % 3 === 0 ? sc.accent : sc.dim, Math.max(1.5, W * 0.0014), 0.4);
      }
    },
  },
  starfield: {
    name: '星空', w: 1.2,
    draw(env, p) {
      const sc = env.sc, W = env.W, H = env.H, seed = p.seed;
      const n = 90 + (p.n | 0) * 30;
      for (let i = 0; i < n; i++) {
        const x = Z.rnd(seed, i, 1) * W, y = Z.rnd(seed, i, 2) * H;
        const r = Math.min(W, H) * (0.0015 + Z.rnd(seed, i, 3) * 0.004);
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(env.lt * (0.6 + Z.rnd(seed, i, 4)) + i));
        env.circle(x, y, r * (0.7 + tw * 0.6), i % 11 === 0 ? sc.accent : sc.fg, null, 1, 0.35 + tw * 0.55);
      }
    },
  },
  moonNight: {
    name: '月夜', w: 1, wa: true,
    draw(env, p) {
      const sc = env.sc, W = env.W, H = env.H;
      const R = Math.min(W, H) * 0.22;
      const cx = W * 0.74, cy = H * 0.26;
      env.circle(cx, cy, R, sc.accent, null, 1, 0.9);
      env.circle(cx + R * 0.42, cy - R * 0.2, R * 1.02, sc.bg, null, 1, 1);
      for (let i = 0; i < 40; i++) {
        env.circle(Z.rnd(p.seed, i, 1) * W, Z.rnd(p.seed, i, 2) * H * 0.6, Math.min(W, H) * 0.0022, sc.fg, null, 1, 0.5);
      }
    },
  },
  cityscape: {
    name: '城市剪影', w: 1,
    draw(env, p) {
      const sc = env.sc, W = env.W, H = env.H, seed = p.seed;
      const base = H * 0.78;
      let x = 0;
      while (x < W) {
        const w = W * (0.03 + Z.rnd(seed, Math.floor(x), 1) * 0.07);
        const h = H * (0.08 + Z.rnd(seed, Math.floor(x), 2) * 0.3);
        env.rect(x, base - h, w * 0.94, h + H, sc.dim, 0.9);
        /* 窗户 */
        for (let wy = base - h + H * 0.02; wy < base - H * 0.02; wy += H * 0.028) {
          for (let wx = x + w * 0.14; wx < x + w * 0.8; wx += w * 0.26) {
            if (Z.rnd(seed, Math.floor(wx), Math.floor(wy), 3) < 0.42) env.rect(wx, wy, w * 0.12, H * 0.012, sc.accent, 0.7);
          }
        }
        x += w;
      }
    },
  },
  sunset: {
    name: '落日海面', w: 1,
    draw(env, p) {
      const sc = env.sc, W = env.W, H = env.H;
      const hz = H * 0.58;
      env.circle(W / 2, hz - H * 0.08, Math.min(W, H) * 0.16, sc.accent, null, 1, 0.9);
      env.rect(0, hz, W, Math.max(3, H * 0.006), sc.fg, 0.7);
      for (let i = 0; i < 16; i++) {
        const y = hz + H * 0.03 * (i + 1);
        const w = W * (0.5 - i * 0.025) * (0.7 + 0.5 * Math.abs(Math.sin(env.lt * 0.6 + i)));
        env.rect(W / 2 - w / 2, y, w, Math.max(2, H * 0.004), sc.accent, 0.3 - i * 0.012);
      }
    },
  },
  rainWindow: {
    name: '雨窗', w: 0.9,
    draw(env, p) {
      const sc = env.sc, W = env.W, H = env.H, seed = p.seed;
      for (let i = 0; i < 60; i++) {
        const x = Z.rnd(seed, i, 1) * W;
        const y = ((Z.rnd(seed, i, 2) + env.lt * (0.4 + Z.rnd(seed, i, 3))) % 1) * H;
        const len = H * (0.03 + Z.rnd(seed, i, 4) * 0.06);
        env.rect(x, y, Math.max(1.2, W * 0.0014), len, sc.fg, 0.28);
      }
    },
  },
  fireworks: {
    name: '烟花', w: 1,
    draw(env, p) {
      const sc = env.sc, W = env.W, H = env.H, seed = p.seed;
      for (let f = 0; f < 3; f++) {
        const cx = W * (0.2 + Z.rnd(seed, f, 1) * 0.6);
        const cy = H * (0.15 + Z.rnd(seed, f, 2) * 0.35);
        const ph = ((env.lt * 0.35 + Z.rnd(seed, f, 3)) % 1);
        const R = Math.min(W, H) * 0.2 * ph;
        const n = 26;
        for (let i = 0; i < n; i++) {
          const a = i / n * Z.TAU;
          const rr = R * (0.7 + Z.rnd(seed, f, i, 4) * 0.5);
          env.circle(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, Math.min(W, H) * 0.0025, f % 2 ? sc.accent : sc.fg, null, 1, (1 - ph) * 0.8);
        }
      }
    },
  },
  mountains: {
    name: '山峦', w: 1,
    draw(env, p) {
      const sc = env.sc, W = env.W, H = env.H, seed = p.seed;
      for (let layer = 0; layer < 3; layer++) {
        const base = H * (0.7 + layer * 0.1);
        const pts = [[0, H]];
        const N = 14;
        for (let i = 0; i <= N; i++) {
          const u = i / N;
          pts.push([u * W, base - Math.abs(Z.noise1(u * 3 + layer * 5, seed + layer)) * H * (0.24 - layer * 0.05)]);
        }
        pts.push([W, H]);
        env.poly(pts, layer === 0 ? sc.dim : (layer === 1 ? Z.mix(sc.dim, sc.bg, 0.35) : Z.mix(sc.dim, sc.bg, 0.6)), 0.85);
      }
    },
  },
  vhsNoise: {
    name: 'VHS 噪波', w: 1.2,
    draw(env, p) {
      const sc = env.sc, W = env.W, H = env.H, seed = p.seed, step = env.step;
      for (let i = 0; i < 22; i++) {
        const y = Z.rnd(seed, step, i, 1) * H;
        const h = H * (0.002 + Z.rnd(seed, step, i, 2) * 0.014);
        env.rect(0, y, W, h, i % 3 === 0 ? sc.accent : sc.fg, 0.12 + Z.rnd(seed, step, i, 3) * 0.18);
      }
      for (let i = 0; i < 5; i++) {
        const y = Z.rnd(seed, step, i, 4) * H;
        env.rect(0, y, W, H * 0.02, Z.rgba(sc.fg, 0.06), 1);
      }
    },
  },
  marble: {
    name: '大理石纹', w: 0.9,
    draw(env, p) {
      const sc = env.sc, W = env.W, H = env.H, seed = p.seed;
      for (let i = 0; i < 14; i++) {
        const pts = [];
        const N = 40;
        for (let k = 0; k <= N; k++) {
          const u = k / N;
          const y = u * H;
          const x = W * (0.5 + (Z.noise1(u * 4 + i * 1.7, seed) * 0.5 + (i - 7) * 0.06));
          pts.push([x, y]);
        }
        env.line(pts, i % 4 === 0 ? sc.accent : sc.dim, Math.max(1.5, W * (0.001 + (i % 3) * 0.001)), 0.34);
      }
    },
  },
  papercut: {
    name: '剪纸花', w: 0.9,
    draw(env, p) {
      const sc = env.sc, W = env.W, H = env.H;
      const cx = W * 0.5, cy = H * 0.5;
      const R = Math.min(W, H) * 0.42;
      const ctx = env.ctx;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.globalAlpha = env.pass !== 'main' ? 0.4 : 0.3;
      ctx.fillStyle = env.pass !== 'main' ? env.passColor : sc.accent;
      for (let i = 0; i < 12; i++) {
        ctx.save(); ctx.rotate(i / 12 * Z.TAU);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(R * 0.3, -R * 0.2, R * 0.9, 0);
        ctx.quadraticCurveTo(R * 0.3, R * 0.2, 0, 0);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    },
  },
  circuit: {
    name: '电路板', w: 0.9,
    draw(env, p) {
      const sc = env.sc, W = env.W, H = env.H, seed = p.seed;
      const step = Math.min(W, H) / 14;
      for (let i = 0; i < 26; i++) {
        let x = Math.round(Z.rnd(seed, i, 1) * W / step) * step;
        let y = Math.round(Z.rnd(seed, i, 2) * H / step) * step;
        const pts = [[x, y]];
        for (let k = 0; k < 4; k++) {
          if (Z.rnd(seed, i, k, 3) < 0.5) x += (Z.rnd(seed, i, k, 4) < 0.5 ? -1 : 1) * step * Z.int2(seed, i, k);
          else y += (Z.rnd(seed, i, k, 5) < 0.5 ? -1 : 1) * step * Z.int2(seed, i, k);
          pts.push([x, y]);
        }
        env.line(pts, i % 5 === 0 ? sc.accent : sc.dim, Math.max(1.5, W * 0.0016), 0.42);
        env.circle(pts[pts.length - 1][0], pts[pts.length - 1][1], Math.min(W, H) * 0.005, i % 5 === 0 ? sc.accent : sc.dim, null, 1, 0.6);
      }
    },
  },
  bloomField: {
    name: '花田点彩', w: 1,
    draw(env, p) {
      const sc = env.sc, W = env.W, H = env.H, seed = p.seed;
      for (let i = 0; i < 70; i++) {
        const x = Z.rnd(seed, i, 1) * W, y = Z.rnd(seed, i, 2) * H;
        const r = Math.min(W, H) * (0.004 + Z.rnd(seed, i, 3) * 0.01);
        env.circle(x, y, r, i % 4 === 0 ? sc.accent : sc.dim, null, 1, 0.6);
        if (i % 6 === 0) {
          for (let k = 0; k < 5; k++) {
            const a = k / 5 * Z.TAU;
            env.circle(x + Math.cos(a) * r * 1.9, y + Math.sin(a) * r * 1.9, r * 0.7, sc.accent, null, 1, 0.7);
          }
        }
      }
    },
  },
}, 'core');
Z.int2 = (a, b, c) => 1 + Math.floor(Z.rnd(a, b, c, 9) * 2);

/* ============================================================
   文字加工
   apply(env, it, p)  直接改写文字元素的样式字段
   ============================================================ */
Z.registerAll('treat', {
  outline: {
    name: '描边字', safe: true, w: 1.4,
    apply(env, it, p) {
      it.fill = p.fill !== false ? false : true;
      it.stroke = it.size * (p.w || 0.022);
      it.strokeColor = p.color === 'accent' ? env.sc.accent : env.sc.fg;
    },
  },
  outlineFill: {
    name: '描边+填色', safe: true, w: 1.2,
    apply(env, it, p) {
      it.stroke = it.size * 0.03;
      it.strokeColor = env.sc.accent;
      it.strokeUnder = true;
      it.color = env.sc.fg;
    },
  },
  extrude: {
    name: '立体挤出', w: 1.2,
    apply(env, it, p) {
      const k = p.deep ? 2 : 1;
      it.extrude = { n: Math.round(6 * k), dx: it.size * 0.012 * (p.dx || 1), dy: it.size * 0.012 * (p.dy || 1), color: p.color === 'ghost' ? env.sc.ghostA : env.sc.dim, a: 0.95, fade: p.fade !== false };
    },
  },
  longShadow: {
    name: '长投影', w: 1.1,
    apply(env, it, p) {
      it.extrude = { n: 22, dx: it.size * 0.02, dy: it.size * 0.02, color: env.sc.dim, a: 0.55, fade: true };
    },
  },
  glow: {
    name: '发光', w: 1.3,
    apply(env, it, p) {
      it.shadow = { color: Z.rgba(env.sc.accent, 0.85), blur: it.size * (p.soft ? 0.5 : 0.28), dx: 0, dy: 0 };
      it.color = env.sc.fg;
    },
  },
  neon: {
    name: '霓虹管', w: 1.2,
    apply(env, it, p) {
      it.fill = false;
      it.stroke = it.size * 0.045;
      it.strokeColor = env.sc.accent;
      it.shadow = { color: Z.rgba(env.sc.accent, 0.9), blur: it.size * 0.42, dx: 0, dy: 0 };
    },
  },
  marker: {
    name: '荧光笔', w: 1.2,
    apply(env, it, p) {
      it.pre = (env2, it2, bb) => {
        const m = it2._m || Z.measure(it2);
        const box = Z.itemBox(it2);
        const h = it2.size * 0.72;
        const y = it2.y + it2.size * 0.2 - h / 2;
        env2.rrect(box.x0 - it2.size * 0.12, y, m.w + it2.size * 0.24, h, h * 0.22, env2.sc.accent, 0.7);
      };
      it.color = env.sc.ink;
    },
  },
  gradientFill: {
    name: '渐变填充', w: 1.2,
    apply(env, it, p) {
      const sc = env.sc;
      it.gradient = sc.grad ? sc.grad.slice() : [sc.accent, sc.accent2 || sc.fg];
      if (p.flip) it.gradient = [it.gradient[1], it.gradient[0]];
      it.fill = true;
    },
  },
  patternFill: {
    name: '图案填充', w: 1,
    apply(env, it, p) {
      it.pattern = { kind: p.kind || Z.rpick(['dots', 'stripes', 'hatch', 'grid', 'lines', 'bricks'], p.seed | 0), color: env.sc.accent, bg: null };
      it.color = env.sc.fg;
    },
  },
  halftoneText: {
    name: '网纹字', w: 0.9,
    apply(env, it, p) {
      it.pattern = { kind: 'dots', color: env.sc.fg, bg: null };
      it.fillAlpha = 0.9;
    },
  },
  misalign: {
    name: '色版错位', w: 1.2,
    apply(env, it, p) {
      it.echo = { n: 2, dx: it.size * 0.03, dy: -it.size * 0.014, a: 0.85, decay: 0.7, color: p.ghostB ? env.sc.ghostB : env.sc.ghostA };
    },
  },
  multiShadow: {
    name: '多重影', w: 1,
    apply(env, it, p) {
      it.echo = { n: 4, dx: it.size * 0.05, dy: it.size * 0.05, a: 0.5, decay: 0.72, color: env.sc.dim };
    },
  },
  chrome: {
    name: '金属铭牌', w: 1,
    apply(env, it, p) {
      const sc = env.sc;
      it.gradient = [[0, Z.mix(sc.fg, '#FFFFFF', 0.6)], [0.48, sc.fg], [0.52, Z.mix(sc.fg, sc.bg, 0.55)], [1, Z.mix(sc.fg, '#FFFFFF', 0.3)]];
      it.stroke = it.size * 0.018;
      it.strokeColor = sc.bg;
      it.strokeUnder = true;
    },
  },
  rainbow: {
    name: '彩虹渐变', w: 0.9,
    apply(env, it, p) {
      const g = [];
      for (let i = 0; i <= 6; i++) g.push([i / 6, Z.hsl2hex(i * 60 + (p.seed | 0) % 60, 0.9, 0.6)]);
      it.gradient = g;
      it.fill = true;
    },
  },
  stencil: {
    name: '模板喷漆', w: 0.9,
    apply(env, it, p) {
      it.dash = 0.62;
      it.stroke = it.size * 0.03;
      it.strokeColor = env.sc.fg;
      it.fillAlpha = 0.14;
    },
  },
  bracketJP: {
    name: '括号框', w: 0.9,
    apply(env, it, p) {
      it.post = (env2, it2, bb) => {
        if (!bb) return;
        const size = it2.size, col = env2.sc.accent;
        const pad = size * 0.34;
        Z.drawText(env2, { text: '\u300c', font: it2.font, size, x: bb.x0 - pad, y: it2.y, color: col, enter: 'cut', exit: 'cut', hold: 'still', seed: it2.seed });
        Z.drawText(env2, { text: '\u300d', font: it2.font, size, x: bb.x1 + pad, y: it2.y, color: col, enter: 'cut', exit: 'cut', hold: 'still', seed: it2.seed });
      };
    },
  },
  circleEnclose: {
    name: '圈重点', w: 0.9,
    apply(env, it, p) {
      it.post = (env2, it2, bb) => {
        if (!bb || !bb.boxes.length) return;
        const b = bb.boxes[Math.floor(bb.boxes.length * 0.5)];
        const R = Math.max(b.w, b.h) * 0.85;
        env2.circle(it2.x + b.x, it2.y + b.y, R, null, env2.sc.accent, Math.max(2.5, it2.size * 0.022), 0.9);
      };
    },
  },
  emphasisDots: {
    name: '着重号', w: 0.9,
    apply(env, it, p) {
      it.post = (env2, it2, bb) => {
        if (!bb) return;
        for (const b of bb.boxes) {
          env2.circle(it2.x + b.x, it2.y + b.y + it2.size * 0.62, it2.size * 0.05, env2.sc.accent, null, 1, 0.95);
        }
      };
    },
  },
  underline: {
    name: '下划线', w: 1,
    apply(env, it, p) {
      it.post = (env2, it2, bb) => {
        if (!bb) return;
        env2.rect(bb.x0, bb.y1 + it2.size * 0.1, bb.x1 - bb.x0, Math.max(2.5, it2.size * 0.045), env2.sc.accent, 0.95);
      };
    },
  },
  reflection: {
    name: '倒影', w: 1,
    apply(env, it, p) {
      it.post = (env2, it2, bb) => {
        if (!bb) return;
        const c = Object.assign({}, it2, {
          y: it2.y + (bb.y1 - bb.y0) * 0.95 + it2.size * 0.1,
          sy: -(it2.sy || 1) * 0.55, alpha: (it2.alpha ?? 1) * 0.28,
          gradient: [it2.color || env2.sc.fg, 'rgba(0,0,0,0)'],
          charFn: null, pieceFn: null, post: null, echo: null, shadow: null, extrude: null, _lay: null, _m: null,
        });
        Z.drawText(env2, c);
      };
    },
  },
  shadowDrop: {
    name: '投影', safe: true, w: 1.1,
    apply(env, it, p) {
      it.shadow = { color: 'rgba(0,0,0,0.55)', blur: it.size * 0.16, dx: it.size * 0.02, dy: it.size * 0.025 };
    },
  },
  stickerEdge: {
    name: '贴纸白边', w: 1,
    apply(env, it, p) {
      it.stroke = it.size * 0.055;
      it.strokeColor = '#FFFFFF';
      it.strokeUnder = true;
      it.shadow = { color: 'rgba(0,0,0,0.35)', blur: it.size * 0.14, dx: 0, dy: it.size * 0.02 };
    },
  },
  blurEdge: {
    name: '柔焦边', w: 0.8,
    apply(env, it, p) {
      it.blur = (it.blur || 0) + it.size * 0.014;
      it.shadow = { color: Z.rgba(env.sc.fg, 0.4), blur: it.size * 0.2, dx: 0, dy: 0 };
    },
  },
  cutout: {
    name: '剪贴字', w: 0.9,
    apply(env, it, p) {
      it.pre = (env2, it2) => {
        const box = Z.itemBox(it2);
        env2.ctx.save();
        env2.ctx.translate(Z.rsign(it2.seed, 7) * it2.size * 0.03, Z.rsign(it2.seed, 8) * it2.size * 0.03);
        env2.ctx.rotate(Z.rsign(it2.seed, 9) * 3 * Z.DEG);
        env2.rrect(box.x0 - it2.size * 0.1, box.y0 - it2.size * 0.06, box.w + it2.size * 0.2, box.h + it2.size * 0.12, it2.size * 0.03, env2.sc.fg, 0.95);
        env2.ctx.restore();
      };
      it.color = env.sc.bg;
    },
  },
  karaoke: {
    name: '卡拉OK填充', w: 1.2,
    apply(env, it, p) {
      /* 从左到右把字"唱"成强调色：先画底，再按进度裁一条强调色 */
      it.post = (env2, it2, bb) => {
        if (!bb) return;
        const m = it2._m || Z.measure(it2);
        const p2 = Z.clamp(env2.lt / Math.max(0.6, (env2.cut.params || {}).karaokeDur || env2.cut.dur * 0.75));
        if (p2 <= 0.01) return;
        const box = Z.itemBox(it2);
        const c = Object.assign({}, it2, {
          color: env2.sc.accent, charFn: null, pieceFn: null, post: null, echo: null,
          shadow: null, extrude: null, gradient: null, pattern: null, _lay: null, _m: null,
        });
        env2.ctx.save();
        env2.ctx.beginPath();
        env2.ctx.rect(box.x0 - it2.size, box.y0 - it2.size, box.w * p2 + it2.size, box.h + it2.size * 2);
        env2.ctx.clip();
        Z.drawText(env2, c);
        env2.ctx.restore();
      };
    },
  },

  /* 挖版：字底下垫一块实色版，字挖成背景色 */
  knockout: {
    name: '挖版', w: 1.3,
    apply(env, it, p) {
      it.pre = (env2, it2) => Z.knockout(env2, it2, env2.sc.ink);
      it.color = env.sc.bg;
      it.fillAlpha = 1;
    },
  },
  /* 复写副本：整行在旁边再写一遍，描边或压暗 */
  sideCopy: {
    name: '复写副本', w: 1.2,
    apply(env, it, p) {
      const outline = p.outline !== false;
      const gap = (p.gap || 0.9) * it.size;
      it.echo = {
        n: p.n || 2, dy: 0, dx: gap,
        a: outline ? 0.85 : 0.42, decay: 1,
        color: env.sc.sub,
      };
      if (outline) it.echo.outline = true;
    },
  },
}, 'core');
})();
