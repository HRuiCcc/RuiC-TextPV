/* ============================================================
   RuiC-TextPV — 动效设计层（重新设计）
   基础运动库解决"能不能动"，这一层解决"动得像什么"。
   四条主线：
     光学显影  —— 感光、聚焦、逆显影、曝晒
     物理重量  —— 落定、弹网、坠落、磁吸、表面张力
     声学响应  —— 激振、踩拍、声压、心跳、涟漪
     材质分解  —— 凝结、微粒化、吹散、灼烧、蒸发、溶入
   带 new:true 的零件在 UI 里标「新」，是这一层的设计成果。
   ============================================================ */
(() => {
'use strict';
const E = Z.E;

/* ============================================================
   光学显影
   ============================================================ */
Z.registerAll('enter', {
  /* 感光显影：像相纸在药水里浮出来，先见轮廓后见实心 */
  develop: {
    name: '感光显影', new: true, w: 1.3, tags: ['calm', 'emotional', 'editorial'],
    apply(env, it, p) {
      const seed = it.seed | 0;
      const e = E.outQuad(p);
      it.alpha = (it.alpha ?? 1) * Math.min(1, e * 1.25);
      it.blur = (it.blur || 0) + (1 - e) * 7;
      it.size *= 1 + 0.07 * (1 - e);
      /* 逐字错峰：先中心后两侧，像影像从中间往外显出来 */
      it.charFns.push((i, g, n) => {
        const mid = Math.abs(i - (n - 1) / 2) / Math.max(1, (n - 1) / 2);
        const d = mid * 0.42 + Z.rnd(seed, i, 1) * 0.12;
        const q = Z.clamp((p - d) / 0.55);
        if (q <= 0) return { hide: true };
        const k = E.outQuad(q);
        return { a: 0.25 + 0.75 * k, blur: (1 - k) * 6, s: 1 + (1 - k) * 0.06 };
      });
    },
  },

  /* 扫描显影：一条扫描线自上而下刷过，刷到的地方才成像 */
  scanDevelop: {
    name: '扫描显影', new: true, w: 1.2, tags: ['glitch', 'graphic'],
    apply(env, it, p) {
      const m = it._m || (it._m = Z.measure(it));
      const box = Z.itemBox(it);
      const y0 = box.y0 - it.size * 0.5, y1 = box.y1 + it.size * 0.5;
      const e = E.outCubic(p);
      const line = Z.lerp(y0, y1, e);
      it.clipBands = [[-1e5, line]];
      it.alpha = (it.alpha ?? 1) * Math.min(1, p * 2.5);
      it.edgeGlow = p < 1 ? { x: it.x, y: line, w: box.w + it.size * 0.9, h: it.size * 0.34, soft: 1 } : null;
      /* 线附近的字更亮，形成"刷过"的观感 */
      if (p < 1) {
        it.charFns.push((i, g) => {
          const gy = it.y + g.y * (it.sy || 1);
          const d = Math.abs(gy - line) / (it.size * 1.4);
          return d < 1 ? { color: env.sc.accent, a: 1 } : null;
        });
      }
    },
  },

  /* 聚焦：两个错开的虚影向内收敛，最后合焦 */
  defocus: {
    name: '合焦', new: true, w: 1.1, tags: ['calm', 'emotional'],
    apply(env, it, p) {
      const e = E.outQuart(p);
      it.alpha = (it.alpha ?? 1) * Math.min(1, p * 2);
      it.blur = (it.blur || 0) + (1 - e) * 9;
      const k = 1 - e;
      it.charFns.push(() => ({ dx: Z.rnd(it.seed | 0, 3) < 0.5 ? -it.size * 0.12 * k : it.size * 0.12 * k }));
    },
  },

  /* 影先至：影子先落在画面上，字随后才跟上 */
  shadowFirst: {
    name: '影先至', new: true, w: 1, tags: ['emotional', 'editorial'],
    apply(env, it, p) {
      const e = E.outCubic(Z.clamp(p / 0.6));
      const lag = Z.clamp((p - 0.45) / 0.55);
      /* 一个纯黑的重影，从下方偏移处先滑到位 */
      it.pre = (env2, it2) => {
        const k = 1 - e;
        Z.drawText(env2, Object.assign({}, it2, {
          x: it2.x, y: it2.y + it2.size * 0.28 * k, color: 'rgba(0,0,0,0.62)',
          alpha: (it2.alpha ?? 1) * e * 0.9, charFn: null, pieceFn: null, pre: null, post: null,
          shadow: null, extrude: null, stain: null, _lay: null, _m: null,
        }));
      };
      it.alpha = (it.alpha ?? 1) * E.outQuad(lag);
      it.size *= 1 + 0.05 * (1 - lag);
    },
  },

  /* 倒带：横向抽送的磁带感，来回拉两次才定住 */
  rewind: {
    name: '倒带', new: true, w: 0.95, tags: ['glitch', 'graphic'],
    apply(env, it, p) {
      const seed = it.seed | 0, step = env.step;
      const e = E.outExpo(Z.clamp(p / 0.7));
      if (p < 0.7) {
        const damp = (1 - p / 0.7);
        it.x += Z.rsign(seed, step, 2) * env.W * 0.06 * damp;
        it.bands = Z.itemBands(env, it, 5, i => Z.rsign(seed, step, i, 3) * it.size * 0.5 * damp);
      }
      it.alpha = (it.alpha ?? 1) * (p < 0.7 ? 0.35 + 0.65 * Math.abs(Math.sin(p * 22)) : 1);
      it.size *= 1 + 0.04 * (1 - e);
    },
  },

  /* 灼烧显字：一条发热的边缘推进，走过的地方烙出字来 */
  burnIn: {
    name: '灼烧显字', new: true, w: 1.05, tags: ['glitch', 'emotional'],
    apply(env, it, p) {
      const box = Z.itemBox(it);
      const e = E.inOutCubic(p);
      const y = Z.lerp(box.y1 + it.size * 0.4, box.y0 - it.size * 0.2, e);
      it.clipY = [y, 1e5];
      it.alpha = (it.alpha ?? 1) * Math.min(1, p * 3);
      it.edgeGlow = p < 0.98 ? { x: it.x, y, w: box.w + it.size * 1.1, h: it.size * 0.5, soft: 1 } : null;
      it.charFns.push((i, g) => {
        const gy = it.y + g.y * (it.sy || 1);
        const d = (gy - y) / (it.size * 1.1);
        return d > -1 && d < 0.55 ? { color: env.sc.accent, a: Math.max(0.2, 1 - Math.abs(d)) } : null;
      });
    },
  },

  /* 霓虹渐亮：灯丝预热，先抖两下再稳住 */
  glowUp: {
    name: '霓虹渐亮', new: true, w: 1.15, tags: ['glitch', 'pop'],
    apply(env, it, p) {
      const seed = it.seed | 0, step = env.step;
      const e = E.outCubic(p);
      const flick = p >= 1 ? 1 : (Z.rnd(seed, step, 8) < 0.18 ? 0.32 : 0.68 + 0.32 * e);
      it.alpha = (it.alpha ?? 1) * flick * Math.min(1, p * 3);
      it.shadow = { color: Z.rgba(env.sc.accent, 0.9), blur: it.size * (0.5 - e * 0.24), dx: 0, dy: 0 };
      it.size *= 1 + 0.03 * (1 - e);
    },
  },

  /* 曝光过度：先是一片惨白，然后影像从白里浮出来 */
  overexposeIn: {
    name: '曝光过度', new: true, w: 0.9, tags: ['editorial', 'glitch'],
    apply(env, it, p) {
      const e = E.outQuart(p);
      it.alpha = (it.alpha ?? 1) * Math.min(1, e * 1.6);
      it.blur = (it.blur || 0) + (1 - e) * 20;
      it.shadow = { color: 'rgba(255,255,255,0.95)', blur: it.size * (0.9 - e * 0.6), dx: 0, dy: 0 };
    },
  },

  /* 光斑扫过：一束光横过，字像被光照出来 */
  lightReveal: {
    name: '光扫显影', new: true, w: 1.1, tags: ['calm', 'graphic'],
    apply(env, it, p) {
      const box = Z.itemBox(it);
      const e = E.inOutSine(p);
      const x = Z.lerp(box.x0 - it.size * 0.6, box.x1 + it.size * 0.6, e);
      it.clip = [x - (box.w + it.size * 2) * e, x + (box.w + it.size * 2) * 0.02];
      it.alpha = (it.alpha ?? 1) * Math.min(1, p * 4);
      it.edgeGlow = { x, y: it.y, w: it.size * 0.5, h: box.h + it.size * 0.6, soft: 0.85 };
    },
  },
}, 'design');

/* ============================================================
   物理重量
   ============================================================ */
Z.registerAll('enter', {
  /* 落定：带重量的落下，触地压扁再弹回，一次到位 */
  settle: {
    name: '落定', new: true, w: 1.25, tags: ['graphic', 'pop', 'editorial'],
    apply(env, it, p) {
      const seed = it.seed | 0;
      it.charFns.push((i, g, n) => {
        const d = Z.rnd(seed, i, 4) * 0.34;
        const q = Z.clamp((p - d) / 0.55);
        if (q <= 0) return { hide: true };
        const b = E.outBounce(q);
        const land = Z.clamp((q - 0.7) / 0.3);          // 落地之后的压扁瞬间
        const squash = Math.sin(land * Math.PI);
        return { dy: -(1 - b) * it.size * 2.1, sy: 1 + (1 - q) * 0.28 - squash * 0.3, sx: 1 - (1 - q) * 0.1 + squash * 0.24, a: Math.min(1, q * 5) };
      });
    },
  },

  /* 弹网：整块文字像落在弹网上，纵向做阻尼振荡 */
  trampoline: {
    name: '弹网', new: true, w: 1, tags: ['pop'],
    apply(env, it, p) {
      const e = E.outQuad(p);
      const k = (1 - e);
      const osc = Math.sin(p * Math.PI * 5.5) * Math.exp(-p * 4.5);
      it.sy = (it.sy || 1) * (1 - k * 0.5 + osc * 0.16);
      it.sx = (it.sx || 1) * (1 + k * 0.22 - osc * 0.1);
      it.alpha = (it.alpha ?? 1) * Math.min(1, p * 4);
    },
  },

  /* 磁吸：从四面八方被吸过来，接近时反而减速卡住 */
  magnet: {
    name: '磁吸', new: true, w: 1.15, tags: ['graphic', 'pop'],
    apply(env, it, p) {
      const seed = it.seed | 0;
      it.charFns.push((i, g, n) => {
        const ang = Z.rnd(seed, i, 1) * Z.TAU;
        const dist = it.size * (2.2 + Z.rnd(seed, i, 2) * 2.4);
        const d = Z.rnd(seed, i, 3) * 0.22;
        const q = Z.clamp((p - d) / 0.62);
        if (q <= 0) return { hide: true };
        const k = 1 - E.outBack(q, 1.25);            // 先冲过头再吸回来
        return { dx: Math.cos(ang) * dist * k, dy: Math.sin(ang) * dist * k, rot: k * 40, s: 1 + k * 0.35, a: Math.min(1, q * 4) };
      });
    },
  },

  /* 表面张力：像一滴墨落在纸上，先摊开再收回成形 */
  surfaceTension: {
    name: '表面张力', new: true, w: 1, tags: ['calm', 'emotional'],
    apply(env, it, p) {
      const e = E.outBack(p, 1.5);
      it.size *= Z.lerp(1.34, 1, e);
      it.blur = (it.blur || 0) + (1 - e) * 5;
      it.alpha = (it.alpha ?? 1) * Math.min(1, p * 3.4);
      it.track = (it.track || 0) + (1 - e) * 0.16;
      it.charFns.push((i, g, n) => {
        const mid = Math.abs(i - (n - 1) / 2) / Math.max(1, (n - 1) / 2);
        const k = 1 - e;
        return { dy: mid * it.size * 0.16 * k };
      });
    },
  },

  /* 阶梯落定：每个字落在自己那一级台阶上，再对齐到一条线 */
  stairStep: {
    name: '阶梯落定', new: true, w: 1, tags: ['graphic'],
    apply(env, it, p) {
      const seed = it.seed | 0;
      it.charFns.push((i, g, n) => {
        const stagger = n > 1 ? i / (n - 1) : 0;
        const d = stagger * 0.5;
        const q = Z.clamp((p - d) / 0.42);
        if (q <= 0) return { hide: true };
        const e = E.outQuint(q);
        const stepY = (1 - stagger) * it.size * 1.5;   // 台阶高度：
        return { dy: (1 - e) * (it.size * 2 + stepY), a: Math.min(1, q * 4), rot: (1 - e) * (stagger - 0.5) * 16 };
      });
    },
  },

  /* 翻飞入场：一边翻一边落，像纸片被放开 */
  flutterIn: {
    name: '翻飞入场', new: true, w: 1.05, tags: ['pop', 'emotional'],
    apply(env, it, p) {
      const seed = it.seed | 0;
      it.charFns.push((i, g, n) => {
        const d = Z.rnd(seed, i, 5) * 0.45;
        const q = Z.clamp((p - d) / 0.55);
        if (q <= 0) return { hide: true };
        const e = E.outCubic(q);
        const k = 1 - e;
        const sway = Math.sin(q * Math.PI * 2.4 + i) * it.size * 0.6 * k;
        return { dx: sway, dy: -k * it.size * 1.9, rot: Z.rsign(seed, i, 6) * 240 * k, sx: 0.2 + 0.8 * e, a: Math.min(1, q * 3.5) };
      });
    },
  },

  /* 折纸展开：从对折的窄条展开，边缘有一点回弹 */
  paperFold: {
    name: '折纸展开', new: true, w: 1.05, tags: ['graphic', 'editorial'],
    apply(env, it, p) {
      const e = E.outBack(p, 1.2);
      it.sy = (it.sy || 1) * Math.max(0.02, e);
      it.skew = (it.skew || 0) + (1 - p) * 8;
      it.alpha = (it.alpha ?? 1) * Math.min(1, p * 3);
      it.shadow = { color: 'rgba(0,0,0,0.35)', blur: it.size * 0.2 * (1 - e), dx: 0, dy: it.size * 0.02 };
    },
  },

  /* 凿刻：字块像被凿进版面，从最近的画外沿滑入并咬合 */
  chisel: {
    name: '凿刻', new: true, w: 1, tags: ['graphic', 'glitch'], pieces: true,
    apply(env, it, p, ctx) {
      const dur = ctx.inDur, lt = env.lt - (it.delay || 0);
      const seed = it.seed | 0;
      it.pieceFns.push((ci, pj, pc, ox, oy) => {
        const d = Z.rnd(seed, ci, pj, 1) * dur * 0.4;
        const x = (lt - d) / Math.max(0.05, dur * 0.6);
        if (x < 0) return null;
        if (x >= 1) return Z.REST;
        const e = E.outBack(x, 1.6);
        const k = 1 - e;
        /* 每个碎块沿"离自己最近的画外沿"进来 */
        const dl = ox, dr = env.W - ox, du = oy, dd = env.H - oy;
        const m = Math.min(dl, dr, du, dd);
        const dir = m === dl ? [-1, 0] : m === dr ? [1, 0] : m === du ? [0, -1] : [0, 1];
        const dist = it.size * (1.6 + Z.rnd(seed, ci, pj, 2) * 1.4);
        return Z.PIECE(dir[0] * dist * k, dir[1] * dist * k, Z.rsign(seed, ci, pj, 3) * 12 * k, 1 - k * 0.25, 1, 0, 1);
      });
    },
  },

  /* 踩拍炸开：碎块按拍点齐射，鼓点落下去字就成形 */
  beatBurst: {
    name: '踩拍炸开', new: true, w: 1, tags: ['pop', 'glitch'], pieces: true,
    apply(env, it, p, ctx) {
      const dur = ctx.inDur, lt = env.lt - (it.delay || 0);
      const seed = it.seed | 0;
      const beat = env.beat ? env.beat.len : 0.5;
      it.pieceFns.push((ci, pj, pc, ox, oy) => {
        const phase = Z.rnd(seed, ci, pj, 4) * 0.5;
        const x = (lt - phase * beat) / Math.max(0.05, dur * 0.7);
        if (x < 0) return null;
        if (x >= 1) return Z.REST;
        const e = E.inCubic(x), k = 1 - e;
        const ang = Math.atan2(oy - it.y + 0.01, ox - it.x + 0.01);
        const dist = it.size * 3.2 * (0.5 + Z.rnd(seed, ci, pj, 5));
        return Z.PIECE(Math.cos(ang) * dist * k, Math.sin(ang) * dist * k, ang / Z.DEG * k * 2, 1 + k * 0.6, 1, ang / Z.DEG, 1);
      });
    },
  },
}, 'design');

/* ============================================================
   声学响应
   ============================================================ */
Z.registerAll('enter', {
  /* 激振：像被敲了一下，高频抖动迅速衰减到静止 */
  resonate: {
    name: '激振', new: true, w: 1.2, tags: ['glitch', 'graphic'],
    apply(env, it, p) {
      const seed = it.seed | 0;
      const damp = Math.exp(-p * 5.5) * (1 - p);
      const amp = it.size * 0.28 * damp * (0.5 + (env.fx.motion ?? 0.7));
      const w = 34;
      it.charFns.push((i, g, n) => {
        const dir = Z.rnd(seed, i, 1) * Z.TAU;
        return {
          dx: Math.cos(dir) * amp * Math.sin(p * w + i * 0.4),
          dy: Math.sin(dir) * amp * Math.cos(p * w + i * 0.7) * 0.6,
          rot: Math.sin(p * w * 1.3 + i) * 9 * damp,
          a: Math.min(1, p * 4),
        };
      });
      it.blur = (it.blur || 0) + 4 * damp;
    },
  },

  /* 逐字起浪：字像浪头一样依次抬起再落下 */
  waveIn: {
    name: '逐字起浪', new: true, w: 1.15, tags: ['calm', 'pop'],
    apply(env, it, p) {
      it.charFns.push((i, g, n) => {
        const d = n > 1 ? (i / (n - 1)) * 0.5 : 0;
        const q = Z.clamp((p - d) / 0.5);
        if (q <= 0) return { hide: true };
        const arc = Math.sin(q * Math.PI);
        const e = E.outCubic(q);
        return { dy: -arc * it.size * 0.85, rot: -arc * 14, s: 0.86 + 0.14 * e, a: Math.min(1, q * 4) };
      });
    },
  },

  /* 涟漪：从中心往外扩散的环形波，被波面扫过的字才出现 */
  ripple: {
    name: '涟漪', new: true, w: 1.05, tags: ['calm', 'emotional'],
    apply(env, it, p) {
      const seed = it.seed | 0;
      const maxR = Math.hypot(env.W, env.H) * 0.7;
      it.charFns.push((i, g) => {
        const gx = it.x + g.x * (it.sx || 1), gy = it.y + g.y * (it.sy || 1);
        const rr = Math.hypot(gx - env.W / 2, gy - env.H / 2) / maxR;
        const d = rr * 0.55 + Z.rnd(seed, i, 2) * 0.06;
        const q = Z.clamp((p - d) / 0.45);
        if (q <= 0) return { hide: true };
        const e = E.outBack(q, 1.4);
        return { s: e, a: Math.min(1, q * 3.5), rot: (1 - e) * 12 };
      });
    },
  },
}, 'design');

Z.registerAll('hold', {
  /* 微颤：整块一起做高频小幅抖动，像绷着的弦 */
  tremor: {
    name: '微颤', new: true, w: 1.1, tags: ['glitch', 'emotional'],
    apply(env, it, amt) {
      const a = it.size * 0.008 * amt * (env.fx.motion ?? 0.7);
      const t = env.lt * 26;
      it.x += Math.sin(t) * a; it.y += Math.cos(t * 1.3) * a;
      it.rot = (it.rot || 0) + Math.sin(t * 0.9) * 0.25 * amt;
    },
  },

  /* 潮汐：大幅缓速横向进出，像镜头随水面起伏 */
  tide: {
    name: '潮汐', new: true, w: 1.05, tags: ['calm', 'emotional'],
    apply(env, it, amt, ctx) {
      const u = env.lt / Math.max(0.4, ctx.dur);
      it.x += Math.sin(u * Z.TAU * 0.5) * env.W * 0.03 * amt;
      it.y += Math.sin(u * Z.TAU * 0.72) * env.H * 0.018 * amt;
      it.rot = (it.rot || 0) + Math.sin(u * Z.TAU * 0.5) * 0.8 * amt;
    },
  },

  /* 声压：动作幅度跟着音乐能量走，安静时几乎不动，鼓点一冲就撑开 */
  driven: {
    name: '声压', new: true, w: 1.2, tags: ['glitch', 'pop'],
    apply(env, it, amt) {
      const e = env.energy != null ? env.energy : 0.5;
      const k = (0.35 + e * 0.75) * amt;
      it.size *= 1 + 0.05 * k;
      it.track = (it.track || 0) + 0.03 * k;
      it.alpha = (it.alpha ?? 1) * (0.86 + 0.14 * Math.min(1, e * 1.6));
    },
  },

  /* 心跳：两下快、一下慢的节奏，整块轻微起伏 */
  heartbeat: {
    name: '心跳', new: true, w: 1.05, tags: ['emotional'],
    apply(env, it, amt) {
      const t = (env.lt * 1.1) % 1;
      const thump = Math.exp(-Math.pow((t - 0.0) / 0.07, 2)) + 0.62 * Math.exp(-Math.pow((t - 0.2) / 0.08, 2));
      const k = thump * amt;
      it.size *= 1 + 0.055 * k;
      it.y -= it.size * 0.012 * k;
      it.alpha = (it.alpha ?? 1) * (0.94 + 0.06 * k);
    },
  },

  /* 沙沙：逐字做快速小幅转动，像被微风吹动的纸页 */
  rustle: {
    name: '沙沙', new: true, w: 1, tags: ['calm', 'editorial'],
    apply(env, it, amt) {
      const seed = it.seed | 0, step = env.step;
      it.charFns.push((i) => ({
        rot: Z.rsign(seed, step, i, 4) * 2.2 * amt,
        dy: Z.rsign(seed, step, i, 5) * it.size * 0.012 * amt,
      }));
    },
  },

  /* 光流：一道高光周期性地从字面淌过 */
  sheen: {
    name: '光流', new: true, w: 1.15, tags: ['graphic', 'pop'],
    apply(env, it, amt) {
      const box = Z.itemBox(it);
      const t = (env.lt * 0.55) % 1;
      const x = Z.lerp(box.x0 - it.size, box.x1 + it.size, t);
      it.post2 = (env2, it2) => {
        const col = env2.pass !== 'main' ? env2.passColor : '#FFFFFF';
        env2.ctx.save();
        env2.ctx.globalCompositeOperation = env2.pass !== 'main' ? 'source-over' : 'overlay';
        env2.ctx.globalAlpha = 0.34 * amt * Math.sin(t * Math.PI);
        const g = env2.ctx.createLinearGradient(x - it2.size * 0.7, 0, x + it2.size * 0.7, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, col);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        env2.ctx.fillStyle = g;
        env2.ctx.fillRect(box.x0 - it2.size, box.y0 - it2.size * 0.4, box.w + it2.size * 2, box.h + it2.size * 0.8);
        env2.ctx.restore();
      };
    },
  },

  /* 焦点漂移：时不时轻微虚掉又合上，像自动对焦在找 */
  rackFocus: {
    name: '焦点漂移', new: true, w: 1, tags: ['calm', 'emotional'],
    apply(env, it, amt) {
      const n = Z.noise1(env.lt * 0.7, 77);
      it.blur = (it.blur || 0) + Math.abs(n) * it.size * 0.022 * amt;
      it.size *= 1 + n * 0.008 * amt;
    },
  },

  /* 呼吸色：字色在主色与强调色之间缓慢来回 */
  colorBreathe: {
    name: '呼吸色', new: true, w: 1, tags: ['calm', 'pop'],
    apply(env, it, amt) {
      if (env.pass !== 'main') return;
      const k = (Math.sin(env.lt * 1.1) + 1) / 2 * amt;
      it.color = Z.mix(env.sc.fg, env.sc.accent, k * 0.75);
    },
  },
}, 'design');

/* ============================================================
   材质分解
   ============================================================ */
Z.registerAll('exit', {
  /* 微粒化：字散成细密的尘埃，颗粒越飘越淡 */
  particulate: {
    name: '微粒化', new: true, w: 1.25, tags: ['emotional', 'glitch'], pieces: true,
    apply(env, it, p, ctx) {
      const seed = it.seed | 0, dur = ctx.outDur, lt = env.lt - (ctx.dur - ctx.outDur);
      it.shatter = true;
      it.pieceFns.push((ci, pj, pc, ox, oy) => {
        const d = Z.rnd(seed, ci, pj, 1) * dur * 0.5;
        const x = (lt - d) / Math.max(0.05, dur * 0.6);
        if (x <= 0) return Z.REST;
        if (x >= 1) return null;
        const e = E.outQuad(x);
        const ang = Z.rnd(seed, ci, pj, 2) * Z.TAU;
        const dist = it.size * (0.6 + Z.rnd(seed, ci, pj, 3) * 2.2);
        return Z.PIECE(
          Math.cos(ang) * dist * e, Math.sin(ang) * dist * e - it.size * 0.5 * e * e,
          0, 1 - e * 0.85, 1, 0, 1 - x
        );
      });
    },
  },

  /* 被风吹散：一股从左来的风把字掀走，越远越快 */
  gust: {
    name: '被风吹散', new: true, w: 1.2, tags: ['calm', 'emotional', 'pop'],
    apply(env, it, p) {
      const seed = it.seed | 0;
      const e = E.inCubic(p);
      it.charFns.push((i, g, n) => {
        const d = (n > 1 ? i / (n - 1) : 0) * 0.45;
        const q = Z.clamp((p - d) / 0.6);
        if (q <= 0) return null;
        const k = E.inQuad(q);
        const lift = Math.sin(q * Math.PI * 0.9);
        return {
          dx: k * env.W * 0.32,
          dy: (-lift * 0.8 + k * k * 1.6) * it.size * 1.7,
          rot: k * (Z.rsign(seed, i, 3) * 120),
          a: 1 - k * k,
        };
      });
      it.alpha = (it.alpha ?? 1) * (1 - Z.smoothstep(0.85, 1, e));
      it.track = (it.track || 0) + e * 0.5;
    },
  },

  /* 沉入景深：不是淡出，是越走越虚、越走越远 */
  defocusOut: {
    name: '沉入景深', new: true, w: 1.2, tags: ['calm', 'emotional'],
    apply(env, it, p) {
      const e = E.inQuad(p);
      it.blur = (it.blur || 0) + e * it.size * 0.09;
      it.size *= 1 - e * 0.16;
      it.alpha = (it.alpha ?? 1) * (1 - e * 0.85);
      it.charFns.push((i, g, n) => {
        const d = (n > 1 ? i / (n - 1) : 0) * 0.3;
        const q = Z.clamp((p - d) / 0.7);
        return { dy: q * q * it.size * 0.28, sx: 1 - q * 0.12 };
      });
    },
  },

  /* 蒸发：字往上飘走，同时化成一团白气 */
  evaporate: {
    name: '蒸发', new: true, w: 1.1, tags: ['calm', 'emotional'],
    apply(env, it, p) {
      const e = E.inOutSine(p);
      it.y -= e * it.size * 1.1;
      it.blur = (it.blur || 0) + e * it.size * 0.07;
      it.alpha = (it.alpha ?? 1) * (1 - e);
      it.charFns.push((i, g, n) => {
        const d = (n > 1 ? i / (n - 1) : 0) * 0.4;
        const q = Z.clamp((p - d) / 0.6);
        return { sy: 1 + q * 0.5, sx: 1 - q * 0.25, dy: -q * it.size * 0.35 };
      });
    },
  },

  /* 灼烧：像纸被火舌从下往上吃掉，边缘是亮的 */
  burnOut: {
    name: '灼烧', new: true, w: 1.15, tags: ['glitch', 'emotional'],
    apply(env, it, p) {
      const box = Z.itemBox(it);
      const e = E.inQuad(p);
      const y = Z.lerp(box.y1 + it.size * 0.3, box.y0 - it.size * 0.3, e);
      it.clipY = [-1e5, y];
      it.edgeGlow = { x: it.x, y, w: box.w + it.size * 1.2, h: it.size * 0.55, soft: 1 };
      it.charFns.push((i, g) => {
        const gy = it.y + g.y * (it.sy || 1);
        const d = Math.abs(gy - y) / (it.size * 1.1);
        return d < 1 ? { color: env.sc.accent } : null;
      });
      it.alpha = (it.alpha ?? 1) * (1 - Z.smoothstep(0.92, 1, p));
    },
  },

  /* 逐个被吃掉：字从一端开始被吞掉，每个消失前先缩一下 */
  consume: {
    name: '逐个吞噬', new: true, w: 1.05, tags: ['glitch', 'graphic'],
    apply(env, it, p) {
      const n = (it._m || (it._m = Z.measure(it))).lay.N;
      const seed = it.seed | 0;
      const order = [];
      for (let i = 0; i < n; i++) order.push(i);
      order.sort((a, b) => Z.rnd(seed, a, 9) - Z.rnd(seed, b, 9));
      const eaten = p * n;
      it.charFns.push((i) => {
        const rank = order.indexOf(i);
        if (rank < Math.floor(eaten)) return { hide: true };
        const q = Z.clamp(eaten - rank);
        if (q <= 0) return null;
        return { s: 1 - q, rot: q * 140, a: 1 - q, dy: q * it.size * 0.4 };
      });
    },
  },

  /* 压成一条线：先被压扁成一条亮线，再整条消失 */
  flatten: {
    name: '压成一线', new: true, w: 0.95, tags: ['graphic', 'glitch'],
    apply(env, it, p) {
      if (p < 0.55) {
        const e = E.inOutCubic(p / 0.55);
        it.sy = (it.sy || 1) * Math.max(0.006, 1 - e);
        it.sx = (it.sx || 1) * (1 + e * 0.14);
        it.shadow = { color: Z.rgba(env.sc.accent, 0.9 * e), blur: it.size * 0.3 * e, dx: 0, dy: 0 };
      } else {
        const e = (p - 0.55) / 0.45;
        it.sy = (it.sy || 1) * 0.006;
        it.sx = (it.sx || 1) * Math.max(0.001, 1.14 - E.inQuad(e) * 1.14);
        it.alpha = (it.alpha ?? 1) * (1 - e);
      }
    },
  },

  /* 翻面离场：像卡片翻过去，露出背面 */
  turnAway: {
    name: '翻面离场', new: true, w: 1, tags: ['graphic', 'editorial'],
    apply(env, it, p) {
      const e = E.inOutCubic(p);
      it.sx = (it.sx || 1) * Math.max(0.01, Math.cos(e * Math.PI * 0.5));
      it.skew = (it.skew || 0) + e * 14;
      it.shadow = { color: 'rgba(0,0,0,0.4)', blur: it.size * 0.2, dx: it.size * 0.02 * e, dy: it.size * 0.02 * e };
      it.alpha = (it.alpha ?? 1) * (1 - Z.smoothstep(0.75, 1, p));
    },
  },

  /* 光芒吞没：中心炸出一团光，把字整个吞进去 */
  flareOut: {
    name: '光芒吞没', new: true, w: 1, tags: ['glitch', 'pop'],
    apply(env, it, p) {
      const e = E.inQuad(p);
      const box = Z.itemBox(it);
      const R = Math.max(box.w, box.h) * (0.1 + e * 0.9);
      it.post2 = (env2) => {
        const ctx = env2.ctx;
        ctx.save();
        const col = env2.pass !== 'main' ? env2.passColor : '#FFFFFF';
        const g = ctx.createRadialGradient(it.x, it.y, R * 0.15, it.x, it.y, R);
        g.addColorStop(0, col);
        g.addColorStop(0.45, Z.rgba(env2.sc.accent, 0.9 * e));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = e;
        ctx.fillStyle = g;
        ctx.fillRect(it.x - R * 1.4, it.y - R * 1.4, R * 2.8, R * 2.8);
        ctx.restore();
      };
      it.alpha = (it.alpha ?? 1) * (1 - e * e);
    },
  },

  /* 收拢成点：所有字朝画面中心的一个点收进去 */
  collapseToPoint: {
    name: '收拢成点', new: true, w: 1.05, tags: ['graphic', 'glitch'],
    apply(env, it, p) {
      const e = E.inQuart(p);
      const seed = it.seed | 0;
      const cx = env.W / 2 + Z.rsign(seed, 1) * env.W * 0.1;
      const cy = env.H / 2 + Z.rsign(seed, 2) * env.H * 0.1;
      it.charFns.push((i, g) => {
        const gx = it.x + g.x * (it.sx || 1), gy = it.y + g.y * (it.sy || 1);
        return { dx: (cx - gx) * e, dy: (cy - gy) * e, s: 1 - e * 0.95, rot: e * 180, a: 1 - e };
      });
    },
  },

  /* 碎网：碎块被吸到一个远处的网格里散掉 */
  shatterGrid: {
    name: '碎网消散', new: true, w: 1, tags: ['graphic', 'glitch'], pieces: true,
    apply(env, it, p, ctx) {
      const seed = it.seed | 0, dur = ctx.outDur, lt = env.lt - (ctx.dur - ctx.outDur);
      it.shatter = true;
      it.pieceFns.push((ci, pj, pc, ox, oy) => {
        const x = (lt - Z.rnd(seed, ci, pj, 1) * dur * 0.25) / Math.max(0.05, dur * 0.75);
        if (x <= 0) return Z.REST;
        if (x >= 1) return null;
        const e = E.inQuad(x);
        const tx = Math.round(ox / (it.size * 0.9)) * it.size * 0.9;
        const ty = Math.round(oy / (it.size * 0.9)) * it.size * 0.9;
        return Z.PIECE((tx - ox) * e * 3.2, (ty - oy) * e * 3.2, e * 45, 1 - e * 0.9, 1, 0, 1 - x);
      });
    },
  },
}, 'design');

/* 新增零件默认权重略高一点，让"重新设计"的部分真的会被抽到 */
for (const g of Z.GROUPS) {
  for (const k of Z.order(g)) {
    const d = Z.registry(g)[k];
    if (d && d.new && d.w == null) d.w = 1.1;
  }
}
})();
