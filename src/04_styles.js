/* ============================================================
   RuiC-TextPV — 风格包
   一套风格 = 若干配色方案（同一支片子里按镜头切换）
           + 字体角色 + 质感 + 零件倾向 + 色散强度
   ============================================================ */
(() => {
'use strict';

/* scheme 字段：
   bg 背景 / fg 主文字 / sub 次级文字 / accent 强调色
   accent2 次强调 / ink 色块上的反白 / dim 背景装饰文字
   ghostA ghostB 色散的双色 / grad 渐变文字 / paper 是否叠纸纹 */
Z.STYLES = {
  ink: {
    name: '墨白', desc: '宣纸底 · 浓墨大字 · 朱红一点',
    schemes: [
      { bg: '#EFEBE3', fg: '#14120F', sub: '#5C574E', accent: '#C0392B', accent2: '#14120F', ink: '#14120F', dim: '#DED8CC', ghostA: '#C0392B', ghostB: '#3A3630', paper: true },
      { bg: '#121110', fg: '#F4F0E8', sub: '#A8A296', accent: '#C0392B', accent2: '#F4F0E8', ink: '#F4F0E8', dim: '#22201E', ghostA: '#C0392B', ghostB: '#8E887C', paper: true },
      { bg: '#C0392B', fg: '#FBF7EF', sub: '#F2CCC4', accent: '#121110', accent2: '#FBF7EF', ink: '#121110', dim: '#AB3225', ghostA: '#121110', ghostB: '#FBF7EF', paper: true },
    ],
    fonts: { display: ['serif_black', 'mashan', 'sans_black'], serif: ['wenkai', 'serif_bold'], body: ['serif'], mono: ['mono'] },
    texture: { grain: 0.5, paper: 1, scan: 0 }, ghost: 0.45,
    bias: { layout: { vcols: 2.2, gloss: 1.8, huge: 1.6, stack: 1.5, seal: 1.4 }, enter: { brush: 2.2, wipe: 1.5, blur: 1.3 }, exit: { ink: 1.8, drift: 1.5, wipe: 1.3 } },
    decor: { sealStk: 1.2, bars: 1, blobs: 0.9, microText: 1.4, cornerTicks: 1.2 }, hud: false,
  },
  neon: {
    name: '霓虹夜', desc: '湿沥青 · 品红与青 · 灯管描边',
    schemes: [
      { bg: '#08060E', fg: '#F6F1FF', sub: '#B0A6C8', accent: '#FF2E97', accent2: '#22E8FF', ink: '#F6F1FF', dim: '#18122A', ghostA: '#FF2E97', ghostB: '#22E8FF' },
      { bg: '#12071C', fg: '#22E8FF', sub: '#8FD8E8', accent: '#FF2E97', accent2: '#FFFFFF', ink: '#FF2E97', dim: '#200E30', ghostA: '#FF2E97', ghostB: '#22E8FF' },
      { bg: '#FF2E97', fg: '#0A0512', sub: '#3A0A2A', accent: '#22E8FF', accent2: '#FFFFFF', ink: '#0A0512', dim: '#E82A8C', ghostA: '#22E8FF', ghostB: '#0A0512' },
    ],
    fonts: { display: ['sans_black', 'dela', 'qingke'], serif: ['serif_bold'], body: ['sans_med'], mono: ['mono', 'dot'] },
    texture: { grain: 0.8, paper: 0, scan: 0.3 }, ghost: 1.2,
    bias: { layout: { vcols: 1.9, neon: 2.4, marquee: 1.6, center: 1.3, pill: 1.3 }, enter: { neonOn: 2.6, flicker: 1.8, slice: 1.3 }, exit: { glitch: 1.8, slice: 1.5, burn: 1.4 } },
    decor: { hud: 1, rings: 0.9, glitchBits: 0.9, dots: 0.8, tickRing: 1.3, recDot: 1.1, microText: 1.2 }, hud: true, glow: 1.6, glitchBoost: 1.25,
  },
  riso: {
    name: '孔版双色', desc: '米白纸 · 荧光粉与蓝 · 错版',
    schemes: [
      { bg: '#F7F4EC', fg: '#1B2A6B', sub: '#54628F', accent: '#FF4E8A', accent2: '#1B2A6B', ink: '#1B2A6B', dim: '#E8E4D8', ghostA: '#FF4E8A', ghostB: '#1B2A6B', paper: true },
      { bg: '#1B2A6B', fg: '#F7F4EC', sub: '#B9C1E0', accent: '#FF4E8A', accent2: '#FFD84D', ink: '#F7F4EC', dim: '#25347C', ghostA: '#FF4E8A', ghostB: '#FFD84D', paper: true },
      { bg: '#FF4E8A', fg: '#F7F4EC', sub: '#FFD3E2', accent: '#1B2A6B', accent2: '#FFD84D', ink: '#1B2A6B', dim: '#EE4379', ghostA: '#1B2A6B', ghostB: '#FFD84D', paper: true },
    ],
    fonts: { display: ['sans_black', 'kuaile', 'dela'], serif: ['serif_bold', 'wenkai'], body: ['sans_med', 'round'], mono: ['mono'] },
    texture: { grain: 0.9, paper: 0.8, scan: 0 }, ghost: 0.85,
    bias: { layout: { mixed: 2, labels: 1.6, tile: 1.5, huge: 1.4, scatter: 1.3 }, enter: { misprint: 2, stamp: 1.8, wipe: 1.3 }, exit: { scrap: 1.6, wipe: 1.4, drift: 1.2 } },
    decor: { shapes: 1.3, stripes: 1.2, scribble: 1.1, halftone: 1, microText: 1.5, bgRows: 1.1 }, hud: false,
  },
  sunset: {
    name: '落日渐变', desc: '橙紫渐变 · 圆润特粗 · 长影',
    schemes: [
      { bg: '#1A1040', fg: '#FFF3E0', sub: '#FFC8A2', accent: '#FF6B3D', accent2: '#FFD84D', ink: '#1A1040', dim: '#241748', ghostA: '#FF6B3D', ghostB: '#7B5BFF', grad: ['#FFD84D', '#FF3D7F'] },
      { bg: '#FF6B3D', fg: '#2A0F00', sub: '#5C2606', accent: '#1A1040', accent2: '#FFD84D', ink: '#2A0F00', dim: '#F05F33', ghostA: '#1A1040', ghostB: '#FFD84D', grad: ['#2A0F00', '#7B3A00'] },
      { bg: '#F7E9D0', fg: '#2A1040', sub: '#6B4A6E', accent: '#FF3D7F', accent2: '#7B5BFF', ink: '#2A1040', dim: '#EADCC2', ghostA: '#FF3D7F', ghostB: '#7B5BFF', grad: ['#FF3D7F', '#7B5BFF'] },
    ],
    fonts: { display: ['dela', 'round', 'sans_black'], serif: ['serif_black'], body: ['sans_med', 'round'], mono: ['mono'] },
    texture: { grain: 0.5, paper: 0, scan: 0 }, ghost: 0.6,
    bias: { layout: { huge: 2.4, center: 1.4, pill: 1.5, stack: 1.3, wave: 1.2 }, enter: { zoom: 1.7, pop: 1.4, drop: 1.3 }, exit: { shrink: 1.5, blur: 1.3, scatter: 1.2 } },
    decor: { shapes: 1, sparks: 1, bokeh: 1.1, leaders: 0.7, driftMotes: 1.3, microText: 1.2 }, hud: false, glow: 1.5, useGrad: true,
  },
  forest: {
    name: '森系手帖', desc: '亚麻底 · 墨绿与赭 · 手写注记',
    schemes: [
      { bg: '#EDEAE0', fg: '#2A3628', sub: '#5E6B56', accent: '#B5762E', accent2: '#2A3628', ink: '#2A3628', dim: '#DCD8CA', ghostA: '#B5762E', ghostB: '#2A3628', paper: true },
      { bg: '#2A3628', fg: '#EDEAE0', sub: '#A9B29C', accent: '#D9A85C', accent2: '#EDEAE0', ink: '#EDEAE0', dim: '#37452F', ghostA: '#D9A85C', ghostB: '#8FA383', paper: true },
    ],
    fonts: { display: ['serif_black', 'wenkai', 'longcang'], serif: ['wenkai', 'serif'], body: ['wenkai', 'serif'], mono: ['mono'] },
    texture: { grain: 0.7, paper: 0.9, scan: 0 }, ghost: 0.3,
    bias: { layout: { notes: 2.2, vcols: 1.6, stack: 1.5, mixed: 1.3 }, enter: { brush: 1.8, wipe: 1.5, blur: 1.4 }, exit: { drift: 1.7, blur: 1.5, fade: 1.4 } },
    decor: { scribble: 1.3, blobs: 1, leaders: 1, sealStk: 0.8 }, hud: false,
  },
  vapor: {
    name: '蒸汽波', desc: '紫粉网格 · 落日圆盘 · 罗马字',
    schemes: [
      { bg: '#1B0F3B', fg: '#FFE9FB', sub: '#C9A8E8', accent: '#00F0FF', accent2: '#FF6BD6', ink: '#1B0F3B', dim: '#251548', ghostA: '#00F0FF', ghostB: '#FF6BD6' },
      { bg: '#FF6BD6', fg: '#1B0F3B', sub: '#5E1B54', accent: '#00F0FF', accent2: '#FFE9FB', ink: '#1B0F3B', dim: '#F05FC8', ghostA: '#00F0FF', ghostB: '#1B0F3B' },
      { bg: '#00F0FF', fg: '#1B0F3B', sub: '#0A5A66', accent: '#FF6BD6', accent2: '#1B0F3B', ink: '#1B0F3B', dim: '#00DDEB', ghostA: '#FF6BD6', ghostB: '#1B0F3B' },
    ],
    fonts: { display: ['dela', 'qingke', 'sans_black'], serif: ['serif_bold'], body: ['sans_med'], mono: ['mono', 'dot'] },
    texture: { grain: 0.6, paper: 0, scan: 0.35 }, ghost: 1.1,
    bias: { layout: { type: 2, gloss: 1.8, huge: 1.6, ring: 1.4, marquee: 1.3 }, enter: { type: 1.8, zoom: 1.5, flipX: 1.3 }, exit: { glitch: 1.5, blur: 1.4, shrink: 1.2 } },
    decor: { grid: 1.4, glowDisc: 1.4, shapes: 1, hud: 0.8 }, hud: true, glow: 1.7,
  },
  news: {
    name: '新闻纸', desc: '灰白报底 · 宋体密排 · 红头与栏目线',
    schemes: [
      { bg: '#E9E6DF', fg: '#191919', sub: '#4E4A44', accent: '#A3111A', accent2: '#191919', ink: '#191919', dim: '#D6D2C8', ghostA: '#A3111A', ghostB: '#191919', paper: true },
      { bg: '#191919', fg: '#E9E6DF', sub: '#A09A90', accent: '#A3111A', accent2: '#E9E6DF', ink: '#E9E6DF', dim: '#232323', ghostA: '#A3111A', ghostB: '#8C867C', paper: true },
    ],
    fonts: { display: ['serif_black', 'sans_black'], serif: ['serif_bold', 'serif'], body: ['serif'], mono: ['mono'] },
    texture: { grain: 0.75, paper: 1, scan: 0 }, ghost: 0.35,
    bias: { layout: { columns: 2.2, mixed: 1.8, labels: 1.5, gloss: 1.4 }, enter: { wipe: 1.7, type: 1.6, stamp: 1.3 }, exit: { wipe: 1.5, blur: 1.3, slideOut: 1.3 } },
    decor: { bars: 1.2, leaders: 1.1, halftone: 1, scratch: 0.8, bgRows: 1.4, microText: 1.5, cornerTicks: 1.2 }, hud: true,
  },
  synth: {
    name: '合成器80s', desc: '深蓝黑 · 铬合金渐变 · 扫描线',
    schemes: [
      { bg: '#0C0F1E', fg: '#EAF0FF', sub: '#8E9BC4', accent: '#FF3B3B', accent2: '#4DD8FF', ink: '#EAF0FF', dim: '#161B33', ghostA: '#FF3B3B', ghostB: '#4DD8FF', grad: ['#EAF0FF', '#4A5A8C'] },
      { bg: '#1A1F3A', fg: '#FFFFFF', sub: '#A8B4DC', accent: '#FFC63B', accent2: '#FF3B3B', ink: '#FFC63B', dim: '#242A4A', ghostA: '#FFC63B', ghostB: '#FF3B3B', grad: ['#FFFFFF', '#FFC63B'] },
    ],
    fonts: { display: ['dela', 'sans_black', 'qingke'], serif: ['serif_bold'], body: ['sans_med'], mono: ['mono'] },
    texture: { grain: 0.7, paper: 0, scan: 0.7 }, ghost: 1.0,
    bias: { layout: { vcols: 2, marquee: 1.9, huge: 1.5, center: 1.2 }, enter: { slice: 1.8, assemble: 1.6, stretch: 1.4 }, exit: { slice: 1.7, explode: 1.5, glitch: 1.4 } },
    decor: { grid: 1.2, scanBar: 1.2, hud: 1.1, waveform: 1, waveBars: 1.4, tickRing: 1.2, marqueeMini: 1.2 }, hud: true, glow: 1.3, useGrad: true,
  },
  kraft: {
    name: '牛皮纸', desc: '牛皮底 · 黑色标签 · 胶带与印章',
    schemes: [
      { bg: '#C9A87C', fg: '#1E1A14', sub: '#5A4A32', accent: '#1E1A14', accent2: '#F2E8D8', ink: '#1E1A14', dim: '#BC9A6E', ghostA: '#1E1A14', ghostB: '#F2E8D8', paper: true },
      { bg: '#1E1A14', fg: '#E8DCC8', sub: '#9A8A6E', accent: '#C9A87C', accent2: '#E8DCC8', ink: '#C9A87C', dim: '#2A241C', ghostA: '#C9A87C', ghostB: '#E8DCC8', paper: true },
      { bg: '#F2E8D8', fg: '#1E1A14', sub: '#6B5A40', accent: '#B5642E', accent2: '#1E1A14', ink: '#1E1A14', dim: '#E4D8C4', ghostA: '#B5642E', ghostB: '#1E1A14', paper: true },
    ],
    fonts: { display: ['sans_black', 'kuaile', 'serif_black'], serif: ['wenkai', 'serif_bold'], body: ['sans_med'], mono: ['mono', 'dot'] },
    texture: { grain: 0.8, paper: 1, scan: 0 }, ghost: 0.4,
    bias: { layout: { labels: 2.2, pill: 1.7, stamp: 1.5, mixed: 1.4, tile: 1.3 }, enter: { stamp: 2, pop: 1.4, wipe: 1.3 }, exit: { scrap: 1.7, shrink: 1.4, wipe: 1.3 } },
    decor: { tape: 1.5, stampMark: 1.3, scribble: 1.1, halftone: 1, microText: 1.4, bgRows: 1.2 }, hud: false,
  },
  candy: {
    name: '糖果', desc: '粉蓝撞色 · 圆胖字体 · 弹跳',
    schemes: [
      { bg: '#FFD9E8', fg: '#3A1040', sub: '#8A4A78', accent: '#38C6F4', accent2: '#FF7BB0', ink: '#3A1040', dim: '#FFCBE0', ghostA: '#38C6F4', ghostB: '#FF7BB0' },
      { bg: '#38C6F4', fg: '#FFFFFF', sub: '#C4EEFF', accent: '#FF7BB0', accent2: '#FFD9E8', ink: '#3A1040', dim: '#2AB6E4', ghostA: '#FF7BB0', ghostB: '#FFD9E8' },
      { bg: '#3A1040', fg: '#FFD9E8', sub: '#C99AC0', accent: '#FF7BB0', accent2: '#38C6F4', ink: '#FFD9E8', dim: '#4C1854', ghostA: '#FF7BB0', ghostB: '#38C6F4' },
    ],
    fonts: { display: ['kuaile', 'round', 'dela'], serif: ['round'], body: ['round', 'sans_med'], mono: ['mono'] },
    texture: { grain: 0.3, paper: 0, scan: 0 }, ghost: 0.75,
    bias: { layout: { wave: 2.2, pill: 1.8, huge: 1.5, scatter: 1.3, tile: 1.2 }, enter: { pop: 2.2, drop: 1.6, spin: 1.3 }, exit: { bounceOut: 1.7, scatter: 1.5, shrink: 1.3 } },
    decor: { shapes: 1.5, sparks: 1.2, confetti: 1.3, bokeh: 0.8, driftMotes: 1.2, microText: 1.2 }, hud: false,
  },
  acid: {
    name: '酸性', desc: '荧光黄绿 · 黑客界面 · 网格与等宽',
    schemes: [
      { bg: '#0A0A08', fg: '#E8FF3A', sub: '#8A9E1E', accent: '#FF2ECD', accent2: '#E8FF3A', ink: '#0A0A08', dim: '#1A1A10', ghostA: '#FF2ECD', ghostB: '#E8FF3A' },
      { bg: '#E8FF3A', fg: '#0A0A08', sub: '#4A5410', accent: '#FF2ECD', accent2: '#0A0A08', ink: '#0A0A08', dim: '#D4EA2E', ghostA: '#FF2ECD', ghostB: '#0A0A08' },
      { bg: '#FF2ECD', fg: '#0A0A08', sub: '#5A1048', accent: '#E8FF3A', accent2: '#0A0A08', ink: '#0A0A08', dim: '#EE28BC', ghostA: '#E8FF3A', ghostB: '#0A0A08' },
    ],
    fonts: { display: ['sans_black', 'dot', 'mono'], serif: ['serif_bold'], body: ['mono', 'sans_med'], mono: ['mono', 'dot'] },
    texture: { grain: 0.85, paper: 0, scan: 0.5 }, ghost: 1.25,
    bias: { layout: { grid: 2.2, type: 1.8, labels: 1.5, rain: 1.4 }, enter: { scramble: 2, type: 1.6, flicker: 1.5 }, exit: { glitch: 1.9, slice: 1.5, dissolve: 1.3 } },
    decor: { grid: 1.5, hud: 1.3, barcode: 1.2, glitchBits: 1.1, bgRows: 1.3, microText: 1.3, recDot: 1.1 }, hud: true, glitchBoost: 1.5,
  },
  vermilion: {
    name: '朱墨', desc: '和纸底 · 朱与墨 · 印章与竖排',
    schemes: [
      { bg: '#F4EFE2', fg: '#1A1614', sub: '#5E5548', accent: '#B7332A', accent2: '#1A1614', ink: '#1A1614', dim: '#E6DFCC', ghostA: '#B7332A', ghostB: '#3C3630', paper: true },
      { bg: '#1A1614', fg: '#F4EFE2', sub: '#A29888', accent: '#C8392E', accent2: '#F4EFE2', ink: '#F4EFE2', dim: '#262120', ghostA: '#C8392E', ghostB: '#8C8272', paper: true },
      { bg: '#B7332A', fg: '#F8F4E8', sub: '#F0CFC6', accent: '#1A1614', accent2: '#F8F4E8', ink: '#1A1614', dim: '#A32D25', ghostA: '#1A1614', ghostB: '#F8F4E8', paper: true },
    ],
    fonts: { display: ['serif_black', 'mashan', 'wenkai'], serif: ['wenkai', 'serif_black'], body: ['wenkai', 'serif'], mono: ['mono'] },
    texture: { grain: 0.65, paper: 1, scan: 0 }, ghost: 0.5,
    bias: { layout: { vcols: 2.6, genko: 1.9, seal: 1.7, gloss: 1.4 }, enter: { brush: 2.4, sealDrop: 1.8, wipe: 1.4 }, exit: { ink: 2, drift: 1.5, wipe: 1.2 } },
    decor: { sealStk: 1.8, lantern: 1.4, waves: 1.4, petals: 1.2, microText: 1.2 }, hud: false,
  },
  gold: {
    name: '金夜', desc: '酒红黑 · 烫金渐变 · 华丽衬线',
    schemes: [
      { bg: '#14060A', fg: '#F2DFA8', sub: '#A78B52', accent: '#E8B846', accent2: '#F2DFA8', ink: '#14060A', dim: '#22101A', grad: ['#FFF0C4', '#8A6A1E'], ghostA: '#E8B846', ghostB: '#8A2A3A' },
      { bg: '#3A0A14', fg: '#F8ECC8', sub: '#C09A60', accent: '#E8B846', accent2: '#F8ECC8', ink: '#F8ECC8', dim: '#4A1220', grad: ['#FFF0C4', '#B08A2A'], ghostA: '#E8B846', ghostB: '#F8ECC8' },
    ],
    fonts: { display: ['serif_black', 'dela', 'xiaowei'], serif: ['serif_black', 'serif_bold'], body: ['serif'], mono: ['mono'] },
    texture: { grain: 0.7, paper: 0.3, scan: 0 }, ghost: 0.55,
    bias: { layout: { gloss: 2.4, huge: 1.8, center: 1.5, stack: 1.3 }, enter: { zoom: 1.6, wipe: 1.5, blur: 1.3 }, exit: { blur: 1.5, shrink: 1.4, drift: 1.2 } },
    decor: { sparks: 1.5, bokeh: 1.4, shapes: 1, leaders: 0.7 }, hud: false, glow: 1.8, useGrad: true,
  },
  blueprint: {
    name: '蓝图', desc: '工程蓝 · 白线框 · 尺寸标注',
    schemes: [
      { bg: '#1436C8', fg: '#FFFFFF', sub: '#B8C6FF', accent: '#FFD84D', accent2: '#FFFFFF', ink: '#0A1B6B', dim: '#1B3FD8', ghostA: '#FFD84D', ghostB: '#8CA0FF' },
      { bg: '#0A1B6B', fg: '#FFFFFF', sub: '#93A6F0', accent: '#FFD84D', accent2: '#8CA0FF', ink: '#FFFFFF', dim: '#122578', ghostA: '#FFD84D', ghostB: '#8CA0FF' },
      { bg: '#F0F2F8', fg: '#1436C8', sub: '#5A6BB8', accent: '#FF4E2B', accent2: '#1436C8', ink: '#1436C8', dim: '#DFE3F0', ghostA: '#FF4E2B', ghostB: '#1436C8' },
    ],
    fonts: { display: ['sans_black', 'dela', 'mono'], serif: ['serif_bold'], body: ['sans_med', 'mono'], mono: ['mono', 'dot'] },
    texture: { grain: 0.45, paper: 0, scan: 0.25 }, ghost: 0.7,
    bias: { layout: { diag: 2.2, grid: 1.8, labels: 1.6, vcols: 1.3 }, enter: { wipe: 1.8, slice: 1.6, type: 1.4 }, exit: { wipe: 1.7, slideOut: 1.5, slice: 1.3 } },
    decor: { grid: 1.6, dimension: 1.5, hud: 1.2, crosshair: 1.1, cornerTicks: 1.4, marqueeMini: 1.2, microText: 1.3 }, hud: true,
  },
  mono: {
    name: '单色RGB', desc: '灰阶空间 · 白衬线 · 强色散',
    schemes: [
      { bg: '#3A3D42', fg: '#FFFFFF', sub: '#B4B8BE', accent: '#FFFFFF', accent2: '#FFD84D', ink: '#1A1B1E', dim: '#464A50', ghostA: '#FF2A2A', ghostB: '#2AA8FF' },
      { bg: '#111214', fg: '#FFFFFF', sub: '#9A9EA4', accent: '#FFD84D', accent2: '#FFFFFF', ink: '#FFFFFF', dim: '#1C1E21', ghostA: '#FF2A2A', ghostB: '#2AFF7A' },
    ],
    fonts: { display: ['serif_black', 'sans_black'], serif: ['serif_bold'], body: ['serif'], mono: ['mono'] },
    texture: { grain: 1, paper: 0, scan: 0.4 }, ghost: 1.45,
    bias: { layout: { ring: 1.9, center: 1.7, circle: 1.5, stack: 1.4, gloss: 1.3 }, enter: { assemble: 1.6, blur: 1.5, explode: 1.3 }, exit: { explode: 1.5, glitch: 1.4, blur: 1.3 } },
    decor: { rings: 1.4, crosshair: 1.2, dots: 1.1, scratch: 1, tickRing: 1.5, orbitDots: 1.3, microText: 1.4 }, hud: false,
  },
  mist: {
    name: '薄雾', desc: '雾蓝灰 · 细衬线 · 慢速飘移',
    schemes: [
      { bg: '#DDE3E6', fg: '#2C3A42', sub: '#68787F', accent: '#7A9BA8', accent2: '#2C3A42', ink: '#2C3A42', dim: '#CDD6DA', ghostA: '#7A9BA8', ghostB: '#2C3A42' },
      { bg: '#2C3A42', fg: '#E4EAEC', sub: '#9AAAB1', accent: '#B8D4DC', accent2: '#E4EAEC', ink: '#E4EAEC', dim: '#38474F', ghostA: '#B8D4DC', ghostB: '#7A9BA8' },
      { bg: '#7A9BA8', fg: '#FFFFFF', sub: '#D8E6EA', accent: '#2C3A42', accent2: '#FFFFFF', ink: '#2C3A42', dim: '#6E8C98', ghostA: '#2C3A42', ghostB: '#FFFFFF' },
    ],
    fonts: { display: ['serif', 'wenkai', 'sans_light'], serif: ['wenkai', 'serif'], body: ['sans_light', 'serif'], mono: ['mono'] },
    texture: { grain: 0.6, paper: 0.4, scan: 0 }, ghost: 0.35,
    bias: { layout: { center: 2, stack: 1.8, notes: 1.5, vcols: 1.3, wave: 1.2 }, enter: { blur: 2, fade: 1.7, drift: 1.4 }, exit: { blur: 1.9, drift: 1.6, fade: 1.5 } },
    decor: { bokeh: 1.3, blobs: 1.2, scratch: 0.9, dots: 0.8, driftMotes: 1.4, microText: 1.3 }, hud: false, glow: 1.4,
  },
};
Z.STYLE_ORDER = ['ink', 'neon', 'riso', 'sunset', 'forest', 'vapor', 'news', 'synth', 'kraft', 'candy', 'acid', 'vermilion', 'gold', 'blueprint', 'mono', 'mist'];

/* 合成素材用的单色背景（绿幕 / 黑幕） */
Z.KEY_BG = { green: '#00FF00', black: '#000000' };
Z.keyMode = project => (project && Z.KEY_BG[project.keyBg] ? project.keyBg : null);
function keyStyle(st) {
  st.schemes = st.schemes.map(s => {
    const o = { bg: '#000000', fg: '#FFFFFF', sub: '#D2D2D2', accent: '#FFFFFF', accent2: '#BDBDBD', ink: '#FFFFFF', dim: '#1E1E1E', ghostA: '#9A9A9A', ghostB: '#5E5E5E' };
    if (s.grad) o.grad = ['#FFFFFF', '#A8A8A8'];
    return o;
  });
  st.texture = { grain: 0, paper: 0, scan: 0 };
  st.key = true;
}

/* ============================================================
   气质档位
   「一键成片」除了换风格，还会换一整套动效取向：
   动得多快、故障多重、常用哪些出现与消失的方式。
   它通过改写 bias（零件权重表）来生效。
   ============================================================ */
Z.MOODS = {
  glitch: {
    name: '故障', desc: '信号不稳、撕裂、跳变',
    fx: { motion: 0.85, glitch: 1.0, chroma: 1.05, decor: 0.45, density: 0.62, texture: 0.85 },
    ghost: 1.25,
    bias: {
      enter: { resonate: 2.4, slice: 1.9, scramble: 1.8, flicker: 1.6, glowUp: 1.6, rewind: 1.5, scanDevelop: 1.4, stamp: 1.2 },
      exit: { glitch: 2.2, slice: 1.9, particulate: 1.7, shatterGrid: 1.5, consume: 1.4, dissolve: 1.4, scrambleOut: 1.5 },
      hold: { glitchtick: 2, tremor: 1.8, rustle: 1.4, driven: 1.3 },
      layout: { grid: 1.4, tile: 1.3, labels: 1.3, diag: 1.2 },
    },
  },
  calm: {
    name: '沉静', desc: '缓慢、留白、虚化的边缘',
    fx: { motion: 0.35, glitch: 0.18, chroma: 0.35, decor: 0.35, density: 0.42, texture: 0.5 },
    ghost: 0.5,
    bias: {
      enter: { develop: 2.8, defocus: 2.2, surfaceTension: 1.8, fade: 1.6, drift: 1.5, lightReveal: 1.4 },
      exit: { defocusOut: 2.6, evaporate: 1.8, sink: 1.6, drift: 1.6, blur: 1.5, fade: 1.4 },
      hold: { breathe: 1.8, tide: 1.7, float: 1.5, breatheHi: 1.4, rackFocus: 1.3 },
      layout: { center: 1.8, gloss: 1.6, notes: 1.5, stack: 1.5, vcols: 1.3 },
    },
  },
  pop: {
    name: '活泼', desc: '弹跳、撞色、密度高',
    fx: { motion: 0.95, glitch: 0.25, chroma: 0.6, decor: 0.72, density: 0.72, texture: 0.4 },
    ghost: 0.7,
    bias: {
      enter: { settle: 2.4, trampoline: 2, pop: 1.9, flutterIn: 1.8, magnet: 1.6, drop: 1.5, stairStep: 1.4 },
      exit: { bounceOut: 2.2, scatter: 1.8, gust: 1.5, shrink: 1.4, slideOut: 1.4 },
      hold: { jelly: 1.8, beatHop: 1.8, wave: 1.6, float: 1.4, pulse: 1.4 },
      layout: { wave: 1.8, pill: 1.6, huge: 1.4, tile: 1.3, scatter: 1.3 },
    },
  },
  graphic: {
    name: '图形', desc: '几何、对称、版面感',
    fx: { motion: 0.7, glitch: 0.4, chroma: 0.8, decor: 0.65, density: 0.55, texture: 0.5 },
    ghost: 0.95,
    bias: {
      enter: { chisel: 2.6, scanDevelop: 2, lightReveal: 1.8, assemble: 1.6, paperFold: 1.6, wipe: 1.5, splitJoin: 1.4 },
      exit: { turnAway: 2.2, flatten: 2, collapseToPoint: 1.8, shatterGrid: 1.6, wipe: 1.5, slideOut: 1.4 },
      hold: { scaleRun: 1.6, sheen: 1.6, breathe: 1.3, swivel: 1.2 },
      layout: { diag: 1.8, grid: 1.7, vcols: 1.5, columns: 1.4, labels: 1.4 },
    },
  },
  editorial: {
    name: '编辑', desc: '留白、小字注记、克制的动',
    fx: { motion: 0.42, glitch: 0.32, chroma: 0.3, decor: 0.55, density: 0.45, texture: 0.6 },
    ghost: 0.35,
    bias: {
      enter: { develop: 2, type: 1.9, lightReveal: 1.6, shadowFirst: 1.6, defocus: 1.4, settle: 1.3 },
      exit: { defocusOut: 1.8, turnAway: 1.5, blur: 1.5, wipe: 1.4, ink: 1.4, drift: 1.3 },
      hold: { still: 2.2, shimmer: 1.3, drift: 1.2 },
      layout: { gloss: 2, notes: 1.8, columns: 1.6, stack: 1.4, lyricBar: 1.3 },
    },
  },
  emo: {
    name: '情绪', desc: '重影、拖尾、粘稠的过渡',
    fx: { motion: 0.55, glitch: 0.3, chroma: 0.6, decor: 0.5, density: 0.45, texture: 0.75 },
    ghost: 0.85,
    bias: {
      enter: { develop: 2.2, shadowFirst: 2, misprint: 1.8, surfaceTension: 1.6, ripple: 1.6, defocus: 1.5, waveIn: 1.4 },
      exit: { particulate: 2, evaporate: 1.8, defocusOut: 1.7, gust: 1.5, melt: 1.4, drift: 1.3 },
      hold: { heartbeat: 1.8, driven: 1.6, breathe: 1.5, colorBreathe: 1.4, shimmer: 1.3 },
      layout: { center: 1.6, stack: 1.5, ribbon: 1.4, vcols: 1.3, notes: 1.3 },
    },
  },
  all: {
    name: '全都来', desc: '不偏向，什么都可能抽到',
    fx: { motion: 0.75, glitch: 0.6, chroma: 0.75, decor: 0.6, density: 0.6, texture: 0.65 },
    ghost: 0.9,
    bias: {},
  },
};
Z.MOOD_ORDER = ['glitch', 'calm', 'pop', 'graphic', 'editorial', 'emo', 'all'];

/* 气质是"叠加偏置"：风格自己的偏好保留，两边都提到的相乘 */
function applyMood(st, project) {
  const m = Z.MOODS[project.mood];
  if (!m) return;
  st.mood = project.mood;
  st.moodName = m.name;
  if (m.ghost != null) st.ghost = m.ghost;
  if (m.bias) {
    st.bias = st.bias || {};
    for (const g of Object.keys(m.bias)) {
      const out = Object.assign({}, st.bias[g] || {});
      for (const k of Object.keys(m.bias[g])) out[k] = (out[k] || 1) * m.bias[g][k];
      st.bias[g] = out;
    }
  }
}

/* 把用户的颜色 / 字体覆盖解析成最终风格 */
Z.resolveStyle = (project) => {
  const base = Z.STYLES[project.style] || Z.STYLES.ink;
  const st = JSON.parse(JSON.stringify(base));
  const ov = project.colors || {};
  if (ov.enabled) st.schemes[0] = Object.assign({}, st.schemes[0], defined(ov, ['bg', 'fg', 'sub']));
  if (ov.accentOn) {
    st.schemes = st.schemes.map(s => {
      const o = Object.assign({}, s);
      if (ov.accent) { o.accent = Z.readable(ov.accent, s.bg, 2.4); if (s.ink === s.accent) o.ink = o.accent; }
      if (ov.ghostA) o.ghostA = Z.readable(ov.ghostA, s.bg, 1.35);
      if (ov.ghostB) o.ghostB = Z.readable(ov.ghostB, s.bg, 1.35);
      if (ov.accent && s.grad) o.grad = [Z.readable(ov.accent, s.bg, 2.4), Z.mix(ov.accent, '#000000', 0.7)];
      return o;
    });
  }
  const fo = project.fonts || {};
  for (const role of ['display', 'serif', 'body']) if (fo[role] && Z.FONTS[fo[role]]) st.fonts[role] = [fo[role]];
  applyMood(st, project);
  if (Z.keyMode(project)) keyStyle(st);
  return st;
};
function defined(o, keys) { const r = {}; for (const k of keys) if (o[k]) r[k] = o[k]; return r; }
})();
