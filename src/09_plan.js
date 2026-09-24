/* ============================================================
   RuiC-TextPV — 规划器
   歌词 → 行 → 词块 → 切分点 → 带演出的镜头 + 画面事件
   整条链路只依赖 project.seed，同一个种子在任何机器上
   都会排出同一支片子。
   ============================================================ */
(() => {
'use strict';

Z.SAMPLE_LYRICS = `你总是盘旋在我脑海里面
想跟你缠绵一直到路灯熄灭
你在我身边说可以放弃体面
我装没听见还越来越没底线`;

Z.defaultProject = () => ({
  version: 1,
  title: '', artist: '',
  lyrics: Z.SAMPLE_LYRICS,
  style: 'afterglow', mood: 'graphic',
  director: true,         // 优先使用成套的版式与运动节奏；手动指定仍然优先
  design: true,          // 启用"动效设计层"（本作新增的显影/物理/声学/材质类演出）
  wa: true,              // 启用和风元素（灯笼、青海波、麻叶纹、月夜…）
  keyBg: 'off',          // 'off' | 'green' | 'black'  合成素材用
  seed: 20260924,
  aspect: '16:9', res: 1080, fps: 60,
  fx: { motion: 0.72, glitch: 0.24, chroma: 0.42, decor: 0.28, density: 0.52, lettering: 0.55, texture: 0.48, flash: true, koma: 0, hud: 'off', bgSwitch: 0.18 },
  enabled: {},
  timing: { bpm: 0, offset: 0.4, snap: true, tail: 0.9, lineTimes: {}, lineScale: 1 },
  overrides: {},
  colors: { enabled: false },
  fonts: {},
});

/* 零件是否允许被随机抽到：设计层 / 和风 两个开关 */
Z.randomOk = (project, group, key) => {
  const d = Z.registry(group)[key];
  if (!d) return true;
  if (d.wa && project.wa === false) return false;
  if (d.design && project.design === false) return false;
  return true;
};
Z.usesDesign = d => !!d.design;
Z.usesWa = d => !!d.wa;

/* 动画步长：koma = 每秒画几张（24fps 时基），0 = 每个输出帧都画 */
Z.komaOf = fx => (fx.koma != null ? +fx.koma : 12);
Z.stepDur = (fx, fps) => { const k = Z.komaOf(fx); return k > 0 ? 1 / k : 1 / (fps || 24); };

/* ============================================================
   歌词解析
   一行一句。支持的写法见 UI 的「写法」说明。
   ============================================================ */
Z.parseLyrics = (raw) => {
  const lines = []; const meta = {};
  let pendingGap = false;
  for (const src of String(raw || '').replace(/\r/g, '').split('\n')) {
    const s0 = src.trim();
    if (!s0) { if (lines.length) pendingGap = true; continue; }
    if (s0.startsWith('#')) continue;                       // 注释
    const mm = s0.match(/^\[(ti|ar|al|by|offset):(.*)\]$/i);
    if (mm) { meta[mm[1].toLowerCase()] = mm[2].trim(); continue; }
    let s = s0; const times = [];
    let m;
    while ((m = s.match(/^\[(\d+):(\d+(?:[.:]\d+)?)\]/))) {   // LRC 时间戳
      times.push(+m[1] * 60 + parseFloat(m[2].replace(':', '.')));
      s = s.slice(m[0].length);
    }
    s = s.trim();
    let note = null;
    const bar = s.indexOf('|');
    if (bar >= 0) { note = s.slice(bar + 1).trim() || null; s = s.slice(0, bar).trim(); }
    let impact = false;
    if (/[!！]$/.test(s) && s.length > 1) { impact = true; s = s.slice(0, -1).trim(); }
    const emph = [];
    s = s.replace(/\*([^*]+)\*/g, (_, w) => { emph.push(w); return w; });
    let manual = null;
    if (s.includes('/')) {                                   // 手动切分点
      manual = s.split('/').map(x => x.trim()).filter(Boolean);
      const latin = manual.some(x => /[A-Za-z]/.test(x));
      s = manual.join(latin ? ' ' : '');
    }
    if (!s) continue;
    const base = { text: s, note, impact, emph, manual, gapBefore: pendingGap };
    pendingGap = false;
    if (times.length) times.forEach(t => lines.push(Object.assign({}, base, { lrc: t })));
    else lines.push(Object.assign({}, base, { lrc: null }));
  }
  if (lines.some(l => l.lrc != null)) lines.sort((a, b) => (a.lrc ?? 1e9) - (b.lrc ?? 1e9));
  return { lines, meta };
};

/* ============================================================
   分词 → 词块
   中文用 Intl.Segmenter('zh')，退化时按字符类别切。
   词块是"一口气唱出来的一段"，比词大、比句小。
   ============================================================ */
const segZH = (typeof Intl !== 'undefined' && Intl.Segmenter) ? new Intl.Segmenter('zh', { granularity: 'word' }) : null;
const segJA = (typeof Intl !== 'undefined' && Intl.Segmenter) ? new Intl.Segmenter('ja', { granularity: 'word' }) : null;
/* 虚词：单独成块没意义，往前并 */
const PARTICLES = '的地得了着过吗呢吧啊呀哦嗯么之乎者也へをにがはでと';

const segKind = s => {
  if (/^\s+$/.test(s)) return 'S';
  if ([...s].every(c => Z.isPunct(c))) return 'P';
  if (/[A-Za-z0-9]/.test(s)) return 'L';
  if ([...s].some(c => Z.isHan(c))) return 'K';
  if ([...s].every(c => Z.isHira(c) || c === '\u30fc')) return 'H';
  if ([...s].every(c => Z.isKata(c) || c === '\u30fc')) return 'T';
  return 'O';
};
Z.segments = (text) => {
  const hasHan = /[\u3400-\u9FFF]/.test(text);
  const seg = hasHan ? (segZH || segJA) : (segJA || segZH);
  if (seg) return [...seg.segment(text)].map(x => x.segment);
  const out = []; let cur = '', ct = '';
  for (const c of text) {
    const t = segKind(c);
    if (cur && t !== ct && !(ct === 'K' && t === 'H')) { out.push(cur); cur = ''; }
    cur += c; ct = t;
  }
  if (cur) out.push(cur);
  return out;
};

Z.chunkText = (text) => {
  const segs = Z.segments(text);
  const chunks = []; let cur = null;
  const close = () => { if (cur && cur.s.trim()) chunks.push(cur.s.trim()); cur = null; };
  for (const sg of segs) {
    const t = segKind(sg);
    if (t === 'S') { close(); continue; }
    if (t === 'P') {                                   // 标点贴着前一个块
      if (cur) cur.s += sg;
      else if (chunks.length) chunks[chunks.length - 1] += sg;
      else cur = { s: sg, k: 'P', hasH: false };
      continue;
    }
    if (!cur) { cur = { s: sg, k: t, hasH: t === 'H' }; continue; }
    const len = [...sg].length;
    const isParticle = t === 'K' && len === 1 && PARTICLES.includes(sg);
    if (isParticle || len <= 1) { cur.s += sg; if (t === 'H') cur.hasH = true; continue; }
    if (t === 'H') {                                   // 假名尾：短的就并进来
      if (len <= 3 || (cur.k !== 'H' && !cur.hasH) || (cur.k === 'H' && [...cur.s].length + len <= 4)) { cur.s += sg; cur.hasH = true; continue; }
      close(); cur = { s: sg, k: 'H', hasH: true }; continue;
    }
    if (t === 'K' && cur.k === 'K' && !cur.hasH && [...(cur.s + sg)].length <= 6) { cur.s += sg; continue; }
    if ((t === 'T' || t === 'L') && cur.k === t) { cur.s += sg; continue; }
    close(); cur = { s: sg, k: t, hasH: t === 'H' };
  }
  close();
  /* 太长的块再切，落单的单字往前并 */
  const out = [];
  for (const c of chunks) {
    const n = [...c].length;
    if (n > 10) Z.splitLines(c, Math.ceil(n / Math.ceil(n / 8))).split('\n').forEach(x => { if (x) out.push(x); });
    else out.push(c);
  }
  for (let i = out.length - 1; i > 0; i--) {
    if ([...out[i]].length === 1 && !Z.isHan(out[i])) { out[i - 1] += out[i]; out.splice(i, 1); }
  }
  return out.length ? out : [text];
};

/* ============================================================
   时间轴
   ============================================================ */
Z.computeTiming = (project, parsed, audio) => {
  const T = project.timing || {};
  const lines = parsed.lines;
  const beat = T.bpm > 0 ? 60 / T.bpm : 0;
  const starts = [];
  const allLrc = lines.length > 0 && lines.every(l => l.lrc != null);
  const base = T.offset ?? 0.4;
  lines.forEach((l, i) => {
    const man = T.lineTimes && T.lineTimes[i] != null ? +T.lineTimes[i] : null;
    let s;
    if (allLrc) s = l.lrc;
    else if (man != null && isFinite(man)) s = man;
    else if (i > 0) {
      const n = [...lines[i - 1].text].length;
      let d = Z.clamp(0.8 + n * 0.17, 1.3, 5.2) * (T.lineScale || 1);
      if (beat) d = Math.max(2, Math.round(d / beat)) * beat;
      s = starts[i - 1] + d + (l.gapBefore ? (beat ? beat * 2 : 0.8) : 0);
    } else s = base;
    starts.push(s);
  });
  const lineDur = (txt, min) => {
    const n = [...String(txt)].length;
    let d = Z.clamp(0.8 + n * 0.17, min, 5.2) * (T.lineScale || 1);
    if (beat) d = Math.max(2, Math.round(d / beat)) * beat;
    return d;
  };
  const ends = starts.map((s, i) => (i < starts.length - 1 ? Math.max(s + 0.35, starts[i + 1]) : s + lineDur(lines[i].text, 1.5)));
  let duration = (ends.length ? ends[ends.length - 1] : 3) + (T.tail ?? 0.9);
  if (audio && audio.duration && T.useAudioLength !== false) {
    duration = Math.max(audio.duration, ends.length ? ends[ends.length - 1] + 0.2 : 1);
  }
  return { starts, ends, duration };
};

/* ============================================================
   排片
   ============================================================ */
const wkey = (obj, k, d = 1) => (obj && obj[k] != null ? obj[k] : d);

/* 导演编排把一个镜头的版式、入场和停留动作当作同一组决定。
   每句轮换重拍、错位、显影三个重音；随机种子只改变组的起点。
   专业模式里的逐项指定始终覆盖这里的选择。 */
const DIRECTED_SCENES = [
  { layouts: ['pulsePoster', 'huge'], enters: ['softWhip', 'settle'], hold: 'still', exit: 'trailFade', cam: 'push', fontRole: 'display' },
  { layouts: ['splitHeadline', 'stack'], enters: ['windowRise', 'glideGlyph'], hold: 'lineFloat', exit: 'foldDown', cam: 'panL', fontRole: 'serif' },
  { layouts: ['accentGlyph', 'mixed'], enters: ['cursorInk', 'settle'], hold: 'still', exit: 'trailFade', cam: 'push', fontRole: 'display' },
  { layouts: ['tideLine', 'center'], enters: ['trackFocus', 'develop'], hold: 'lineFloat', exit: 'trackFade', cam: 'pull', fontRole: 'serif' },
  { layouts: ['tickerStack', 'stack'], enters: ['glideGlyph', 'cascade'], hold: 'still', exit: 'trailFade', cam: 'push', fontRole: 'display' },
  { layouts: ['orbitCaption', 'center'], enters: ['softWave', 'waveIn'], hold: 'tide', exit: 'trackFade', cam: 'push', fontRole: 'serif' },
  { layouts: ['outlineText', 'huge'], enters: ['cursorInk', 'scanDevelop'], hold: 'still', exit: 'foldDown', cam: 'push', fontRole: 'display' },
  { layouts: ['vcols', 'center'], enters: ['windowRise', 'develop'], hold: 'lineFloat', exit: 'trackFade', cam: 'push', fontRole: 'serif' },
];
const DIRECTOR_FAMILIES = {
  cinematic: {
    supportLayouts: ['diag', 'lyricBar', 'stampBox', 'frame', 'mixed', 'center'],
    bg: ['scoreLines', 'meshGrad', 'polka', 'gradientArc', 'none', 'starfield', 'scoreLines', 'none'],
    decor: ['cornerMark', 'leaders', 'dots', 'waveform', 'scanBar', 'rings', 'bars', 'cornerMark'],
    treat: ['none', 'shadowDrop', 'none', 'none', 'none', 'none', 'none', 'none'],
    trans: ['edgeWipe', 'coverSlide', 'push'],
  },
  atmospheric: {
    supportLayouts: ['wave', 'ring', 'notes', 'frame', 'center', 'mixed'],
    bg: ['gradientArc', 'rainWindow', 'concentric', 'aurora', 'none', 'starfield', 'gradientArc', 'scoreLines'],
    decor: ['bokeh', 'rings', 'dots', 'waveform', 'scanBar', 'sparks', 'cornerMark', 'waves'],
    treat: ['none', 'none', 'none', 'blurEdge', 'none', 'none', 'none', 'none'],
    trans: ['edgeWipe', 'iris', 'coverSlide'],
  },
  editorial: {
    supportLayouts: ['gloss', 'frame', 'stampBox', 'genko', 'mixed', 'center'],
    bg: ['scoreLines', 'contour', 'polka', 'none', 'none', 'concentric', 'scoreLines', 'giantText'],
    decor: ['cornerMark', 'leaders', 'halftone', 'dimension', 'bars', 'rings', 'tape', 'sealStk'],
    treat: ['none', 'shadowDrop', 'none', 'underline', 'none', 'none', 'none', 'none'],
    trans: ['edgeWipe', 'push', 'coverSlide'],
  },
  electric: {
    supportLayouts: ['grid', 'marquee', 'type', 'tile', 'labels', 'center'],
    bg: ['retroGrid', 'meshGrad', 'circuit', 'gradientArc', 'vhsNoise', 'starfield', 'radial', 'scoreLines'],
    decor: ['bars', 'crosshair', 'glitchBits', 'scanBar', 'barcode', 'sparks', 'cornerMark', 'scanlines'],
    treat: ['none', 'none', 'none', 'glow', 'misalign', 'none', 'none', 'none'],
    trans: ['whipPan', 'edgeWipe', 'push'],
  },
};
function directorFamily(style) {
  if (['neon', 'synth', 'acid', 'vapor', 'blueprint'].includes(style)) return DIRECTOR_FAMILIES.electric;
  if (['nightwave', 'mist', 'forest', 'sunset'].includes(style)) return DIRECTOR_FAMILIES.atmospheric;
  if (['paperfire', 'ink', 'riso', 'news', 'kraft', 'vermilion', 'gold'].includes(style)) return DIRECTOR_FAMILIES.editorial;
  return DIRECTOR_FAMILIES.cinematic;
}
function directedSceneIndex(seed, line, index) {
  return (Math.abs(seed | 0) % DIRECTED_SCENES.length + line * 2 + index) % DIRECTED_SCENES.length;
}
function directedChoice(group, keys, en, chars, history = []) {
  const valid = keys.filter(k => en[group][k] && Z.registry(group)[k] &&
    (group !== 'layout' || !Z.LAYOUTS[k].fits || Z.LAYOUTS[k].fits(chars)));
  if (group === 'layout') {
    const recent = new Set(history.slice(-8).map(h => h.layout));
    return valid.find(k => !recent.has(k)) || valid[0] || null;
  }
  return valid[0] || null;
}

Z.plan = (project, audio) => {
  const st = Z.resolveStyle(project);
  const fx = Object.assign({}, Z.defaultProject().fx, project.fx || {});
  const parsed = Z.parseLyrics(project.lyrics);
  const title = project.title || parsed.meta.ti || '';
  const artist = project.artist || parsed.meta.ar || '';
  const tm = Z.computeTiming(project, parsed, audio);
  const [W, H] = Z.designSize(project.aspect);
  /* 启用表：显式关掉的关掉，其余按 设计层 / 和风 开关过滤 */
  const en = {};
  for (const g of Z.GROUPS) {
    en[g] = {};
    const src = (project.enabled || {})[g] || {};
    for (const k of Z.order(g)) en[g][k] = src[k] !== false && Z.randomOk(project, g, k);
  }
  const plan = {
    version: 1, generator: 'RuiC-TextPV', title, artist, W, H, fps: project.fps || 24,
    duration: tm.duration, styleKey: project.style, style: st, fx, seed: project.seed,
    director: project.director !== false,
    lines: [], cuts: [], events: [],
    beats: audio && audio.beats ? audio.beats.slice() : [],
    hud: fx.hud === 'on' ? true : fx.hud === 'off' ? false : !!st.hud,
    keyBg: Z.keyMode(project),
  };
  const beats = plan.beats;
  const snap = (t) => {
    if (!beats.length || !(project.timing && project.timing.snap)) return t;
    let lo = 0, hi = beats.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (beats[mid] < t) lo = mid + 1; else hi = mid; }
    let best = t, bd = 0.13;
    for (const k of [lo - 1, lo]) {
      if (k >= 0 && k < beats.length && Math.abs(beats[k] - t) < bd) { bd = Math.abs(beats[k] - t); best = beats[k]; }
    }
    return best;
  };
  const history = [], bgHistory = [], fxHistory = [];
  const family = directorFamily(project.style);
  let schemeIdx = 0;
  const nSchemes = st.schemes.length;
  const addEvent = (t, type, amp, dur) => plan.events.push({ t: Math.max(0, t), type, amp, dur });
  const fxOn = k => en.fx == null || en.fx[k] !== false;
  const F = 1 / 24;                                    // 特效时长按 24fps 时基，换 fps 观感不变

  /* ---- 标题卡 ---- */
  const firstStart = tm.starts.length ? tm.starts[0] : 0;
  if (title && firstStart >= 1.1) {
    const rng = Z.seeded(Z.h(project.seed, 999));
    plan.cuts.push(makeCut({
      text: title, note: artist, lineText: title, line: -1,
      start: 0.1, end: firstStart - 0.04,
      layout: 'title',
      enter: rng.pick(['develop', 'defocus', 'type', 'lightReveal']),
      exit: rng.pick(['defocusOut', 'blur', 'fade']),
      hold: 'still', params: Z.LAYOUTS.title.plan(rng, {}, st),
      decor: [], scheme: 0, seed: Z.h(project.seed, 999, 1),
    }));
  }

  parsed.lines.forEach((ln, li) => {
    const s = tm.starts[li], e = tm.ends[li];
    const ov = (project.overrides || {})[li] || {};
    const lineSeed = ov.lock && ov.lockedSeed != null ? ov.lockedSeed : Z.h(project.seed, li + 1, ov.seed | 0);
    const rng = Z.seeded(lineSeed);
    const n = [...ln.text.replace(/\s+/g, '')].length;
    const visEnd = Math.min(e, s + Math.max(3.6, n * 0.5 + 1.2));
    const D = Math.max(0.5, visEnd - s);
    plan.lines.push({ index: li, text: ln.text, start: s, end: e, visEnd, note: ln.note, impact: ln.impact, emph: ln.emph, chunks: null, seed: lineSeed });
    const chunks = ln.manual || Z.chunkText(ln.text);
    plan.lines[li].chunks = chunks;

    /* 一行切成几个镜头：由"镜头密度"决定 */
    const L = Z.lerp(1.35, 0.52, fx.density);
    let nC = Math.round(D / L);
    const maxC = chunks.length + (chunks.length >= 2 && D > 2.0 ? 1 : 0);
    nC = Z.clamp(nC, 1, Math.max(1, maxC));
    if (ov.single) nC = 1;
    const nG = Math.min(nC, chunks.length);
    let groups;
    if (nG <= 1) groups = [ln.text];
    else groups = partition(chunks, nG).map(g => g.join(/[A-Za-z]/.test(g.join('')) ? ' ' : ''));
    const recap = nC > groups.length && groups.length >= 2;
    const units = groups.map(g => ({ text: g, w: [...g].length + 1.6 }));
    if (recap) units.push({ text: ln.text, w: (units.reduce((a, u) => a + u.w, 0) / units.length) * 1.25, recap: true });
    const tot = units.reduce((a, u) => a + u.w, 0);
    let acc = s; const bounds = [s];
    units.forEach((u, k) => { acc += D * u.w / tot; bounds.push(k === units.length - 1 ? visEnd : acc); });
    for (let k = 1; k < bounds.length - 1; k++) bounds[k] = Z.clamp(snap(bounds[k]), bounds[k - 1] + 0.22, bounds[k + 1] - 0.22);

    /* 配色方案（同一支片子里会换底） */
    if (project.director) schemeIdx = li % nSchemes;
    else if (nSchemes > 1 && li > 0 && rng.chance(fx.bgSwitch * (ln.impact ? 1.8 : 1))) schemeIdx = (schemeIdx + 1 + rng.int(0, nSchemes - 2)) % nSchemes;
    const emphLine = ln.impact || ln.emph.length > 0;

    /* 背景图形：逐行挑，偶尔在一个镜头中途再换 */
    let lineBg = ov.bg && Z.BG[ov.bg] ? ov.bg : project.director ? 'none' : pickBg(rng, st, en, fx, bgHistory);
    bgHistory.push(lineBg);
    let lineBgP = Z.BG[lineBg] && Z.BG[lineBg].plan ? Z.BG[lineBg].plan(rng, st) : {};
    if (Z.BG[lineBg] && !Z.BG[lineBg].plan) lineBgP = { seed: rng.int(1, 1e9), n: rng.int(1, 3), x: rng.range(0.3, 0.7), y: rng.range(0.3, 0.6), big: rng.chance(0.4), rot: rng.range(0, 1), text: ln.text.slice(0, 2), font: rng.pick(st.fonts.display) };

    units.forEach((u, k) => {
      const cs = bounds[k], ce = bounds[k + 1], dur = Math.max(0.3, ce - cs);
      const txt = u.text;
      const nn = [...txt.replace(/\s+/g, '')].length;
      const emph = (ln.impact && (k === 0 || u.recap)) || ln.emph.some(w => txt.includes(w));
      const sceneIndex = project.director ? directedSceneIndex(lineSeed, li, k) : -1;
      const scene = project.director ? DIRECTED_SCENES[sceneIndex] : null;
      const layout = ov.layout && Z.LAYOUTS[ov.layout] ? ov.layout :
        (scene && directedChoice('layout', scene.layouts.concat(family.supportLayouts), en, nn, history)) || pickLayout(rng, st, en, nn, dur, history, emph, u.recap, H > W);
      let enter = ov.enter && Z.ENTER[ov.enter] ? ov.enter :
        (scene && directedChoice('enter', scene.enters, en, nn)) || pickEnter(rng, st, en, layout, dur, history, emph, nn);
      let exit = ov.exit && Z.EXIT[ov.exit] ? ov.exit : project.director ?
        (k === units.length - 1 && dur > 0.72 ? (emph && en.exit.particulate ? 'particulate' :
          (en.exit[scene.exit] ? scene.exit : 'fade')) : 'cut') :
        pickExit(rng, st, en, layout, dur, k === units.length - 1, history);
      const hold = ov.hold && Z.HOLD[ov.hold] ? ov.hold :
        (scene && en.hold[scene.hold] ? scene.hold : null) || pickHold(rng, en, fx, history);
      let inDur = Z.clamp(dur * 0.36, 0.12, 0.6);
      if (enter === 'type') inDur = Z.clamp(nn * 0.055 + 0.1, 0.15, dur * 0.65);
      if (enter === 'assemble' || enter === 'condense' || enter === 'chisel') inDur = Z.clamp(dur * 0.45, 0.22, 0.75);
      if (Z.ENTER[enter] && Z.ENTER[enter].inDur) inDur = Z.ENTER[enter].inDur(dur, nn);
      if (enter === 'cut') inDur = 0.12;
      let outDur = exit === 'cut' ? 0 : Z.clamp(dur * 0.3, 0.14, 0.55);
      if (['explode', 'fall', 'drift', 'particulate', 'gust', 'gravityOut', 'shatterGrid'].includes(exit)) outDur = Z.clamp(dur * 0.38, 0.25, 0.7);
      if (Z.EXIT[exit] && Z.EXIT[exit].outDur) outDur = Z.EXIT[exit].outDur(dur, nn);
      if (inDur + outDur > dur * 0.92) { const f2 = dur * 0.92 / (inDur + outDur); inDur *= f2; outDur *= f2; }

      let sch = schemeIdx;
      if (!project.director && nSchemes > 1 && k > 0 && rng.chance(0.12 * fx.bgSwitch)) sch = (schemeIdx + 1) % nSchemes;

      const LD = Z.LAYOUTS[layout];
      const params = LD.plan(rng, { text: txt, n: nn, W, H, dur }, st);
      if (scene && !ov.layout) {
        const face = st.fonts[scene.fontRole] || st.fonts.display;
        if (face && face.length) params.font = face[(li + Math.floor(k / 2)) % face.length];
        if (params.body && st.fonts.body && st.fonts.body.length) params.body = st.fonts.body[li % st.fonts.body.length];
      }
      const decor = Array.isArray(ov.decor) ? ov.decor.filter(id => Z.DECOR[id]).map(id => decorParams(rng, id)) :
        project.director ? [
          ...(en.decor.beatRail && !Z.keyMode(project) ? [decorParams(rng, 'beatRail')] : []),
          ...((k !== 1 || emph) && en.decor[family.decor[sceneIndex]] && !Z.keyMode(project)
            ? [decorParams(rng, family.decor[sceneIndex])] : []),
        ] :
        pickDecor(rng, st, en, fx, layout, history);
      const directedTreat = family.treat[sceneIndex];
      const treat = ov.treat && Z.TREAT[ov.treat] ? ov.treat : project.director ?
        (k === 0 && !LD.busy && en.treat[directedTreat] ? directedTreat : 'none') : pickTreat(rng, st, en, fx, LD, emph, history);
      const treatP = Z.TREAT[treat].plan ? Z.TREAT[treat].plan(rng, st) : {};
      if (!project.director && !ov.bg && k > 0 && rng.chance(0.18 * fx.bgSwitch + 0.04)) {
        lineBg = pickBg(rng, st, en, fx, bgHistory);
        lineBgP = Z.BG[lineBg].plan ? Z.BG[lineBg].plan(rng, st) : lineBgP;
      }
      const directedBg = family.bg[sceneIndex];
      const wantedBg = project.director && !ov.bg ? ((k !== 1 || emph) && en.bg[directedBg] ? directedBg : 'none') : lineBg;
      const bg = LD.busy && !(Z.BG[wantedBg] && Z.BG[wantedBg].subtle) ? 'none' : wantedBg;
      const bgP = bg === lineBg ? lineBgP : bg !== 'none' ?
        (Z.BG[bg].plan ? Z.BG[bg].plan(rng, st) : { seed: rng.int(1, 1e9), text: ln.text.slice(0, 2), font: params.font }) : {};
      const cam = ov.cam && Z.CAMERA[ov.cam] ? ov.cam :
        project.director ? (emph && audio && en.cam.beatZoom ? 'beatZoom' : scene.cam) : pickCam(rng, st, en, fx, LD, emph, history);
      const camP = Z.CAMERA[cam].plan ? Z.CAMERA[cam].plan(rng, st) : Object.assign({ seed: rng.int(1, 1e9), a: rng.range(0.7, 1.3), turns: rng.range(0.15, 0.45), dir: rng.chance(0.5) ? 1 : -1, at: rng.range(0.3, 0.7), amount: rng.range(0.02, 0.05) }, cameraDefaults(cam, rng));

      /* 镜头之间的转场：会顶掉上个镜头的退场和这个镜头的入场 */
      const prevCut = plan.cuts[plan.cuts.length - 1];
      let trans = null, transP = {}, transDur = 0;
      const prevOv = prevCut ? ((project.overrides || {})[prevCut.line] || {}) : {};
      const canTrans = prevCut && Math.abs(prevCut.end - cs) < 0.06 && prevCut.layout !== 'interlude' && dur > 0.5
        && (ov.trans || (!ov.enter && !prevOv.exit));
      if (canTrans && (!project.director || ov.trans || (k === 0 && li > 0))) {
        const directedTrans = project.director ? family.trans[(li - 1) % family.trans.length] : null;
        trans = ov.trans && Z.TRANS[ov.trans] ? ov.trans :
          (directedTrans && en.trans[directedTrans] ? directedTrans : project.director ? null : pickTrans(rng, st, en, fx, emph, history));
        if (trans) {
          const TD = Z.TRANS[trans];
          transDur = Z.clamp(TD.dur || 0.35, 0.12, Math.min(0.6, dur * 0.45));
          transP = { seed: rng.int(1, 1e9) };
          enter = 'cut'; inDur = 0.12;
          prevCut.exit = 'cut'; prevCut.outDur = 0;
        }
      }

      const cut = makeCut({
        text: txt, lineText: ln.text, note: ln.note, line: li, start: cs, end: ce,
        layout, enter, exit, hold, inDur, outDur, params, decor, scheme: sch,
        seed: Z.h(lineSeed, k, 17), emph, recap: !!u.recap, words: Z.chunkText(txt),
        stagger: rng.range(0.025, 0.06), treat, treatP,
        bg, bgP, cam, camP, trans, transP, transDur,
      });
      plan.cuts.push(cut);
      history.push({ layout, enter, exit, hold, treat, cam, trans, decor: decor.map(d => d.id) });

      /* ---- 镜头起点的画面事件 ---- */
      const g = fx.glitch * (st.glitchBoost || 1);
      if (project.director) {
        if (fxOn('chroma') && (k === 0 || emph)) addEvent(cs, 'chroma', (emph ? 2.1 : 1.1) * fx.chroma, 0.12);
        if (emph && fxOn('shake')) addEvent(cs, 'shake', fx.motion * 0.72, 0.18);
        if (ln.impact && k === 0 && fxOn('flash') && fx.flash) addEvent(cs, 'flash', 0.65, 2 * F);
      } else {
      if (fxOn('chroma')) addEvent(cs, 'chroma', 1.4 + rng.range(0, 2) * fx.chroma + (emph ? 2.5 : 0), 0.25);
      if (fxOn('slice') && rng.chance(g * 0.5 + (emph ? 0.3 : 0))) addEvent(cs, 'slice', 0.6 + rng.range(0, 0.8) * g + (emph ? 0.5 : 0), rng.pick([2, 3, 4]) * F);
      if (fxOn('block') && rng.chance(g * 0.22)) addEvent(cs + rng.range(0, 0.05), 'block', 0.5 + g, rng.pick([2, 4]) * F);
      if (fxOn('shake') && (emph || rng.chance(fx.motion * 0.18))) addEvent(cs, 'shake', (emph ? 1 : 0.5) * fx.motion, 0.3);
      if (fxOn('flash') && fx.flash && ln.impact && k === 0) addEvent(cs, 'flash', 1, 3 * F);
      if (fxOn('invert') && rng.chance(0.035 * g)) addEvent(cs, 'invert', 1, 2 * F);
      if (fxOn('zoom') && ((emph && rng.chance(0.6)) || rng.chance(0.06 * fx.motion))) addEvent(cs, 'zoom', 0.7 + 0.5 * fx.motion, 0.22);
      if (fxOn('mosaic') && rng.chance(0.04 * g)) addEvent(cs, 'mosaic', 1, 3 * F);
      if (fxOn('slice') && dur > 0.8 && rng.chance(g * 0.4)) addEvent(cs + rng.range(0.35, 0.8) * dur, 'slice', 0.4 + g * 0.4, 2 * F);
      /* 后加的零件库：每个镜头最多一个（转场点），另外偶尔在镜头中间补一个 */
      if (plan.cuts.length > 1 || k > 0 || li > 0) {
        const pick = pickFx(rng, st, en, fx, emph, fxHistory, 'edge');
        if (pick) {
          const D2 = Z.FX[pick];
          addEvent(cs - (D2.pre ? D2.pre * F : 0), pick, (D2.amp || 1) * (0.7 + 0.5 * g + (emph ? 0.3 : 0)), (D2.dur || 4) * F);
          fxHistory.push(pick);
        }
      }
      if (dur > 1.1) {
        const pick = pickFx(rng, st, en, fx, emph, fxHistory, 'mid');
        if (pick) { const D2 = Z.FX[pick]; addEvent(cs + rng.range(0.4, 0.75) * dur, pick, (D2.amp || 1) * (0.5 + 0.4 * g), (D2.dur || 3) * F); }
      }
      }
    });

    /* ---- 长间隙插一段间奏 ---- */
    const nextStart = li < parsed.lines.length - 1 ? tm.starts[li + 1] : null;
    if (nextStart != null && nextStart - visEnd > 1.3) {
      const r2 = Z.seeded(Z.h(lineSeed, 404));
      plan.cuts.push(makeCut({
        text: title || '', lineText: '', line: li, start: visEnd, end: nextStart,
        layout: 'interlude', enter: 'defocus', exit: 'defocusOut', hold: 'still', inDur: 0.3, outDur: 0.3,
        params: Z.LAYOUTS.interlude.plan(r2, {}, st),
        decor: pickDecor(r2, st, en, Object.assign({}, fx, { decor: 1 }), 'interlude'),
        scheme: schemeIdx, seed: Z.h(lineSeed, 405),
      }));
    }
  });

  plan.cuts.sort((a, b) => a.start - b.start);
  plan.cuts.forEach((c, i) => { c.index = i; c.dur = c.end - c.start; });
  plan.events.sort((a, b) => a.t - b.t);
  plan.energy = audio && audio.energy ? audio.energy : null;
  plan.energyRate = audio && audio.energyRate ? audio.energyRate : 0;
  return plan;
};

function makeCut(o) {
  const c = Object.assign({
    hold: 'still', inDur: 0.3, outDur: 0.25, stagger: 0.04, decor: [], params: {},
    scheme: 0, emph: false, words: [], note: null, treat: 'none', treatP: {},
    bg: 'none', bgP: {}, cam: 'push', camP: {}, recap: false,
  }, o);
  c.dur = c.end - c.start;
  return c;
}
function cameraDefaults(k, rng) {
  if (k === 'earthquake') return { seed: rng.int(1, 1e9) };
  return {};
}
function partition(chunks, k) {
  const lens = chunks.map(c => [...c].length + 1);
  const tot = lens.reduce((a, b) => a + b, 0), target = tot / k;
  const groups = []; let cur = [], acc = 0, remainingGroups = k;
  chunks.forEach((c, i) => {
    const remainingChunks = chunks.length - i;
    if (cur.length && (acc + lens[i] / 2 > target || remainingChunks < remainingGroups) && groups.length < k - 1) {
      groups.push(cur); cur = []; acc = 0; remainingGroups--;
    }
    cur.push(c); acc += lens[i];
  });
  if (cur.length) groups.push(cur);
  return groups;
}
/* 越近用过的零件权重越低 —— 这是"每次都不一样"的关键 */
function novelty(history, key, val) {
  let w = 1;
  for (let i = history.length - 1, d = 0; i >= 0 && d < 6; i--, d++) if (history[i][key] === val) w *= d < 2 ? 0.2 : 0.6;
  return w;
}

const NARROW_W = { vcols: 1.9, columns: 1.3, huge: 1.3, center: 1.2, stack: 1.1, mixed: 0.7, marquee: 0.6, wave: 0.6, diag: 0.8, type: 0.8, gloss: 0.5 };
function pickLayout(rng, st, en, n, dur, history, emph, recap, narrow) {
  const cands = [];
  for (const k of Z.LAYOUT_ORDER) {
    const L = Z.LAYOUTS[k];
    if (!en.layout[k] || (L.fits && !L.fits(n))) continue;
    let w = wkey(st.bias.layout, k, L.w ?? 1) * novelty(history, 'layout', k);
    if (narrow) w *= L.portrait != null ? L.portrait : wkey(NARROW_W, k, 1);
    if (emph && L.emph) w *= L.emph;
    if (emph && ['huge', 'center', 'tile', 'marquee', 'stack', 'outlineText'].includes(k)) w *= 2;
    if (recap && ['center', 'stack', 'marquee', 'tile', 'mixed', 'type', 'gloss'].includes(k)) w *= 1.8;
    if (dur < 0.5 && ['wave', 'ring', 'labels', 'gloss', 'type', 'tile', 'orbit', 'swirl'].includes(k)) w *= 0.3;
    if (dur < 0.5 && ['center', 'huge', 'stack', 'vcols'].includes(k)) w *= 1.4;
    cands.push([k, w]);
  }
  if (!cands.length) return 'center';
  return rng.weighted(cands);
}
/* 某几种排版配某些入场更对味 */
const LAYOUT_ENTER = {
  type: { type: 4, scramble: 1.5, develop: 1.2 },
  ring: { pop: 2, spin: 2, cut: 1, assemble: 0.4, slice: 0.2, ripple: 1.6 },
  labels: { cut: 3, pop: 1, pressStamp: 1.4 },
  wave: { waveIn: 2.2, pop: 1.2, drop: 1.2, blur: 1, slice: 0.3 },
  tile: { assemble: 1.3, slice: 1.4, zoom: 1.4, chisel: 1.5 },
  huge: { zoom: 1.4, wipe: 1.3, slice: 1.2, stretch: 1.2, lightReveal: 1.5, develop: 1.4 },
  mixed: { pop: 1.6, drop: 1.6, spin: 1.3, settle: 1.5 },
  scatter: { pop: 1.5, spin: 1.5, drop: 1.2, assemble: 1.3, magnet: 1.5 },
  vcols: { assemble: 1.8, brush: 1.6, develop: 1.4, type: 1.2 },
  gloss: { develop: 1.8, defocus: 1.4, fade: 1.3 },
  lyricBar: { pressStamp: 1.5, fade: 1.4, wipe: 1.2 },
  marquee: { cut: 1.6, slice: 1.3 },
  rain: { cut: 2, fade: 1.5 },
  credits: { cut: 2, fade: 1.4 },
  genko: { type: 2, develop: 1.3 },
  filmstrip: { cut: 1.8, chisel: 1.3 },
  notes: { develop: 1.6, defocus: 1.3 },
};
function pickEnter(rng, st, en, layout, dur, history, emph, n) {
  const cands = [];
  for (const k of Z.ENTER_ORDER) {
    if (!en.enter[k]) continue;
    const D = Z.ENTER[k]; if (!D) continue;
    const LD = Z.LAYOUTS[layout] || {};
    let w = wkey(st.bias.enter, k, D.w ?? 1) * novelty(history, 'enter', k) * wkey(LAYOUT_ENTER[layout] || LD.enterBias, k, 1);
    if (D.minDur && dur < D.minDur) w *= 0.15;
    if (D.maxChars && n > D.maxChars) w *= 0.2;
    if (k === 'cut') w *= 0.5;
    if (dur < 0.45 && ['type', 'assemble', 'drop', 'spin', 'pop', 'flicker', 'chisel', 'flutterIn'].includes(k)) w *= 0.25;
    if (dur < 0.45 && ['cut', 'slice', 'zoom', 'stretch', 'lightReveal'].includes(k)) w *= 1.8;
    if (k === 'type' && n > 18) w *= 0.3;
    if (emph && ['zoom', 'assemble', 'slice', 'chisel', 'beatBurst'].includes(k)) w *= 1.8;
    cands.push([k, w]);
  }
  return cands.length ? rng.weighted(cands) : 'cut';
}
function pickExit(rng, st, en, layout, dur, lastOfLine, history) {
  const cands = [];
  for (const k of Z.EXIT_ORDER) {
    if (!en.exit[k]) continue;
    const D = Z.EXIT[k]; if (!D) continue;
    let w = wkey(st.bias.exit, k, D.w ?? 1) * novelty(history, 'exit', k);
    if (D.minDur && dur < D.minDur) w *= 0.15;
    if (k === 'cut') w *= dur < 0.6 ? 4 : lastOfLine ? 1.2 : 2.2;
    if (dur < 0.6 && k !== 'cut') w *= 0.4;
    if (['labels', 'ring', 'tile'].includes(layout) && ['explode', 'fall', 'drift', 'gust'].includes(k)) w *= 0.3;
    cands.push([k, w]);
  }
  return cands.length ? rng.weighted(cands) : 'cut';
}
const HOLD_W = { still: 1, jitter: 1.2, tremor: 1.1, drift: 1, tide: 1, breathe: 0.7, wave: 0.4, glitchtick: 0.9, driven: 1.1, heartbeat: 1, sheen: 1 };
function pickHold(rng, en, fx, history) {
  const cands = Z.HOLD_ORDER.filter(k => en.hold[k] !== false && Z.HOLD[k]).map(k => {
    const D = Z.HOLD[k];
    let w = HOLD_W[k] != null ? HOLD_W[k] : (D.w ?? 0.8);
    if (k === 'jitter' || k === 'tremor' || (D.tags && D.tags.includes('glitch'))) w *= 0.4 + fx.motion;
    if (k === 'glitchtick') w *= fx.glitch;
    if (k === 'driven' && !fx.hasAudio) w *= 0.5;
    return [k, w * novelty(history, 'hold', k)];
  });
  return cands.length ? rng.weighted(cands) : 'still';
}
function decorParams(rng, k) {
  return {
    id: k, seed: rng.int(1, 1e9), n: rng.int(1, 3) + (k === 'shapes' ? 3 : 0) + (k === 'sparks' ? 4 : 0) + (k === 'confetti' ? 2 : 0),
    right: rng.chance(0.5), low: rng.chance(0.5), accent: rng.chance(0.4), corner: rng.chance(0.5),
    big: rng.chance(0.4), mode: rng.pick(['count', 'index']), from: rng.int(0, 20), to: rng.int(30, 999), v: rng.int(0, 5), r: rng(),
  };
}
function pickDecor(rng, st, en, fx, layout, history = []) {
  const count = Math.round(fx.decor * 2.8 * rng.range(0.45, 1.15));
  const recent = new Set(history.slice(-2).flatMap(h => h.decor || []));
  const LD = Z.LAYOUTS[layout] || {};
  const cands = Z.DECOR_ORDER
    .filter(k => en.decor[k] && Z.DECOR[k] && !(LD.busy && Z.DECOR[k].layer === 'back' && !Z.DECOR[k].subtle))
    .map(k => [k, wkey(st.decor, k, Z.DECOR[k].w != null ? Z.DECOR[k].w * 0.5 : 0.35) * (recent.has(k) ? 0.35 : 1)]);
  const out = [];
  for (let i = 0; i < count && cands.length; i++) {
    const k = rng.weighted(cands);
    cands.splice(cands.findIndex(c => c[0] === k), 1);
    out.push(decorParams(rng, k));
  }
  return out;
}
/* 文字加工：大部分时候不上，装饰量越大越常上 */
function pickTreat(rng, st, en, fx, LD, emph, history) {
  if (LD.treat === false) return 'none';
  if (!rng.chance(0.18 + 0.42 * (fx.decor ?? 0.5) + (emph ? 0.15 : 0))) return 'none';
  const cands = Z.TREAT_ORDER
    .filter(k => k !== 'none' && en.treat && en.treat[k] !== false && Z.TREAT[k] && (LD.treat !== 'safe' || Z.TREAT[k].safe))
    .map(k => [k, wkey(st.bias && st.bias.treat, k, Z.TREAT[k].w ?? 1) * novelty(history, 'treat', k)]);
  return cands.length ? rng.weighted(cands) : 'none';
}
function pickBg(rng, st, en, fx, bgHist) {
  if (!rng.chance(0.2 + 0.35 * (fx.decor ?? 0.5) + 0.2 * (fx.bgSwitch ?? 0.35))) return 'none';
  const last = bgHist.slice(-3);
  const cands = Z.BG_ORDER
    .filter(k => k !== 'none' && en.bg && en.bg[k] !== false && Z.BG[k])
    .map(k => [k, wkey(st.bias && st.bias.bg, k, Z.BG[k].w ?? 1) * (last.includes(k) ? 0.25 : 1)]);
  return cands.length ? rng.weighted(cands) : 'none';
}
function pickCam(rng, st, en, fx, LD, emph, history) {
  const cands = Z.CAMERA_ORDER.filter(k => en.cam && en.cam[k] !== false && Z.CAMERA[k]).map(k => {
    const D = Z.CAMERA[k];
    let w = wkey(st.bias && st.bias.cam, k, D.w ?? 1) * novelty(history, 'cam', k);
    if (D.strong) w *= 0.25 + 0.9 * (fx.motion ?? 0.7) + (emph ? 0.6 : 0);
    if (LD.cam === false && k !== 'push') w *= 0.05;
    return [k, w];
  });
  return cands.length ? rng.weighted(cands) : 'push';
}
function pickTrans(rng, st, en, fx, emph, history) {
  if (!Z.TRANS_ORDER.length) return null;
  if (!rng.chance(0.1 + 0.22 * (fx.motion ?? 0.7) + (emph ? 0.08 : 0))) return null;
  const cands = Z.TRANS_ORDER
    .filter(k => en.trans && en.trans[k] !== false && Z.TRANS[k])
    .map(k => [k, wkey(st.bias && st.bias.trans, k, Z.TRANS[k].w ?? 1) * novelty(history, 'trans', k)]);
  return cands.length ? rng.weighted(cands) : null;
}
/* kind='edge' 镜头交界；'mid' 镜头中间的点缀 */
function pickFx(rng, st, en, fx, emph, fxHist, kind) {
  const g = fx.glitch ?? 0.55;
  const p = kind === 'edge' ? 0.12 + 0.38 * g + 0.12 * (fx.motion ?? 0.7) + (emph ? 0.15 : 0) : 0.05 + 0.2 * g;
  if (!rng.chance(p)) return null;
  const last = fxHist.slice(-3);
  const cands = Z.FX_ORDER
    .filter(k => {
      const D = Z.FX[k];
      return D && !D.builtin && en.fx && en.fx[k] !== false && (kind === 'edge' ? D.edge !== false : D.mid);
    })
    .map(k => {
      const D = Z.FX[k];
      let w = wkey(st.bias && st.bias.fx, k, D.w ?? 1) * (last.includes(k) ? 0.2 : 1);
      if (D.glitchy) w *= 0.3 + g * 1.4;
      return [k, w];
    });
  return cands.length ? rng.weighted(cands) : null;
}

/* ============================================================
   画面尺寸
   ============================================================ */
Z.designSize = (aspect) => {
  if (aspect === '9:16') return [1080, 1920];
  if (aspect === '1:1') return [1440, 1440];
  if (aspect === '4:5') return [1440, 1800];
  if (aspect === '21:9') return [2520, 1080];
  if (aspect === '4:3') return [1440, 1080];
  if (aspect === '3:4') return [1080, 1440];
  return [1920, 1080];
};
Z.outputSize = (project) => {
  const [W, H] = Z.designSize(project.aspect);
  const k = (project.res || 1080) / Math.min(W, H);
  return [Math.round(W * k / 2) * 2, Math.round(H * k / 2) * 2];
};
})();
