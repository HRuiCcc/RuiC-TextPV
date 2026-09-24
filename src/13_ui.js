/* ============================================================
   RuiC-TextPV — 界面逻辑
   状态、预览循环、时间轴、各面板、一键成片、导出
   ============================================================ */
(() => {
'use strict';

const $ = s => document.querySelector(s);
const $$ = s => Array.prototype.slice.call(document.querySelectorAll(s));
const el = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
};

const ASPECTS = [['16:9', '16:9 横'], ['9:16', '9:16 竖'], ['4:3', '4:3'], ['3:4', '3:4 竖'], ['1:1', '1:1'], ['4:5', '4:5 竖'], ['21:9', '21:9 宽']];
const RES = [['720', '720p'], ['1080', '1080p'], ['1440', '1440p'], ['2160', '4K']];
const FPS = ['24', '30', '60'];
const KEYS = [['off', '正常（用风格的底色）'], ['green', '绿幕（给抠像用）'], ['black', '黑幕（给滤色叠加用）']];
const GROUP_CN = { layout: '排版', enter: '出现', hold: '停留', exit: '消失', decor: '装饰', treat: '文字加工', bg: '背景', cam: '镜头', fx: '画面特效', trans: '转场' };

const state = {
  project: Z.defaultProject(),
  plan: null,
  audio: null,
  audioNode: null,
  history: [], histIdx: -1,
  playing: false, t: 0, loop: true,
  mode: 'easy', panel: 'style',
  abort: null,
  tapOn: false, tapIdx: 0, tapStart: 0,
  openGroups: { layout: true },
  fontReady: 0,
};

let renderer = null;
const view = $('#view');
const vctx = view.getContext('2d');

/* ============================================================
   小工具
   ============================================================ */
function toast(msg, ms = 2200) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._h);
  toast._h = setTimeout(() => { t.hidden = true; }, ms);
}
function fillSelect(sel, opts, value) {
  if (!sel) return;
  sel.innerHTML = '';
  for (const [v, label] of opts) {
    const o = el('option', null, label);
    o.value = v;
    sel.appendChild(o);
  }
  if (value != null) sel.value = String(value);
}
function fmt(t) { return Z.fmtTime(t, 0); }
function partName(group, key) {
  if (!key || key === 'none') return '无';
  const d = Z.registry(group) && Z.registry(group)[key];
  return d ? d.name : key;
}
function isNew(group, key) { const d = Z.registry(group) && Z.registry(group)[key]; return !!(d && d.design); }
function isWa(group, key) { const d = Z.registry(group) && Z.registry(group)[key]; return !!(d && d.wa); }

/* ============================================================
   规划与预览
   ============================================================ */
function rebuild(opts = {}) {
  state.project.fx.hasAudio = !!state.audio;
  state.plan = Z.plan(state.project, state.audio);
  if (opts.keepTime !== true) state.t = Math.min(state.t, Math.max(0, state.plan.duration - 0.01));
  refreshAll();
  Z.ensureFonts(state.plan).then(() => {
    state.fontReady++;
    drawPreview();
    drawStyleThumbs();
  });
}

function previewScale() {
  const vp = $('#viewport');
  const W = state.plan ? state.plan.W : 1920, H = state.plan ? state.plan.H : 1080;
  const availW = Math.max(120, vp.clientWidth - 2), availH = Math.max(80, vp.clientHeight - 2);
  const k = Math.min(availW / W, availH / H);
  view.width = Math.max(2, Math.round(W * k));
  view.height = Math.max(2, Math.round(H * k));
  view.style.width = view.width + 'px';
  view.style.height = view.height + 'px';
  return view.width / W;
}
let lastDrawT = -1, lastDrawPlan = null, lastDrawFast = true;
function drawPreview(fast = true) {
  if (!state.plan) return;
  const scale = previewScale();
  try { renderer.frame(vctx, state.plan, state.t, { scale, fast, noTrans: fast && !state.plan.director }); }
  catch (e) { console.warn(e); }
  lastDrawT = state.t; lastDrawPlan = state.plan; lastDrawFast = fast;
}
let lastFrame = 0;
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.12, (now - lastFrame) / 1000 || 0);
  lastFrame = now;
  if (!state.plan) return;
  if (state.playing) {
    state.t += dt;
    if (state.t >= state.plan.duration) {
      if (state.loop) state.t = 0;
      else { state.t = state.plan.duration - 0.01; setPlaying(false); }
    }
    $('#scrub').value = String(Math.round(state.t / state.plan.duration * 10000));
    $('#timeNow').textContent = Z.fmtTime(state.t, state.plan.fps);
    drawTimeline();
    drawCutBar();
    markLayoutStrip();
    if (state.tapOn) updateTapPanel();
  }
  if (state.playing) drawPreview(true);
  else if (lastDrawT !== state.t || lastDrawPlan !== state.plan || lastDrawFast) drawPreview(false);
}

function setPlaying(on) {
  state.playing = on;
  $('#btnPlay').setAttribute('aria-pressed', on ? 'true' : 'false');
  if (!on && state.plan) drawPreview(false);
}

/* ============================================================
   时间轴
   ============================================================ */
const tl = $('#timeline');
const tctx = tl.getContext('2d');
const LAYOUT_HUE = {};
function hueOfLayout(k) {
  if (LAYOUT_HUE[k] == null) LAYOUT_HUE[k] = (Z.sid(k) % 360);
  return LAYOUT_HUE[k];
}
function drawTimeline() {
  const plan = state.plan;
  if (!plan) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = tl.clientWidth, h = tl.clientHeight;
  if (tl.width !== Math.round(w * dpr) || tl.height !== Math.round(h * dpr)) {
    tl.width = Math.round(w * dpr);
    tl.height = Math.round(h * dpr);
  }
  tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  tctx.clearRect(0, 0, w, h);
  const dur = plan.duration || 1;
  const x = t => t / dur * w;
  /* 波形 */
  if (state.audio && state.audio.peaks) {
    const pk = state.audio.peaks;
    tctx.fillStyle = 'rgba(255,255,255,0.16)';
    for (let i = 0; i < pk.length; i++) {
      const px = i / pk.length * w;
      const bh = pk[i] * h * 0.42;
      tctx.fillRect(px, h / 2 - bh, Math.max(1, w / pk.length), bh * 2);
    }
  }
  /* 拍点 */
  if (plan.beats && plan.beats.length) {
    tctx.strokeStyle = 'rgba(45,225,194,0.22)';
    tctx.lineWidth = 1;
    const step = plan.beats.length > 260 ? Math.ceil(plan.beats.length / 260) : 1;
    for (let i = 0; i < plan.beats.length; i += step) {
      const px = Math.round(x(plan.beats[i])) + 0.5;
      tctx.beginPath(); tctx.moveTo(px, h * 0.62); tctx.lineTo(px, h * 0.86); tctx.stroke();
    }
  }
  /* 分镜块：颜色按排版取色相，高度按强调程度 */
  for (const c of plan.cuts) {
    const x0 = x(c.start), x1 = Math.max(x0 + 1.5, x(c.end));
    const hue = hueOfLayout(c.layout);
    const top = c.emph ? h * 0.2 : h * 0.3;
    const ah = 0.28 + (c.emph ? 0.34 : 0);
    tctx.fillStyle = `hsla(${hue} 72% 56% / ${ah})`;
    tctx.fillRect(x0, top, x1 - x0 - 1, h * 0.3);
    if (c.emph) {
      tctx.fillStyle = 'rgba(255,255,255,0.75)';
      tctx.fillRect(x0, top, x1 - x0 - 1, 2);
    }
    if (c.trans) {
      tctx.fillStyle = 'rgba(255,255,255,0.85)';
      tctx.fillRect(x0, top - 3, 2, h * 0.36);
    }
    /* 有画面特效的镜头加一道底标 */
    const hasFx = plan.events.some(ev => ev.t >= c.start && ev.t < c.end && ev.type !== 'chroma');
    if (hasFx) {
      tctx.fillStyle = 'rgba(255,176,32,0.6)';
      tctx.fillRect(x0, h * 0.62, x1 - x0 - 1, 2);
    }
  }
  /* 歌词行分隔 */
  tctx.fillStyle = 'rgba(255,255,255,0.1)';
  for (const l of plan.lines) tctx.fillRect(Math.round(x(l.start)), 0, 1, h);
  /* 播放头 */
  const px = Math.round(x(state.t)) + 0.5;
  tctx.fillStyle = '#2DE1C2';
  tctx.fillRect(px - 0.5, 0, 1.5, h);
  tctx.beginPath();
  tctx.moveTo(px - 5, 0); tctx.lineTo(px + 5, 0); tctx.lineTo(px, 7);
  tctx.closePath(); tctx.fill();
  $('#tlInfo').textContent = `${plan.cuts.length} 个镜头 · ${plan.lines.length} 句 · ${plan.duration.toFixed(1)}s`;
}
tl.addEventListener('pointerdown', e => {
  const seek = ev => {
    const r = tl.getBoundingClientRect();
    const p = Z.clamp((ev.clientX - r.left) / r.width);
    state.t = Z.clamp(p * state.plan.duration, 0, state.plan.duration - 0.001);
    $('#scrub').value = String(Math.round(p * 10000));
    $('#timeNow').textContent = Z.fmtTime(state.t, state.plan.fps);
    drawTimeline(); drawCutBar(); drawPreview(true);
  };
  seek(e);
  const move = ev => seek(ev);
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
});

/* ============================================================
   当前镜头信息：标签 + 值 的文字对
   ============================================================ */
function drawCutBar() {
  const plan = state.plan;
  const box = $('#cutInfo');
  if (!plan) return;
  const cut = Z.cutAt(plan, state.t);
  box.innerHTML = '';
  if (!cut) return;
  const mkKV = (parent, label, value, cls) => {
    const s = el('span', 'kv' + (cls ? ' ' + cls : ''));
    s.innerHTML = '<b>' + label + '</b><span></span>';
    s.lastChild.textContent = value;
    parent.appendChild(s);
    return s;
  };
  const head = el('div', 'cut-line');
  mkKV(head, '镜头', '#' + String(cut.index + 1).padStart(3, '0') + '  ' + cut.start.toFixed(2) + '→' + cut.end.toFixed(2) + 's  ' + (cut.end - cut.start).toFixed(2) + 's', 'head');
  box.appendChild(head);

  const row = el('div', 'cut-line');
  const add = (label, key, group) => {
    const cls = isNew(group, key) ? 'is-new' : isWa(group, key) ? 'is-wa' : null;
    const s = mkKV(row, label, partName(group, key), cls);
    if (cls === 'is-new') s.title = '动效设计层：本作重新设计的演出';
    if (cls === 'is-wa') s.title = '和风元素';
  };
  add('排版', cut.layout, 'layout');
  add('出现', cut.enter, 'enter');
  add('停留', cut.hold, 'hold');
  add('消失', cut.exit, 'exit');
  if (cut.treat && cut.treat !== 'none') add('加工', cut.treat, 'treat');
  if (cut.bg && cut.bg !== 'none') add('背景', cut.bg, 'bg');
  add('镜头', cut.cam, 'cam');
  if (cut.trans) add('转场', cut.trans, 'trans');
  for (const d of cut.decor || []) add('装饰', d.id, 'decor');
  mkKV(row, '文字', cut.text.replace(/\s+/g, ' '));
  box.appendChild(row);
}

/* ============================================================
   排版缩略图条：用真实引擎给每种排版画一张小图
   点一下就把当前这句的排版换成它
   ============================================================ */
const layoutThumbPlan = {};
let layoutStripBuilt = false;
function currentLineIndex() {
  const plan = state.plan;
  if (!plan) return 0;
  const cut = Z.cutAt(plan, state.t);
  return cut && cut.line >= 0 ? cut.line : 0;
}
function buildLayoutStrip() {
  const strip = $('#layoutStrip');
  if (!strip || layoutStripBuilt) return;
  strip.innerHTML = '';
  for (const key of Z.LAYOUT_ORDER.filter(k => !Z.LAYOUTS[k].special)) {
    const b = el('button', 'lt');
    b.dataset.layout = key;
    b.title = Z.LAYOUTS[key].name + '：点一下把当前这句换成这个排版，再点一次取消';
    const cv = el('canvas');
    cv.width = 168; cv.height = 94;
    b.appendChild(cv);
    b.appendChild(el('span', null, Z.LAYOUTS[key].name));
    b.addEventListener('click', () => {
      const li = currentLineIndex();
      if (!state.project.overrides[li]) state.project.overrides[li] = {};
      const ov = state.project.overrides[li];
      if (ov.layout === key) delete ov.layout;
      else ov.layout = key;
      rebuild({ keepTime: true });
      toast(ov.layout ? ('第 ' + (li + 1) + ' 句排版设为「' + Z.LAYOUTS[key].name + '」') : ('第 ' + (li + 1) + ' 句恢复自动排版'));
    });
    strip.appendChild(b);
  }
  layoutStripBuilt = true;
  setTimeout(paintLayoutThumbs, 0);
}
function paintLayoutThumbs() {
  const strip = $('#layoutStrip');
  if (!strip || !state.plan) return;
  const first = (state.project.lyrics || '').split('\n').map(x => x.trim()).filter(Boolean)[0] || '文字PV';
  const demo = (first.replace(/[*!|]/g, '').split('/')[0] || '文字PV').slice(0, 8);
  const R = new Z.Renderer();
  for (const b of strip.querySelectorAll('.lt')) {
    const key = b.dataset.layout;
    const cv = b.querySelector('canvas');
    try {
      let tp = layoutThumbPlan[key];
      if (!tp) {
        const p = Z.defaultProject();
        p.seed = 5;
        p.lyrics = demo;
        p.timing = Object.assign(p.timing, { tail: 0.2 });
        /* 固定成静态，只展示排版本身 */
        p.overrides = { 0: { layout: key, enter: 'cut', exit: 'cut', hold: 'still', treat: 'none', bg: 'none', cam: 'push', decor: [] } };
        tp = layoutThumbPlan[key] = Z.plan(p, null);
      }
      const cut = tp.cuts[0];
      R.frame(cv.getContext('2d'), tp, cut.start + Math.min(0.45, cut.dur * 0.6), {
        scale: cv.width / tp.W, fast: true, noTrans: true, noHud: true, noPost: true, noGhost: true,
      });
    } catch (e) { /* 单张缩略图失败不影响主流程 */ }
  }
  markLayoutStrip();
}
let _lastStripLayout = null;
function markLayoutStrip() {
  const strip = $('#layoutStrip');
  if (!strip || !state.plan) return;
  const cut = Z.cutAt(state.plan, state.t);
  const cur = cut ? cut.layout : null;
  if (cur === _lastStripLayout) return;
  _lastStripLayout = cur;
  for (const b of strip.querySelectorAll('.lt')) {
    b.setAttribute('aria-pressed', b.dataset.layout === cur ? 'true' : 'false');
  }
  const on = strip.querySelector('.lt[aria-pressed="true"]');
  if (on && strip.scrollWidth > strip.clientWidth) {
    const want = on.offsetLeft - strip.clientWidth / 2 + on.offsetWidth / 2;
    strip.scrollLeft = Math.max(0, want);
  }
}

/* ============================================================
   面板切换
   ============================================================ */
function setMode(m) {
  state.mode = m;
  document.body.dataset.mode = m;
  $('#modeEasy').setAttribute('aria-pressed', m === 'easy' ? 'true' : 'false');
  $('#modePro').setAttribute('aria-pressed', m === 'pro' ? 'true' : 'false');
  $('#tabs').hidden = m === 'easy';
  showPane(m === 'easy' ? 'easy' : state.panel);
}
function showPane(name) {
  if (name !== 'easy') state.panel = name;
  for (const p of $$('#inspector .pane')) p.hidden = (p.dataset.pane !== name);
  for (const b of $$('#tabs button[data-panel]')) {
    b.setAttribute('aria-selected', b.dataset.panel === name ? 'true' : 'false');
  }
  if (name === 'parts') buildPartLists();
  if (name === 'style') drawStyleThumbs();
}
for (const b of $$('#tabs button[data-panel]')) {
  b.addEventListener('click', () => { state.mode = 'pro'; setMode('pro'); showPane(b.dataset.panel); });
}
$('#modeEasy').addEventListener('click', () => setMode('easy'));
$('#modePro').addEventListener('click', () => setMode('pro'));

/* ============================================================
   歌词与分镜表
   ============================================================ */
function buildLineList() {
  const plan = state.plan;
  const list = $('#lineList');
  if (!plan) return;
  list.innerHTML = '';
  $('#linesInfo').textContent = plan.lines.length + ' 句 / ' + plan.cuts.length + ' 个镜头';
  plan.lines.forEach((ln, li) => {
    const ov = state.project.overrides[li] || {};
    const item = el('div', 'line-item' + (ov.lock ? ' locked' : ''));
    /* 左侧竖排编号 */
    item.appendChild(el('div', 'line-idx', String(li + 1).padStart(2, '0')));

    const main = el('div', 'line-main');
    const top = el('div', 'line-top');
    const time = el('input', 'line-time');
    time.type = 'number'; time.step = '0.05'; time.min = '0';
    time.value = (state.project.timing.lineTimes[li] != null ? state.project.timing.lineTimes[li] : ln.start).toFixed(2);
    time.title = '这一句的开始时间（秒）。改了就固定下来';
    time.addEventListener('change', () => {
      state.project.timing.lineTimes[li] = parseFloat(time.value) || 0;
      rebuild({ keepTime: true });
    });
    top.appendChild(time);
    const txt = el('span', 'line-text');
    txt.innerHTML = escapeHTML(ln.text) + (ln.impact ? ' <em>!</em>' : '');
    txt.title = ln.text;
    top.appendChild(txt);
    const acts = el('span', 'line-acts');
    const mk = (label, title, cls, fn) => {
      const b = el('button', 'ibtn ' + cls, label);
      b.title = title;
      b.addEventListener('click', fn);
      return b;
    };
    acts.appendChild(mk('⤨', '只把这一句的排版与演出重新抽一次', '', () => rerollLine(li)));
    acts.appendChild(mk(ov.lock ? '锁' : '开', ov.lock ? '已锁定：重新抽签时不动这一句' : '锁定这一句', ov.lock ? 'on' : '', () => {
      if (!state.project.overrides[li]) state.project.overrides[li] = {};
      const o = state.project.overrides[li];
      o.lock = !o.lock;
      if (o.lock) o.lockedSeed = Z.h(state.project.seed, li + 1, o.seed | 0);
      rebuild({ keepTime: true });
    }));
    top.appendChild(acts);
    main.appendChild(top);

    /* 第二行：这一句的手法（留空 = 自动） */
    const ctl = el('div', 'line-ctl');
    for (const [g, label] of [['layout', '排版'], ['enter', '出现'], ['exit', '消失'], ['hold', '停留'], ['bg', '背景'], ['cam', '镜头'], ['treat', '加工']]) {
      const s = el('select');
      const o0 = el('option', null, label + ' 自动');
      o0.value = '';
      s.appendChild(o0);
      for (const k of Z.order(g)) {
        if (g === 'layout' && Z.registry(g)[k].special) continue;
        const o = el('option', null, Z.registry(g)[k].name + (isNew(g, k) ? '（新）' : isWa(g, k) ? '（和）' : ''));
        o.value = k;
        s.appendChild(o);
      }
      s.value = ov[g] || '';
      if (ov[g]) s.title = '已手动指定，不受随机影响';
      s.addEventListener('change', () => {
        if (!state.project.overrides[li]) state.project.overrides[li] = {};
        if (s.value) state.project.overrides[li][g] = s.value;
        else delete state.project.overrides[li][g];
        rebuild({ keepTime: true });
      });
      ctl.appendChild(s);
    }
    main.appendChild(ctl);

    /* 这一句切出来的镜头 */
    const pills = el('div', 'cut-pills');
    plan.cuts.filter(c => c.line === li).forEach(c => {
      const pill = el('span', 'pill', c.start.toFixed(2) + ' ' + partName('layout', c.layout));
      pill.title = partName('enter', c.enter) + ' → ' + partName('hold', c.hold) + ' → ' + partName('exit', c.exit);
      pill.addEventListener('click', () => {
        state.t = c.start + 0.01;
        $('#scrub').value = String(Math.round(state.t / plan.duration * 10000));
        drawTimeline(); drawCutBar(); drawPreview(false); markLayoutStrip();
      });
      pills.appendChild(pill);
    });
    main.appendChild(pills);

    item.appendChild(main);
    list.appendChild(item);
  });
}
function escapeHTML(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function rerollLine(li) {
  const o = state.project.overrides[li] || (state.project.overrides[li] = {});
  o.seed = (o.seed | 0) + 1 + Math.floor(Math.random() * 997);
  if (o.lock) o.lock = false;
  rebuild();
}

/* ============================================================
   风格
   ============================================================ */
let thumbCache = {};
function buildStyleStrip() {
  const strip = $('#styleStrip');
  strip.innerHTML = '';
  for (const k of Z.STYLE_ORDER) {
    const st = Z.STYLES[k];
    const card = el('button', 'style-card');
    card.setAttribute('aria-pressed', state.project.style === k ? 'true' : 'false');
    card.title = st.desc;
    const cv = el('canvas');
    cv.width = 244; cv.height = 136;
    cv.dataset.style = k;
    card.appendChild(cv);
    card.appendChild(el('span', 'sc-name', st.name));
    card.appendChild(el('span', 'sc-desc', st.desc));
    card.addEventListener('click', () => {
      state.project.style = k;
      for (const c of $$('.style-card')) c.setAttribute('aria-pressed', 'false');
      card.setAttribute('aria-pressed', 'true');
      rebuild();
    });
    strip.appendChild(card);
  }
  $('#styleCount').textContent = `${Z.STYLE_ORDER.length} 套`;
}
/* 用真实引擎给每套风格渲染一张缩略图 */
function drawStyleThumbs() {
  const cards = $$('.style-card canvas');
  if (!cards.length || state.thumbing) return;
  state.thumbing = true;
  const first = (state.project.lyrics || '').split('\n').map(x => x.trim()).filter(Boolean)[0] || '文字PV';
  const demo = first.replace(/[*!|]/g, '').slice(0, 9);
  let i = 0;
  const step = () => {
    if (i >= cards.length) { state.thumbing = false; return; }
    const cv = cards[i++];
    const key = cv.dataset.style;
    try {
      const p = Z.defaultProject();
      p.style = key;
      p.lyrics = demo;
      p.fx = Object.assign(p.fx, { texture: 0.7, decor: 0.7 });
      p.fx.hasAudio = false;
      const plan = Z.plan(p, null);
      const r = new Z.Renderer();
      const ctx = cv.getContext('2d');
      r.frame(ctx, plan, Math.max(0.35, plan.cuts[0].start + 0.55), { scale: cv.width / plan.W, fast: true, noTrans: true, noHud: true, noPost: true });
    } catch (e) { /* 缩略图失败不影响主流程 */ }
    setTimeout(step, 0);
  };
  step();
}
function buildFontRoles() {
  const box = $('#fontRoles');
  box.innerHTML = '';
  const roles = [['display', '标题字'], ['serif', '衬线'], ['body', '正文字'], ['mono', '数字/信息']];
  for (const [role, label] of roles) {
    const row = el('div', 'font-role');
    row.appendChild(el('label', null, label));
    const s = el('select');
    const auto = el('option', null, '跟随风格');
    auto.value = '';
    s.appendChild(auto);
    for (const k of Z.FONT_KEYS) {
      const o = el('option', null, Z.FONTS[k].label + (Z.FONTS[k].user ? '（自定义）' : ''));
      o.value = k;
      s.appendChild(o);
    }
    s.value = state.project.fonts[role] || '';
    s.addEventListener('change', () => {
      if (s.value) state.project.fonts[role] = s.value;
      else delete state.project.fonts[role];
      rebuild();
    });
    row.appendChild(s);
    box.appendChild(row);
  }
}
function buildColorRows() {
  const mk = (id, keys, defaults) => {
    const box = $(id);
    box.innerHTML = '';
    for (const [k, label] of keys) {
      const wrap = el('label', 'swatch');
      const cur = state.project.colors[k] || defaults[k];
      wrap.style.background = cur;
      const inp = el('input');
      inp.type = 'color'; inp.value = cur;
      inp.title = label;
      inp.addEventListener('input', () => {
        state.project.colors[k] = inp.value;
        wrap.style.background = inp.value;
        const on = id === '#accentRow' ? '#accentOn' : '#colorOn';
        $(on).checked = true;
        state.project.colors[id === '#accentRow' ? 'accentOn' : 'enabled'] = true;
        rebuild();
      });
      wrap.appendChild(inp);
      wrap.appendChild(el('span', null, label));
      box.appendChild(wrap);
    }
  };
  mk('#accentRow', [['accent', '强调'], ['ghostA', '色散A'], ['ghostB', '色散B']], { accent: '#2DE1C2', ghostA: '#FF2A2A', ghostB: '#2AA8FF' });
  mk('#baseRow', [['bg', '底色'], ['fg', '字色'], ['sub', '次要']], { bg: '#101216', fg: '#F2F4F7', sub: '#9AA3AE' });
}

/* ============================================================
   动效面板
   ============================================================ */
const FX_SLIDERS = [
  ['motion', '动作幅度', '推拉摇移的力度、位移的距离'],
  ['glitch', '故障量', '撕裂、错位、跳帧这类破坏感的出现频率'],
  ['chroma', '色散', '红蓝通道错开的强度，霓虹与复古味的来源'],
  ['decor', '装饰密度', '叠加图形与文字加工的数量'],
  ['density', '切分密度', '一句歌词被切成几个镜头'],
  ['texture', '质感', '颗粒、扫描线、暗角、泛光的量'],
  ['bgSwitch', '换底频率', '同一支片子里配色方案切换的频繁程度'],
  ['lettering', '写字感', '每个字的旋转、高低、大小与偶尔变色的幅度。0 = 方正印刷体，1 = 手写涂鸦'],
];
function buildFxSliders() {
  const box = $('#fxSliders');
  box.innerHTML = '';
  for (const [key, label, tip] of FX_SLIDERS) {
    const row = el('div', 'slider');
    const lab = el('label', null, label);
    lab.title = tip;
    const r = el('input');
    r.type = 'range'; r.min = '0'; r.max = '1'; r.step = '0.01';
    r.value = String(state.project.fx[key] ?? 0.5);
    const out = el('output', null, Math.round((state.project.fx[key] ?? 0.5) * 100) + '%');
    r.addEventListener('input', () => {
      state.project.fx[key] = parseFloat(r.value);
      out.textContent = Math.round(state.project.fx[key] * 100) + '%';
    });
    r.addEventListener('change', () => rebuild({ keepTime: true }));
    row.appendChild(lab); row.appendChild(r); row.appendChild(out);
    box.appendChild(row);
  }
}

/* ============================================================
   手法面板
   ============================================================ */
function buildPartLists() {
  const box = $('#partLists');
  box.innerHTML = '';
  const filter = ($('#partFilter').value || '').trim().toLowerCase();
  let shown = 0, total = 0;
  for (const g of Z.GROUPS) {
    const keys = Z.order(g).filter(k => {
      const d = Z.registry(g)[k];
      if (d.special) return false;
      if (!filter) return true;
      return d.name.toLowerCase().includes(filter) || k.toLowerCase().includes(filter);
    });
    if (!keys.length) continue;
    total += Z.order(g).filter(k => !Z.registry(g)[k].special).length;
    const grp = el('div', 'part-group');
    grp.dataset.open = state.openGroups[g] ? 'true' : 'false';
    const head = el('div', 'part-head');
    head.appendChild(el('span', 'arrow', '▶'));
    head.appendChild(el('h4', null, GROUP_CN[g] || g));
    head.appendChild(el('span', 'cnt', `${keys.length} / ${Z.order(g).filter(k => !Z.registry(g)[k].special).length}`));
    head.addEventListener('click', () => {
      state.openGroups[g] = grp.dataset.open !== 'true';
      grp.dataset.open = state.openGroups[g] ? 'true' : 'false';
    });
    grp.appendChild(head);

    const body = el('div', 'part-body');
    const tools = el('div', 'tools');
    const mkTool = (label, fn) => {
      const b = el('button', 'btn ghost sm', label);
      b.addEventListener('click', fn);
      tools.appendChild(b);
    };
    const setAll = v => {
      const src = state.project.enabled[g] || (state.project.enabled[g] = {});
      for (const k of keys) src[k] = v;
      rebuild({ keepTime: true });
    };
    mkTool('全开', () => setAll(true));
    mkTool('全关', () => setAll(false));
    mkTool('反选', () => {
      const src = state.project.enabled[g] || (state.project.enabled[g] = {});
      for (const k of keys) src[k] = src[k] === false;
      rebuild({ keepTime: true });
    });
    body.appendChild(tools);

    const items = el('div', 'part-items');
    for (const k of keys) {
      const d = Z.registry(g)[k];
      const src = state.project.enabled[g] || {};
      const on = src[k] !== false && Z.randomOk(state.project, g, k);
      const pi = el('label', 'pi');
      pi.dataset.on = on ? 'true' : 'false';
      pi.dataset.off = src[k] === false ? 'true' : 'false';
      const inp = el('input');
      inp.type = 'checkbox'; inp.checked = src[k] !== false;
      inp.addEventListener('change', () => {
        if (!state.project.enabled[g]) state.project.enabled[g] = {};
        state.project.enabled[g][k] = inp.checked;
        rebuild({ keepTime: true });
      });
      pi.appendChild(inp);
      pi.appendChild(el('span', 'dt'));
      pi.appendChild(el('span', null, d.name));
      if (d.design) {
        const b = el('span', 'badge n', '新');
        b.title = '动效设计层：本作重新设计的演出';
        pi.appendChild(b);
      } else if (d.wa) {
        const b = el('span', 'badge w', '和');
        b.title = '和风元素';
        pi.appendChild(b);
      }
      if ((src[k] === false) || !Z.randomOk(state.project, g, k)) {
        pi.title = src[k] === false ? '已被手动关掉' : (d.design ? '需要打开「动效设计层」' : '需要打开「和风元素」');
      }
      items.appendChild(pi);
      shown++;
    }
    body.appendChild(items);
    grp.appendChild(body);
    box.appendChild(grp);
  }
  $('#partsTotal').textContent = `${Z.countParts()} 个零件 · 显示 ${shown}`;
}

/* ============================================================
   一键成片 / 重抽
   ============================================================ */
function currentSnapshot() {
  const p = state.project;
  return {
    style: p.style, mood: p.mood, seed: p.seed, director: p.director,
    fx: JSON.parse(JSON.stringify(p.fx)),
    colors: JSON.parse(JSON.stringify(p.colors)),
    fonts: JSON.parse(JSON.stringify(p.fonts)),
  };
}
function applySnapshot(s) {
  Object.assign(state.project, {
    style: s.style, mood: s.mood, seed: s.seed, director: s.director,
    fx: JSON.parse(JSON.stringify(s.fx)),
    colors: JSON.parse(JSON.stringify(s.colors)),
    fonts: JSON.parse(JSON.stringify(s.fonts)),
  });
}
function pushHistory() {
  state.history = state.history.slice(0, state.histIdx + 1);
  state.history.push(currentSnapshot());
  if (state.history.length > 40) state.history.shift();
  state.histIdx = state.history.length - 1;
}
function omakase(partial) {
  const p = state.project;
  if (!partial || partial === 'style') {
    const styles = p.director ? ['afterglow', 'nightwave', 'paperfire', 'neon', 'mono', 'synth', 'acid', 'riso', 'ink'] : Z.STYLE_ORDER;
    const pool = styles.filter(k => k !== p.style);
    p.style = pool[Math.floor(Math.random() * pool.length)] || p.style;
  }
  if (!partial || partial === 'mood') {
    const moods = (p.director ? ['graphic', 'emo', 'editorial', 'glitch'] : Z.MOOD_ORDER).filter(k => k !== p.mood);
    p.mood = moods[Math.floor(Math.random() * moods.length)];
    const m = Z.MOODS[p.mood];
    if (m && m.fx) p.fx = Object.assign(p.fx, m.fx);
  }
  if (!partial) p.colors.accentOn = false;
  if (partial === 'palette') {
    const st = Z.STYLES[p.style] || Z.STYLES.ink;
    const bg = (st.schemes[0] || {}).bg || '#101216';
    const pal = Z.rollPalette(bg);
    p.colors.accentOn = true;
    p.colors.accent = pal.accent;
    p.colors.ghostA = pal.ghostA;
    p.colors.ghostB = pal.ghostB;
  }
  if (!partial || partial === 'seed') p.seed = Math.floor(Math.random() * 99999999);
  rebuild({ keepTime: false });
  state.t = 0;
  setPlaying(true);
  pushHistory();
  syncControls();
  updateEasyNow();
  toast(`新的一版：${(Z.STYLES[p.style] || {}).name || p.style} · ${(Z.MOODS[p.mood] || {}).name || '不偏不倚'} · 种子 ${p.seed}`);
}
function gotoHistory(d) {
  const i = state.histIdx + d;
  if (i < 0 || i >= state.history.length) { toast('没有更多版本了'); return; }
  state.histIdx = i;
  applySnapshot(state.history[i]);
  rebuild({ keepTime: false });
  state.t = 0;
  syncControls();
  updateEasyNow();
  updateHistPos();
}
function updateHistPos() {
  const s = `${state.histIdx + 1} / ${state.history.length}`;
  $('#histPos').textContent = s;
  $('#histPos2').textContent = s;
}
function updateEasyNow() {
  const p = state.project, plan = state.plan;
  const box = $('#easyNow');
  if (!box || !plan) return;
  const st = plan.style;
  const sw = st.schemes[0] || {};
  box.innerHTML = '';
  const row = (label, val, colors) => {
    const r = el('div', 'now-row');
    r.appendChild(el('b', null, label));
    if (colors) {
      const wrap = el('span', 'mini-swatches');
      for (const c of colors) {
        const i = el('i');
        i.style.background = c;
        wrap.appendChild(i);
      }
      r.appendChild(wrap);
      r.appendChild(el('span', 'dim', val));
    } else {
      r.appendChild(el('span', null, val));
    }
    box.appendChild(r);
  };
  row('风格', `${st.name || p.style}`);
  row('气质', st.moodName || '不偏不倚');
  row('配色', `${sw.bg || ''} / ${sw.fg || ''}`, [sw.bg, sw.fg, sw.accent, sw.ghostA, sw.ghostB].filter(Boolean));
  row('标题字', Z.fontLabel((st.fonts.display || [])[0]));
  row('分镜', `${plan.cuts.length} 个镜头 · 排 ${new Set(plan.cuts.map(c => c.layout)).size} 种`);
  row('演出', `出现 ${new Set(plan.cuts.map(c => c.enter)).size} 种 · 消失 ${new Set(plan.cuts.map(c => c.exit)).size} 种 · 装饰 ${plan.cuts.reduce((a, c) => a + (c.decor || []).length, 0)} 个`);
  row('种子', String(p.seed));
}

/* ============================================================
   导出
   ============================================================ */
async function runExport(kind) {
  const plan = state.plan, project = state.project;
  const box = $('#inspector .pane:not([hidden]) .progress-box') || $('#inspector .progress-box');
  const showBox = () => {
    for (const b of $$('.progress-box')) b.hidden = false;
  };
  showBox();
  const bars = $$('.progress-box .bar i');
  const texts = $$('.progress-box .ptext');
  const ctrl = new AbortController();
  state.abort = ctrl;
  const onProgress = (p, msg) => {
    for (const b of bars) b.style.width = (Z.clamp(p) * 100).toFixed(1) + '%';
    for (const t of texts) t.textContent = msg;
  };
  const name = (project.title || 'ruic').replace(/[\\/:*?"<>|]/g, '_');
  const suffix = project.keyBg === 'green' ? '_greenback' : project.keyBg === 'black' ? '_blackback' : '';
  setPlaying(false);
  try {
    if (kind === 'mp4') {
      const r = await Z.exportMP4({ plan, project, audio: state.audio, quality: $('#outQuality').value, onProgress, signal: ctrl.signal });
      await Z.saveFile(`${name}${suffix}_${plan.W}x${plan.H}_${plan.fps}fps.mp4`, r.blob);
      toast(`导出完成 · ${r.codec}${r.audio ? ' + ' + r.audio : ''} · ${r.width}×${r.height} · ${Z.fmtBytes(r.blob.size)}`, 4200);
    } else if (kind === 'png') {
      const blob = await Z.exportPNGZip({ plan, project, transparent: false, onProgress, signal: ctrl.signal });
      await Z.saveFile(`${name}${suffix}_png_${plan.fps}fps.zip`, blob);
      toast(`导出完成 · ${Z.fmtBytes(blob.size)}`, 3600);
    } else if (kind === 'pnga') {
      const blob = await Z.exportPNGZip({ plan, project, transparent: true, onProgress, signal: ctrl.signal });
      await Z.saveFile(`${name}_alpha_png_${plan.fps}fps.zip`, blob);
      toast(`导出完成（透明底）· ${Z.fmtBytes(blob.size)}`, 3600);
    }
  } catch (e) {
    console.warn(e);
    toast('导出失败：' + (e && e.message ? e.message : e), 5000);
  } finally {
    state.abort = null;
    for (const b of $$('.progress-box')) b.hidden = true;
    for (const t of texts) t.textContent = '—';
    for (const b of bars) b.style.width = '0%';
  }
}
for (const b of $$('.progress-box .cancel')) {
  b.addEventListener('click', () => { if (state.abort) state.abort.abort(); });
}

/* ============================================================
   跟随音乐打点
   ============================================================ */
function startTap() {
  if (!state.audio) { toast('先载入一首音乐'); return; }
  $('#tapPanel').hidden = false;
  state.tapOn = true;
  state.tapIdx = 0;
  state.project.timing.lineTimes = {};
  const ctx = new AudioContext();
  const src = ctx.createBufferSource();
  src.buffer = state.audio.buffer;
  src.connect(ctx.destination);
  const t0 = ctx.currentTime + 0.12;
  src.start(t0);
  state.tapStart = t0;
  state.tapCtx = ctx;
  state.audioNode = src;
  state.tapTimes = [];
  updateTapPanel();
}
function tap() {
  if (!state.tapOn) return;
  const idx = state.tapIdx;
  const t = Math.max(0, (state.tapCtx ? state.tapCtx.currentTime : 0) - state.tapStart);
  state.tapTimes[idx] = +t.toFixed(3);
  state.project.timing.lineTimes[idx] = state.tapTimes[idx];
  state.tapIdx++;
  if (state.tapIdx >= state.plan.lines.length) { stopTap(); rebuild(); return; }
  updateTapPanel();
}
function updateTapPanel() {
  const ln = state.plan && state.plan.lines[state.tapIdx];
  $('#tapLine').textContent = ln ? ln.text : '—';
}
function stopTap() {
  state.tapOn = false;
  $('#tapPanel').hidden = true;
  if (state.audioNode) { try { state.audioNode.stop(); } catch (e) {} state.audioNode = null; }
  if (state.tapCtx) { try { state.tapCtx.close(); } catch (e) {} state.tapCtx = null; }
  rebuild();
}

/* ============================================================
   控件同步
   ============================================================ */
function syncControls() {
  const p = state.project;
  $('#lyrics').value = p.lyrics;
  $('#songTitle').value = p.title;
  $('#songArtist').value = p.artist;
  $('#bpm').value = p.timing.bpm || '';
  $('#offset').value = p.timing.offset;
  $('#lineScale').value = p.timing.lineScale;
  $('#tail').value = p.timing.tail;
  $('#snap').checked = p.timing.snap !== false;
  $('#seed').value = p.seed;
  $('#fxFlash').checked = p.fx.flash !== false;
  $('#fxKoma').value = String(p.fx.koma ?? 0);
  $('#fxHud').value = p.fx.hud || 'auto';
  $('#accentOn').checked = !!p.colors.accentOn;
  $('#colorOn').checked = !!p.colors.enabled;
  $('#includeAudio').checked = p.includeAudio !== false;
  $('#eDesign').checked = p.design !== false;
  $('#tDesign').checked = p.design !== false;
  $('#eDirector').checked = p.director !== false;
  $('#tDirector').checked = p.director !== false;
  $('#eWa').checked = p.wa !== false;
  $('#tWa').checked = p.wa !== false;
  for (const id of ['#eAspect', '#outAspect']) $(id).value = p.aspect;
  for (const id of ['#eRes', '#outRes']) $(id).value = String(p.res);
  for (const id of ['#eFps', '#outFps']) $(id).value = String(p.fps);
  for (const id of ['#eKey', '#outKey']) $(id).value = p.keyBg || 'off';
  $('#vpBadge').hidden = !p.keyBg || p.keyBg === 'off';
  if (p.keyBg && p.keyBg !== 'off') $('#vpBadge').textContent = p.keyBg === 'green' ? '绿幕素材预览' : '黑幕素材预览';
  $('#audioName').textContent = state.audio
    ? `${state.audio.name} · ${state.audio.duration.toFixed(1)}s · 约 ${state.audio.bpm} BPM · 检测到 ${state.audio.beats.length} 个拍点`
    : '还没载入音乐。载入后会自动测出速度与拍点，分镜切口会往拍上贴。';
  $('#estSize').textContent = estSizeText();
  updateHistPos();
}
function estSizeText() {
  const p = state.project;
  const [w, h] = Z.outputSize(p);
  const px = w * h * p.fps;
  const q = $('#outQuality') ? $('#outQuality').value : 'high';
  const br = px * (q === 'max' ? 0.42 : q === 'high' ? 0.28 : 0.16);
  const secs = state.plan ? state.plan.duration : 10;
  return `（约 ${w}×${h}，预计 ${Z.fmtBytes(br * secs / 8)}）`;
}

/* ============================================================
   事件绑定
   ============================================================ */
function bind() {
  /* 顶栏 */
  $('#songTitle').addEventListener('change', e => { state.project.title = e.target.value.trim(); rebuild({ keepTime: true }); });
  $('#songArtist').addEventListener('change', e => { state.project.artist = e.target.value.trim(); rebuild({ keepTime: true }); });
  $('#btnSave').addEventListener('click', saveProject);
  $('#btnSave2').addEventListener('click', saveProject);
  $('#btnStruct').addEventListener('click', exportStruct);
  $('#btnHelp').addEventListener('click', () => $('#helpDlg').showModal());
  for (const b of $$('.terms-open')) b.addEventListener('click', () => $('#helpDlg').showModal());

  const openFile = (file) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        state.project = Z.loadProject(JSON.parse(r.result));
        rebuild({ keepTime: false });
        syncControls();
        buildPartLists();
        updateEasyNow();
        toast('工程已载入');
      } catch (e) { toast('这个文件读不出来'); }
    };
    r.readAsText(file);
  };
  $('#fileProject').addEventListener('change', e => { if (e.target.files[0]) openFile(e.target.files[0]); });
  $('#fileProject2').addEventListener('change', e => { if (e.target.files[0]) openFile(e.target.files[0]); });

  /* 歌词 */
  $('#lyrics').addEventListener('input', e => {
    clearTimeout(bind._h);
    bind._h = setTimeout(() => {
      state.project.lyrics = e.target.value;
      layoutStripBuilt = false;
      for (const k of Object.keys(layoutThumbPlan)) delete layoutThumbPlan[k];
      rebuild({ keepTime: true });
    }, 320);
  });
  $('#btnSyntax').addEventListener('click', () => {
    const s = $('#syntax');
    s.hidden = !s.hidden;
    $('#btnSyntax').setAttribute('aria-expanded', s.hidden ? 'false' : 'true');
  });

  /* 传输 */
  $('#btnPlay').addEventListener('click', () => setPlaying(!state.playing));
  $('#scrub').addEventListener('input', e => {
    state.t = Z.clamp(parseFloat(e.target.value) / 10000 * state.plan.duration, 0, state.plan.duration - 0.001);
    $('#timeNow').textContent = Z.fmtTime(state.t, state.plan.fps);
    drawTimeline(); drawCutBar();
  });
  $('#btnLoop').addEventListener('click', e => {
    state.loop = !state.loop;
    e.currentTarget.setAttribute('aria-pressed', state.loop ? 'true' : 'false');
  });
  $('#btnPrev').addEventListener('click', () => gotoHistory(-1));
  $('#btnNext').addEventListener('click', () => gotoHistory(1));
  $('#btnPrev2').addEventListener('click', () => gotoHistory(-1));
  $('#btnNext2').addEventListener('click', () => gotoHistory(1));
  $('#btnShuffle').addEventListener('click', () => {
    state.project.seed = Math.floor(Math.random() * 99999999);
    rebuild({ keepTime: false });
    syncControls();
    toast('分镜已重抽（锁定的行没动）');
  });
  $('#btnOmakase').addEventListener('click', () => omakase());
  $('#btnOmakaseBig').addEventListener('click', () => omakase());
  $('#eStyle').addEventListener('click', () => omakase('style'));
  $('#ePalette').addEventListener('click', () => omakase('palette'));
  $('#eMood').addEventListener('click', () => omakase('mood'));
  $('#eCut').addEventListener('click', () => { omakase('seed'); });

  /* 音频 */
  $('#audioFile').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    toast('正在分析音频…', 3000);
    try {
      state.audio = await Z.analyzeAudio(f);
      if (state.audio.bpm) state.project.timing.bpm = 0;   // 用检测值
      state.project.timing.lineTimes = {};
      rebuild({ keepTime: false });
      syncControls();
      toast(`已载入：${state.audio.bpm} BPM · ${state.audio.beats.length} 个拍点`, 3600);
    } catch (err) {
      console.warn(err);
      toast('这个音频解码不了，换一个格式试试');
    }
  });
  $('#btnClearAudio').addEventListener('click', () => {
    state.audio = null;
    rebuild({ keepTime: false });
    syncControls();
  });
  $('#btnTap').addEventListener('click', startTap);
  $('#tapBtn').addEventListener('click', tap);
  $('#tapStop').addEventListener('click', stopTap);
  window.addEventListener('keydown', e => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.code === 'Space') { e.preventDefault(); if (state.tapOn) tap(); else setPlaying(!state.playing); }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); omakase(); }
  });
  for (const [id, key] of [['#bpm', 'bpm'], ['#offset', 'offset'], ['#lineScale', 'lineScale'], ['#tail', 'tail']]) {
    $(id).addEventListener('change', e => {
      state.project.timing[key] = parseFloat(e.target.value) || 0;
      rebuild({ keepTime: true });
    });
  }
  $('#snap').addEventListener('change', e => { state.project.timing.snap = e.target.checked; rebuild({ keepTime: true }); });
  $('#btnResetTimes').addEventListener('click', () => {
    state.project.timing.lineTimes = {};
    rebuild({ keepTime: true });
    toast('手动打点已清掉');
  });
  $('#includeAudio').addEventListener('change', e => { state.project.includeAudio = e.target.checked; });

  /* 风格 */
  $('#btnAddFont').addEventListener('click', () => {
    const name = $('#localFont').value.trim();
    if (!name) return;
    const key = 'user_' + Z.sid(name).toString(36);
    Z.addFont(key, name + '（本机）', name, 400, 'custom');
    state.project.fonts.display = key;
    $('#localFont').value = '';
    buildFontRoles();
    rebuild({ keepTime: true });
    toast('已把本机字体「' + name + '」用作标题字');
  });
  $('#fontFile').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const key = await Z.loadFontFile(f);
      state.project.fonts.display = key;
      buildFontRoles();
      rebuild({ keepTime: true });
      toast('字体已载入并设为标题字');
    } catch (err) { toast('这个字体文件读不进来'); }
  });
  $('#accentOn').addEventListener('change', e => { state.project.colors.accentOn = e.target.checked; rebuild({ keepTime: true }); });
  $('#colorOn').addEventListener('change', e => { state.project.colors.enabled = e.target.checked; rebuild({ keepTime: true }); });
  $('#btnRandPalette').addEventListener('click', () => omakase('palette'));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.tapOn) stopTap();
  });

  /* 动效 */
  $('#fxFlash').addEventListener('change', e => { state.project.fx.flash = e.target.checked; rebuild({ keepTime: true }); });
  $('#fxKoma').addEventListener('change', e => { state.project.fx.koma = +e.target.value; rebuild({ keepTime: true }); });
  $('#fxHud').addEventListener('change', e => { state.project.fx.hud = e.target.value; rebuild({ keepTime: true }); });
  $('#seed').addEventListener('change', e => { state.project.seed = parseInt(e.target.value, 10) || 1; rebuild({ keepTime: false }); });
  $('#btnSeed').addEventListener('click', () => {
    state.project.seed = Math.floor(Math.random() * 99999999);
    $('#seed').value = state.project.seed;
    rebuild({ keepTime: false });
  });
  for (const id of ['#eDesign', '#tDesign']) {
    $(id).addEventListener('change', e => {
      state.project.design = e.target.checked;
      syncControls(); buildPartLists(); rebuild({ keepTime: true });
      toast(e.target.checked ? '动效设计层已打开' : '只用经典动效');
    });
  }
  for (const id of ['#eDirector', '#tDirector']) {
    $(id).addEventListener('change', e => {
      state.project.director = e.target.checked;
      syncControls(); rebuild({ keepTime: true }); updateEasyNow();
      toast(e.target.checked ? '已启用导演编排：版式和运动会成套配合' : '已切换为自由随机编排');
    });
  }
  for (const id of ['#eWa', '#tWa']) {
    $(id).addEventListener('change', e => {
      state.project.wa = e.target.checked;
      syncControls(); buildPartLists(); rebuild({ keepTime: true });
    });
  }

  /* 手法 */
  let filtH;
  $('#partFilter').addEventListener('input', () => {
    clearTimeout(filtH);
    filtH = setTimeout(buildPartLists, 160);
  });
  $('#btnPartsAll').addEventListener('click', () => {
    state.project.enabled = {};
    buildPartLists(); rebuild({ keepTime: true });
  });
  $('#btnPartsNone').addEventListener('click', () => {
    for (const g of Z.GROUPS) {
      state.project.enabled[g] = {};
      for (const k of Z.order(g)) state.project.enabled[g][k] = false;
    }
    buildPartLists(); rebuild({ keepTime: true });
  });

  /* 输出 */
  for (const [id, key] of [['#eAspect', 'aspect'], ['#outAspect', 'aspect'], ['#eRes', 'res'], ['#outRes', 'res'], ['#eFps', 'fps'], ['#outFps', 'fps'], ['#eKey', 'keyBg'], ['#outKey', 'keyBg']]) {
    $(id).addEventListener('change', e => {
      const v = e.target.value;
      state.project[key] = (key === 'res' || key === 'fps') ? +v : v;
      syncControls();
      rebuild({ keepTime: true });
    });
  }
  $('#outQuality').addEventListener('change', syncControls);
  $('#eMP4').addEventListener('click', () => runExport('mp4'));
  $('#btnMP4').addEventListener('click', () => runExport('mp4'));
  $('#btnPNG').addEventListener('click', () => runExport('png'));
  $('#btnPNGA').addEventListener('click', () => runExport('pnga'));

  window.addEventListener('resize', () => { drawTimeline(); drawPreview(true); });
}

/* ============================================================
   工程存取
   ============================================================ */
async function saveProject() {
  const data = JSON.stringify(Z.trimProject(state.project), null, 1);
  const name = (state.project.title || 'ruic-project').replace(/[\\/:*?"<>|]/g, '_');
  await Z.saveFile(`${name}.json`, new Blob([data], { type: 'application/json' }));
  toast('工程已保存（.json）');
}
async function exportStruct() {
  if (!state.plan) return;
  const data = JSON.stringify(Z.projectJSON(state.project, state.plan), null, 1);
  const name = (state.project.title || 'ruic').replace(/[\\/:*?"<>|]/g, '_');
  await Z.saveFile(`${name}_结构.json`, new Blob([data], { type: 'application/json' }));
  toast('结构数据已导出：含每个镜头的排版、演出、时间与配色', 3600);
}

function refreshAll() {
  if (!state.plan) return;
  $('#timeDur').textContent = Z.fmtTime(state.plan.duration, state.plan.fps);
  $('#timeNow').textContent = Z.fmtTime(state.t, state.plan.fps);
  $('#statusLeft').textContent = `${state.plan.W}×${state.plan.H} 设计 · ${state.plan.fps}fps · ${state.plan.duration.toFixed(1)}s`;
  $('#statusRight').textContent = `${Z.countParts()} 个零件 · 设计层 ${state.project.design === false ? '关' : '开'} · 和风 ${state.project.wa === false ? '关' : '开'}`;
  drawTimeline();
  drawCutBar();
  buildLineList();
  buildLayoutStrip();
  markLayoutStrip();
  updateEasyNow();
}

/* ============================================================
   启动
   ============================================================ */
function init() {
  renderer = new Z.Renderer();
  fillSelect($('#eAspect'), ASPECTS); fillSelect($('#outAspect'), ASPECTS);
  fillSelect($('#eRes'), RES); fillSelect($('#outRes'), RES);
  fillSelect($('#eFps'), FPS.map(f => [f, f + ' fps']));
  fillSelect($('#outFps'), FPS.map(f => [f, f + ' fps']));
  fillSelect($('#eKey'), KEYS); fillSelect($('#outKey'), KEYS);
  buildStyleStrip();
  buildFontRoles();
  buildColorRows();
  buildFxSliders();
  buildPartLists();
  bind();
  rebuild({ keepTime: false });
  state.t = state.plan.lines.length ? state.plan.lines[0].start + 0.28 : 0;
  drawPreview();
  syncControls();
  setMode('easy');
  requestAnimationFrame(tick);
  updateEasyNow();
  pushHistory();
  updateHistPos();
  /* 首屏直接播放同一套可复现的示例，让文字运动先于控件被看见。 */
  setPlaying(true);
}
init();
})();
