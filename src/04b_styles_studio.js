/* RuiC-TextPV 自己的三套新视觉场景：把配色、字重和材质作为一个整体。 */
(() => {
'use strict';

Z.STYLES.afterglow = {
  name: '余光', desc: '炭黑与暖纸交替 · 珊瑚色字标',
  schemes: [
    { bg: '#111016', fg: '#F7F0E7', sub: '#C7BDB8', accent: '#FF786E', accent2: '#F7C46C', ink: '#111016', dim: '#211E28', ghostA: '#FF786E', ghostB: '#79D9D2' },
    { bg: '#F1E8DB', fg: '#251D22', sub: '#66575B', accent: '#B8453F', accent2: '#287C82', ink: '#251D22', dim: '#DED1C8', ghostA: '#B8453F', ghostB: '#287C82' },
  ],
  fonts: { display: ['sans_black', 'serif_black'], serif: ['serif_bold'], body: ['sans_med', 'serif'], mono: ['mono'] },
  texture: { grain: 0.27, paper: 0, scan: 0 }, ghost: 0.42,
  bias: { layout: { pulsePoster: 2, splitHeadline: 1.6, accentGlyph: 1.7, huge: 1.3 }, enter: { softWhip: 1.7, windowRise: 1.6, glideGlyph: 1.5 }, exit: { trailFade: 1.5, fade: 1.2 } },
  decor: { bars: 1, dots: 0.6 }, hud: false,
};

Z.STYLES.nightwave = {
  name: '夜潮', desc: '深海蓝 · 潮汐青 · 缓慢透光',
  schemes: [
    { bg: '#071B27', fg: '#EAF7F2', sub: '#A7C9C7', accent: '#62E2CF', accent2: '#F6BE8D', ink: '#071B27', dim: '#103244', ghostA: '#62E2CF', ghostB: '#F6BE8D' },
    { bg: '#103044', fg: '#F4FBF8', sub: '#C1DDD9', accent: '#F6BE8D', accent2: '#62E2CF', ink: '#103044', dim: '#19435A', ghostA: '#F6BE8D', ghostB: '#62E2CF' },
  ],
  fonts: { display: ['serif_black', 'sans_black'], serif: ['serif_bold', 'wenkai'], body: ['sans_med'], mono: ['mono'] },
  texture: { grain: 0.18, paper: 0, scan: 0 }, ghost: 0.42,
  bias: { layout: { tideLine: 2, orbitCaption: 1.5, center: 1.3 }, enter: { trackFocus: 1.7, windowRise: 1.5, softWave: 1.3 }, exit: { trackFade: 1.6, fade: 1.2 } },
  decor: { rings: 0.8, dots: 0.5 }, hud: false,
};

Z.STYLES.paperfire = {
  name: '纸火', desc: '暖纸底 · 油墨黑 · 短促朱橙',
  schemes: [
    { bg: '#F4EFE4', fg: '#24201E', sub: '#615953', accent: '#D95238', accent2: '#24201E', ink: '#F4EFE4', dim: '#E9E1D4', ghostA: '#D95238', ghostB: '#536878', paper: true },
    { bg: '#BB3D2B', fg: '#FFF5E6', sub: '#FFECE5', accent: '#24201E', accent2: '#FFF5E6', ink: '#BB3D2B', dim: '#9F3426', ghostA: '#24201E', ghostB: '#FFF5E6', paper: true },
  ],
  fonts: { display: ['serif_black', 'sans_black'], serif: ['serif_bold', 'wenkai'], body: ['serif'], mono: ['mono'] },
  texture: { grain: 0.25, paper: 0.55, scan: 0 }, ghost: 0.26,
  bias: { layout: { accentGlyph: 2, splitHeadline: 1.7, pulsePoster: 1.5, stack: 1.3 }, enter: { windowRise: 1.7, glideGlyph: 1.5, settle: 1.3 }, exit: { trailFade: 1.5, wipe: 1.1 } },
  decor: { bars: 1, leaders: 0.6 }, hud: false,
};

Z.STYLE_ORDER.unshift('paperfire', 'nightwave', 'afterglow');
})();
