/* ============================================================
   RuiC-TextPV — 运动库
   入场 / 保持 / 退场。每个零件改写文本元素的状态，
   或挂上逐字（charFn）与逐块（pieceFn）的动画函数。
   ============================================================ */
(() => {
'use strict';
const E = Z.E;

const SCRAMBLE_POOL = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン爱梦声光影空夜星雨泪心恋神呼叫虚★◆▲●■※＃＄％＆0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const KANA_POOL = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';

/* ============================================================
   入场（出现方式）
   ============================================================ */
Z.registerAll('enter', {
  cut: { name: '硬切', apply() {} },

  /* 打字机：一字一字冒出来，可带光标 */
  type: {
    name: '打字机', cursor: true,
    apply(env, it, p) {
      const n = (it._m || (it._m = Z.measure(it))).lay.N;
      const k = Math.floor(p * (n + 0.999));
      it.charFns.push(i => (i >= k ? { hide: true } : null));
      it.cursorAt = p < 1 ? k : -1;
    },
  },

  /* 逐字弹跳放大 */
  pop: {
    name: '逐字弹入',
    apply(env, it, p) {
      const seed = it.seed | 0;
      it.charFns.push((i, g, n) => {
        const d = n > 1 ? (i / (n - 1)) * 0.45 : 0;
        const q = Z.clamp((p - d) / 0.55);
        if (q <= 0) return { hide: true };
        return { s: E.outBack(q, 2.6), rot: (1 - E.outCubic(q)) * Z.rsign(seed, i, 9) * 30 };
      });
    },
  },

  /* 从上方掉落 + 压扁回弹 */
  drop: {
    name: '掉落挤压',
    apply(env, it, p) {
      const size = it.size, seed = it.seed | 0;
      it.charFns.push((i, g, n) => {
        const d = n > 1 ? Z.rnd(seed, i, 4) * 0.5 : 0;
        const q = Z.clamp((p - d) / 0.5);
        if (q <= 0) return { hide: true };
        const b = E.outBounce(q);
        return { dy: -(1 - b) * size * 2.6, sy: 1 + (1 - q) * 0.5, sx: 1 - (1 - q) * 0.2 };
      });
    },
  },

  /* 从下方弹起 */
  rise: {
    name: '弹起',
    apply(env, it, p) {
      const size = it.size, seed = it.seed | 0;
      it.charFns.push((i, g, n) => {
        const d = n > 1 ? (i / (n - 1)) * 0.35 : 0;
        const q = Z.clamp((p - d) / 0.6);
        if (q <= 0) return { hide: true };
        const e = E.outBack(q, 1.7);
        return { dy: (1 - e) * size * 1.9, a: Math.min(1, q * 3), s: Z.lerp(0.85, 1, e) };
      });
    },
  },

  /* 字形碎块从四周聚拢 */
  assemble: {
    name: '碎块聚拢', pieces: true,
    apply(env, it, p, ctx) {
      const dur = ctx.inDur, lt = env.lt - (it.delay || 0);
      const spread = it.size * 3.4 * (0.6 + env.fx.motion * 0.7), seed = it.seed | 0;
      it.pieceFns.push((ci, pj, pc, ox, oy) => {
        const d = Z.rnd(seed, ci, pj, 1) * dur * 0.45;
        const x = (lt - d) / Math.max(0.05, dur * 0.62);
        if (x < 0) return null;
        const e = E.outExpo(x), k = 1 - e;
        if (k <= 0.0005) return Z.REST;
        const ang = Z.rnd(seed, ci, pj, 2) * Z.TAU;
        const dist = spread * (0.35 + 0.65 * Z.rnd(seed, ci, pj, 3));
        const sp = (e - E.outExpo(x - 1 / (env.fps * dur * 0.62))) * dist;
        return Z.PIECE(Math.cos(ang) * dist * k, Math.sin(ang) * dist * k,
          Z.rsign(seed, ci, pj, 4) * 190 * k,
          1 + (Z.lerp(0.4, 2.1, Z.rnd(seed, ci, pj, 5)) - 1) * k,
          1 + Math.min(2.0, sp * 0.02), ang / Z.DEG, 1);
      });
    },
  },

  /* 横向切片飞入 */
  slice: {
    name: '切片错位',
    apply(env, it, p) {
      const W = env.W;
      it.bands = Z.itemBands(env, it, 7, (i) => (1 - E.outExpo(p * 1.2 - 0.05 * i)) * (i % 2 ? 1 : -1) * W * 0.9);
    },
  },

  /* 毛笔一笔扫过：斜向揭示 + 墨迹边缘 */
  brush: {
    name: '毛笔扫入',
    apply(env, it, p) {
      const m = it._m || (it._m = Z.measure(it));
      const e = E.outCubic(p);
      const x0 = it.x - m.w / 2 - it.size * 0.4, x1 = it.x + m.w / 2 + it.size * 0.4;
      const edge = Z.lerp(x1, x0, e);
      it.clip = [edge, x1 + 4000];
      it.blur = (it.blur || 0) + (1 - e) * 6;
      it.wipeBar = p < 1 ? { x: edge, h: m.h * 1.25 + it.size * 0.2, ink: true } : null;
    },
  },

  /* 雨刷式扫出 */
  wipe: {
    name: '擦除揭示', bar: true,
    apply(env, it, p) {
      const e = E.inOutExpo(p);
      const m = it._m || (it._m = Z.measure(it));
      const x0 = it.x - m.w / 2 - it.size * 0.2, x1 = it.x + m.w / 2 + it.size * 0.2;
      const dir = (it.seed | 0) % 2 ? 1 : -1;
      const edge = dir > 0 ? Z.lerp(x0, x1, e) : Z.lerp(x1, x0, e);
      it.clip = dir > 0 ? [x0 - 4000, edge] : [edge, x1 + 4000];
      it.wipeBar = p < 1 ? { x: edge, h: m.h * 1.3 + it.size * 0.2 } : null;
    },
  },

  /* 从模糊到清晰 */
  blur: {
    name: '虚化聚焦',
    apply(env, it, p) {
      const e = E.outCubic(p);
      it.blur = (it.blur || 0) + (1 - e) * 26;
      it.alpha = (it.alpha ?? 1) * Math.pow(e, 0.7);
      it.size *= 1 + 0.18 * (1 - e);
      it.track = (it.track || 0) + (1 - e) * 0.5;
    },
  },

  /* 纯淡入 + 轻微放大 */
  fade: {
    name: '淡入',
    apply(env, it, p) {
      const e = E.outQuad(p);
      it.alpha = (it.alpha ?? 1) * e;
      it.size *= 1 + 0.06 * (1 - e);
    },
  },

  /* 逐字旋转归位 */
  spin: {
    name: '旋入',
    apply(env, it, p) {
      const seed = it.seed | 0;
      it.charFns.push((i, g, n) => {
        const d = n > 1 ? (i / (n - 1)) * 0.4 : 0;
        const q = Z.clamp((p - d) / 0.6);
        if (q <= 0) return { hide: true };
        const e = E.outExpo(q);
        return { rot: (1 - e) * (Z.rnd(seed, i) > 0.5 ? 1 : -1) * 210, s: Z.lerp(0.15, 1, e), a: Math.min(1, q * 3) };
      });
    },
  },

  /* X 轴翻牌 */
  flipX: {
    name: '翻牌进入',
    apply(env, it, p) {
      const seed = it.seed | 0;
      it.charFns.push((i, g, n) => {
        const d = n > 1 ? (i / (n - 1)) * 0.45 : 0;
        const q = Z.clamp((p - d) / 0.55);
        if (q <= 0) return { hide: true };
        const e = E.outCubic(q);
        return { sx: Math.max(0.02, e), rot: (1 - e) * 0, s: 1 };
      });
    },
  },

  /* 随机点阵闪入（模拟信号不稳） */
  flicker: {
    name: '闪烁点亮',
    apply(env, it, p) {
      const seed = it.seed | 0, step = env.step;
      it.charFns.push(i => (p >= 1 ? null : (Z.rnd(seed, step, i) < p * 1.3 ? null : { hide: true })));
    },
  },

  /* 乱码归位 */
  scramble: {
    name: '乱码归位',
    apply(env, it, p) {
      const seed = it.seed | 0, step = env.step;
      it.charFns.push((i, g, n) => {
        const settle = 0.25 + 0.75 * (n > 1 ? i / (n - 1) : 1);
        if (p >= settle) return null;
        if (p < settle * 0.25 && Z.rnd(seed, i, step, 2) < 0.5) return { hide: true };
        return { ch: SCRAMBLE_POOL[Math.floor(Z.rnd(seed, i, step) * SCRAMBLE_POOL.length)], a: 0.85 };
      });
    },
  },

  /* 霓虹灯管通电：闪几下再稳 */
  neonOn: {
    name: '灯管通电',
    apply(env, it, p) {
      const seed = it.seed | 0, step = env.step;
      const on = p >= 1 ? 1 : (Z.rnd(seed, step) < Math.min(1, p * 1.6) ? (Z.rnd(seed, step, 3) < 0.65 ? 1 : 0.25) : 0.12);
      it.alpha = (it.alpha ?? 1) * on;
      it.treatForce = 'neon';
      if (p < 1) it.blur = (it.blur || 0) + (1 - p) * 5;
    },
  },

  /* 印章盖下：从小砸大 + 重影 */
  stamp: {
    name: '盖章',
    apply(env, it, p) {
      const e = E.outExpo(p);
      it.size *= Z.lerp(2.4, 1, e);
      it.alpha = (it.alpha ?? 1) * Math.min(1, p * 5);
      it.blur = (it.blur || 0) + (1 - e) * 8;
    },
  },

  /* 印章落下（带倾角与抖动） */
  sealDrop: {
    name: '落印',
    apply(env, it, p) {
      const e = E.outBack(p, 1.4);
      const seed = it.seed | 0;
      it.size *= Z.lerp(1.6, 1, e);
      it.alpha = (it.alpha ?? 1) * Math.min(1, p * 4);
      it.rot = (it.rot || 0) + (1 - e) * Z.rsign(seed, 5) * 14 + Z.rsign(seed, env.step, 6) * (1 - e) * 3;
    },
  },

  /* 错版：两个颜色版本偏移再对齐 */
  misprint: {
    name: '错版套印',
    apply(env, it, p) {
      const e = E.outCubic(p);
      it.echo = { n: 2, dx: (1 - e) * it.size * 0.22, dy: (1 - e) * -it.size * 0.1, a: 0.7 * (1 - e * 0.4), decay: 0.55, color: env.sc.accent2 };
      it.alpha = (it.alpha ?? 1) * Math.min(1, 0.4 + p);
      it.blur = (it.blur || 0) + (1 - e) * 3;
    },
  },

  /* 单字浮现 */
  ghostIn: {
    name: '浮现',
    apply(env, it, p) {
      const seed = it.seed | 0;
      it.charFns.push((i, g, n) => {
        const d = n > 1 ? (i / (n - 1)) * 0.5 : 0;
        const q = Z.clamp((p - d) / 0.5);
        if (q <= 0) return { hide: true };
        return { a: E.outQuad(q), blur: (1 - q) * 6, dy: (1 - q) * it.size * 0.12 };
      });
    },
  },

  /* 从右侧推入 + 挤压 */
  stretch: {
    name: '拉伸', 
    apply(env, it, p) {
      const e = E.outExpo(p);
      it.sx = (it.sx || 1) * Z.lerp(4.4, 1, e);
      it.streak = { n: 4, dx: it.size * 0.5 * (1 - e), a: 0.28 * (1 - e) };
    },
  },

  /* 从两侧合拢 */
  splitJoin: {
    name: '合拢',
    apply(env, it, p) {
      const W = env.W;
      it.vbands = Z.itemVBands(env, it, 6, (i, n) => (1 - E.outCubic(p)) * (i < n / 2 ? -1 : 1) * W * 0.5);
    },
  },

  /* 光圈打开 */
  iris: {
    name: '光圈开',
    apply(env, it, p) {
      const e = E.inOutCubic(p);
      const m = it._m || (it._m = Z.measure(it));
      const R = Math.hypot(m.w, m.h) * 0.62 + it.size * 0.2;
      it.clipFn = (ctx) => { ctx.arc(it.x, it.y, Math.max(0.5, R * e), 0, Z.TAU); };
      it.alpha = (it.alpha ?? 1) * Math.min(1, p * 2.5);
    },
  },

  /* 百叶窗 */
  blinds: {
    name: '百叶窗',
    apply(env, it, p) {
      const e = E.outCubic(p);
      const n = 9;
      it.bands = Z.itemBands(env, it, n, () => 0);
      const m = it._m || (it._m = Z.measure(it));
      const h = Math.max(m.h, it.size) * 1.3 + 20, y0 = it.y - h / 2;
      it.clipBands = [];
      for (let i = 0; i < n; i++) {
        const bh = h / n;
        it.clipBands.push([y0 + i * bh, y0 + i * bh + bh * e]);
      }
    },
  },

  /* 从画面外飞入 */
  flyIn: {
    name: '飞入',
    apply(env, it, p) {
      const e = E.outExpo(p), seed = it.seed | 0;
      const dir = Z.rnd(seed, 1) < 0.5 ? -1 : 1;
      it.x += (1 - e) * dir * env.W * 0.6;
      it.blur = (it.blur || 0) + (1 - e) * 16;
      it.alpha = (it.alpha ?? 1) * Math.min(1, p * 4);
    },
  },

  /* 逐字左移滑入 */
  slideL: {
    name: '左滑入',
    apply(env, it, p) {
      const seed = it.seed | 0;
      it.charFns.push((i, g, n) => {
        const d = n > 1 ? (i / (n - 1)) * 0.4 : 0;
        const q = Z.clamp((p - d) / 0.55);
        if (q <= 0) return { hide: true };
        const e = E.outExpo(q);
        return { dx: -(1 - e) * it.size * 2.2, a: Math.min(1, q * 3) };
      });
    },
  },

  /* 多字层叠展开 */
  unfold: {
    name: '展开',
    apply(env, it, p) {
      const e = E.outQuart(p);
      it.sy = (it.sy || 1) * e;
      it.alpha = (it.alpha ?? 1) * Math.min(1, p * 2);
      it.clipY = [it.y - 1e5, it.y + ((it._m || (it._m = Z.measure(it))).h / 2 + it.size * 0.1) * e];
    },
  },

  /* 液态扩散 */
  bleed: {
    name: '墨液扩散',
    apply(env, it, p) {
      const e = E.inOutCubic(p);
      const m = it._m || (it._m = Z.measure(it));
      it.clipFn = (ctx) => {
        const pts = [], n = 14, R = Math.hypot(m.w, m.h) * 0.55 + it.size * 0.3;
        for (let i = 0; i < n; i++) {
          const a = i / n * Z.TAU;
          const rr = R * e * (0.72 + 0.5 * Z.rnd(it.seed | 0, i, 3));
          pts.push([it.x + Math.cos(a) * rr, it.y + Math.sin(a) * rr]);
        }
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i <= n; i++) {
          const p0 = pts[i % n], p1 = pts[(i + 1) % n];
          ctx.quadraticCurveTo(p0[0], p0[1], (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);
        }
      };
      it.alpha = (it.alpha ?? 1) * Math.min(1, p * 2.2);
    },
  },

  /* 从很远处拉近 */
  zoomOut: {
    name: '拉近',
    apply(env, it, p) {
      const e = E.outExpo(p);
      it.size *= Z.lerp(3.2, 1, e);
      it.blur = (it.blur || 0) + (1 - e) * 12;
      it.alpha = (it.alpha ?? 1) * Math.min(1, p * 5);
    },
  },

  /* 推近（起始小） */
  zoom: {
    name: '放大进入',
    apply(env, it, p) {
      const e = E.outExpo(p);
      it.size *= Z.lerp(0.35, 1, e);
      it.blur = (it.blur || 0) + (1 - e) * 10;
      it.alpha = (it.alpha ?? 1) * Math.min(1, p * 3);
    },
  },

  /* 阶梯落字 */
  cascade: {
    name: '阶梯落字',
    apply(env, it, p) {
      const size = it.size, seed = it.seed | 0;
      it.charFns.push((i, g, n) => {
        const q = Z.clamp((p - i * 0.11) / 0.45);
        if (q <= 0) return { hide: true };
        const e = E.outQuint(q);
        return { dy: (1 - e) * size * 2.2, a: Math.min(1, q * 4), rot: (1 - e) * Z.rsign(seed, i) * 12 };
      });
    },
  },

  /* 光扫过 */
  lightSweep: {
    name: '光扫',
    apply(env, it, p) {
      const m = it._m || (it._m = Z.measure(it));
      const e = E.inOutSine(p);
      const x = Z.lerp(it.x - m.w / 2 - it.size, it.x + m.w / 2 + it.size, e);
      it.clip = [-1e5, x];
      it.alpha = (it.alpha ?? 1) * Math.min(1, p * 3);
      it.edgeGlow = { x: x - it.size * 0.28, y: it.y, w: it.size * 0.56, h: m.h + it.size * 0.5, soft: 1 };
    },
  },

  /* 缓慢飘入 */
  drift: {
    name: '飘入',
    apply(env, it, p) {
      const e = E.outExpo(p), seed = it.seed | 0;
      it.x += (1 - e) * Z.rsign(seed, 2) * env.W * 0.22;
      it.y += (1 - e) * Z.rsign(seed, 3) * env.H * 0.16;
      it.alpha = (it.alpha ?? 1) * Math.min(1, p * 2.2);
      it.blur = (it.blur || 0) + (1 - e) * 9;
    },
  },

  /* 栅格逐格亮起 */
  mosaic: {
    name: '栅格亮起',
    apply(env, it, p) {
      const m = it._m || (it._m = Z.measure(it));
      const seed = it.seed | 0, step = env.step;
      const cols = 6, rows = 4;
      it.charFns.push((i, g) => {
        if (p >= 1) return null;
        const cx = Z.clamp((g.x + m.w / 2) / Math.max(1, m.w));
        const cy = Z.clamp((g.y + m.h / 2) / Math.max(1, m.h));
        const cell = Math.floor(cy * rows) * cols + Math.floor(cx * cols);
        const th = Z.rnd(seed, cell, 11) * 0.7;
        return p > th ? (Z.rnd(seed, cell, step, 12) < 0.9 ? null : { hide: true }) : { hide: true };
      });
    },
  },

  /* 抽帧抖动式出现 */
  stutter: {
    name: '抽帧抖入',
    apply(env, it, p) {
      const seed = it.seed | 0, step = env.step;
      const q = Z.clamp(p * 1.5);
      if (q < 1) {
        it.bands = Z.itemBands(env, it, 5, i => Z.rsign(seed, step, i) * it.size * (1 - q) * 0.9);
      }
      it.alpha = (it.alpha ?? 1) * (q < 1 ? 0.55 + 0.45 * Z.rnd(seed, step, 9) : 1);
    },
  },

  /* 上下撕裂进入 */
  tear: {
    name: '撕裂进入',
    apply(env, it, p) {
      const e = E.outCubic(p), W = env.W;
      it.vbands = Z.itemVBands(env, it, 3, (i) => 0);
      it.bands = Z.itemBands(env, it, 9, i => (1 - e) * Z.rnd(it.seed | 0, i, 7) * W * 0.35);
      it.alpha = (it.alpha ?? 1) * Math.min(1, p * 2.5);
    },
  },
}, 'core');
E.outQuint = x => { x = Z.clamp(x); return 1 - Math.pow(1 - x, 5); };

/* ============================================================
   保持（停在画面上时的小动作）
   ============================================================ */
Z.registerAll('hold', {
  still: { name: '静止', apply() {} },

  /* 逐字随机抖动 */
  jitter: {
    name: '抖动',
    apply(env, it, amt) {
      const seed = it.seed | 0, step = env.step, a = it.size * 0.025 * amt * env.fx.motion;
      if (a < 0.2) return;
      it.charFns.push(i => ({ dx: Z.rsign(seed, step, i, 1) * a, dy: Z.rsign(seed, step, i, 2) * a, rot: Z.rsign(seed, step, i, 3) * 4 * amt }));
    },
  },

  /* 缓慢横向漂移 + 微放大 */
  drift: {
    name: '漂移',
    apply(env, it, amt, ctx) {
      const u = env.lt / Math.max(0.3, ctx.dur);
      const dir = (it.seed | 0) % 2 ? 1 : -1;
      it.x += dir * (u - 0.5) * env.W * 0.04 * env.fx.motion * amt;
      it.size *= 1 + 0.05 * u * env.fx.motion * amt;
    },
  },

  /* 呼吸 */
  breathe: {
    name: '呼吸',
    apply(env, it, amt) {
      it.size *= 1 + 0.035 * Math.sin(env.lt * Z.TAU * 0.9) * amt;
      it.track = (it.track || 0) + 0.03 * Math.sin(env.lt * Z.TAU * 0.6) * amt;
    },
  },

  /* 波浪起伏 */
  wave: {
    name: '波浪',
    apply(env, it, amt) {
      const size = it.size, t = env.lt;
      it.charFns.push(i => ({ dy: Math.sin(t * 7 + i * 0.75) * size * 0.07 * amt, rot: Math.cos(t * 7 + i * 0.75) * 5 * amt }));
    },
  },

  /* 缓慢旋转 */
  swivel: {
    name: '缓转',
    apply(env, it, amt) {
      it.rot = (it.rot || 0) + Math.sin(env.lt * 0.5) * 1.8 * amt;
      it.y += Math.cos(env.lt * 0.7) * it.size * 0.03 * amt;
    },
  },

  /* 故障跳变 */
  glitchtick: {
    name: '故障跳',
    apply(env, it, amt) {
      const seed = it.seed | 0, step = env.step;
      if (Z.rnd(seed, step, 77) < 0.22 * env.fx.glitch * amt + 0.02) {
        it.bands = Z.itemBands(env, it, 6, i => (Z.rnd(seed, step, i, 5) < 0.6 ? Z.rsign(seed, step, i, 6) * it.size * 0.35 : 0));
      }
    },
  },

  /* 逐字亮度扫过 */
  shimmer: {
    name: '流光',
    apply(env, it, amt) {
      const t = env.lt, n = (it._m || (it._m = Z.measure(it))).lay.N;
      it.charFns.push(i => {
        const k = ((t * 0.8 - i / Math.max(1, n)) % 1 + 1) % 1;
        return { a: 0.62 + 0.38 * (1 - Math.abs(k - 0.5) * 2) * amt };
      });
    },
  },

  /* 心跳：整体脉动 */
  pulse: {
    name: '脉动',
    apply(env, it, amt, ctx) {
      const beat = env.beat ? Math.max(0, 1 - env.beat.since / env.beat.len) : 0;
      const k = amt * (0.5 + 0.5 * beat);
      it.size *= 1 + 0.045 * k;
    },
  },

  /* 拍点跳一下 */
  beatHop: {
    name: '踩拍',
    apply(env, it, amt) {
      if (!env.beat) return;
      const k = Math.max(0, 1 - env.beat.since / Math.min(0.22, env.beat.len));
      it.y -= k * it.size * 0.13 * amt;
      it.size *= 1 + k * 0.03 * amt;
    },
  },

  /* 果冻弹性 */
  jelly: {
    name: '果冻',
    apply(env, it, amt) {
      const t = env.lt * 6;
      it.sx = (it.sx || 1) * (1 + Math.sin(t) * 0.035 * amt);
      it.sy = (it.sy || 1) * (1 - Math.sin(t) * 0.035 * amt);
    },
  },

  /* 逐字放大（后字更大） */
  scaleRun: {
    name: '递进放大',
    apply(env, it, amt) {
      const n = (it._m || (it._m = Z.measure(it))).lay.N;
      it.charFns.push((i, g, nn) => ({ s: 1 + (nn > 1 ? i / (nn - 1) : 0) * 0.08 * amt }));
    },
  },

  /* 缓慢上下浮动（多字错相） */
  float: {
    name: '浮动',
    apply(env, it, amt) {
      const seed = it.seed | 0;
      it.charFns.push((i) => ({ dy: Math.sin(env.lt * 1.4 + i * 0.5 + (seed % 10)) * it.size * 0.08 * amt, rot: Math.sin(env.lt * 1.1 + i * 0.7) * 3 * amt }));
    },
  },

  /* 文字后面的光斑移动（靠改 blur 与 alpha 实现呼吸感） */
  breatheHi: {
    name: '明暗呼吸',
    apply(env, it, amt) {
      it.alpha = (it.alpha ?? 1) * (1 - 0.22 * (0.5 + 0.5 * Math.sin(env.lt * 2.2)) * amt);
      it.blur = (it.blur || 0) + (0.5 + 0.5 * Math.sin(env.lt * 2.2)) * it.size * 0.012 * amt;
    },
  },

  /* 逐字摇摆 */
  sway: {
    name: '摇摆',
    apply(env, it, amt) {
      it.charFns.push((i, g, n) => {
        const ph = (n > 1 ? i / (n - 1) : 0) * 2.4;
        return { rot: Math.sin(env.lt * 2 + ph) * 7 * amt };
      });
    },
  },
}, 'core');

/* ============================================================
   退场
   ============================================================ */
Z.registerAll('exit', {
  cut: { name: '硬切', apply() {} },

  /* 碎块炸开 */
  explode: {
    name: '爆散', pieces: true, shatter: true,
    apply(env, it, p, ctx) {
      const seed = it.seed | 0, dur = ctx.outDur, lt = env.lt - (ctx.dur - ctx.outDur);
      const spread = Math.max(env.W, env.H) * 0.9 * (0.5 + env.fx.motion * 0.6);
      it.shatter = true;
      it.pieceFns.push((ci, pj, pc, ox, oy) => {
        const d = Z.rnd(seed, ci, pj, 11) * dur * 0.3;
        const x = (lt - d) / Math.max(0.05, dur * 0.7);
        if (x <= 0) return Z.REST;
        if (x >= 1) return null;
        const e = E.inCubic(x);
        const ang = Math.atan2(oy + 0.01, ox + 0.01) + Z.rsign(seed, ci, pj, 12) * 1.1;
        const dist = spread * (0.35 + 0.65 * Z.rnd(seed, ci, pj, 13));
        const sp = (e - E.inCubic(x - 1 / (env.fps * dur * 0.7))) * dist;
        return Z.PIECE(Math.cos(ang) * dist * e, Math.sin(ang) * dist * e, Z.rsign(seed, ci, pj, 14) * 280 * e,
          1 + Z.rsign(seed, ci, pj, 15) * 0.6 * e, 1 + Math.min(2.4, sp * 0.012), ang / Z.DEG, 1 - x * x * x);
      });
    },
  },

  /* 碎块塌落 */
  fall: {
    name: '崩落', pieces: true, shatter: true,
    apply(env, it, p, ctx) {
      const seed = it.seed | 0, lt = env.lt - (ctx.dur - ctx.outDur), g = env.H * 5.5;
      it.shatter = true;
      it.pieceFns.push((ci, pj) => {
        const x = lt - Z.rnd(seed, ci, pj, 21) * ctx.outDur * 0.4;
        if (x <= 0) return Z.REST;
        const v = g * x;
        return Z.PIECE(Z.rsign(seed, ci, pj, 22) * env.W * 0.03 * x, 0.5 * g * x * x, Z.rsign(seed, ci, pj, 23) * 200 * x, 1, 1 + Math.min(2.2, v * 0.0012), 90, 1);
      });
    },
  },

  /* 碎块升空飘散 */
  rise: {
    name: '升空', pieces: true, shatter: true,
    apply(env, it, p, ctx) {
      const seed = it.seed | 0, dur = ctx.outDur, lt = env.lt - (ctx.dur - ctx.outDur);
      it.shatter = true;
      it.pieceFns.push((ci, pj) => {
        const x = (lt - Z.rnd(seed, ci, pj, 25) * dur * 0.35) / Math.max(0.05, dur * 0.65);
        if (x <= 0) return Z.REST;
        if (x >= 1) return null;
        const e = E.inQuad(x);
        return Z.PIECE(Z.rsign(seed, ci, pj, 26) * env.W * 0.05 * e, -env.H * 0.75 * e, Z.rsign(seed, ci, pj, 27) * 160 * e, 1 - 0.4 * e, 1 + e * 0.5, 90, 1 - e * e);
      });
    },
  },

  /* 雾散 */
  drift: {
    name: '雾散', pieces: true, shatter: true,
    apply(env, it, p, ctx) {
      const seed = it.seed | 0, dur = ctx.outDur, lt = env.lt - (ctx.dur - ctx.outDur), dist0 = it.size * 1.6;
      it.shatter = true;
      it.pieceFns.push((ci, pj) => {
        const x = (lt - Z.rnd(seed, ci, pj, 31) * dur * 0.3) / Math.max(0.05, dur * 0.7);
        if (x <= 0) return Z.REST;
        if (x >= 1) return null;
        const e = E.inQuad(x), ang = Z.rnd(seed, ci, pj, 32) * Z.TAU, dd = dist0 * (0.3 + 0.7 * Z.rnd(seed, ci, pj, 33));
        return Z.PIECE(Math.cos(ang) * dd * e, Math.sin(ang) * dd * e - it.size * 0.3 * e, Z.rsign(seed, ci, pj, 34) * 80 * e, 1 - 0.35 * e, 1 + e * 0.8, ang / Z.DEG, 1 - e * e);
      });
    },
  },

  /* 横向切片飞出 */
  slice: {
    name: '切片飞出',
    apply(env, it, p) {
      const e = E.inExpo(p);
      it.bands = Z.itemBands(env, it, 7, i => e * (i % 2 ? -1 : 1) * env.W * 1.1 * (0.6 + 0.4 * Z.rnd(it.seed | 0, i, 41)));
    },
  },

  /* 擦除 */
  wipe: {
    name: '擦除', bar: true,
    apply(env, it, p) {
      const e = E.inOutExpo(p);
      const m = it._m || (it._m = Z.measure(it));
      const x0 = it.x - m.w / 2 - it.size * 0.2, x1 = it.x + m.w / 2 + it.size * 0.2;
      const edge = Z.lerp(x0, x1, e);
      it.clip = [edge, x1 + 4000];
      it.wipeBar = p > 0 && p < 1 ? { x: edge, h: m.h * 1.3 + it.size * 0.2 } : null;
    },
  },

  /* 向一侧滑出 */
  slideOut: {
    name: '滑出',
    apply(env, it, p) {
      const e = E.inCubic(p), dir = (it.seed | 0) % 2 ? 1 : -1;
      it.x += e * dir * env.W * 0.75;
      it.blur = (it.blur || 0) + e * 14;
      it.alpha = (it.alpha ?? 1) * (1 - Z.smoothstep(0.6, 1, p));
    },
  },

  /* 收缩 */
  shrink: {
    name: '收缩',
    apply(env, it, p) {
      const e = E.inCubic(p);
      it.size *= 1 - e * 0.96;
      it.alpha = (it.alpha ?? 1) * (1 - e * e);
      it.track = (it.track || 0) - e * 0.2;
    },
  },

  /* 模糊淡出 */
  blur: {
    name: '虚化淡出',
    apply(env, it, p) {
      const e = E.inQuad(p);
      it.blur = (it.blur || 0) + e * 30;
      it.alpha = (it.alpha ?? 1) * (1 - e);
      it.size *= 1 + e * 0.2;
    },
  },

  /* 淡出 */
  fade: {
    name: '淡出',
    apply(env, it, p) {
      it.alpha = (it.alpha ?? 1) * (1 - E.inQuad(p));
    },
  },

  /* 融化（向下拉伸模糊） */
  melt: {
    name: '融化',
    apply(env, it, p) {
      const e = E.inQuad(p);
      it.sy = (it.sy || 1) * (1 + e * 1.6);
      it.sx = (it.sx || 1) * (1 - e * 0.3);
      it.blur = (it.blur || 0) + e * 22;
      it.alpha = (it.alpha ?? 1) * (1 - e * 0.9);
      it.y += e * it.size * 0.5;
    },
  },

  /* 逐字飞散 */
  scatter: {
    name: '飞散',
    apply(env, it, p) {
      const seed = it.seed | 0, W = env.W;
      it.charFns.push((i, g, n) => {
        const d = Z.rnd(seed, i, 51) * 0.35;
        const q = Z.clamp((p - d) / 0.65);
        if (q <= 0) return null;
        const e = E.inCubic(q), ang = Z.rnd(seed, i, 52) * Z.TAU;
        return { dx: Math.cos(ang) * W * 0.7 * e, dy: Math.sin(ang) * W * 0.45 * e, rot: Z.rsign(seed, i, 53) * 560 * e, s: 1 + e * 0.8, a: 1 - q * q };
      });
    },
  },

  /* 逐字崩落 */
  dropOut: {
    name: '逐字坠落',
    apply(env, it, p) {
      const seed = it.seed | 0, H = env.H;
      it.charFns.push((i) => {
        const d = Z.rnd(seed, i, 55) * 0.4;
        const q = Z.clamp((p - d) / 0.6);
        if (q <= 0) return null;
        const e = E.inQuad(q);
        return { dy: e * H * 0.55, rot: Z.rsign(seed, i, 56) * 180 * e, a: 1 - e * e };
      });
    },
  },

  /* 逐字弹走 */
  bounceOut: {
    name: '弹走',
    apply(env, it, p) {
      const seed = it.seed | 0;
      it.charFns.push((i) => {
        const d = Z.rnd(seed, i, 57) * 0.4;
        const q = Z.clamp((p - d) / 0.55);
        if (q <= 0) return null;
        const e = E.inCubic(q);
        const dir = Z.rnd(seed, i, 58) < 0.5 ? -1 : 1;
        return { dx: dir * env.W * 0.4 * e, dy: -Math.sin(q * Math.PI) * it.size * 0.8, rot: dir * 90 * e, a: 1 - q };
      });
    },
  },

  /* 故障撕裂 */
  glitch: {
    name: '故障撕裂',
    apply(env, it, p) {
      const seed = it.seed | 0, step = env.step;
      const amp = it.size * (0.3 + p * 2.2);
      it.bands = Z.itemBands(env, it, 9, i => (Z.rnd(seed, step, i, 61) < 0.75 ? Z.rsign(seed, step, i, 62) * amp : 0));
      if (p > 0.55) it.alpha = (it.alpha ?? 1) * (Z.rnd(seed, step, 63) < 0.5 ? 0.15 : 1) * (1 - Z.smoothstep(0.8, 1, p));
    },
  },

  /* 反相溶解 */
  dissolve: {
    name: '溶解',
    apply(env, it, p) {
      const seed = it.seed | 0, step = env.step;
      it.charFns.push((i) => (Z.rnd(seed, i, step, 64) < p ? { hide: true } : { a: 1 }));
    },
  },

  /* 逐字退格 */
  backspace: {
    name: '退格删除',
    apply(env, it, p) {
      const n = (it._m || (it._m = Z.measure(it))).lay.N;
      const k = Math.floor(p * n);
      it.charFns.push(i => (i < k ? { hide: true } : null));
      if (p > 0 && p < 1) it.cursorAt = k - 1;
    },
  },

  /* 数字滚动式消失（每字被替换成随机的字再消失） */
  scrambleOut: {
    name: '乱码消散',
    apply(env, it, p) {
      const seed = it.seed | 0, step = env.step;
      it.charFns.push((i, g, n) => {
        const th = n > 1 ? i / (n - 1) : 0;
        if (p < th * 0.8) return null;
        if (Z.rnd(seed, i, step, 65) < 0.7) return { ch: SCRAMBLE_POOL[Math.floor(Z.rnd(seed, i, step, 66) * SCRAMBLE_POOL.length)], a: 1 - p };
        return { hide: true };
      });
    },
  },

  /* 吸入 */
  suck: {
    name: '吸入',
    apply(env, it, p) {
      const e = E.inQuart(p), seed = it.seed | 0;
      const dir = Z.rnd(seed, 1) < 0.5 ? -1 : 1;
      it.x += e * dir * env.W * 0.5;
      it.size *= 1 - e * 0.9;
      it.alpha = (it.alpha ?? 1) * (1 - e);
      it.blur = (it.blur || 0) + e * 12;
    },
  },

  /* 向内收缩到一条线 */
  collapse: {
    name: '收成一线',
    apply(env, it, p) {
      const e = E.inOutCubic(p);
      it.sy = (it.sy || 1) * Math.max(0.01, 1 - e);
      it.alpha = (it.alpha ?? 1) * (1 - Z.smoothstep(0.85, 1, p));
      it.blur = (it.blur || 0) + e * 6;
    },
  },

  /* 墨点晕开消失 */
  ink: {
    name: '墨散',
    apply(env, it, p) {
      const e = E.inCubic(p), seed = it.seed | 0;
      it.blur = (it.blur || 0) + e * 30;
      it.alpha = (it.alpha ?? 1) * (1 - e);
      it.charFns.push((i, g) => {
        const d = Z.rnd(seed, i, 71) * 0.5;
        const q = Z.clamp((p - d) / 0.5);
        return q > 0 ? { dy: q * it.size * 0.3, dy2: 0, sx: 1 + q * 0.5, sy: 1 - q * 0.4, a: 1 - q } : null;
      });
    },
  },

  /* 撕纸 */
  scrap: {
    name: '撕纸',
    apply(env, it, p) {
      const seed = it.seed | 0;
      it.vbands = Z.itemVBands(env, it, 6, (i) => {
        const d = Z.rnd(seed, i, 81) * 0.4;
        const q = Z.clamp((p - d) / 0.6);
        return -(q * q) * env.H * 0.5;
      });
      /* 第 4 位是每条自己的旋转角 */
      for (let i = 0; i < it.vbands.length; i++) {
        const d = Z.rnd(seed, i, 81) * 0.4;
        it.vbands[i][3] = Z.rsign(seed, i, 83) * 40 * Z.clamp((p - d) / 0.6);
      }
      it.alpha = (it.alpha ?? 1) * (1 - Z.smoothstep(0.7, 1, p));
    },
  },

  /* 燃烧 */
  burn: {
    name: '烧掉',
    apply(env, it, p) {
      const e = E.inQuad(p);
      const m = it._m || (it._m = Z.measure(it));
      const edge = it.y + m.h / 2 - e * (m.h + it.size * 0.6);
      it.bands = Z.itemBands(env, it, 10, i => (Z.rnd(it.seed | 0, i, 91) < 0.5 ? Z.rsign(it.seed | 0, i, 92) * it.size * 0.4 : 0));
      it.clipY = [-1e5, edge];
      it.alpha = (it.alpha ?? 1) * (1 - Z.smoothstep(0.9, 1, p));
      it.edgeGlow = e < 1 ? { x: it.x, y: edge, w: m.w + it.size * 0.8, h: it.size * 0.7, soft: 1, dir: 1 } : null;
    },
  },

  /* TV 关机：横向收成一条线再灭 */
  tvOff: {
    name: '关机',
    apply(env, it, p) {
      if (p < 0.62) {
        const e = E.inQuad(p / 0.62);
        it.sy = (it.sy || 1) * Math.max(0.006, 1 - e);
        it.sx = (it.sx || 1) * (1 + e * 0.1);
      } else {
        const e = (p - 0.62) / 0.38;
        it.sx = (it.sx || 1) * Math.max(0.001, 1 - E.inQuad(e));
        it.sy = (it.sy || 1) * 0.006;
      }
      it.alpha = (it.alpha ?? 1) * (1 - Z.smoothstep(0.9, 1, p));
    },
  },

  /* 一行行被抹掉 */
  eraser: {
    name: '板擦抹除',
    apply(env, it, p) {
      const m = it._m || (it._m = Z.measure(it));
      const e = E.lin(p);
      const edge = it.y - m.h / 2 + e * (m.h + it.size * 0.4);
      it.clipY = [edge, 1e5];
      it.edgeGlow = e < 1 ? { x: it.x, y: edge, w: m.w + it.size * 0.6, h: it.size * 0.45, soft: 0.7, dir: 1 } : null;
    },
  },

  /* 逐字沉入水底 */
  sink: {
    name: '下沉',
    apply(env, it, p) {
      const seed = it.seed | 0;
      it.charFns.push((i) => {
        const d = Z.rnd(seed, i, 95) * 0.45;
        const q = Z.clamp((p - d) / 0.6);
        if (q <= 0) return null;
        const e = E.inOutSine(q);
        return { dy: e * env.H * 0.4, dy2: 0, s: 1 - e * 0.3, a: 1 - e, blur: e * 10 };
      });
    },
  },

  /* 翻页 */
  flap: {
    name: '翻页',
    apply(env, it, p) {
      const e = E.inOutCubic(p);
      it.sx = (it.sx || 1) * Math.max(0.01, Math.cos(e * Math.PI * 0.5));
      it.skew = (it.skew || 0) + e * 18;
      it.alpha = (it.alpha ?? 1) * (1 - Z.smoothstep(0.8, 1, p));
    },
  },

  /* 玻璃碎裂式分离 */
  shatter: {
    name: '碎裂分离', pieces: true,
    apply(env, it, p, ctx) {
      const seed = it.seed | 0, dur = ctx.outDur, lt = env.lt - (ctx.dur - ctx.outDur);
      it.shatter = true;
      it.pieceFns.push((ci, pj, pc, ox, oy) => {
        const x = (lt - Z.rnd(seed, ci, pj, 101) * dur * 0.2) / Math.max(0.05, dur * 0.8);
        if (x <= 0) return Z.REST;
        if (x >= 1) return null;
        const e = E.inQuart(x);
        const ang = Math.atan2(oy - it.y + 0.01, ox - it.x + 0.01) + Z.rsign(seed, ci, pj, 102) * 0.5;
        return Z.PIECE(Math.cos(ang) * it.size * 3 * e, Math.sin(ang) * it.size * 3 * e, Z.rsign(seed, ci, pj, 103) * 200 * e, 1, 1, ang / Z.DEG, 1 - e);
      });
    },
  },
}, 'core');
})();
