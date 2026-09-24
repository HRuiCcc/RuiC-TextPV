/* ============================================================
   RuiC-TextPV — 相机运动 / 画面特效 / 镜头转场
   相机：给整个文字层加一层变换（推拉摇移、手持、变焦…）
   特效：画面级的后处理（故障、反相、闪白、过曝…）
   转场：把上一个镜头的末帧与这一个镜头的画面合成切换
   ============================================================ */
(() => {
'use strict';
const E = Z.E;

/* ============================================================
   相机
   get(env, p) → { s 缩放, x/y 位移, rot 旋转, sx/sy 拉伸,
                   skx 斜切, blur 整层模糊 }（单位：设计像素 / 度）
   ============================================================ */
Z.registerAll('cam', {
  push: {
    name: '缓推', tags: ['*'], w: 5,
    get(env, p) { const u = Z.clamp(env.lt / Math.max(0.3, env.cut.dur)); return { s: 1 + (p.amount || 0.03) * (env.fx.motion ?? 0.7) * u }; },
  },
  pull: {
    name: '缓拉', w: 1.4,
    get(env, p) { const u = Z.clamp(env.lt / Math.max(0.3, env.cut.dur)); return { s: 1.12 - 0.1 * (env.fx.motion ?? 0.7) * u }; },
  },
  panL: {
    name: '左摇', w: 1.4, tags: ['calm', 'editorial', 'graphic'],
    get(env, p) {
      const u = Z.clamp(env.lt / Math.max(0.3, env.cut.dur));
      return { s: 1.06, x: (0.5 - u) * env.W * 0.07 * (env.fx.motion ?? 0.7) };
    },
  },
  panR: {
    name: '右摇', w: 1.4, tags: ['calm', 'editorial', 'graphic'],
    get(env, p) {
      const u = Z.clamp(env.lt / Math.max(0.3, env.cut.dur));
      return { s: 1.06, x: (u - 0.5) * env.W * 0.07 * (env.fx.motion ?? 0.7) };
    },
  },
  tiltUp: {
    name: '上摇', w: 1.1,
    get(env) { return { s: 1.05, y: (0.5 - Z.clamp(env.lt / Math.max(0.3, env.cut.dur))) * env.H * 0.05 }; },
  },
  tiltDown: {
    name: '下摇', w: 1.1,
    get(env) { return { s: 1.05, y: (Z.clamp(env.lt / Math.max(0.3, env.cut.dur)) - 0.5) * env.H * 0.05 }; },
  },
  dutch: {
    name: '倾斜', w: 1.1, strong: true,
    get(env, p) { return { rot: (p.a || 4) * (env.fx.motion ?? 0.7) * (1 - Z.clamp(env.lt / Math.max(0.3, env.cut.dur)) * 0.5), s: 1.07 }; },
  },
  handheld: {
    name: '手持', w: 1.3,
    get(env, p) {
      const t = env.lt, A = (p.a || 1) * (env.fx.motion ?? 0.7);
      return {
        s: 1.04, x: Z.noise1(t * 2.2, 11) * env.W * 0.008 * A, y: Z.noise1(t * 1.9, 22) * env.H * 0.008 * A,
        rot: Z.noise1(t * 1.4, 33) * 0.8 * A,
      };
    },
  },
  beatZoom: {
    name: '踩拍变焦', w: 1.2, strong: true,
    get(env, p) {
      const k = env.beat ? Math.max(0, 1 - env.beat.since / Math.min(0.3, env.beat.len)) : 0;
      const u = Z.clamp(env.lt / Math.max(0.3, env.cut.dur));
      return { s: 1 + 0.03 * u + k * 0.055 * (env.fx.motion ?? 0.7) * (p.a || 1) };
    },
  },
  crashZoom: {
    name: '急推', w: 1, strong: true,
    get(env, p) { const u = Z.clamp(env.lt / Math.min(0.5, env.cut.dur * 0.4)); return { s: Z.lerp(1, 1.55, E.outExpo(u)) * (p.a || 1) }; },
  },
  orbit: {
    name: '环绕', w: 1, strong: true,
    get(env, p) {
      const u = Z.clamp(env.lt / Math.max(0.3, env.cut.dur));
      const a = u * Z.TAU * (p.turns || 0.25);
      return { s: 1.1, x: Math.sin(a) * env.W * 0.05, y: Math.cos(a) * env.H * 0.04, rot: Math.sin(a) * 2 };
    },
  },
  roll: {
    name: '滚转', w: 0.9, strong: true,
    get(env, p) { return { s: 1.12, rot: Z.clamp(env.lt / Math.max(0.3, env.cut.dur)) * 360 * (p.turns || 0.3) }; },
  },
  pendulum: {
    name: '摆锤', w: 1.1,
    get(env, p) { return { s: 1.06, rot: Math.sin(env.lt * 2.2) * 4 * (env.fx.motion ?? 0.7), x: Math.sin(env.lt * 2.2) * env.W * 0.02 }; },
  },
  focusPull: {
    name: '焦点拉移', w: 1, strong: true,
    get(env, p) {
      const u = Z.clamp(env.lt / Math.max(0.4, env.cut.dur * 0.5));
      const blur = Math.abs(u - (p.at || 0.5)) * 2;
      return { s: 1 + u * 0.05, blur: Math.max(0, blur - 0.35) * 7 * (env.fx.motion ?? 0.7) };
    },
  },
  earthquake: {
    name: '地震', w: 0.9, strong: true,
    get(env, p) {
      const u = Z.clamp(env.lt / Math.max(0.3, env.cut.dur));
      const A = (1 - u) * (p.a || 1) * (env.fx.motion ?? 0.7);
      const st = env.step;
      return { s: 1.06, x: Z.rsign(p.seed | 0, st, 1) * env.W * 0.02 * A, y: Z.rsign(p.seed | 0, st, 2) * env.H * 0.02 * A };
    },
  },
  snapPan: {
    name: '甩镜', w: 0.8, strong: true,
    get(env, p) {
      const k = Z.clamp(env.lt / Math.min(0.28, env.cut.dur * 0.3));
      const dir = (p.dir || 1);
      return { s: 1.05, x: (1 - E.outExpo(k)) * dir * env.W * 0.18, blur: (1 - k) * 5 };
    },
  },
  vortex: {
    name: '旋涡推进', w: 0.8, strong: true,
    get(env, p) {
      const u = Z.clamp(env.lt / Math.max(0.3, env.cut.dur));
      return { s: 1 + u * 0.22, rot: u * 25 * (p.dir || 1) };
    },
  },
}, 'core');

/* ============================================================
   画面特效
   draw(ctx, ev, k, info)   k = 0→1 进度；ctx 画布已是设备像素
   需要读原图时用 info.S（渲染器准备好的拷贝）配合 ev.scratch
   ============================================================ */
const F = (k, info) => k;   // 进度
Z.registerAll('fx', {
  /* ---- 新增的、需要自定义绘制的 ---- */
  rgbSplit: {
    name: 'RGB 分离', dur: 4, amp: 1, edge: true, mid: true, glitchy: true, scratch: true, w: 1.4,
    draw(ctx, ev, k, fo) {
      const { cw, ch, S } = fo;
      const A = ev.amp * (1 - k) * cw * 0.012;
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, cw, ch);
      ctx.globalCompositeOperation = 'lighter';
      const R = fo.tmp(cw, ch), r = R.getContext('2d');
      for (const [col, dx, dy] of [['#ff0000', A, A * 0.3], ['#00ff00', 0, 0], ['#0000ff', -A, -A * 0.3]]) {
        r.setTransform(1, 0, 0, 1, 0, 0);
        r.globalCompositeOperation = 'copy';
        r.globalAlpha = 1;
        r.drawImage(S, 0, 0);
        r.globalCompositeOperation = 'multiply';
        r.fillStyle = col;
        r.fillRect(0, 0, cw, ch);
        ctx.globalAlpha = 1;
        ctx.drawImage(R, dx, dy);
      }
      ctx.restore();
    },
  },
  smear: {
    name: '拖影涂抹', dur: 5, amp: 1, edge: true, mid: true, scratch: true, w: 1.2,
    draw(ctx, ev, k, fo) {
      const { cw, ch, S } = fo;
      const n = 6;
      ctx.save();
      for (let i = 1; i <= n; i++) {
        ctx.globalAlpha = 0.16 * (1 - i / (n + 1)) * (1 - k);
        ctx.drawImage(S, Z.rsign(ev.amp | 0, i, 1) * cw * 0.02 * i, 0);
      }
      ctx.restore();
    },
  },
  vhsRoll: {
    name: 'VHS 卷动', dur: 6, amp: 1, edge: true, mid: true, glitchy: true, scratch: true, w: 1.3,
    draw(ctx, ev, k, fo) {
      const { cw, ch, S } = fo;
      const y = (1 - k) * ch + (Z.rnd(ev.t | 0, 3) - 0.5) * ch * 0.1;
      const h = ch * 0.09;
      ctx.save();
      ctx.drawImage(S, 0, y, cw, h, 0, y + Z.rnd(ev.t | 0, 4) * h * 0.4, cw, h);
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.25 * (1 - k);
      ctx.fillStyle = fo.sc.accent;
      ctx.fillRect(0, y, cw, h * 0.4);
      ctx.restore();
    },
  },
  tracking: {
    name: '走带噪点', dur: 4, amp: 1, edge: true, mid: true, glitchy: true, scratch: true, w: 1.1,
    draw(ctx, ev, k, fo) {
      const { cw, ch, S, step } = fo;
      ctx.save();
      for (let i = 0; i < 14; i++) {
        if (Z.rnd(step, i, 1) > 0.4) continue;
        const y = Z.rnd(step, i, 2) * ch;
        const h = ch * (0.005 + Z.rnd(step, i, 3) * 0.02);
        const dx = Z.rsign(step, i, 4) * cw * 0.05 * ev.amp;
        ctx.drawImage(S, 0, y, cw, h, dx, y, cw, h);
      }
      ctx.globalAlpha = 0.14 * (1 - k);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, cw, ch);
      ctx.restore();
    },
  },
  waveWarp: {
    name: '波纹扭曲', dur: 5, amp: 1, edge: true, mid: true, scratch: true, w: 1.1,
    draw(ctx, ev, k, fo) {
      const { cw, ch, S } = fo;
      const slices = 26;
      ctx.save();
      for (let i = 0; i < slices; i++) {
        const y = ch * i / slices, h = ch / slices + 1;
        const dx = Math.sin(i / slices * 6 + (1 - k) * 8) * cw * 0.03 * ev.amp * (1 - k);
        ctx.drawImage(S, 0, y, cw, h, dx, y, cw, h);
      }
      ctx.restore();
    },
  },
  tileShift: {
    name: '方块错位', dur: 4, amp: 1, edge: true, mid: true, glitchy: true, scratch: true, w: 1.1,
    draw(ctx, ev, k, fo) {
      const { cw, ch, S, step } = fo;
      const cols = 5, rows = 4;
      ctx.save();
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (Z.rnd(step, r, c, 1) > 0.22 + k * 0.3) continue;
          const w = cw / cols, h = ch / rows;
          const dx = Z.rsign(step, r, c, 2) * cw * 0.04 * ev.amp;
          const dy = Z.rsign(step, r, c, 3) * ch * 0.04 * ev.amp;
          ctx.drawImage(S, c * w, r * h, w, h, c * w + dx, r * h + dy, w, h);
        }
      }
      ctx.restore();
    },
  },
  strobe: {
    name: '频闪', dur: 5, amp: 1, edge: true, w: 1.1,
    draw(ctx, ev, k, fo) {
      const { cw, ch } = fo;
      const on = Math.floor(k * 10) % 2 === 0;
      if (!on) return;
      ctx.save();
      ctx.globalCompositeOperation = 'difference';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cw, ch);
      ctx.restore();
    },
  },
  blackFrame: {
    name: '闪黑', dur: 3, amp: 1, edge: true, w: 1,
    draw(ctx, ev, k, fo) {
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, fo.cw, fo.ch);
      ctx.restore();
    },
  },
  whiteFrame: {
    name: '闪白', dur: 3, amp: 1, edge: true, w: 1.1,
    draw(ctx, ev, k, fo) {
      ctx.save();
      ctx.globalAlpha = Math.pow(1 - k, 1.4) * 0.95;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, fo.cw, fo.ch);
      ctx.restore();
    },
  },
  filmBurn: {
    name: '胶片烧穿', dur: 6, amp: 1, edge: true, scratch: true, w: 1,
    draw(ctx, ev, k, fo) {
      const { cw, ch, S } = fo;
      const R = Math.max(cw, ch) * (0.2 + k * 0.9);
      ctx.save();
      ctx.drawImage(S, 0, 0);
      const g = ctx.createRadialGradient(cw * 0.5, ch * 0.5, R * 0.2, cw * 0.5, ch * 0.5, R);
      g.addColorStop(0, 'rgba(255,220,120,0)');
      g.addColorStop(0.55, `rgba(255,140,30,${0.5 * (1 - k * 0.6)})`);
      g.addColorStop(0.8, `rgba(120,20,0,${0.8 * (1 - k * 0.5)})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cw, ch);
      ctx.restore();
    },
  },
  lightSweepFX: {
    name: '光晕扫过', dur: 5, amp: 1, edge: true, mid: true, w: 1.2,
    draw(ctx, ev, k, fo) {
      const { cw, ch } = fo;
      const x = (-0.3 + k * 1.6) * cw;
      const g = ctx.createLinearGradient(x - cw * 0.2, 0, x + cw * 0.2, ch);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, `rgba(255,255,255,${0.3 * Math.sin(k * Math.PI)})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cw, ch);
      ctx.restore();
    },
  },
  posterize: {
    name: '色调分离', dur: 5, amp: 1, edge: true, mid: true, w: 1,
    draw(ctx, ev, k, fo) {
      const { cw, ch } = fo;
      const bands = Math.max(2, Math.round(3 + (1 - k) * 3));
      const T = fo.tmp(Math.max(8, Math.round(cw / 6)), Math.max(8, Math.round(ch / 6)));
      const tx = T.getContext('2d');
      tx.setTransform(1, 0, 0, 1, 0, 0);
      tx.globalAlpha = 1;
      tx.globalCompositeOperation = 'copy';
      tx.drawImage(ctx.canvas, 0, 0, T.width, T.height);
      const id = tx.getImageData(0, 0, T.width, T.height);
      const d = id.data, q = 255 / (bands - 1);
      for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.round(d[i] / q) * q;
        d[i + 1] = Math.round(d[i + 1] / q) * q;
        d[i + 2] = Math.round(d[i + 2] / q) * q;
      }
      tx.putImageData(id, 0, 0);
      ctx.save();
      ctx.globalAlpha = 0.85 * (1 - k) + 0.15;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(T, 0, 0, cw, ch);
      ctx.restore();
    },
  },
  hueShift: {
    name: '色相偏移', dur: 5, amp: 1, edge: true, mid: true, w: 1,
    draw(ctx, ev, k, fo) {
      ctx.save();
      ctx.globalCompositeOperation = 'hue';
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.fillStyle = Z.hsl2hex(k * 220 + 30, 0.7, 0.5);
      ctx.fillRect(0, 0, fo.cw, fo.ch);
      ctx.restore();
    },
  },
  doors: {
    name: '门板闭合', dur: 4, amp: 1, edge: true, scratch: true, w: 1,
    draw(ctx, ev, k, fo) {
      const { cw, ch, S } = fo;
      ctx.save();
      const w = cw * 0.5 * (1 - k) + 1;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(S, 0, 0, cw, ch);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cw * 0.5 - w / 2, ch);
      ctx.fillRect(cw * 0.5 + w / 2, 0, cw * 0.5 - w / 2, ch);
      ctx.restore();
    },
  },
  crtOff: {
    name: '显像管关机', dur: 6, amp: 1, edge: true, scratch: true, w: 1,
    draw(ctx, ev, k, fo) {
      const { cw, ch, S } = fo;
      ctx.save();
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cw, ch);
      if (k < 0.75) {
        const h = Math.max(2, ch * (1 - k / 0.75));
        ctx.drawImage(S, 0, 0, cw, ch, 0, ch / 2 - h / 2, cw, h);
      } else {
        const w = Math.max(1, cw * (1 - (k - 0.75) / 0.25));
        ctx.globalAlpha = Math.max(0, 1 - (k - 0.9) / 0.1);
        ctx.fillStyle = '#fff';
        ctx.fillRect(cw / 2 - w / 2, ch / 2 - Math.max(1, ch * 0.004), w, Math.max(2, ch * 0.008));
      }
      ctx.restore();
    },
  },
  zoomPunch: {
    name: '变焦冲击', dur: 3, amp: 1, edge: true, mid: true, scratch: true, w: 1.3,
    draw(ctx, ev, k, fo) {
      const { cw, ch, S } = fo;
      const s = 1 + (1 - k) * 0.16 * ev.amp;
      ctx.save();
      ctx.drawImage(S, cw / 2 - cw * s / 2, ch / 2 - ch * s / 2, cw * s, ch * s);
      ctx.restore();
    },
  },
  whipBlur: {
    name: '甩动模糊', dur: 4, amp: 1, edge: true, scratch: true, w: 1.1,
    draw(ctx, ev, k, fo) {
      const { cw, ch, S } = fo;
      const n = 5;
      ctx.save();
      for (let i = 0; i < n; i++) {
        ctx.globalAlpha = (1 - k) * 0.3;
        ctx.drawImage(S, (i - n / 2) * cw * 0.014 * ev.amp, 0);
      }
      ctx.restore();
    },
  },
  irisTrans: {
    name: '光圈收放', dur: 5, amp: 1, edge: true, w: 1.1,
    draw(ctx, ev, k, fo) {
      const { cw, ch } = fo;
      ctx.save();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.rect(0, 0, cw, ch);
      ctx.arc(cw / 2, ch / 2, Math.max(1, Math.hypot(cw, ch) * 0.6 * (1 - k)), 0, Z.TAU, true);
      ctx.fill();
      ctx.restore();
    },
  },
  gridRepeat: {
    name: '网格重复', dur: 5, amp: 1, edge: true, mid: true, scratch: true, w: 0.9,
    draw(ctx, ev, k, fo) {
      const { cw, ch, S } = fo;
      const n = 2 + Math.round((1 - k) * 4);
      const w = cw / n, h = ch / n;
      ctx.save();
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) ctx.drawImage(S, c * w, r * h, w, h);
      ctx.restore();
    },
  },
  mirrorFlash: {
    name: '镜像闪烁', dur: 3, amp: 1, edge: true, w: 1,
    draw(ctx, ev, k, fo) {
      const { cw, ch } = fo;
      ctx.save();
      ctx.globalAlpha = Math.pow(1 - k, 1.6);
      ctx.globalCompositeOperation = 'difference';
      ctx.fillStyle = fo.sc.accent;
      ctx.fillRect(0, 0, cw, cw * 0.001);
      ctx.translate(cw, 0); ctx.scale(-1, 1);
      ctx.drawImage(ctx.canvas, 0, 0);
      ctx.restore();
    },
  },
  pixelDrift: {
    name: '像素漂移', dur: 5, amp: 1, edge: true, mid: true, glitchy: true, scratch: true, w: 1.1,
    draw(ctx, ev, k, fo) {
      const { cw, ch, S, step } = fo;
      const px = Math.max(3, Math.round(cw / (90 + k * 200)));
      const T = fo.tmp(Math.max(4, Math.round(cw / px)), Math.max(4, Math.round(ch / px)));
      const tx = T.getContext('2d');
      tx.setTransform(1, 0, 0, 1, 0, 0);
      tx.globalCompositeOperation = 'copy'; tx.globalAlpha = 1;
      tx.drawImage(S, 0, 0, T.width, T.height);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 0.6 + 0.4 * (1 - k);
      for (let i = 0; i < 7; i++) {
        const y = Z.rnd(step, i, 5) * T.height, h = 2 + Z.rnd(step, i, 6) * 6;
        const dx = Z.rsign(step, i, 7) * 6 * ev.amp;
        ctx.drawImage(T, 0, y, T.width, h, dx * px, y * px, cw, h * px);
      }
      ctx.imageSmoothingEnabled = true;
      ctx.restore();
    },
  },
  halation: {
    name: '光晕', dur: 5, amp: 1, edge: true, mid: true, scratch: true, w: 1.1,
    draw(ctx, ev, k, fo) {
      const { cw, ch, S } = fo;
      const T = fo.tmp(Math.max(8, Math.round(cw / 8)), Math.max(8, Math.round(ch / 8)));
      const tx = T.getContext('2d');
      tx.setTransform(1, 0, 0, 1, 0, 0);
      tx.globalCompositeOperation = 'copy'; tx.globalAlpha = 1;
      if (fo.allowFilter) tx.filter = 'blur(4px)';
      tx.drawImage(S, 0, 0, T.width, T.height);
      tx.filter = 'none';
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.55 * (1 - k) * ev.amp;
      ctx.drawImage(T, 0, 0, cw, ch);
      ctx.restore();
    },
  },
  flare: {
    name: '横向光斑', dur: 4, amp: 1, edge: true, mid: true, w: 1,
    draw(ctx, ev, k, fo) {
      const { cw, ch } = fo;
      const y = ch * (0.3 + Z.rnd(ev.t | 0, 1) * 0.4);
      const g = ctx.createLinearGradient(0, y - ch * 0.06, cw, y + ch * 0.06);
      const col = fo.sc.accent2 || '#fff';
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.35, Z.rgba(col, 0.35 * (1 - k)));
      g.addColorStop(0.5, Z.rgba(col, 0.7 * (1 - k)));
      g.addColorStop(0.65, Z.rgba(col, 0.35 * (1 - k)));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = g;
      ctx.fillRect(0, y - ch * 0.06, cw, ch * 0.12);
      ctx.restore();
    },
  },
  dust: {
    name: '灰尘划痕', dur: 6, amp: 1, edge: true, mid: true, w: 0.9,
    draw(ctx, ev, k, fo) {
      const { cw, ch, step } = fo;
      ctx.save();
      for (let i = 0; i < 8; i++) {
        const x = Z.rnd(step, i, 1) * cw;
        const y0 = Z.rnd(step, i, 2) * ch, y1 = y0 + ch * (0.1 + Z.rnd(step, i, 3) * 0.4);
        ctx.globalAlpha = 0.1 + 0.2 * (1 - k);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = Math.max(1, cw * 0.0006);
        ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + Z.rsign(step, i, 4) * cw * 0.01, y1); ctx.stroke();
      }
      ctx.globalAlpha = 0.06 * (1 - k);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, cw, ch);
      ctx.restore();
    },
  },
  scrambleFX: {
    name: '行错位乱帧', dur: 4, amp: 1, edge: true, mid: true, glitchy: true, scratch: true, w: 1.1,
    draw(ctx, ev, k, fo) {
      const { cw, ch, S, step } = fo;
      const n = 10 + Math.round(8 * ev.amp);
      ctx.save();
      for (let i = 0; i < n; i++) {
        const y = Z.rnd(step, i, 1) * ch;
        const h = ch * (0.004 + Z.rnd(step, i, 2) * 0.03);
        const dx = Z.rsign(step, i, 3) * cw * 0.06 * ev.amp * (0.4 + k);
        ctx.drawImage(S, 0, y, cw, h, dx, y, cw, h);
      }
      ctx.restore();
    },
  },
  heartbeatPulse: {
    name: '心跳脉动', dur: 4, amp: 1, edge: true, mid: true, scratch: true, w: 1,
    draw(ctx, ev, k, fo) {
      const { cw, ch, S } = fo;
      const s = 1 + Math.sin((1 - k) * Math.PI * 3) * 0.04 * (1 - k) * ev.amp;
      ctx.save();
      ctx.drawImage(S, cw / 2 - cw * s / 2, ch / 2 - ch * s / 2, cw * s, ch * s);
      ctx.restore();
    },
  },
}, 'core');

/* ============================================================
   镜头转场
   draw(ctx, A, B, p, info)  A = 上一个镜头的末帧，B = 当前画面
   都是设备像素的 canvas；p = 0→1 切换进度
   ============================================================ */
const tmpCtx = (info, w, h) => info.tmp(w, h).getContext('2d');
Z.registerAll('trans', {
  edgeWipe: {
    name: '边缘擦除', dur: 0.35, w: 1.4,
    draw(ctx, A, B, p, info) {
      const { cw, ch } = info;
      const e = E.inOutCubic(p);
      ctx.save();
      ctx.drawImage(B, 0, 0);
      ctx.beginPath();
      ctx.rect(cw * (1 - e), 0, cw * e + 2, ch);
      ctx.clip();
      ctx.drawImage(A, 0, 0);
      ctx.restore();
      const x = cw * (1 - e);
      ctx.fillStyle = info.sc.accent;
      ctx.fillRect(x - cw * 0.004, 0, Math.max(2, cw * 0.008), ch);
    },
  },
  diagWipe: {
    name: '斜向擦除', dur: 0.4, w: 1.2,
    draw(ctx, A, B, p, info) {
      const { cw, ch } = info;
      const e = E.inOutCubic(p);
      const d = (cw + ch) * e;
      ctx.save();
      ctx.drawImage(B, 0, 0);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(d, 0); ctx.lineTo(0, d); ctx.closePath();
      ctx.clip();
      ctx.drawImage(A, 0, 0);
      ctx.restore();
    },
  },
  clockWipe: {
    name: '时钟擦除', dur: 0.45, w: 1.1,
    draw(ctx, A, B, p, info) {
      const { cw, ch } = info;
      const e = E.inOutCubic(p);
      ctx.save();
      ctx.drawImage(B, 0, 0);
      ctx.beginPath();
      ctx.moveTo(cw / 2, ch / 2);
      ctx.arc(cw / 2, ch / 2, Math.hypot(cw, ch), -Math.PI / 2, -Math.PI / 2 + Z.TAU * e);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(A, 0, 0);
      ctx.restore();
    },
  },
  iris: {
    name: '光圈切换', dur: 0.4, w: 1.2,
    draw(ctx, A, B, p, info) {
      const { cw, ch } = info;
      const e = E.inOutCubic(p);
      ctx.save();
      ctx.drawImage(B, 0, 0);
      ctx.beginPath();
      ctx.arc(cw / 2, ch / 2, Math.hypot(cw, ch) * 0.62 * (1 - e), 0, Z.TAU);
      ctx.clip();
      ctx.drawImage(A, 0, 0);
      ctx.restore();
    },
  },
  push: {
    name: '推挤', dur: 0.4, w: 1.3,
    draw(ctx, A, B, p, info) {
      const { cw, ch } = info;
      const e = E.inOutCubic(p);
      ctx.save();
      ctx.drawImage(B, cw * (1 - e), 0);
      ctx.drawImage(A, -cw * e, 0);
      ctx.restore();
    },
  },
  coverSlide: {
    name: '覆盖滑动', dur: 0.38, w: 1.2,
    draw(ctx, A, B, p, info) {
      const { cw, ch } = info;
      const e = E.inOutCubic(p);
      ctx.save();
      ctx.drawImage(A, 0, 0);
      ctx.drawImage(B, cw * (1 - e), 0);
      ctx.restore();
    },
  },
  zoomThrough: {
    name: '穿透缩放', dur: 0.4, w: 1.2,
    draw(ctx, A, B, p, info) {
      const { cw, ch } = info;
      const e = E.inOutCubic(p);
      ctx.save();
      ctx.globalAlpha = 1;
      const s1 = 1 + e * 1.6, s2 = Z.lerp(0.35, 1, e);
      ctx.globalAlpha = 1 - e;
      ctx.drawImage(A, cw / 2 - cw * s1 / 2, ch / 2 - ch * s1 / 2, cw * s1, ch * s1);
      ctx.globalAlpha = e;
      ctx.drawImage(B, cw / 2 - cw * s2 / 2, ch / 2 - ch * s2 / 2, cw * s2, ch * s2);
      ctx.restore();
    },
  },
  doors: {
    name: '对开', dur: 0.4, w: 1,
    draw(ctx, A, B, p, info) {
      const { cw, ch } = info;
      const e = E.inOutCubic(p);
      ctx.save();
      ctx.drawImage(B, 0, 0);
      const w = cw * 0.5 * (1 - e);
      ctx.drawImage(A, 0, 0, cw * 0.5, ch, 0, 0, w, ch);
      ctx.drawImage(A, cw * 0.5, 0, cw * 0.5, ch, cw - w, 0, w, ch);
      ctx.restore();
    },
  },
  blinds: {
    name: '百叶切换', dur: 0.4, w: 1,
    draw(ctx, A, B, p, info) {
      const { cw, ch } = info;
      ctx.save();
      ctx.drawImage(B, 0, 0);
      const n = 12, e = E.inOutCubic(p);
      for (let i = 0; i < n; i++) {
        const y = ch * i / n, h = ch / n;
        ctx.drawImage(A, 0, y, cw, h, 0, y, cw, h * e);
      }
      ctx.restore();
    },
  },
  checker: {
    name: '棋盘格', dur: 0.42, w: 1,
    draw(ctx, A, B, p, info) {
      const { cw, ch } = info;
      const cols = 8, rows = 6;
      const e = E.inOutCubic(p);
      ctx.save();
      ctx.drawImage(B, 0, 0);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const d = (c / cols + r / rows) / 2;
          const k = Z.clamp((e - d * 0.55) / 0.45);
          if (k <= 0) continue;
          const w = cw / cols, h = ch / rows;
          ctx.drawImage(A, c * w, r * h, w, h, c * w, r * h, w * k, h * k);
        }
      }
      ctx.restore();
    },
  },
  blocks: {
    name: '方块坠补', dur: 0.45, w: 1,
    draw(ctx, A, B, p, info) {
      const { cw, ch, seed } = info;
      const cols = 7, rows = 5;
      const e = E.inOutCubic(p);
      ctx.save();
      ctx.drawImage(B, 0, 0);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const d = Z.rnd(seed | 0, c, r, 1) * 0.4;
          const k = Z.clamp((e - d) / 0.6);
          if (k <= 0) continue;
          const w = cw / cols, h = ch / rows;
          ctx.drawImage(A, c * w, r * h, w, h, c * w, r * h + (1 - k) * ch * 0.4, w, h * k);
        }
      }
      ctx.restore();
    },
  },
  whipPan: {
    name: '甩镜切换', dur: 0.28, w: 1.2,
    draw(ctx, A, B, p, info) {
      const { cw, ch } = info;
      const e = E.inOutCubic(p);
      ctx.save();
      ctx.drawImage(B, cw * (1 - e) * 0.4, 0);
      ctx.globalAlpha = 1 - e;
      for (let i = 0; i < 4; i++) ctx.drawImage(A, -cw * e * 0.5 - i * cw * 0.03 * (1 - e), 0);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = Math.sin(e * Math.PI) * 0.5;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, cw, ch);
      ctx.restore();
    },
  },
  flashCut: {
    name: '闪白切换', dur: 0.3, w: 1.1,
    draw(ctx, A, B, p, info) {
      const { cw, ch } = info;
      ctx.save();
      ctx.drawImage(p < 0.5 ? A : B, 0, 0);
      ctx.globalAlpha = Math.sin(p * Math.PI) * (p < 0.5 ? 1 : 0.75);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, cw, ch);
      ctx.restore();
    },
  },
  mosaicCut: {
    name: '马赛克切换', dur: 0.42, w: 0.9,
    draw(ctx, A, B, p, info) {
      const { cw, ch } = info;
      const e = E.inOutCubic(p);
      ctx.save();
      ctx.drawImage(B, 0, 0);
      const n = Math.max(2, Math.round(20 * (1 - e)));
      const w = cw / n, h = ch / n;
      ctx.globalAlpha = Z.clamp(1 - (e - 0.6) / 0.4);
      ctx.imageSmoothingEnabled = false;
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) ctx.drawImage(A, c * w, r * h, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.restore();
    },
  },
}, 'core');
})();
