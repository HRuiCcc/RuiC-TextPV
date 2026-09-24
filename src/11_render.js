/* ============================================================
   RuiC-TextPV — 渲染管线
   一帧的构成：
     底 → 背景图形 → 【色散三通道 × 相机】→ 文字 → 转场 → HUD → 后处理
   色散（RGB 分离）靠"把同一切镜按不同时间与位移重画三遍"实现：
   通道 A 慢一点、偏右上；通道 B 更慢、偏左下；主通道居中。
   ============================================================ */
(() => {
'use strict';

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; };

Z.cutAt = (plan, t) => {
  const cs = plan.cuts;
  let lo = 0, hi = cs.length - 1, ans = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (cs[m].start <= t) { ans = m; lo = m + 1; } else hi = m - 1;
  }
  if (ans < 0) return null;
  const c = cs[ans];
  return t < c.end ? c : null;
};
/* 拍点上下文：距上一拍多久、这一拍多长、第几拍 */
function beatCtx(beats, t) {
  let lo = 0, hi = beats.length - 1, i = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (beats[m] <= t) { i = m; lo = m + 1; } else hi = m - 1; }
  if (i < 0) return null;
  const len = i + 1 < beats.length ? beats[i + 1] - beats[i] : (i > 0 ? beats[i] - beats[i - 1] : 0.5);
  return { since: t - beats[i], len: Math.max(0.2, len), index: i };
}
function prevBeat(beats, t) {
  let lo = 0, hi = beats.length - 1, ans = null;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (beats[m] <= t) { ans = beats[m]; lo = m + 1; } else hi = m - 1; }
  return ans;
}

class Renderer {
  constructor() {
    this.scratch = mk(2, 2); this.small = mk(2, 2); this.tiny = mk(2, 2);
    this.grain = [];
    for (let k = 0; k < 4; k++) {
      const g = mk(256, 256), x = g.getContext('2d'), id = x.createImageData(256, 256);
      for (let i = 0; i < id.data.length; i += 4) {
        const v = Math.random() * 255;
        id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
        id.data[i + 3] = 255;
      }
      x.putImageData(id, 0, 0);
      this.grain.push(g);
    }
    const sl = mk(1, 4), sx = sl.getContext('2d');
    sx.fillStyle = '#fff'; sx.fillRect(0, 0, 1, 4);
    sx.fillStyle = '#000'; sx.fillRect(0, 3, 1, 1);
    this.scan = sl;
    this.paperCache = new Map();
    this.filterOK = (() => {
      try { const c = mk(4, 4).getContext('2d'); c.filter = 'blur(2px)'; return c.filter === 'blur(2px)'; }
      catch (e) { return false; }
    })();
  }

  /* 纸纹：一次生成带缓存，按画布尺寸取 */
  paper(W, H) {
    const key = W + 'x' + H;
    let p = this.paperCache.get(key);
    if (p) return p;
    const w = Math.round(W / 2), h = Math.round(H / 2);
    p = mk(w, h);
    const x = p.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
    const lo = mk(Math.ceil(w / 24), Math.ceil(h / 24)), lx = lo.getContext('2d'), ld = lx.createImageData(lo.width, lo.height);
    for (let i = 0; i < ld.data.length; i += 4) {
      const v = 225 + Math.random() * 30;
      ld.data[i] = v; ld.data[i + 1] = v - 2; ld.data[i + 2] = v - 6; ld.data[i + 3] = 255;
    }
    lx.putImageData(ld, 0, 0);
    x.imageSmoothingEnabled = true;
    x.globalAlpha = 0.9; x.drawImage(lo, 0, 0, w, h); x.globalAlpha = 1;
    const id = x.getImageData(0, 0, w, h);
    for (let i = 0; i < id.data.length; i += 4) {
      const n2 = (Math.random() - 0.5) * 22;
      id.data[i] += n2; id.data[i + 1] += n2; id.data[i + 2] += n2;
    }
    x.putImageData(id, 0, 0);
    /* 纤维 */
    x.strokeStyle = 'rgba(120,110,100,0.16)'; x.lineWidth = 0.7;
    for (let i = 0; i < 800; i++) {
      const X = Math.random() * w, Y = Math.random() * h, a = Math.random() * Z.TAU, L = 4 + Math.random() * 14;
      x.beginPath(); x.moveTo(X, Y);
      x.quadraticCurveTo(X + Math.cos(a + 0.5) * L / 2, Y + Math.sin(a + 0.5) * L / 2, X + Math.cos(a) * L, Y + Math.sin(a) * L);
      x.stroke();
    }
    x.fillStyle = 'rgba(60,50,40,0.22)';
    for (let i = 0; i < 1300; i++) x.fillRect(Math.random() * w, Math.random() * h, Math.random() * 1.6, Math.random() * 1.6);
    this.paperCache.set(key, p);
    return p;
  }

  ensure(c, w, h) { if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } return c; }

  makeEnv(ctx, plan, cut, sc, o) {
    const W = plan.W, H = plan.H;
    const env = Object.assign({ ctx, W, H, sc, st: plan.style, fx: plan.fx, fps: plan.fps, cut, plan }, o);
    if (cut) {
      env.pIn = Z.clamp(o.lt / Math.max(0.01, cut.inDur));
      env.pOut = cut.outDur > 0 ? Z.clamp((o.lt - (cut.dur - cut.outDur)) / cut.outDur) : 0;
    } else { env.pIn = 1; env.pOut = 0; }
    const ghost = env.pass !== 'main';
    env.aMul = 1;                       // 装饰件做淡入时临时改它
    const colOf = (c, g) => (ghost ? (g === false ? null : env.passColor) : c);
    env.draw = it => Z.drawText(env, it);
    env.rect = (x, y, w, h, c, a = 1, g = true) => {
      const col = colOf(c, g);
      if (!col || a <= 0) return;
      const A = a * env.aMul; if (A <= 0) return; ctx.globalAlpha = A; ctx.fillStyle = col; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;
    };
    env.line = (pts, c, lw = 1, a = 1, g = true) => {
      const col = colOf(c, g);
      if (!col || a <= 0 || pts.length < 2) return;
      const A = a * env.aMul; if (A <= 0) return; ctx.globalAlpha = A; ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke(); ctx.globalAlpha = 1;
    };
    env.polyPartial = (pts, e, c, lw = 1, a = 1, g = true) => {
      if (e <= 0) return;
      let L = 0; const seg = [];
      for (let i = 1; i < pts.length; i++) {
        const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        seg.push(d); L += d;
      }
      let rem = L * Z.clamp(e);
      const out = [pts[0]];
      for (let i = 1; i < pts.length && rem > 0; i++) {
        const d = seg[i - 1];
        if (rem >= d) { out.push(pts[i]); rem -= d; }
        else {
          const k = rem / d;
          out.push([Z.lerp(pts[i - 1][0], pts[i][0], k), Z.lerp(pts[i - 1][1], pts[i][1], k)]);
          rem = 0;
        }
      }
      env.line(out, c, lw, a, g);
    };
    env.circle = (cx, cy, r, fill, stroke, lw = 1, a = 1, g = true) => {
      if (r <= 0 || a <= 0) return;
      const f = fill ? colOf(fill, g) : null, s = stroke ? colOf(stroke, g) : null;
      if (!f && !s) return;
      const A = a * env.aMul; if (A <= 0) return; ctx.globalAlpha = A; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Z.TAU);
      if (f) { ctx.fillStyle = f; ctx.fill(); }
      if (s) { ctx.strokeStyle = s; ctx.lineWidth = lw; ctx.stroke(); }
      ctx.globalAlpha = 1;
    };
    env.arc = (cx, cy, r, a0, a1, c, lw = 1, a = 1, g = true) => {
      const col = colOf(c, g);
      if (!col || a <= 0 || r <= 0) return;
      const A = a * env.aMul; if (A <= 0) return; ctx.globalAlpha = A; ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.arc(cx, cy, r, a0 * Z.DEG, a1 * Z.DEG); ctx.stroke();
      ctx.globalAlpha = 1;
    };
    env.rrect = (x, y, w, h, r, fill, a = 1, g = true, stroke, lw = 1) => {
      if (a <= 0 || w <= 0 || h <= 0) return;
      const f = fill ? (ghost ? colOf(fill, g) : fill) : null, s = stroke ? colOf(stroke, g) : null;
      if (!f && !s) return;
      r = Math.min(r, w / 2, h / 2);
      const A = a * env.aMul; if (A <= 0) return; ctx.globalAlpha = A; ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      if (f) { ctx.fillStyle = f; ctx.fill(); }
      if (s) { ctx.strokeStyle = s; ctx.lineWidth = lw; ctx.stroke(); }
      ctx.globalAlpha = 1;
    };
    env.poly = (pts, c, a = 1, g = true) => {
      const col = colOf(c, g);
      if (!col || a <= 0) return;
      const A = a * env.aMul; if (A <= 0) return; ctx.globalAlpha = A; ctx.fillStyle = col; ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    };
    env.blob = (pts, c, a = 1, g = true) => {
      const col = colOf(c, g);
      if (!col || a <= 0) return;
      const A = a * env.aMul; if (A <= 0) return; ctx.globalAlpha = A; ctx.fillStyle = col; ctx.beginPath();
      const n2 = pts.length;
      const mid = i => [(pts[i % n2][0] + pts[(i + 1) % n2][0]) / 2, (pts[i % n2][1] + pts[(i + 1) % n2][1]) / 2];
      const m0 = mid(0);
      ctx.moveTo(m0[0], m0[1]);
      for (let i = 1; i <= n2; i++) {
        const p = pts[i % n2], m = mid(i);
        ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
      }
      ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    };
    return env;
  }

  /* 装饰件也要"进场"：淡入 + 一点位移，否则像贴上去的静态图层 */
  drawDecor(env, D, d, bb) {
    const cut = env.cut, ctx = env.ctx, lt = env.lt;
    const inD = Math.min(0.34, Math.max(0.14, cut.inDur * 0.8));
    const p = Z.clamp((lt - (d.delay || 0)) / inD);
    const pOut = cut.outDur > 0 ? Z.clamp((lt - (cut.dur - cut.outDur)) / cut.outDur) : 0;
    const k = Z.E.outCubic(p) * (1 - pOut);
    if (k <= 0.01) return;
    const dir = Z.rnd(d.seed | 0, 3) < 0.5 ? -1 : 1;
    const off = (1 - Z.E.outExpo(p)) * env.W * 0.018 * dir;
    const prev = env.aMul;
    env.aMul = prev * k;
    ctx.save();
    ctx.translate(off, (1 - Z.E.outExpo(p)) * env.H * 0.01);
    try { D.draw(env, bb, d); } catch (e) { console.warn('decor', d.id, e); }
    ctx.restore();
    env.aMul = prev;
  }

  drawCut(env) {
    const cut = env.cut;
    const L = Z.LAYOUTS[cut.layout] || Z.LAYOUTS.center;
    const decor = cut.decor || [];
    for (const d of decor) {
      const D = Z.DECOR[d.id];
      if (D && D.layer === 'back') this.drawDecor(env, D, d, null);
    }
    let bb = null;
    try { bb = L.render(env); } catch (e) { console.warn('layout', cut.layout, e); }
    for (const d of decor) {
      const D = Z.DECOR[d.id];
      if (D && D.layer !== 'back') this.drawDecor(env, D, d, bb);
    }
    return bb;
  }

  /* 主入口：把 t 时刻的一帧画进 ctx（canvas 像素 = 设计像素 × scale） */
  frame(ctx, plan, t, opt = {}) {
    const W = plan.W, H = plan.H, scale = opt.scale || 1;
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    const fx = plan.fx, st = plan.style;
    /* 动作量化到 koma 张/秒；随机闪烁最多 24Hz，换 fps 观感不变 */
    const stepDur = Z.stepDur(fx, plan.fps);
    const clock = Z.komaOf(fx) > 0 ? stepDur : 1 / 24;
    const tq = Math.floor(t / stepDur + 1e-6) * stepDur;
    const mainCut = Z.cutAt(plan, tq);
    const sc = st.schemes[mainCut ? mainCut.scheme % st.schemes.length : 0] || st.schemes[0];
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.filter = 'none';
    ctx.clearRect(0, 0, cw, ch);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    /* ---------- 底 ---------- */
    const key = plan.keyBg && Z.KEY_BG[plan.keyBg] ? plan.keyBg : null;
    if (key && !opt.transparent) { ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, W, H); }
    else if (!opt.transparent) {
      ctx.fillStyle = sc.bg; ctx.fillRect(0, 0, W, H);
      const g = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H / 2, Math.hypot(W, H) * 0.6);
      g.addColorStop(0, Z.isDark(sc.bg) ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.10)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const paperAmt = (sc.paper ? 1 : st.texture.paper || 0) * (fx.texture ?? 0.6);
      if (paperAmt > 0.02) {
        ctx.globalCompositeOperation = Z.isDark(sc.bg) ? 'screen' : 'multiply';
        ctx.globalAlpha = Z.isDark(sc.bg) ? paperAmt * 0.06 : paperAmt * 0.85;
        if (Z.isDark(sc.bg)) ctx.filter = 'invert(1)';
        ctx.drawImage(this.paper(W, H), 0, 0, W, H);
        ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
    }

    /* ---------- 相机与色散强度 ---------- */
    const u = H / 1080;
    const events = plan.events;
    let spike = 0, shake = 0, beatPulse = 0;
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (ev.t > t) break;
      const dt = (t - ev.t) * 24;
      if (dt > 14) continue;
      if (ev.type === 'chroma') spike += ev.amp * Math.pow(0.55, dt);
      else if (ev.type === 'shake') shake += ev.amp * Math.pow(0.62, dt);
    }
    if (plan.beats && plan.beats.length) {
      const b = prevBeat(plan.beats, t);
      if (b != null && t - b < 0.25) beatPulse = 0.9 * Math.exp(-(t - b) * 16);
    }
    const age = mainCut ? Math.max(0, tq - mainCut.start) : 1;
    const colorTail = plan.director ? (mainCut && mainCut.emph ? 0.55 : 0.1 + 0.9 * Math.exp(-age * 9)) : 1;
    const chroma = (fx.chroma ?? 0.7) * (st.ghost ?? 1) * (1 + spike + beatPulse) * colorTail;
    const step = Math.floor(tq / clock + 1e-6);
    const beatInfo = plan.beats && plan.beats.length ? beatCtx(plan.beats, tq) : null;
    const energy = plan.energy ? plan.energy[Math.min(plan.energy.length - 1, Math.max(0, Math.floor(t * plan.energyRate)))] : null;

    /* ---------- 背景图形（逐行） ---------- */
    if (!opt.transparent && !key && mainCut && mainCut.bg && mainCut.bg !== 'none' && Z.BG[mainCut.bg]) {
      const env = this.makeEnv(ctx, plan, mainCut, sc, { pass: 'main', t: tq, lt: tq - mainCut.start, ltb: tq - mainCut.start, step, scale, allowFilter: false, energy, beat: beatInfo, bgOnly: true });
      ctx.save();
      try { Z.BG[mainCut.bg].draw(env, mainCut.bgP || {}); } catch (e) { console.warn('bg', mainCut.bg, e); }
      ctx.restore();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    }

    const shx = Z.rsign(step, 71) * shake * 16 * u, shy = Z.rsign(step, 72) * shake * 11 * u;

    /* ---------- 色散三通道 ---------- */
    const passes = [
      { pass: 'B', lag: 1.6 / 24, off: [-3.4 * chroma * u, -1.3 * chroma * u] },
      { pass: 'A', lag: 0.8 / 24, off: [3.2 * chroma * u, 1.9 * chroma * u] },
      { pass: 'main', lag: 0, off: [0, 0] },
    ];
    const ghostOn = chroma > 0.018 && !opt.noGhost;
    const allowFilter = this.filterOK && !opt.fast;

    /* 焦点类相机：整层模糊一次就够，逐字加滤镜会非常慢 */
    let layerBlur = 0, LX = null;
    if (allowFilter && mainCut && Z.CAMERA[mainCut.cam] && mainCut.cam !== 'push') {
      try {
        const e0 = this.makeEnv(ctx, plan, mainCut, sc, { pass: 'main', t: tq, lt: tq - mainCut.start, ltb: tq - mainCut.start, step, scale, allowFilter, energy, beat: beatInfo });
        const c0 = Z.CAMERA[mainCut.cam].get(e0, mainCut.camP || {});
        if (c0 && c0.blur > 0.4) layerBlur = c0.blur;
      } catch (e) {}
      if (layerBlur) {
        const L = this.ensure(this.camLayer || (this.camLayer = mk(2, 2)), cw, ch);
        LX = L.getContext('2d');
        LX.setTransform(1, 0, 0, 1, 0, 0); LX.globalAlpha = 1; LX.globalCompositeOperation = 'source-over'; LX.filter = 'none';
        LX.clearRect(0, 0, cw, ch);
        LX.setTransform(scale, 0, 0, scale, 0, 0);
      }
    }

    for (const P of passes) {
      if (P.pass !== 'main' && !ghostOn) continue;
      const tp = Math.max(0, tq - P.lag);
      const cut = P.lag ? Z.cutAt(plan, tp) : mainCut;
      if (!cut) continue;
      const csc = st.schemes[cut.scheme % st.schemes.length] || st.schemes[0];
      const lt = tp - cut.start;
      const X = LX || ctx;
      const env = this.makeEnv(X, plan, cut, csc, {
        pass: P.pass,
        passColor: P.pass === 'A' ? csc.ghostA : P.pass === 'B' ? csc.ghostB : null,
        t: tp, lt, ltb: lt + P.lag, step: Math.floor(tp / clock + 1e-6),
        scale, allowFilter, energy, beat: beatInfo,
      });
      X.save();
      let cam = null;
      const CD = Z.CAMERA[cut.cam] || Z.CAMERA.push;
      try { cam = CD.get(env, cut.camP || {}); } catch (e) { cam = null; }
      cam = cam || {};
      const cs = cam.s ?? 1;
      X.translate(W / 2 + shx + P.off[0] + (cam.x || 0), H / 2 + shy + P.off[1] + (cam.y || 0));
      if (cam.rot) X.rotate(cam.rot * Z.DEG);
      if (cam.skx) X.transform(1, 0, Math.tan(cam.skx * Z.DEG), 1, 0, 0);
      X.scale(cs * (cam.sx ?? 1), cs * (cam.sy ?? 1));
      X.translate(-W / 2, -H / 2);
      if (this.drawCut(env)) { /* bbox 可能会被 HUD 用到 */ }
      X.restore();
      if (P.pass !== 'main') X.globalAlpha = 1;
    }
    if (LX) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.filter = `blur(${(layerBlur * scale).toFixed(1)}px)`;
      ctx.drawImage(LX.canvas, 0, 0);
      ctx.restore();
    }

    /* ---------- 镜头转场：把上一个镜头的末帧与这一帧合成 ---------- */
    if (!opt.noTrans && mainCut && mainCut.trans && Z.TRANS[mainCut.trans] && mainCut.index > 0) {
      const lt = tq - mainCut.start, dur = mainCut.transDur || 0.35;
      const prev = plan.cuts[mainCut.index - 1];
      if (lt < dur && prev && Math.abs(prev.end - mainCut.start) < 0.06) {
        const A = this.ensure(this.transA || (this.transA = mk(2, 2)), cw, ch);
        const B = this.ensure(this.transB || (this.transB = mk(2, 2)), cw, ch);
        const bx = B.getContext('2d');
        bx.setTransform(1, 0, 0, 1, 0, 0); bx.globalCompositeOperation = 'copy';
        bx.drawImage(ctx.canvas, 0, 0);
        bx.globalCompositeOperation = 'source-over';
        this.frame(A.getContext('2d'), plan, Math.max(prev.start, prev.end - 1e-3), Object.assign({}, opt, { noTrans: true, noPost: true, noHud: true }));
        const psc = st.schemes[prev.scheme % st.schemes.length] || st.schemes[0];
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
        try {
          Z.TRANS[mainCut.trans].draw(ctx, A, B, Z.clamp(lt / dur), {
            cw, ch, sc, scPrev: psc, st, P: mainCut.transP || {}, step, t, scale,
            allowFilter, seed: mainCut.seed | 0,
            tmp: (w, h) => this.ensure(this.transC || (this.transC = mk(2, 2)), w, h),
          });
        } catch (e) { console.warn('trans', mainCut.trans, e); }
        ctx.restore();
      }
    }

    /* ---------- HUD ---------- */
    if (plan.hud && !opt.noHud && !opt.transparent) {
      const env = this.makeEnv(ctx, plan, mainCut, sc, { pass: 'main', t: tq, lt: 0, ltb: 0, step, scale, allowFilter, energy, beat: beatInfo });
      try { Z.drawHUD(env, plan, t); } catch (e) {}
    }
    ctx.restore();

    /* ---------- 后处理 ---------- */
    if (!opt.noPost) this.post(ctx, plan, t, tq, step, sc, scale, opt, allowFilter);
    if (key && !opt.noPost) this.keyFinish(ctx, key, opt);
  }

  post(ctx, plan, t, tq, step, sc, scale, opt, allowFilter) {
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    const st = plan.style;
    const active = plan.events.filter(ev => t >= ev.t && t < ev.t + Math.max(ev.dur, 1 / plan.fps));
    const needScratch = active.some(ev => ['slice', 'block', 'zoom', 'mosaic'].includes(ev.type) || (Z.FX[ev.type] && Z.FX[ev.type].scratch))
      || (!opt.fast && (st.glow || 0) > 0);
    const S = needScratch ? this.ensure(this.scratch, cw, ch) : null;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const copy = () => {
      const sx = S.getContext('2d');
      sx.globalCompositeOperation = 'copy'; sx.drawImage(ctx.canvas, 0, 0); sx.globalCompositeOperation = 'source-over';
    };
    const clock24 = Math.floor(t * 24);
    for (const ev of active) {
      const k = (t - ev.t) / Math.max(ev.dur, 1e-3);
      const D = Z.FX[ev.type];
      if (D && D.draw) {
        if (D.scratch) copy();
        try {
          D.draw(ctx, ev, k, {
            cw, ch, S, sc, st, step: clock24, t, scale, renderer: this, allowFilter, opt,
            tmp: (w, h) => this.ensure(this.tiny, w, h),
            tmp2: (w, h) => this.ensure(this.small2 || (this.small2 = mk(2, 2)), w, h),
          });
        } catch (e) { console.warn('fx', ev.type, e); }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
        ctx.imageSmoothingEnabled = true;
        continue;
      }
      /* ---- 内置的几种 ---- */
      if (ev.type === 'slice') {
        copy();
        const n = 6 + (Z.h(clock24, 3) % 7);
        let y = 0;
        for (let i = 0; i < n && y < ch; i++) {
          const h = Math.max(2, ch * Z.rrange(0.01, 0.12, clock24, i, 1));
          const dx = Z.rnd(clock24, i, 2) < 0.55 ? Z.rsign(clock24, i, 3) * cw * 0.06 * ev.amp : 0;
          if (dx) ctx.drawImage(S, 0, y, cw, h, dx, y, cw, h);
          y += h + ch * Z.rrange(0, 0.08, clock24, i, 4);
        }
      } else if (ev.type === 'block') {
        copy();
        for (let i = 0; i < 9; i++) {
          const w = cw * Z.rrange(0.05, 0.3, clock24, i, 5), h = ch * Z.rrange(0.01, 0.07, clock24, i, 6);
          const x = Z.rnd(clock24, i, 7) * (cw - w), y = Z.rnd(clock24, i, 8) * (ch - h);
          const sx = Z.clamp(x + Z.rsign(clock24, i, 9) * cw * 0.08, 0, cw - w);
          const sy = Z.clamp(y + Z.rsign(clock24, i, 10) * ch * 0.04, 0, ch - h);
          ctx.drawImage(S, sx, sy, w, h, x, y, w, h);
          if (Z.rnd(clock24, i, 11) < 0.35) {
            ctx.globalCompositeOperation = 'difference';
            ctx.fillStyle = Z.rnd(clock24, i, 12) < 0.5 ? sc.ghostA : sc.ghostB;
            ctx.fillRect(x, y, w, h);
            ctx.globalCompositeOperation = 'source-over';
          }
        }
      } else if (ev.type === 'invert') {
        ctx.globalCompositeOperation = 'difference';
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cw, ch);
        ctx.globalCompositeOperation = 'source-over';
      } else if (ev.type === 'flash') {
        ctx.globalAlpha = Math.pow(1 - k, 1.5) * 0.92;
        ctx.fillStyle = Z.isDark(sc.bg) ? sc.fg : '#ffffff';
        ctx.fillRect(0, 0, cw, ch);
        ctx.globalAlpha = 1;
      } else if (ev.type === 'zoom') {
        copy();
        const a = ev.amp * (1 - k);
        for (let i = 1; i <= 6; i++) {
          const s = 1 + i * 0.022 * a;
          ctx.globalAlpha = 0.2 * (1 - i / 7) * Math.min(1, a * 1.3);
          ctx.drawImage(S, cw / 2 - cw * s / 2, ch / 2 - ch * s / 2, cw * s, ch * s);
        }
        ctx.globalAlpha = 1;
      } else if (ev.type === 'mosaic') {
        copy();
        const T = this.ensure(this.tiny, Math.max(8, Math.round(cw / 42)), Math.max(8, Math.round(ch / 42)));
        const tx = T.getContext('2d');
        tx.imageSmoothingEnabled = true;
        tx.drawImage(S, 0, 0, T.width, T.height);
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = 0.85 * (1 - k);
        ctx.drawImage(T, 0, 0, cw, ch);
        ctx.globalAlpha = 1;
        ctx.imageSmoothingEnabled = true;
      }
    }
    /* ---- 泛光 ---- */
    const glow = (st.glow || 0.6) * 0.5 * (plan.fx.texture ?? 0.6);
    if (!opt.fast && allowFilter && glow > 0.05 && !opt.transparent) {
      const sw = Math.round(cw / 4), sh2 = Math.round(ch / 4);
      const Sm = this.ensure(this.small, sw, sh2), sx = Sm.getContext('2d');
      sx.filter = `blur(${Math.max(2, Math.round(sw / 160))}px)`;
      sx.globalCompositeOperation = 'copy';
      sx.drawImage(ctx.canvas, 0, 0, sw, sh2);
      sx.filter = 'none'; sx.globalCompositeOperation = 'source-over';
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = glow * 0.55;
      ctx.drawImage(Sm, 0, 0, cw, ch);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    if (!opt.transparent && !plan.keyBg) {
      const texAmt = plan.fx.texture ?? 0.6;
      /* 扫描线 */
      const scan = (st.texture.scan || 0) * texAmt;
      if (scan > 0.03) {
        const pat = ctx.createPattern(this.scan, 'repeat');
        const k2 = Math.max(1, Math.round(ch / 540));
        ctx.save(); ctx.scale(k2, k2);
        ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = scan * 0.28;
        ctx.fillStyle = pat; ctx.fillRect(0, 0, cw / k2, ch / k2);
        ctx.restore();
      }
      /* 颗粒 */
      const gr = (st.texture.grain || 0) * texAmt;
      if (gr > 0.02) {
        const img = this.grain[((step % 4) + 4) % 4];
        const pat = ctx.createPattern(img, 'repeat');
        const k2 = Math.max(1, ch / 1080);
        const ox = Z.rnd(step, 1) * 256, oy = Z.rnd(step, 2) * 256;
        ctx.save(); ctx.scale(k2, k2); ctx.translate(-ox, -oy);
        ctx.fillStyle = pat;
        ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = gr * 0.2;
        ctx.fillRect(0, 0, cw / k2 + 256, ch / k2 + 256);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = gr * 0.035;
        ctx.fillRect(0, 0, cw / k2 + 256, ch / k2 + 256);
        ctx.restore();
      }
      /* 暗角 */
      const vg = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.35, cw / 2, ch / 2, Math.hypot(cw, ch) * 0.62);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, `rgba(0,0,0,${0.28 * texAmt})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, cw, ch);
    }
    ctx.restore();
  }

  /* 合成素材用背景：把成品帧去色，黑色的部分留给抠像 */
  keyFinish(ctx, key, opt) {
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.filter = 'none';
    if (opt.transparent) {
      const S = this.ensure(this.scratch, cw, ch);
      const sx = S.getContext('2d');
      sx.setTransform(1, 0, 0, 1, 0, 0);
      sx.globalAlpha = 1;
      sx.globalCompositeOperation = 'copy';
      if (this.filterOK) { sx.filter = 'grayscale(1)'; sx.drawImage(ctx.canvas, 0, 0); sx.filter = 'none'; }
      else {
        sx.drawImage(ctx.canvas, 0, 0);
        sx.globalCompositeOperation = 'saturation';
        sx.fillStyle = '#808080'; sx.fillRect(0, 0, cw, ch);
        sx.globalCompositeOperation = 'destination-in';
        sx.drawImage(ctx.canvas, 0, 0);
      }
      sx.globalCompositeOperation = 'source-over';
      ctx.globalCompositeOperation = 'copy';
      ctx.drawImage(S, 0, 0);
    } else {
      /* 用 saturation 混合任意灰，只去色不改亮度 */
      ctx.globalCompositeOperation = 'saturation';
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, cw, ch);
      if (key === 'green') {
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = Z.KEY_BG.green;
        ctx.fillRect(0, 0, cw, ch);
      }
    }
    ctx.restore();
  }
}
Z.Renderer = Renderer;

/* ============================================================
   画面内 HUD（时码 / 镜头信息 / 风格 / 种子）
   ============================================================ */
Z.drawHUD = (env, plan, t) => {
  const W = env.W, H = env.H, sc = env.sc;
  const u = Math.min(W, H) / 1000;
  const pad = 24 * u;
  const size = 20 * u;
  const col = sc.sub;
  const a = 0.85;
  const ctx = env.ctx;
  ctx.save();
  ctx.globalAlpha = a;
  /* 左下：品牌 + 时码 */
  Z.drawText(env, {
    text: 'RuiC-TextPV', font: 'mono', size: size * 1.05, align: 'left', x: pad, y: H - pad - size * 0.6,
    color: sc.fg, alpha: 0.55, enter: 'cut', exit: 'cut', hold: 'still', seed: 1,
  });
  Z.drawText(env, {
    text: `${Z.fmtTime(t, plan.fps)}  /  ${Z.fmtTime(plan.duration, plan.fps)}`, font: 'mono', size: size * 0.9,
    align: 'left', x: pad, y: H - pad - size * 2.0, color: col, alpha: 0.5,
    enter: 'cut', exit: 'cut', hold: 'still', seed: 2,
  });
  /* 右下：风格 + 种子 */
  const cut = Z.cutAt(plan, t);
  const info = cut ? `#${String(cut.index + 1).padStart(3, '0')}  ${Z.LAYOUTS[cut.layout] ? Z.LAYOUTS[cut.layout].name : cut.layout}` : '';
  Z.drawText(env, {
    text: info, font: 'mono', size: size * 0.9, align: 'right', x: W - pad, y: H - pad - size * 0.6,
    color: col, alpha: 0.5, enter: 'cut', exit: 'cut', hold: 'still', seed: 3,
  });
  Z.drawText(env, {
    text: `SEED ${plan.seed}  ${plan.fps}fps  ${plan.W}x${plan.H}`, font: 'mono', size: size * 0.9,
    align: 'right', x: W - pad, y: H - pad - size * 2.0, color: col, alpha: 0.4,
    enter: 'cut', exit: 'cut', hold: 'still', seed: 4,
  });
  /* 右上：合成背景提示 */
  if (plan.keyBg) {
    Z.drawText(env, {
      text: plan.keyBg === 'green' ? '绿幕素材' : '黑幕素材', font: 'mono', size: size * 1.1,
      align: 'right', x: W - pad, y: pad + size, color: sc.fg, alpha: 0.8,
      enter: 'cut', exit: 'cut', hold: 'still', seed: 5,
    });
  }
  ctx.restore();
};
})();
