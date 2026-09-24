/* ============================================================
   RuiC-TextPV — 布局库 + 单个文字元素的绘制主流程
   布局的职责：把一段歌词摆到画面里，画出来，并返回主文字的包围盒
   （包围盒会交给装饰件挂靠，比如引出线、坐标圆、箭头）。
   ============================================================ */
(() => {
'use strict';
const E = Z.E;

/* ---------------- 单个文字元素的主流程 ----------------
   入场 → 保持 → 退场 → 文字加工 → 绘制 */
Z.mainDraw = (env, it) => {
  const cut = env.cut;
  it.seed = it.seed != null ? it.seed : Z.h(cut.seed, (it.mi | 0) + 1, 7);
  it.charFns = []; it.pieceFns = [];
  it.delay = (it.mi | 0) * (cut.stagger || 0);
  const ctx = { dur: cut.dur, inDur: cut.inDur, outDur: cut.outDur };
  const lt0 = env.lt;
  const ltI = lt0 - it.delay;
  const pIn = Z.clamp(ltI / Math.max(0.01, cut.inDur));
  const outStart = cut.dur - cut.outDur;
  const pOut = cut.outDur > 0 ? Z.clamp((lt0 - outStart) / cut.outDur) : 0;
  const en = Z.ENTER[it.enter || cut.enter] || Z.ENTER.cut;
  const ex = Z.EXIT[it.exit || cut.exit] || Z.EXIT.cut;
  const ho = Z.HOLD[it.hold || cut.hold] || Z.HOLD.still;
  /* 文字加工（描边 / 立体 / 霓虹…）；自己画底板的布局可以用 plain 关掉 */
  const treatKey = it.treat || cut.treat;
  if (treatKey && !it.plain && Z.TREAT[treatKey]) {
    try { Z.TREAT[treatKey].apply(env, it, cut.treatP || {}); } catch (e) { console.warn('treat', treatKey, e); }
  }
  if (ltI < 0 && en === Z.ENTER.cut) return null;
  if (en !== Z.ENTER.cut && (pIn < 1 || en.pieces)) { env.lt = ltI; en.apply(env, it, pIn, ctx); env.lt = lt0; }
  if (ltI < 0 && !en.pieces) return null;
  const amt = Z.clamp((ltI - cut.inDur * 0.85) / 0.25) * (1 - pOut);
  if (amt > 0 && !it.noHold) ho.apply(env, it, amt, ctx);
  if (pOut > 0 && ex !== Z.EXIT.cut) ex.apply(env, it, pOut, ctx);
  /* 写字感：印刷体与手排体的分界就在这一步 */
  if (!it.noLettering && !it.vertical) {
    const lamt = it.lettering != null ? it.lettering : (env.fx.lettering ?? 0.55);
    if (lamt > 0.02) it.charFns.push(Z.letterFn(env, it.seed | 0, lamt, it.size));
    /* 整块偶尔歪两三度：是"贴上去的"，不是"排出来的" */
    if (lamt > 0.25 && Z.rnd(it.seed | 0, 31) < 0.4 * lamt) {
      it.rot = (it.rot || 0) + Z.rsign(it.seed | 0, 32) * 3.4 * lamt;
    }
  }
  it.charFn = Z.combineChar(it.charFns);
  it.pieceFn = Z.combinePiece(it.pieceFns);
  return Z.drawFx(env, it);
};

/* ---------------- 绘制：切片 / 遮罩 / 残影 / 拖尾 / 光标 ---------------- */
Z.drawFx = (env, it) => {
  const ctx = env.ctx;
  let bb = null;
  const draw = () => {
    if (it.streak && it.streak.a > 0.01) {
      for (let k = it.streak.n; k >= 1; k--) {
        const c = Object.assign({}, it, {
          x: it.x + it.streak.dx * k, y: it.y + (it.streak.dy || 0) * k,
          alpha: (it.alpha ?? 1) * it.streak.a * (1 - k / (it.streak.n + 1)),
          pieceFn: null, streak: null, echo: null, pre: null, post: null, shadow: null, extrude: null,
        });
        Z.drawText(env, c);
      }
    }
    if (it.echo && it.echo.n > 0) {
      const E0 = it.echo;
      for (let k = E0.n; k >= 1; k--) {
        const c = Object.assign({}, it, {
          x: it.x + (E0.dx || 0) * k, y: it.y + (E0.dy || 0) * k,
          size: it.size * Math.pow(E0.scale || 1, k), rot: (it.rot || 0) + (E0.rot || 0) * k,
          alpha: (it.alpha ?? 1) * (E0.a ?? 0.5) * Math.pow(E0.decay ?? 0.7, k - 1),
          pieceFn: null, streak: null, echo: null, pre: null, post: null, shadow: null, extrude: null,
          pattern: null, gradient: null, color: E0.color || it.color, _lay: null, _m: null,
        });
        if (E0.outline) Object.assign(c, { fill: false, stroke: Math.max(1, it.size * 0.012), strokeColor: E0.color || it.color });
        Z.drawText(env, c);
      }
    }
    const r = Z.drawText(env, it);
    if (r) bb = r;
  };
  if (it.pre) { try { it.pre(env, it); } catch (e) { console.warn(e); } }
  const clips = [];
  if (it.clip) { clips.push(() => { ctx.rect(it.clip[0], -env.H, it.clip[1] - it.clip[0], env.H * 3); }); }
  if (it.clipY) { clips.push(() => { ctx.rect(-env.W, it.clipY[0], env.W * 3, it.clipY[1] - it.clipY[0]); }); }
  if (it.clipBands) { clips.push(() => { for (const [y0, y1] of it.clipBands) ctx.rect(-env.W * 2, y0, env.W * 4, y1 - y0); }); }
  if (it.clipFn) { clips.push(() => it.clipFn(ctx, env, it)); }
  let clipped = false;
  if (clips.length) { ctx.save(); ctx.beginPath(); for (const f of clips) f(); ctx.clip(); clipped = true; }
  if (it.vbands) {
    for (const vb of it.vbands) {
      const [x0, x1, dy, rot] = vb;
      ctx.save(); ctx.beginPath(); ctx.rect(x0, -env.H * 2, x1 - x0, env.H * 5); ctx.clip();
      ctx.translate((x0 + x1) / 2, it.y);
      if (rot) ctx.rotate(rot * Z.DEG);
      ctx.translate(-(x0 + x1) / 2, -it.y + dy);
      draw(); ctx.restore();
    }
  } else if (it.bands) {
    for (const [y0, y1, dx] of it.bands) {
      ctx.save(); ctx.beginPath(); ctx.rect(-env.W * 2, y0, env.W * 5, y1 - y0); ctx.clip(); ctx.translate(dx, 0); draw(); ctx.restore();
    }
    const lo = it.bands[0][0], hi = it.bands[it.bands.length - 1][1];
    ctx.save(); ctx.beginPath();
    ctx.rect(-env.W * 2, -env.H * 3, env.W * 5, lo + env.H * 3);
    ctx.rect(-env.W * 2, hi, env.W * 5, env.H * 4);
    ctx.clip(); draw(); ctx.restore();
  } else draw();
  if (clipped) ctx.restore();
  /* 揭示边缘的发光带 */
  if (it.edgeGlow) {
    const g = it.edgeGlow;
    const grd = ctx.createLinearGradient(0, g.y - g.h, 0, g.y + g.h);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.5, Z.rgba(env.sc.accent, 0.85 * (g.soft || 1)));
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save();
    if (env.pass !== 'main') { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = env.passColor; ctx.globalAlpha = 0.5 * (g.soft || 1); }
    else ctx.fillStyle = grd;
    ctx.fillRect(g.x - g.w / 2, g.y - g.h, g.w, g.h * 2);
    ctx.restore();
  }
  if (it.wipeBar) {
    const w = Math.max(8, it.size * (it.wipeBar.ink ? 0.09 : 0.07));
    const h = it.wipeBar.h;
    if (it.wipeBar.ink) {
      ctx.save();
      const col = env.pass !== 'main' ? env.passColor : env.sc.fg;
      ctx.globalAlpha = env.pass !== 'main' ? 0.6 : 0.9;
      ctx.fillStyle = col;
      const bx = it.wipeBar.x, bh = h * 0.22;
      ctx.beginPath();
      ctx.moveTo(bx - w * 0.4, it.y - h / 2);
      ctx.quadraticCurveTo(bx + w * 1.5, it.y - h * 0.1, bx + w * 0.3, it.y + bh);
      ctx.quadraticCurveTo(bx - w * 0.6, it.y + h * 0.4, bx - w * 0.4, it.y - h / 2);
      ctx.fill();
      ctx.restore();
    } else {
      env.rect(it.wipeBar.x - w / 2, it.y - h / 2, w, h, env.sc.accent, 1, false);
    }
  }
  if (it.cursorAt != null && it.cursorAt >= 0) {
    const m = it._m || Z.measure(it);
    const blink = it.cursorAt >= m.lay.N ? (env.step % 2 === 0) : true;
    if (blink) {
      let x;
      if (bb && bb.boxes.length) { const last = bb.boxes[bb.boxes.length - 1]; x = it.x + last.x + last.w / 2 + it.size * 0.08; }
      else x = it.align === 'left' ? it.x : it.x - m.w / 2;
      env.rect(x, it.y - it.size * 0.45, it.size * 0.5, it.size * 0.9, env.sc.accent, 1);
    }
  }
  if (it.post) { try { it.post(env, it, bb); } catch (e) { console.warn(e); } }
  /* post2 = 画在文字"上面"的覆盖层（流光、光团吞没这类） */
  if (it.post2) { try { it.post2(env, it, bb); } catch (e) { console.warn(e); } }
  return bb;
};


/* ============================================================
   排版工具箱
   下面这几个装置决定画面"像不像文字 PV"，
   比排得齐不齐重要得多。
   ============================================================ */
Z.unionBB = (a, b) => {
  if (!a) return b;
  if (!b) return a;
  return {
    x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1),
    boxes: [], cx: (Math.min(a.x0, b.x0) + Math.max(a.x1, b.x1)) / 2,
    cy: (Math.min(a.y0, b.y0) + Math.max(a.y1, b.y1)) / 2,
  };
};

/* 按字类给字号：汉字最大、假名小、标点更小。
   一行字如果每个都同大，就会像印刷品。 */
Z.charScale = (ch, seed, i) => {
  if (Z.isHan(ch)) return 1;
  if (Z.isKata(ch)) return 0.88;
  if (Z.isLatin(ch)) return 0.8;
  if (Z.isPunct(ch)) return 0.42;
  if (Z.isHira(ch)) return (Z.isSmallKana(ch) ? 0.42 : 0.5) + Z.rnd(seed, i, 3) * 0.16;
  return 0.72;
};
/* 抽一个"被挑出来"的字：优先落在假名或标点上，这样看着像刻意改了一笔 */
Z.accentPick = (chars, seed) => {
  const soft = [];
  for (let i = 0; i < chars.length; i++) if (!Z.isHan(chars[i])) soft.push(i);
  const pool = soft.length ? soft : chars.map((_, i) => i);
  return pool[Math.floor(Z.rnd(seed, 21) * pool.length) % pool.length];
};


/* 写字感：给每个字加极小的旋转、高低、大小差别；偶尔挑一个字变色。
   amt = 0 完全方正；amt = 1 接近手写涂鸦。 */
Z.letterFn = (env, seed, amt, size) => {
  const rotA = 6.5 * amt, dyA = 0.06 * amt * size, sA = 0.085 * amt, dxA = 0.028 * amt * size;
  const colorChance = 0.18 * amt;
  return (i) => {
    const o = {
      rot: Z.rsign(seed, i, 11) * rotA + Math.sin(i * 0.9 + (seed % 7)) * rotA * 0.45,
      dy: Z.rsign(seed, i, 12) * dyA + Math.sin(i * 1.3 + (seed % 5)) * dyA * 0.5,
      dx: Z.rsign(seed, i, 14) * dxA,
      s: 1 + (Z.rsign(seed, i, 13) * 0.55 + Math.sin(i * 0.7) * 0.45) * sA,
    };
    if (colorChance > 0.01 && Z.rnd(seed, i, 15) < colorChance) {
      o.color = Z.rnd(seed, i, 16) < 0.55 ? env.sc.accent : (env.sc.ghostA || env.sc.accent);
    }
    return o;
  };
};

/* ------------------------------------------------------------
   逐字摆开：每个字有自己的字号、高低、旋转、颜色
   opt:
     text 内容 / font 字体 / maxW maxH 可用范围
     sx 横向拉伸 / track 字距（em）/ mode 基线(line|stair|wave|arch)
     rotAmp 逐字旋转幅度（度）/ sizeJit 字号抖动 / uniform 关闭大小混排
     accentIdx 指定重点字 / noAccent 不挑重点字
     ox oy 整块偏移（相对画面的比例）/ x y 直接指定中心
     enter exit hold treat 逐字的演出覆盖
     copy 副本：{ kind:'outline'|'dim', dx, dy, alpha }
   ------------------------------------------------------------ */
Z.charRun = (env, o) => {
  const sc = env.sc;
  const chars = [...String(o.text || '').replace(/[\s\u3000]+/g, '')];
  if (!chars.length) return null;
  const n = chars.length;
  const seed = o.seed != null ? o.seed : (env.cut.seed | 0);
  const track = o.track || 0;
  const sx = o.sx || 1;
  const scales = o.uniform
    ? chars.map(() => 1)
    : chars.map((ch, i) => Z.charScale(ch, seed, i) * (o.sizeJit ? 1 + Z.rsign(seed, i, 8) * o.sizeJit : 1));
  let unit = 0;
  const adv = chars.map((ch, i) => { const a = Z.glyphs.advance(o.font, ch, 1) * scales[i] + track; unit += a; return a; });
  const base = Math.min((o.maxW || env.W * 0.86) / Math.max(0.001, unit * sx), o.maxH || env.H * 0.42);
  const mode = o.mode || 'line';
  const rotAmp = o.rotAmp || 0;
  const cx = (o.x != null ? o.x : env.W / 2) + (o.ox || 0) * env.W;
  const cy = (o.y != null ? o.y : env.H / 2) + (o.oy || 0) * env.H;
  const accentIdx = o.noAccent ? -1 : (o.accentIdx != null ? o.accentIdx : Z.accentPick(chars, seed));
  let x = cx - unit * base * sx / 2;
  let bb = null;
  chars.forEach((ch, i) => {
    const size = base * scales[i];
    let y = cy;
    if (mode === 'stair') y += (i - (n - 1) / 2) * base * 0.13;
    else if (mode === 'wave') y += Math.sin(i * 1.1) * base * 0.11;
    else if (mode === 'arch') y -= (1 - Math.abs(i - (n - 1) / 2) / Math.max(1, (n - 1) / 2)) * base * 0.14;
    y += Z.rsign(seed, i, 5) * base * 0.055;
    const it = {
      text: ch, font: (o.fontAlt && Z.rnd(seed, i, 4) < 0.55) ? o.fontAlt : o.font, size, sx,
      x: x + adv[i] * base * sx / 2, y,
      rot: Z.rsign(seed, i, 6) * rotAmp + (o.rotWave ? Math.sin(i * 0.8) * rotAmp * 0.5 : 0),
      color: (i === accentIdx && !o.noAccent) ? sc.accent : (o.color || sc.fg),
      mi: i, seed: Z.h(seed, i, 41),
      enter: o.enter, exit: o.exit, hold: o.hold, treat: o.treat, lettering: 0,
      noLettering: true,
    };
    /* 侧边副本：整行复写在旁边，描边或压暗 */
    if (o.copy) {
      const cp = { dx: (o.copy.dx != null ? o.copy.dx : 1.75) * base, dy: (o.copy.dy || 0) * base, ...o.copy };
      it.echo = { n: 1, dx: cp.dx, dy: cp.dy, a: cp.alpha != null ? cp.alpha : 0.5, decay: 1 };
      if (cp.kind === 'outline') Object.assign(it.echo, { outline: true, color: sc.sub });
      else it.echo.color = sc.sub;
    }
    if (o.outline) { it.fill = false; it.stroke = Math.max(1.2, size * 0.014); it.strokeColor = o.color || sc.fg; }
    bb = Z.unionBB(bb, Z.mkItem(env, it));
    x += adv[i] * base * sx;
  });
  return bb;
};

/* ------------------------------------------------------------
   微字散点：在画面上下撒上一句的小字副本，带随机旋转
   最能造出"编辑感"的一个装置
   ------------------------------------------------------------ */
Z.extrasText = (env, o = {}) => {
  const sc = env.sc, W = env.W, H = env.H, s = env.cut.seed | 0, lb = env.ltb;
  const k = o.count || 9;
  const font = o.font || (env.st.fonts.body && env.st.fonts.body[0]) || 'sans_med';
  for (let i = 0; i < k; i++) {
    const ap = Z.rnd(s, i, 81) * env.cut.dur * 0.5;
    if (lb < ap) continue;
    const top = Z.rnd(s, i, 82) < 0.5;
    Z.mkItem(env, {
      text: o.text, font, size: Z.rrange(H * 0.021, H * 0.046, s, i, 83),
      x: Z.rrange(W * 0.06, W * 0.94, s, i, 84),
      y: top ? Z.rrange(H * 0.06, H * 0.27, s, i, 85) : Z.rrange(H * 0.73, H * 0.94, s, i, 85),
      rot: Z.rsign(s, i, 86) * 20,
      color: Z.rnd(s, i, 87) < 0.22 ? sc.accent : sc.sub,
      alpha: 0.8, ghost: false, noLettering: true,
      enter: 'fade', exit: 'fade', hold: 'still', inDur: 0.3, outDur: 0.25, mi: i,
      seed: Z.h(s, i, 88),
    });
  }
};

/* ------------------------------------------------------------
   背景字行：整屏滚动的小字行，隔行反向，随机抽掉几行
   主文字压在它上面就立刻有了层次
   ------------------------------------------------------------ */
Z.bgRowsText = (env, o = {}) => {
  const sc = env.sc, W = env.W, H = env.H, lb = env.ltb, s = env.cut.seed | 0;
  const rows = o.rows || 13;
  const rowH = H / rows, ts = rowH * (o.fill || 0.7);
  const unit = String(o.text || '') + '\u3000';
  const font = o.font || (env.st.fonts.body && env.st.fonts.body[0]) || 'sans_med';
  const period = Math.max(1, Z.measureText({ text: unit, font, size: ts, track: 0.02 }).w);
  const reps = Math.ceil(W * 2.2 / period) + 2;
  for (let r = 0; r <= rows; r++) {
    const ap = Z.rnd(s, r, 91) * env.cut.inDur * 1.6;
    if (lb < ap) continue;
    if (o.flicker !== false && Z.rnd(s, env.step, r, 92) < 0.13) continue;
    const dir = r % 2 ? 1 : -1;
    const off = (((r % 2) * period * 0.5 + lb * (o.speed || 22) * dir) % period + period) % period;
    Z.drawText(env, {
      text: unit.repeat(reps), font, size: ts, track: 0.02, align: 'left',
      x: -period + off - period * 0.5, y: (r + 0.5) * rowH,
      color: o.color === 'accent' ? sc.accent : sc.sub,
      alpha: (o.alpha != null ? o.alpha : 0.4) * Z.clamp((lb - ap) / 0.1),
      ghost: false, enter: 'cut', exit: 'cut', hold: 'still', noLettering: true,
    });
  }
};

/* 文字雨用的假名池 */
Z.KANA_POOL = '\u30a2\u30a4\u30a6\u30a8\u30aa\u30ab\u30ad\u30af\u30b1\u30b3\u30b5\u30b7\u30b9\u30bb\u30bd\u30bf\u30c1\u30c4\u30c6\u30c8\u30ca\u30cb\u30cc\u30cd\u30ce\u30cf\u30d2\u30d5\u30d8\u30db';
Z.poolKana = () => Z.KANA_POOL;

/* 挖版：文字底下垫一块实色版，字挖成背景色 —— 满屏平铺的"色块行"做法 */
Z.knockout = (env, it, color) => {
  const box = Z.itemBox(it);
  env.rect(box.x0 - it.size * 0.32, box.y0 - it.size * 0.18, box.w + it.size * 0.64, box.h + it.size * 0.36, color || env.sc.ink, 1, false);
};

/* 把文字元素按当前镜头配置好（字体/颜色/入场等），交给 mainDraw */
Z.mkItem = (env, o) => {
  const c = env.cut, p = c.params || {};
  const it = Object.assign({
    font: Z.pickFont(env, o.font, o.role || 'display'),
    size: 100, track: 0, lead: 1.32, align: 'center', vertical: false,
    x: env.W / 2, y: env.H / 2, rot: 0, alpha: 1, color: env.sc.fg,
    enter: c.enter, exit: c.exit, hold: c.hold, treat: c.treat,
  }, o);
  if (o.seed == null) it.seed = Z.h(c.seed, (o.mi | 0) + 1, 7);
  return Z.mainDraw(env, it);
};
Z.pickFont = (env, key, role = 'display') => {
  if (key && Z.FONTS[key]) return key;
  const list = (env.st.fonts && env.st.fonts[role]) || ['sans_bold'];
  return list[(Z.sid(String(env.cut && env.cut.seed)) + role.length) % list.length] || 'sans_bold';
};
/* 文字加工可能要求强制某种字体（如霓虹用黑体） */
Z.fontIn = (list, key, fallback = 'sans_bold') => (key && list.includes(key) ? key : (list[0] || fallback));

const portraitOf = (env) => env.H > env.W;
const splitLines = (text, maxPer) => Z.splitLines(text, maxPer);

/* 把长句切成平衡的几行，优先在语义/假名边界断 */
Z.splitLines = (text, maxPer) => {
  const arr = [...String(text)];
  if (arr.length <= maxPer) return text;
  const nLines = Math.ceil(arr.length / maxPer);
  const per = arr.length / nLines;
  const out = []; let start = 0;
  for (let l = 1; l < nLines; l++) {
    const target = Math.round(per * l);
    let best = target, bestScore = -1;
    for (let k = Math.max(start + 1, target - 3); k <= Math.min(arr.length - 1, target + 3); k++) {
      const a = arr[k - 1], b = arr[k];
      let s = 3 - Math.abs(k - target);
      if (Z.isHira(a) && !Z.isHira(b)) s += 3;
      if (Z.isPunct(a) || a === ' ' || a === '\u3000') s += 5;
      if (Z.isSmallKana(b) || '\u30fc\u3063\u3001\u3002'.includes(b)) s -= 6;
      if (s > bestScore) { bestScore = s; best = k; }
    }
    out.push(arr.slice(start, best).join('').trim());
    start = best;
  }
  out.push(arr.slice(start).join('').trim());
  return out.filter(Boolean).join('\n') || text;
};

/* ============================================================
   布局
   ============================================================ */
Z.registerAll('layout', {
  /* ---------- 基础 ---------- */
  center: {
    name: '居中', w: 1.6, emph: 2, portrait: 1.2,
    fits: n => n <= 14,
    plan(rng, info, st) {
      return {
        font: rng.pick(rng.chance(0.3) ? st.fonts.serif : st.fonts.display),
        sx: rng.pick([1, 1, 1.18, 1.42, 0.82]), track: rng.range(0.02, 0.16),
        ox: rng.range(-0.05, 0.05), oy: rng.range(-0.06, 0.06),
        mode: rng.pick(['line', 'line', 'line', 'arch', 'stair']),
        accent: rng.chance(0.55), under: rng.chance(0.35), sub: rng.chance(0.45),
        extras: rng.chance(0.5), rotAmp: rng.range(0.4, 3.5),
      };
    },
    render(env) {
      const P = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      if (P.extras) Z.extrasText(env, { text: env.cut.lineText || env.cut.text });
      const bb = Z.charRun(env, {
        text: env.cut.text, font: P.font, sx: P.sx, track: P.track,
        maxW: W * 0.84, maxH: H * 0.34, uniform: true,
        mode: P.mode, rotAmp: P.rotAmp, ox: P.ox, oy: P.oy, noAccent: !P.accent,
      });
      if (bb && P.sub && env.cut.lineText && env.cut.lineText !== env.cut.text) {
        Z.mkItem(env, {
          text: env.cut.lineText, font: env.st.fonts.body[0], size: Z.clamp(H * 0.026, 16, 34),
          x: W / 2 + P.ox * W, y: bb.y1 + H * 0.075, track: 0.22, color: sc.sub,
          alpha: Z.E.outCubic(env.pIn), noLettering: true, mi: 3,
        });
      }
      if (bb && P.under) {
        const e = Z.E.outExpo(env.pIn * 1.2 - 0.2), o = Z.E.inCubic(env.pOut);
        if (e > 0 && o < 1) {
          const y = bb.y1 + (bb.y1 - bb.y0) * 0.22;
          env.line([[Z.lerp(bb.x0, bb.x1, o), y], [Z.lerp(bb.x0, bb.x1, e), y]], sc.accent, Math.max(2, (bb.y1 - bb.y0) * 0.06), 1);
        }
      }
      return bb;
    },
  },
  huge: {
    name: '巨型字', w: 1.3, emph: 2.4, portrait: 1.4,
    fits: n => n <= 8,
    plan(rng, info, st) {
      return {
        font: rng.pick(st.fonts.display), sx: rng.pick([1, 1, 1.15, 1.35]),
        track: rng.range(-0.04, 0.06), full: rng.chance(0.4),
        outline: rng.chance(0.25), rotAmp: rng.range(0, 2.5),
        extras: rng.chance(0.45), knock: rng.chance(0.2),
        ox: rng.range(-0.03, 0.03), oy: rng.range(-0.04, 0.04),
      };
    },
    render(env) {
      const P = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      if (P.extras) Z.extrasText(env, { text: env.cut.lineText || env.cut.text });
      const txt = env.cut.text;
      const lines = txt.length > (W < H ? 5 : 6) ? splitLines(txt, Math.ceil(txt.length / 2)) : txt;
      const per = lines.split('\n');
      let bb = null;
      per.forEach((l, i) => {
        bb = Z.unionBB(bb, Z.charRun(env, {
          text: l, font: P.font, sx: P.sx, track: P.track,
          maxW: W * 0.94, maxH: H * (P.full ? 0.8 : 0.6) / per.length,
          rotAmp: P.rotAmp, outline: P.outline,
          y: H / 2 + (i - (per.length - 1) / 2) * H * 0.3,
          ox: P.ox, oy: P.oy, seed: Z.h(env.cut.seed, i, 61),
        }));
      });
      if (bb && P.knock) Z.knockout(env, { size: (bb.y1 - bb.y0) * 0.9, x: bb.cx, y: bb.cy, _lay: null }, sc.bg);
      return bb;
    },
  },
  stack: {
    name: '多行堆叠', w: 1.5, emph: 1.7, portrait: 1.1,
    fits: n => n >= 2,
    plan(rng, info, st) {
      return {
        font: rng.pick(st.fonts.display), per: Math.max(2, Math.round(rng.range(2, 5))),
        gap: rng.range(1.0, 1.6), align: rng.pick(['left', 'left', 'center']),
        ox: rng.range(-0.06, 0.06), oy: rng.range(-0.05, 0.05),
        sizeJit: rng.chance(0.5), rotAmp: rng.range(0, 3), knock: rng.chance(0.3),
      };
    },
    render(env) {
      const P = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      const units = splitLines(env.cut.text, P.per).split('\n').filter(Boolean);
      const maxH = H * 0.68 / units.length;
      const left = P.align === 'left';
      let bb = null;
      units.forEach((l, i) => {
        bb = Z.unionBB(bb, Z.charRun(env, {
          text: l, font: P.font, track: 0.02,
          maxW: W * 0.8, maxH,
          x: left ? W * 0.11 : W / 2, y: H / 2 + (i - (units.length - 1) / 2) * maxH * (P.gap / 1.2),
          ox: left ? 0 : P.ox, oy: P.oy, sizeJit: P.sizeJit ? 0.22 : 0, rotAmp: P.rotAmp,
          seed: Z.h(env.cut.seed, i, 71),
        }));
      });
      if (bb && P.knock) {
        env.rect(bb.x0 - 20, bb.y0 - 14, (bb.x1 - bb.x0) + 40, (bb.y1 - bb.y0) + 28, sc.ink, 1, false);
        units.forEach((l, i) => {
          Z.charRun(env, {
            text: l, font: P.font, track: 0.02, maxW: W * 0.8, maxH,
            x: left ? W * 0.11 : W / 2, y: H / 2 + (i - (units.length - 1) / 2) * maxH * (P.gap / 1.2),
            color: sc.bg, noAccent: true, noLettering: true, seed: Z.h(env.cut.seed, i, 71),
          });
        });
      }
      return bb;
    },
  },
  mixed: {
    name: '大小混排', w: 1.5, emph: 1.6, portrait: 1,
    fits: n => n >= 2 && n <= 16,
    plan(rng, info, st) {
      return {
        fontBig: rng.pick(st.fonts.display), fontSmall: rng.pick(st.fonts.serif.concat(st.fonts.body)),
        mode: rng.pick(['line', 'stair', 'line', 'wave', 'arch']),
        rotAmp: rng.range(2, 10), sx: rng.pick([1, 1, 1.2, 0.85]),
        extras: rng.chance(0.6), rows2: rng.chance(0.5),
      };
    },
    render(env) {
      const P = env.cut.params, W = env.W, H = env.H;
      if (P.extras) Z.extrasText(env, { text: env.cut.text });
      const chars = [...env.cut.text.replace(/[\s\u3000]+/g, '')];
      if (!chars.length) return null;
      const seed = env.cut.seed | 0, n = chars.length;
      const rows = (P.rows2 && n > 6) ? 2 : 1;
      const perRow = Math.ceil(n / rows);
      let bb = null;
      for (let r = 0; r < rows; r++) {
        const row = chars.slice(r * perRow, (r + 1) * perRow).join('');
        if (!row) continue;
        bb = Z.unionBB(bb, Z.charRun(env, {
          text: row, font: P.fontBig, fontAlt: P.fontSmall, sx: P.sx, track: 0.02,
          maxW: W * 0.88, maxH: H * (rows > 1 ? 0.28 : 0.4),
          mode: P.mode, rotAmp: P.rotAmp, sizeJit: 0.3,
          y: H / 2 + (r - (rows - 1) / 2) * H * (rows > 1 ? 0.21 : 0),
          seed: Z.h(seed, r, 51),
        }));
      }
      return bb;
    },
  },

  /* ---------- 竖排与东方版式 ---------- */
  vcols: {
    name: '竖排', w: 1.5, emph: 1.6, portrait: 2,
    fits: n => n >= 2,
    plan(rng, info, st) {
      const n = [...info.text.replace(/\s/g, '')].length;
      return {
        font: rng.pick(st.fonts.serif.concat(st.fonts.display)),
        per: Math.max(3, Math.round(rng.range(4, 9))),
        right: rng.chance(0.35), repeat: n <= 9 && rng.chance(0.6),
        cols: rng.pick([3, 4, 5]), side: rng.pick(['outline', 'dim', 'same', 'outline']),
        rotAmp: rng.range(0.6, 3), ox: rng.range(-0.05, 0.05),
      };
    },
    render(env) {
      const P = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      const txt = env.cut.text.replace(/[\s\u3000]+/g, '');
      const n = [...txt].length;
      /* 短句重复成几列，两边的列做成描边或压暗 */
      if (P.repeat && n <= 9) {
        const cols = P.cols, size = Math.min(H * 0.8 / (n * 1.04), W * 0.86 / (cols * 1.75));
        const mid = (cols - 1) / 2;
        let bb = null;
        for (let i = 0; i < cols; i++) {
          const side = i !== Math.round(mid);
          const it = {
            text: txt, font: P.font, size, x: W / 2 + (i - mid) * size * 1.75, y: H / 2,
            vertical: true, track: 0.04, color: sc.fg, mi: Math.abs(i - mid) * 2,
            rot: Z.rsign(env.cut.seed, i, 3) * P.rotAmp, noLettering: true,
          };
          if (side && P.side === 'outline') { it.fill = false; it.stroke = Math.max(1.2, size * 0.014); it.strokeColor = sc.fg; }
          if (side && P.side === 'dim') it.alpha = 0.38;
          const r = Z.mkItem(env, it);
          if (!side) bb = r;
        }
        return bb;
      }
      const per = Math.max(2, Math.min(P.per + 1, Math.ceil(n / Math.ceil(n / 7))));
      const arr = [...txt], colsArr = [];
      for (let i = 0; i < arr.length; i += per) colsArr.push(arr.slice(i, i + per).join(''));
      const size = Math.min(H * 0.78 / (per * 1.03), W * 0.8 / (colsArr.length * 1.4));
      return Z.mkItem(env, {
        text: colsArr.join('\n'), font: P.font, size,
        x: (P.right ? W * 0.82 : W / 2) + P.ox * W, y: H / 2,
        vertical: true, lead: 1.4, align: 'left', track: 0.03, color: sc.fg,
        rot: Z.rsign(env.cut.seed, 7, 3) * P.rotAmp, noLettering: true,
      });
    },
  },
  gloss: {
    name: '词典版式', w: 1.3, emph: 1.4, portrait: 1,
    fits: n => true,
    plan(rng, info, st) {
      return {
        font: rng.pick(st.fonts.body.concat(st.fonts.serif)),
        per: Math.max(4, Math.round(rng.range(5, 10))),
        showRule: rng.chance(0.7), drop: rng.chance(0.6),
        extras: rng.chance(0.5), accentRule: rng.chance(0.5),
      };
    },
    render(env) {
      const P = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      if (P.extras) Z.extrasText(env, { text: env.cut.lineText || env.cut.text, count: 7 });
      const txt = splitLines(env.cut.text, P.per);
      const lines = txt.split('\n').length;
      const size = Math.min(W * 0.72 / 12, H * 0.6 / (lines * 1.6));
      const x = W * 0.14, y = H / 2 - (lines - 1) * size * 0.8;
      let bbHead = null;
      if (P.drop) {
        bbHead = Z.mkItem(env, {
          text: txt.charAt(0), font: P.font, size: size * 2.2, align: 'left',
          x, y: y - size * 0.15, color: sc.accent, noLettering: true, mi: 0,
        });
      }
      if (P.showRule) {
        const e = Z.E.outExpo(env.pIn * 1.3 - 0.15);
        env.rect(W * 0.1, y - size * 0.6, W * 0.82 * e, Math.max(2, size * 0.035), P.accentRule ? sc.accent : sc.fg, 0.85);
      }
      const rest = P.drop ? txt.slice(1) : txt;
      const bbRest = Z.charRun(env, {
        text: rest, font: P.font, maxW: W * 0.7, maxH: H * 0.6,
        uniform: true, noAccent: true, track: 0.05,
        x: x + (P.drop ? size * 1.1 : 0), y: y - size * 0.2, mode: 'line',
      });
      return bbRest || bbHead;
    },
  },
  news: {
    name: '分栏报纸', w: 1.2, emph: 1.3, portrait: 1,
    fits: n => n >= 6,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.serif), cols: rng.int(2, 3), per: Math.max(5, Math.round(rng.range(6, 12))), rule: rng.chance(0.6) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      const txt = splitLines(env.cut.text, Math.max(3, Math.ceil(env.cut.text.length / p.cols)));
      const lines = txt.split('\n');
      const colW = W * 0.8 / p.cols;
      const size = Math.min(colW / 11, H * 0.5 / 4);
      const x0 = W * 0.1;
      let last = null;
      lines.forEach((l, i) => {
        const cx = x0 + (i % p.cols) * colW;
        const cy = H / 2 - (lines.length > 1 ? H * 0.12 : 0) + Math.floor(i / p.cols) * size * 2.1;
        const bb = Z.mkItem(env, { text: l, font: p.font, size, align: 'left', x: cx, y: cy, mi: i, lead: 1.5 });
        if (bb) last = bb;
        env.rect(cx, cy - size * 0.72, Math.max(1.5, size * 0.02), size * 1.5, sc.sub, 0.5);
      });
      if (p.rule) env.rect(W * 0.1, H / 2 - H * 0.3, W * 0.8, Math.max(3, H * 0.006), sc.accent, 0.9);
      return last;
    },
  },
  genko: {
    name: '稿纸格', w: 1, emph: 1.4, portrait: 1.2,
    fits: n => n <= 40,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.serif), cols: rng.pick([8, 10]), rule: true }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      const txt = splitLines(env.cut.text, p.cols);
      const lines = txt.split('\n');
      const cell = Math.min(W * 0.66 / p.cols, H * 0.66 / Math.max(3, lines.length));
      const x0 = W / 2 - cell * p.cols / 2, y0 = H / 2 - cell * lines.length / 2;
      /* 格线 */
      for (let r = 0; r <= lines.length; r++) env.rect(x0, y0 + r * cell, cell * p.cols, Math.max(1, cell * 0.012), sc.sub, 0.4);
      for (let c = 0; c <= p.cols; c++) env.rect(x0 + c * cell, y0, Math.max(1, cell * 0.012), cell * lines.length, sc.sub, 0.4);
      return Z.mkItem(env, { text: txt, font: p.font, size: cell * 0.86, x: W / 2, y: y0 + cell * lines.length / 2, lead: 1 });
    },
  },
  seal: {
    name: '落款式', w: 1, emph: 1.5, portrait: 1.3,
    fits: n => true,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.display), box: rng.chance(0.6) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      const cx = W * 0.36;
      const size = Z.fitSize(env.cut.text, p.font, W * 0.52, H * 0.4);
      const bb = Z.mkItem(env, { text: env.cut.text, font: p.font, size, x: cx });
      if (p.box) {
        const r = size * 1.15;
        env.rect(cx + W * 0.22 - r / 2, H / 2 - r / 2, r, r, sc.accent, 0.92);
        env.rect(cx + W * 0.22 - r / 2, H / 2 - r / 2, r, r, null, 1, false, sc.accent, r * 0.06);
        Z.mkItem(env, { text: '印', font: p.font, size: r * 0.62, x: cx + W * 0.22, y: H / 2 + r * 0.02, color: sc.ink, mi: 3, enter: 'sealDrop', hold: 'still', exit: 'cut', inDur: 0.3 });
      }
      return bb;
    },
  },

  /* ---------- 几何排列 ---------- */
  ring: {
    name: '圆环', w: 1.4, emph: 1.6, portrait: 0.9,
    fits: n => n >= 2 && n <= 24,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.display), r: rng.range(0.24, 0.4), face: rng.chance(0.4), r0: rng.range(0, 360) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      const txt = env.cut.text;
      const n = txt.length, arr = [...txt];
      const size = Math.min(W * 0.16, H * 0.2, W * 0.9 / Math.max(3, n) * 1.2);
      const R = Math.min(W, H) * p.r;
      const x0 = env.W / 2, y0 = env.H / 2;
      let first = null;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Z.TAU - Math.PI / 2 + p.r0 * Z.DEG;
        const x = x0 + Math.cos(a) * R * (W / Math.min(W, H)) * 0.9;
        const y = y0 + Math.sin(a) * R * (H / Math.min(W, H)) * 0.9;
        const r = Z.mkItem(env, {
          text: arr[i], font: p.font, size, x, y, seed: Z.h(env.cut.seed, i, 31),
          rot: p.face ? a / Z.DEG + 90 : 0,
        });
        if (r && !first) first = r;
      }
      return first;
    },
  },
  circle: {
    name: '同心圆环', w: 1.1, emph: 1.5, portrait: 1,
    fits: n => n >= 4,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.display), rings: rng.int(2, 3) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H;
      const txt = env.cut.text, arr = [...txt];
      const R = Math.min(W, H);
      let first = null;
      for (let r = 0; r < p.rings; r++) {
        const per = Math.max(4, Math.round(arr.length / p.rings));
        const part = arr.slice(r * per, (r + 1) * per).join('');
        if (!part) continue;
        const size = R * 0.055 / (1 + r * 0.35);
        const px = [], pn = part.length;
        for (let i = 0; i < pn; i++) {
          const a = (i / pn) * Z.TAU + r * 0.5;
          const rr = R * (0.22 + r * 0.13);
          px.push([W / 2 + Math.cos(a) * rr, H / 2 + Math.sin(a) * rr, a]);
        }
        for (let i = 0; i < pn; i++) {
          const [x, y, a] = px[i];
          const b = Z.mkItem(env, { text: part[i], font: p.font, size, x, y, rot: a / Z.DEG + 90, seed: Z.h(env.cut.seed, r, i, 41) });
          if (b && !first) first = b;
        }
      }
      return first;
    },
  },
  wave: {
    name: '波浪排布', w: 1.5, emph: 1.6, portrait: 0.8,
    fits: n => n >= 2,
    plan(rng, info, st) {
      return {
        font: rng.pick(st.fonts.display), mode: rng.pick(['wave', 'arch', 'stair']),
        rotAmp: rng.range(4, 16), sizeJit: rng.range(0.1, 0.4),
        sx: rng.pick([1, 1.15]), extras: rng.chance(0.4),
      };
    },
    render(env) {
      const P = env.cut.params, W = env.W, H = env.H;
      if (P.extras) Z.extrasText(env, { text: env.cut.text, count: 6 });
      return Z.charRun(env, {
        text: env.cut.text, font: P.font, sx: P.sx, track: 0.06,
        maxW: W * 0.88, maxH: H * 0.3, mode: P.mode,
        rotAmp: P.rotAmp, sizeJit: P.sizeJit,
      });
    },
  },
  scatter: {
    name: '散点', w: 1.4, emph: 1.6, portrait: 1,
    fits: n => n >= 2 && n <= 30,
    plan(rng, info, st) {
      return {
        font: rng.pick(st.fonts.display), fontAlt: rng.pick(st.fonts.serif.concat(st.fonts.body)),
        mode: rng.pick(['line', 'stair', 'wave', 'arch']),
        sizeJit: rng.range(0.15, 0.5), rotAmp: rng.range(3, 22),
        extras: rng.chance(0.75), sx: rng.pick([1, 1, 1.15]),
      };
    },
    render(env) {
      const P = env.cut.params, W = env.W, H = env.H;
      const chars = [...env.cut.text.replace(/[\s\u3000]+/g, '')];
      if (!chars.length) return null;
      const seed = env.cut.seed | 0, n = chars.length;
      if (P.extras) Z.extrasText(env, { text: env.cut.lineText || env.cut.text });
      return Z.charRun(env, {
        text: chars.join(''), font: P.font, fontAlt: P.fontAlt, sx: P.sx, track: 0.04,
        maxW: W * 0.9, maxH: H * 0.36, mode: P.mode,
        sizeJit: P.sizeJit, rotAmp: P.rotAmp, seed,
      });
    },
  },
  diag: {
    name: '斜排', w: 1.2, emph: 1.7, portrait: 0.8,
    fits: n => true,
    plan(rng, info, st) {
      return {
        font: rng.pick(st.fonts.display), ang: rng.pick([-24, -16, -8, 8, 16, 24]),
        sx: rng.pick([1, 1, 1.25, 1.45]), track: rng.range(0.02, 0.14),
        extras: rng.chance(0.55), sizeJit: rng.chance(0.5),
      };
    },
    render(env) {
      const P = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      if (P.extras) Z.extrasText(env, { text: env.cut.lineText || env.cut.text });
      /* 斜排常配一条同角度的斜带或斜线 */
      const ctx = env.ctx;
      const ang = P.ang * Z.DEG;
      const L = Math.hypot(W, H) * 0.9;
      ctx.save();
      ctx.translate(W / 2, H / 2); ctx.rotate(ang);
      ctx.globalAlpha = env.pass !== 'main' ? 0.3 : 0.16;
      ctx.fillStyle = env.pass !== 'main' ? env.passColor : sc.accent;
      ctx.fillRect(-L / 2, H * 0.13, L, H * 0.012);
      ctx.restore();
      const bb = Z.charRun(env, {
        text: env.cut.text, font: P.font, sx: P.sx, track: P.track,
        maxW: W * 0.95, maxH: H * 0.3, rotAmp: 0, sizeJit: P.sizeJit ? 0.2 : 0,
      });
      return bb;
    },
  },
  grid: {
    name: '网格铺排', w: 1.3, emph: 1.5, portrait: 1,
    fits: n => n >= 4,
    plan(rng, info, st) {
      return {
        font: rng.pick(st.fonts.display), cols: rng.int(3, 5),
        boxed: rng.chance(0.5), sizeJit: rng.range(0.1, 0.4),
        accentRow: rng.chance(0.5), hRule: rng.chance(0.5),
      };
    },
    render(env) {
      const P = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      const txt = splitLines(env.cut.text, P.cols);
      const lines = txt.split('\n');
      const cw = W * 0.84 / P.cols, size = cw * 0.8;
      const seed = env.cut.seed | 0;
      const y0 = H / 2 - lines.length * size * 1.15 / 2 + size * 0.58;
      let first = null;
      lines.forEach((l, r) => {
        if (P.hRule) env.rect(W * 0.08, y0 + r * size * 1.15 - size * 0.62, W * 0.84, Math.max(1, size * 0.02), sc.sub, 0.35);
        [...l].forEach((ch, ci) => {
          const x = W * 0.08 + cw * (ci + 0.5);
          const y = y0 + r * size * 1.15;
          if (P.boxed) env.rect(x - cw / 2 + cw * 0.04, y - size * 0.5, cw * 0.92, size, null, 1, false, P.accentRow && r === 1 ? sc.accent : sc.sub, Math.max(1, size * 0.022));
          const b = Z.mkItem(env, {
            text: ch, font: P.font, size: size * (0.8 + Z.rnd(seed, r, ci, 4) * P.sizeJit),
            x, y, seed: Z.h(seed, r, ci, 71),
            color: (P.accentRow && r === 1) ? sc.accent : sc.fg, mi: r + ci,
          });
          if (b && !first) first = b;
        });
      });
      return first;
    },
  },
  tile: {
    name: '满屏平铺', w: 1, emph: 1.8, portrait: 1,
    fits: n => n >= 2,
    plan(rng, info, st) {
      return {
        font: rng.pick(st.fonts.display), tileFont: rng.pick(st.fonts.serif.concat(st.fonts.body, ['mono'])),
        knock: rng.pick(['box', 'stroke', 'box']), rowsN: rng.pick([11, 13, 15, 17]),
        flicker: rng.chance(0.6), rotAmp: rng.range(0, 3),
      };
    },
    render(env) {
      const P = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      /* 背景：整屏滚动的字行；前景：挖了版的正文 */
      Z.bgRowsText(env, { text: env.cut.lineText || env.cut.text, rows: P.rowsN, font: P.tileFont, flicker: P.flicker, alpha: 0.42, speed: 26 });
      const size = Math.min(W * 0.5 / Math.max(1, env.cut.text.length) * 1.5, H * 0.3);
      const m = Z.measureText({ text: env.cut.text, font: P.font, size });
      const e = Z.E.outExpo(env.pIn * 1.4);
      if (P.knock === 'box') {
        env.rect(W / 2 - (m.w / 2 + size * 0.35) * e, H / 2 - m.h / 2 - size * 0.28, (m.w + size * 0.7) * e, m.h + size * 0.56, sc.bg, 1, false);
      }
      const bb = Z.charRun(env, {
        text: env.cut.text, font: P.font, maxW: W * 0.8, maxH: H * 0.3,
        uniform: true, rotAmp: P.rotAmp,
      });
      if (P.knock === 'stroke') {
        Z.mainDraw(env, {
          text: env.cut.text, font: P.font, size, x: W / 2, y: H / 2,
          fill: false, stroke: size * 0.16, strokeColor: sc.bg, noLettering: true,
          enter: 'cut', exit: 'cut', hold: 'still',
        });
      }
      return bb;
    },
  },
  marquee: {
    name: '流动带', w: 1.3, emph: 1.6, portrait: 0.6,
    fits: n => n >= 2,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.display), bars: rng.int(1, 2), dir: rng.chance(0.5) ? -1 : 1, speed: rng.range(0.15, 0.35) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      const size = H * (p.bars > 1 ? 0.16 : 0.22);
      const txt = (env.cut.text + '   ').repeat(4);
      let first = null;
      for (let b = 0; b < p.bars; b++) {
        const y = H / 2 + (b - (p.bars - 1) / 2) * size * 1.9;
        const dir = b % 2 ? -p.dir : p.dir;
        const t = (env.lt * p.speed * dir) % 1;
        const shift = (t - Math.floor(t) - 0.5) * size * txt.length * 0.62;
        env.rect(0, y - size * 0.82, W, size * 1.64, sc.accent, 0.14);
        const r = Z.mkItem(env, { text: txt, font: p.font, size, x: W / 2 + shift, y, mi: b });
        if (r && !first) first = r;
      }
      return first;
    },
  },
  pill: {
    name: '胶囊标签', w: 1.2, emph: 1.6, portrait: 1.1,
    fits: n => n <= 20,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.display.concat(st.fonts.body)), pad: rng.range(0.35, 0.6), tilt: rng.rsign(1) * rng.range(0, 6) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      const size = Z.fitSize(env.cut.text, p.font, W * 0.66, H * 0.28);
      const m = Z.measureText({ text: env.cut.text, font: p.font, size });
      const w = m.w + size * p.pad * 2, h = m.h + size * p.pad * 1.2;
      const bb = Z.mkItem(env, {
        text: env.cut.text, font: p.font, size, rot: p.tilt, color: sc.ink,
        pre: (e) => { e.rrect(W / 2 - w / 2, H / 2 - h / 2, w, h, h / 2, sc.accent, 0.96); },
      });
      return bb;
    },
  },
  labels: {
    name: '标签贴', w: 1.3, emph: 1.5, portrait: 1,
    fits: n => n >= 2 && n <= 26,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.body.concat(st.fonts.serif)), per: Math.max(2, Math.round(rng.range(2, 5))), seed: rng.int(1, 1e9) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      const arr = Z.chunkText(env.cut.text).length > 1 ? Z.chunkText(env.cut.text) : [...env.cut.text];
      const size = Math.min(W * 0.2, H * 0.11);
      let first = null;
      arr.forEach((w0, i) => {
        const txt = w0 || '';
        const m = Z.measureText({ text: txt, font: p.font, size });
        const cols = 2, rows = Math.ceil(arr.length / cols);
        const gx = i % cols, gy = Math.floor(i / cols);
        const cx = W * 0.24 + gx * W * 0.5 + Z.rsign(p.seed, i, 1) * size * 0.4;
        const cy = H * 0.2 + gy * (H * 0.5 / Math.max(1, rows - 1 || 1)) + Z.rsign(p.seed, i, 2) * size * 0.3;
        env.rrect(cx - m.w / 2 - size * 0.28, cy - size * 0.62, m.w + size * 0.56, size * 1.24, size * 0.1, i % 3 === 0 ? sc.accent : sc.fg, 0.95);
        const b = Z.mkItem(env, { text: txt, font: p.font, size, x: cx, y: cy, color: i % 3 === 0 ? sc.ink : sc.bg, seed: Z.h(p.seed, i, 81), mi: i });
        if (b && !first) first = b;
      });
      return first;
    },
  },
  notes: {
    name: '便签注记', w: 1.1, emph: 1.4, portrait: 1.1,
    fits: n => true,
    plan(rng, info, st) {
      return {
        font: rng.pick(st.fonts.body.concat(st.fonts.serif)),
        side: rng.chance(0.5) ? -1 : 1,
        per: Math.max(3, Math.round(rng.range(4, 8))),
        extras: rng.chance(0.7), rotAmp: rng.range(1, 4),
      };
    },
    render(env) {
      const P = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      if (P.extras) Z.extrasText(env, { text: env.cut.lineText || env.cut.text, count: 8 });
      const txt = splitLines(env.cut.text, P.per);
      const lines = txt.split('\n').length;
      const cx = W / 2 + P.side * W * 0.16;
      let bb = null;
      txt.split('\n').forEach((l, i) => {
        const size = Math.min(W * 0.46 / Math.max(4, l.length) * 1.4, H * 0.5 / (lines * 1.7));
        bb = Z.unionBB(bb, Z.charRun(env, {
          text: l, font: P.font, track: 0.05,
          maxW: W * 0.5, maxH: size * 1.4,
          x: cx, y: H / 2 + (i - (lines - 1) / 2) * size * 1.7,
          rotAmp: P.rotAmp, seed: Z.h(env.cut.seed, i, 81),
        }));
      });
      /* 引到画面边缘的细线 —— 注记的"指示"感 */
      if (bb) {
        const lx = P.side > 0 ? bb.x1 + 8 : bb.x0 - 8;
        const ex = P.side > 0 ? W * 0.94 : W * 0.06;
        const size = (bb.y1 - bb.y0) * 0.2;
        env.rect(Math.min(lx, ex), bb.cy, Math.abs(ex - lx), Math.max(1, size * 0.1), sc.sub, 0.6);
        env.rect(ex - size * 0.06, bb.cy - size * 0.8, Math.max(1, size * 0.1), size * 1.6, sc.sub, 0.6);
      }
      return bb;
    },
  },
  lyricBar: {
    name: '字幕条', w: 1.5, emph: 1.4, portrait: 1.5,
    fits: n => n <= 26,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.body.concat(st.fonts.display)), y: rng.range(0.7, 0.84), lines: rng.chance(0.35) ? 2 : 1 }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      const txt = p.lines > 1 ? splitLines(env.cut.text, Math.ceil(env.cut.text.length / 2)) : env.cut.text;
      const size = Z.fitSize(txt, p.font, W * 0.82, H * 0.16);
      return Z.mkItem(env, {
        text: txt, font: p.font, size, y: H * p.y,
        shadow: { color: 'rgba(0,0,0,0.55)', blur: size * 0.22, dx: 0, dy: size * 0.03 },
      });
    },
  },
  bubble: {
    name: '对话气泡', w: 1, emph: 1.5, portrait: 1,
    fits: n => n <= 30,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.body), side: rng.chance(0.5) ? -1 : 1, per: rng.pick([6, 8, 10]) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      const txt = splitLines(env.cut.text, p.per);
      const size = Math.min(W * 0.6 / p.per, H * 0.2);
      const m = Z.measureText({ text: txt, font: p.font, size, lead: 1.5 });
      const w = m.w + size * 1.2, h = m.h + size * 0.9;
      const cx = W / 2 - p.side * W * 0.1;
      const cy = H * 0.42;
      const r = size * 0.3, tx = cx + p.side * w * 0.3, ty = cy + h / 2;
      return Z.mkItem(env, {
        text: txt, font: p.font, size, lead: 1.5, x: cx, y: cy, color: sc.ink,
        pre: (e) => {
          e.rrect(cx - w / 2, cy - h / 2, w, h, r, sc.fg, 0.97);
          e.poly([[tx, ty - size * 0.1], [tx + p.side * size * 0.7, ty + size * 0.7], [tx + p.side * size * 0.05, ty - size * 0.05]], sc.fg, 1);
        },
      });
    },
  },

  /* ---------- 特殊版式 ---------- */
  type: {
    name: '终端打字', w: 1.4, emph: 1.5, portrait: 0.9,
    fits: n => n <= 40,
    plan(rng, info, st) { return { font: rng.pick(['mono', 'dot', ...st.fonts.body]), per: Math.max(8, Math.round(rng.range(10, 20))), prompt: rng.chance(0.6) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      const txt = splitLines(env.cut.text, p.per);
      const lines = txt.split('\n').length;
      const size = Math.min(W * 0.7 / p.per, H * 0.5 / (lines * 1.7));
      const y0 = H / 2 - (lines - 1) * size * 1.7 / 2;
      let first = null;
      txt.split('\n').forEach((l, i) => {
        const pre = p.prompt && i === 0 ? '> ' : '';
        const b = Z.mkItem(env, { text: pre + l, font: p.font, size, lead: 1.7, align: 'left', x: W * 0.14, y: y0 + i * size * 1.7, mi: i });
        if (b && !first) first = b;
      });
      return first;
    },
  },
  columns: {
    name: '双栏对照', w: 1, emph: 1.3, portrait: 0.9,
    fits: n => n >= 4,
    plan(rng, info, st) {
      return {
        font: rng.pick(st.fonts.display), font2: rng.pick(st.fonts.serif),
        rule: rng.chance(0.6), extras: rng.chance(0.5),
        sx: rng.pick([1, 1.15]),
      };
    },
    render(env) {
      const P = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      if (P.extras) Z.extrasText(env, { text: env.cut.lineText || env.cut.text, count: 7 });
      const arr = Z.chunkText(env.cut.text);
      const half = Math.ceil(arr.length / 2);
      const a = arr.slice(0, half).join(''), b = arr.slice(half).join('');
      if (P.rule) {
        const e = Z.E.outExpo(env.pIn * 1.3);
        env.rect(W / 2 - Math.max(1.5, H * 0.004), H * 0.22, Math.max(2, H * 0.004), H * 0.56 * e, sc.accent, 0.85);
      }
      const bbA = Z.charRun(env, {
        text: a, font: P.font, sx: P.sx, track: 0.04,
        maxW: W * 0.42, maxH: H * 0.34, x: W * 0.27, mode: 'line',
      });
      if (b) {
        Z.charRun(env, {
          text: b, font: P.font2, sx: P.sx, track: 0.04,
          maxW: W * 0.42, maxH: H * 0.34, x: W * 0.73, mode: 'line',
          color: sc.sub, noAccent: true, seed: Z.h(env.cut.seed, 9, 61),
        });
      }
      return bbA;
    },
  },
  rain: {
    name: '文字雨', w: 0.9, emph: 1.5, portrait: 1,
    fits: n => n >= 2,
    plan(rng, info, st) {
      return {
        font: rng.pick(['dot', 'mono'].concat(st.fonts.display)),
        cols: rng.int(7, 12), speed: rng.range(0.2, 0.5),
        lead: rng.chance(0.7), sizeJit: rng.range(0.05, 0.25),
      };
    },
    render(env) {
      const P = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      const txt = (env.cut.text + Z.poolKana()).replace(/\s+/g, '');
      const size = W / P.cols * 0.86;
      const per = Math.ceil(H / (size * 1.2)) + 2;
      let first = null;
      for (let c = 0; c < P.cols; c++) {
        const x = (c + 0.5) * (W / P.cols);
        const off = ((env.lt * P.speed + Z.rnd(env.cut.seed, c, 5)) % 1) * per;
        for (let r = 0; r < per; r++) {
          const idx = (r + Math.floor(off * 1.4)) % txt.length;
          const y = ((r - off) % per + per) % per * size * 1.2 - size;
          if (y < -size || y > H + size) continue;
          const fade = Z.clamp(1 - Math.abs(y - H * 0.5) / (H * 0.72));
          /* 每列最上面那个字用强调色，是"雨头" */
          const isLead = r === 0 && P.lead;
          const b = Z.mkItem(env, {
            text: txt[idx], font: P.font, size: size * (0.9 + Z.rnd(env.cut.seed, c, r, 6) * P.sizeJit), x, y,
            color: isLead ? sc.accent : sc.fg, alpha: (isLead ? 0.95 : 0.08 + 0.55 * fade * fade),
            enter: 'cut', exit: 'cut', hold: 'still', seed: Z.h(env.cut.seed, c, r, 91),
          });
          if (b && !first) first = b;
        }
      }
      return first;
    },
  },
  tunnel: {
    name: '隧道透视', w: 0.9, emph: 1.6, portrait: 0.9,
    fits: n => n <= 40,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.display), n: rng.int(5, 9), z: rng.range(0.55, 0.8) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H;
      const txt = env.cut.text.repeat(3);
      let first = null;
      for (let i = p.n; i >= 0; i--) {
        const k = i / p.n;
        const s = Math.pow(p.z, i) * 1.0;
        const b = Z.mkItem(env, {
          text: txt, font: p.font, size: Z.fitSize(txt, p.font, W * 0.8, H * 0.4) * s,
          x: W / 2, y: H / 2, alpha: 1 - k * 0.5, seed: Z.h(env.cut.seed, i, 101), mi: i,
          enter: i === 0 ? env.cut.enter : 'zoom', hold: 'still', exit: 'cut', inDur: env.cut.inDur,
        });
        if (b && !first) first = b;
      }
      return first;
    },
  },
  credits: {
    name: '片尾滚动', w: 1, emph: 1.4, portrait: 1.2,
    fits: n => n >= 2,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.serif.concat(st.fonts.display)), speed: rng.range(0.1, 0.2), right: rng.chance(0.5) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H;
      const arr = [...env.cut.text];
      const size = Math.min(W * 0.3, H * 0.14);
      const total = arr.length * size * 1.6;
      const start = H + size;
      let first = null;
      arr.forEach((c, i) => {
        const y = start - (env.lt * (total + H) * p.speed + i * size * 1.6);
        if (y < -size * 2 || y > H + size * 2) return;
        const b = Z.mkItem(env, {
          text: c, font: p.font, size: size * 0.9, x: p.right ? W * 0.78 : W / 2, y,
          alpha: Z.clamp(1 - Math.abs(y - H / 2) / (H * 0.75)) * 0.4 + 0.6,
          enter: 'cut', exit: 'cut', hold: 'still', mi: i, seed: Z.h(env.cut.seed, i, 111),
        });
        if (b && !first) first = b;
      });
      return first;
    },
  },
  hang: {
    name: '悬挂', w: 1, emph: 1.5, portrait: 1.3,
    fits: n => n <= 30,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.display), per: rng.pick([6, 8]), rope: rng.chance(0.7) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      const txt = splitLines(env.cut.text, p.per);
      const lines = txt.split('\n');
      let first = null;
      lines.forEach((l, i) => {
        const arr = [...l];
        const size = Math.min(W * 0.14, H * 0.16);
        arr.forEach((c, ci) => {
          const x = W * 0.16 + ci * size * 1.1 + i * size * 0.3;
          const top = H * 0.1 + i * size * 0.4;
          const len = size * (1.4 + (ci % 3) * 0.35);
          if (p.rope) env.rect(x - Math.max(1, size * 0.02), top, Math.max(2, size * 0.04), len, sc.sub, 0.7);
          const swing = Math.sin(env.lt * 1.6 + ci * 0.7) * 4;
          const b = Z.mkItem(env, {
            text: c, font: p.font, size, x, y: top + len + size * 0.55, rot: swing,
            seed: Z.h(env.cut.seed, i, ci, 121), hold: 'sway',
          });
          if (b && !first) first = b;
        });
      });
      return first;
    },
  },
  ribbon: {
    name: '飘带', w: 0.9, emph: 1.5, portrait: 0.9,
    fits: n => n >= 3,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.display), k: rng.range(0.4, 1), amp: rng.range(0.08, 0.2) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      const arr = [...env.cut.text], n = arr.length;
      const size = Math.min(W * 0.8 / n * 1.4, H * 0.26);
      /* 先画一条带子，再把字贴着带子放 */
      const pts = [];
      const N = 40;
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        pts.push([W * 0.08 + u * W * 0.84, H / 2 + Math.sin(u * Z.TAU * p.k + env.lt * 1.4) * H * p.amp]);
      }
      const path = new Path2D();
      path.moveTo(pts[0][0], pts[0][1]);
      for (const q of pts) path.lineTo(q[0], q[1]);
      const ctx = env.ctx;
      ctx.save();
      ctx.strokeStyle = env.pass !== 'main' ? env.passColor : sc.accent;
      ctx.globalAlpha = env.pass !== 'main' ? 0.4 : 0.2;
      ctx.lineWidth = size * 1.5; ctx.lineCap = 'round';
      ctx.stroke(path);
      ctx.restore();
      let first = null;
      arr.forEach((c2, i) => {
        const u = n > 1 ? i / (n - 1) : 0.5;
        const x = W * 0.08 + u * W * 0.84;
        const y = H / 2 + Math.sin(u * Z.TAU * p.k + env.lt * 1.4) * H * p.amp;
        const slope = Math.cos(u * Z.TAU * p.k + env.lt * 1.4) * 22;
        const b = Z.mkItem(env, { text: c2, font: p.font, size, x, y, rot: slope, seed: Z.h(env.cut.seed, i, 131) });
        if (b && !first) first = b;
      });
      return first;
    },
  },
  orbit: {
    name: '环绕', w: 0.9, emph: 1.5, portrait: 0.9,
    fits: n => n >= 2,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.display), speed: rng.range(0.15, 0.45), ellipse: rng.range(0.28, 0.42) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H;
      const arr = [...env.cut.text], n = arr.length;
      const size = Math.min(W * 0.2, H * 0.2, W * 0.9 / Math.max(3, n) * 1.3);
      const R = Math.min(W, H) * p.ellipse;
      let first = null;
      arr.forEach((c, i) => {
        const a = (i / n) * Z.TAU + env.lt * p.speed;
        const z = Math.cos(a);
        const x = W / 2 + Math.sin(a) * R * 1.7;
        const y = H / 2 + Math.sin(a * 0.5) * R * 0.4;
        const b = Z.mkItem(env, {
          text: c, font: p.font, size: size * (0.7 + 0.3 * (z + 1) / 2), x, y,
          alpha: 0.35 + 0.65 * (z + 1) / 2, seed: Z.h(env.cut.seed, i, 141),
        });
        if (b && !first) first = b;
      });
      return first;
    },
  },
  stackEcho: {
    name: '残影堆叠', w: 1, emph: 1.6, portrait: 1,
    fits: n => n <= 20,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.display), n: rng.int(3, 6), dz: rng.range(0.06, 0.16), dir: rng.pick([-1, 1]) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      const size = Z.fitSize(env.cut.text, p.font, W * 0.7, H * 0.34);
      let first = null;
      for (let i = p.n; i >= 0; i--) {
        const k = i / p.n;
        const b = Z.mkItem(env, {
          text: env.cut.text, font: p.font, size: size * (1 - k * p.dz * 0.5),
          x: W / 2 + p.dir * k * size * 0.5, y: H / 2 - k * size * 0.3,
          alpha: i === 0 ? 1 : 0.14 * (1 - k) + 0.06, mi: i, seed: Z.h(env.cut.seed, i, 151),
          enter: i === 0 ? env.cut.enter : 'cut', exit: 'cut', hold: i === 0 ? env.cut.hold : 'still',
        });
        if (b && !first) first = b;
      }
      return first;
    },
  },
  spotlight: {
    name: '聚光', w: 0.9, emph: 1.6, portrait: 1,
    fits: n => n <= 20,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.display), r: rng.range(0.3, 0.48) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      const R = Math.min(W, H) * p.r * (1 + 0.06 * Math.sin(env.lt * 1.2));
      const ctx = env.ctx;
      ctx.save();
      const grd = ctx.createRadialGradient(W / 2, H / 2, R * 0.5, W / 2, H / 2, R * 1.6);
      const col = env.pass !== 'main' ? env.passColor : sc.accent;
      grd.addColorStop(0, Z.rgba(col, env.pass !== 'main' ? 0.25 : 0.3));
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
      ctx.restore();
      const size = Z.fitSize(env.cut.text, p.font, R * 1.5, R * 0.9);
      return Z.mkItem(env, { text: env.cut.text, font: p.font, size });
    },
  },
  split: {
    name: '对分', w: 1, emph: 1.5, portrait: 1.1,
    fits: n => n >= 2,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.display), vert: rng.chance(0.5), offset: rng.range(0.1, 0.3) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      const txt = env.cut.text, mid = Math.max(1, Math.round(txt.length / 2));
      const a = txt.slice(0, mid), b = txt.slice(mid);
      const size = Z.fitSize(txt, p.font, W * 0.44, H * 0.44);
      const dx = W * p.offset / 2;
      const bbA = Z.mkItem(env, p.vert ? { text: a, font: p.font, size, x: W / 2 + dx, y: H / 2, vertical: true } : { text: a, font: p.font, size, x: W / 2 - dx, y: H / 2 });
      if (p.vert) env.rect(W / 2, H * 0.06, Math.max(2, size * 0.05), H * 0.88, sc.accent, 0.7);
      else env.rect(W * 0.06, H / 2, W * 0.88, Math.max(2, size * 0.05), sc.accent, 0.7);
      if (b) Z.mkItem(env, p.vert ? { text: b, font: p.font, size, x: W / 2 - dx, y: H / 2, vertical: true, mi: 1 } : { text: b, font: p.font, size, x: W / 2 + dx, y: H / 2, mi: 1 });
      return bbA;
    },
  },
  stamp: {
    name: '大字印章', w: 1, emph: 1.8, portrait: 1.2,
    fits: n => n <= 6,
    plan(rng, info, st) { return { font: rng.pick(['mashan', ...st.fonts.display]), tilt: rng.rsign(1) * rng.range(4, 12) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      const size = Z.fitSize(env.cut.text, p.font, W * 0.56, H * 0.56);
      return Z.mkItem(env, {
        text: env.cut.text, font: p.font, size, rot: p.tilt, color: sc.accent,
        stroke: size * 0.03, strokeColor: sc.accent,
      });
    },
  },
  frame: {
    name: '画框', w: 1, emph: 1.4, portrait: 1.1,
    fits: n => n <= 24,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.serif), inset: rng.range(0.06, 0.14), double: rng.chance(0.5), per: rng.pick([6, 8]) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      const pad = Math.min(W, H) * p.inset;
      const lw = Math.max(2, Math.min(W, H) * 0.006);
      env.rect(pad, pad, W - pad * 2, lw, sc.fg, 0.9);
      env.rect(pad, H - pad - lw, W - pad * 2, lw, sc.fg, 0.9);
      env.rect(pad, pad, lw, H - pad * 2, sc.fg, 0.9);
      env.rect(W - pad - lw, pad, lw, H - pad * 2, sc.fg, 0.9);
      if (p.double) {
        const q = pad + lw * 3.5;
        env.rect(q, q, W - q * 2, Math.max(1, lw * 0.4), sc.fg, 0.45);
        env.rect(q, H - q, W - q * 2, Math.max(1, lw * 0.4), sc.fg, 0.45);
      }
      const txt = splitLines(env.cut.text, p.per);
      const size = Z.fitSize(txt, p.font, W - pad * 4, H - pad * 4);
      return Z.mkItem(env, { text: txt, font: p.font, size, lead: 1.5 });
    },
  },
  tickets: {
    name: '票根', w: 0.9, emph: 1.5, portrait: 1,
    fits: n => n <= 24,
    plan(rng, info, st) { return { font: rng.pick(['mono', ...st.fonts.body]), tilt: rng.rsign(1) * rng.range(2, 6) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      const size = Z.fitSize(env.cut.text, p.font, W * 0.6, H * 0.24);
      const m = Z.measureText({ text: env.cut.text, font: p.font, size });
      const w = m.w + size * 1.6, h = size * 2.1;
      return Z.mkItem(env, {
        text: env.cut.text, font: p.font, size, rot: p.tilt, color: sc.ink,
        pre: (e) => {
          e.rrect(W / 2 - w / 2, H / 2 - h / 2, w, h, size * 0.14, sc.fg, 0.97);
          /* 票根的虚线撕口 */
          const dash = size * 0.16;
          for (let x = W / 2 - w / 2 + size * 0.4; x < W / 2 + w / 2 - size * 0.3; x += dash * 2) {
            e.rect(x, H / 2 + h * 0.26, dash, Math.max(1.5, size * 0.03), sc.bg, 0.8);
          }
        },
      });
    },
  },
  crossword: {
    name: '填字格', w: 0.8, emph: 1.5, portrait: 1,
    fits: n => n >= 2 && n <= 36,
    plan(rng, info, st) { return { font: rng.pick(['mono', ...st.fonts.display]), cols: rng.int(4, 6), seed: rng.int(1, 1e9) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      const txt = env.cut.text.replace(/\s+/g, '');
      const cols = Math.min(p.cols, Math.max(2, txt.length));
      const rows = Math.max(1, Math.ceil(txt.length / cols));
      const cell = Math.min(W * 0.7 / cols, H * 0.6 / rows);
      const x0 = W / 2 - cell * cols / 2, y0 = H / 2 - cell * rows / 2;
      let first = null;
      for (let i = 0; i < cols * rows; i++) {
        const cx = x0 + (i % cols) * cell, cy = y0 + Math.floor(i / cols) * cell;
        const filled = i < txt.length;
        env.rect(cx, cy, cell * 0.96, cell * 0.96, filled ? sc.accent : sc.dim, filled ? 0.92 : 0.5);
        if (!filled) continue;
        const b = Z.mkItem(env, { text: txt[i], font: p.font, size: cell * 0.7, x: cx + cell / 2, y: cy + cell / 2, color: sc.ink, seed: Z.h(p.seed, i, 161) });
        if (b && !first) first = b;
      }
      return first;
    },
  },
  ladder: {
    name: '阶梯', w: 1, emph: 1.5, portrait: 0.9,
    fits: n => n <= 30,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.display), dir: rng.chance(0.5) ? 1 : -1, step: rng.range(0.08, 0.16) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H;
      const arr = [...env.cut.text], n = arr.length;
      const size = Math.min(W * 0.8 / Math.max(4, n) * 1.6, H * 0.28);
      let first = null;
      arr.forEach((c, i) => {
        const u = n > 1 ? i / (n - 1) : 0.5;
        const x = W / 2 + (u - 0.5) * W * 0.7 * p.dir;
        const y = H / 2 + (u - 0.5) * H * p.step * 4;
        const b = Z.mkItem(env, { text: c, font: p.font, size, x, y, seed: Z.h(env.cut.seed, i, 171) });
        if (b && !first) first = b;
      });
      return first;
    },
  },
  mirror: {
    name: '镜像', w: 0.9, emph: 1.6, portrait: 1,
    fits: n => n <= 20,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.display), vert: rng.chance(0.5), gap: rng.range(1.05, 1.5) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H;
      const size = Z.fitSize(env.cut.text, p.font, W * 0.8, H * 0.3);
      const y = H / 2 - size * p.gap * 0.3;
      const x = W / 2 - (p.vert ? size * p.gap * 0.3 : 0);
      const bb = Z.mkItem(env, { text: env.cut.text, font: p.font, size, x, y });
      Z.mkItem(env, {
        text: env.cut.text, font: p.font, size,
        x: p.vert ? x + size * p.gap * 0.9 : x,
        y: p.vert ? y : y + size * p.gap * 0.62,
        sx: p.vert ? -0.55 : 1, sy: p.vert ? 1 : -0.55,
        alpha: 0.34, mi: 2, seed: Z.h(env.cut.seed, 5, 181), enter: 'cut', exit: 'cut', hold: 'still', gradient: [env.sc.fg, 'rgba(0,0,0,0)'],
      });
      return bb;
    },
  },
  perspective: {
    name: '透视地面', w: 0.9, emph: 1.7, portrait: 0.8,
    fits: n => n <= 24,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.display), rows: rng.int(2, 4) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H;
      const arr = [...env.cut.text];
      const per = Math.max(1, Math.ceil(arr.length / p.rows));
      let first = null;
      for (let r = 0; r < p.rows; r++) {
        const part = arr.slice(r * per, (r + 1) * per).join('');
        if (!part) continue;
        const k = r / Math.max(1, p.rows - 1);
        const size = Math.min(W * 0.7 / per, H * 0.24) * (1 + k * 0.5);
        const y = H * 0.4 + k * H * 0.42;
        const b = Z.mkItem(env, {
          text: part, font: p.font, size, x: W / 2, y,
          sy: 1 + k * 0.55, sx: 1 + k * 1.2, mi: r, seed: Z.h(env.cut.seed, r, 191),
        });
        if (b && !first) first = b;
      }
      return first;
    },
  },
  filmstrip: {
    name: '胶片', w: 0.9, emph: 1.5, portrait: 0.9,
    fits: n => n >= 2,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.display), n: rng.int(3, 5) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      const arr = [...env.cut.text];
      const per = Math.max(1, Math.ceil(arr.length / p.n));
      const fw = W * 0.9 / p.n, fh = H * 0.5;
      let first = null;
      for (let i = 0; i < p.n; i++) {
        const part = arr.slice(i * per, (i + 1) * per).join('');
        const cx = W * 0.05 + fw * (i + 0.5);
        env.rect(cx - fw / 2, H / 2 - fh / 2, fw * 0.98, fh, sc.dim, 0.35);
        env.rect(cx - fw / 2, H / 2 - fh / 2 - fh * 0.07, fw * 0.98, fh * 0.05, sc.fg, 0.6);
        env.rect(cx - fw / 2, H / 2 + fh / 2 + fh * 0.02, fw * 0.98, fh * 0.05, sc.fg, 0.6);
        for (let s = 0; s < 3; s++) {
          env.rect(cx - fw / 2, H / 2 - fh / 2 - fh * 0.05 + s * fh * 0.02, fw * 0.04, fh * 0.02, sc.fg, 0.5);
          env.rect(cx + fw / 2 - fw * 0.04, H / 2 - fh / 2 - fh * 0.05 + s * fh * 0.02, fw * 0.04, fh * 0.02, sc.fg, 0.5);
        }
        if (!part) continue;
        const b = Z.mkItem(env, {
          text: part, font: p.font, size: Math.min(fw * 0.7, fh * 0.4) * 0.5 + Math.min(fw, fh) * 0.2,
          x: cx, y: H / 2, mi: i, seed: Z.h(env.cut.seed, i, 201), vertical: part.length > 3,
        });
        if (b && !first) first = b;
      }
      return first;
    },
  },
  tagCloud: {
    name: '词云', w: 1, emph: 1.4, portrait: 1,
    fits: n => n >= 3,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.display), seed: rng.int(1, 1e9) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H, seed = p.seed;
      const words = Z.chunkText(env.cut.text);
      let first = null;
      words.forEach((w0, i) => {
        const big = i === 0;
        const size = big ? Math.min(W * 0.34, H * 0.3) : Math.min(W * 0.16, H * 0.13) * (0.7 + Z.rnd(seed, i, 1) * 0.6);
        const ang = Z.rnd(seed, i, 2) * Z.TAU;
        const rr = big ? 0 : Math.min(W, H) * (0.24 + Z.rnd(seed, i, 3) * 0.16);
        const x = W / 2 + Math.cos(ang) * rr * 1.3;
        const y = H / 2 + Math.sin(ang) * rr;
        const b = Z.mkItem(env, {
          text: w0, font: p.font, size, x, y, rot: Z.rsign(seed, i, 4) * 12,
          color: big ? env.sc.accent : env.sc.fg, alpha: big ? 1 : 0.85,
          seed: Z.h(seed, i, 211), mi: i,
        });
        if (b && !first) first = b;
      });
      return first;
    },
  },
  swirl: {
    name: '螺旋', w: 0.9, emph: 1.5, portrait: 1,
    fits: n => n >= 3,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.display), turns: rng.range(1, 2.2), spin: rng.range(0.1, 0.4) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H;
      const arr = [...env.cut.text], n = arr.length;
      const size = Math.min(W * 0.5 / Math.max(4, n) * 2.2, H * 0.2);
      let first = null;
      arr.forEach((c, i) => {
        const u = n > 1 ? i / (n - 1) : 0.5;
        const a = u * Z.TAU * p.turns + env.lt * p.spin;
        const rr = Math.min(W, H) * (0.06 + u * 0.34);
        const b = Z.mkItem(env, {
          text: c, font: p.font, size: size * (0.5 + u * 0.7), x: W / 2 + Math.cos(a) * rr * 1.6, y: H / 2 + Math.sin(a) * rr,
          rot: a / Z.DEG + 90, seed: Z.h(env.cut.seed, i, 221),
        });
        if (b && !first) first = b;
      });
      return first;
    },
  },
  outlineText: {
    name: '描边巨字', w: 1, emph: 1.9, portrait: 1.2,
    fits: n => n <= 10,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.display), fill: rng.chance(0.3), w: rng.range(0.012, 0.03) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      const size = Z.fitSize(env.cut.text, p.font, W * 0.94, H * 0.6);
      return Z.mkItem(env, {
        text: env.cut.text, font: p.font, size,
        fill: p.fill, stroke: size * p.w, strokeColor: sc.fg, color: sc.fg,
        strokeUnder: true,
      });
    },
  },
  stampBox: {
    name: '编号章', w: 0.8, emph: 1.4, portrait: 1,
    fits: n => true,
    plan(rng, info, st) { return { font: rng.pick(['mono', ...st.fonts.body]), prefix: rng.pick(['NO.', 'FIG.', '#', 'CUT']), num: rng.int(1, 99) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      const size = Z.fitSize(env.cut.text, p.font, W * 0.7, H * 0.3);
      const m = Z.measureText({ text: env.cut.text, font: p.font, size });
      const w = m.w + size * 1.2, h = size * 1.9;
      const x0 = W / 2 - w / 2, y0 = H / 2 - h / 2;
      env.rect(x0, y0, w, Math.max(2, size * 0.05), sc.accent, 0.95);
      env.rect(x0, y0 + h, w, Math.max(2, size * 0.05), sc.accent, 0.95);
      env.rect(x0, y0, Math.max(2, size * 0.05), h, sc.accent, 0.95);
      env.rect(x0 + w, y0, Math.max(2, size * 0.05), h, sc.accent, 0.95);
      Z.mkItem(env, { text: `${p.prefix}${String(p.num).padStart(2, '0')}`, font: p.font, size: size * 0.32, x: x0 + w * 0.16, y: y0 + h * 0.86, align: 'center', color: sc.accent, mi: 2, enter: 'cut', exit: 'cut', hold: 'still' });
      return Z.mkItem(env, { text: env.cut.text, font: p.font, size, y: H / 2 - size * 0.12 });
    },
  },

  /* ---------- 特殊用途（规划器专用） ---------- */
  title: {
    name: '标题卡', special: true,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.display), sub: rng.pick(st.fonts.body) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      const hasNote = !!env.cut.note;
      const size = Z.fitSize(env.cut.text, p.font, W * 0.78, H * (hasNote ? 0.3 : 0.4));
      const y = H / 2 - (hasNote ? size * 0.36 : 0);
      const bb = Z.mkItem(env, { text: env.cut.text, font: p.font, size, y });
      if (hasNote) Z.mkItem(env, { text: env.cut.note, font: p.sub, size: size * 0.28, y: y + size * 0.86, color: sc.sub, mi: 2, track: 0.1, enter: 'fade', exit: 'fade', hold: 'still' });
      env.rect(W / 2 - size * 1.6, y + size * (hasNote ? 1.24 : 0.78), size * 3.2, Math.max(2, size * 0.03), sc.accent, 0.9);
      return bb;
    },
  },
  interlude: {
    name: '间奏', special: true,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.body), n: rng.int(3, 9), dot: rng.chance(0.5) }; },
    render(env) {
      const p = env.cut.params, W = env.W, H = env.H, sc = env.sc;
      const size = Math.min(W, H) * 0.05;
      const txt = p.dot ? '\u00b7\u00b7\u00b7' : '\u2014\u2014\u2014';
      const n = p.n;
      let first = null;
      for (let i = 0; i < n; i++) {
        const u = n > 1 ? i / (n - 1) : 0.5;
        const ph = (env.lt * 1.6 - u * 1.2) % 1;
        const a = 0.3 + 0.7 * Z.clamp(1 - Math.abs(((ph + 1) % 1) - 0.5) * 2);
        const b = Z.mkItem(env, {
          text: txt, font: p.font, size: size * 0.7, x: W / 2 + (u - 0.5) * W * 0.4, y: H / 2,
          alpha: a, color: sc.sub, enter: 'cut', exit: 'cut', hold: 'still',
          mi: i, seed: Z.h(env.cut.seed, i, 231),
        });
        if (b && !first) first = b;
      }
      return first;
    },
  },
}, 'core');

const KANA_LIKE = '\u30a2\u30a4\u30a6\u30a8\u30aa\u30ab\u30ad\u30af\u30b1\u30b3\u30b5\u30b7\u30b9\u30bb\u30bd\u30bf\u30c1\u30c4\u30c6\u30c8\u30ca\u30cb\u30cc\u30cd\u30ce\u30cf\u30d2\u30d5\u30d8\u30db';
})();
