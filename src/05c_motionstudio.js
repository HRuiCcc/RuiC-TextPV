/* RuiC-TextPV 运动组：每个动作都有可读的起势、错峰和收势。 */
(() => {
'use strict';
const E = Z.E;
const order = (i, n) => n > 1 ? i / (n - 1) : 0;
const phase = (p, i, n, spread) => Z.clamp((p - spread * order(i, n)) / (1 - spread));

Z.registerAll('enter', {
  windowRise: {
    name: '窗内升字', tags: ['graphic', 'editorial', 'calm'], w: 1.35,
    inDur: dur => Z.clamp(dur * 0.48, 0.24, 0.78),
    apply(env, it, p) {
      const sy = it.sy || 1;
      it.charFns.push((i, g, n) => {
        const q = phase(p, i, n, 0.4);
        if (q <= 0) return { hide: true };
        if (q >= 1) return null;
        const offset = 1.06 * (1 - E.outQuint(q));
        return { dy: offset * g.h * sy, clipX: [-2, 2], clipY: [-0.68 - offset, 0.68 - offset] };
      });
    },
  },
  glideGlyph: {
    name: '逐字滑入', tags: ['graphic', 'editorial', 'pop'], w: 1.25,
    inDur: dur => Z.clamp(dur * 0.48, 0.25, 0.82),
    apply(env, it, p) {
      const dir = (it.seed & 1) ? 1 : -1;
      it.charFns.push((i, g, n) => {
        const q = phase(p, i, n, 0.48);
        if (q <= 0) return { hide: true };
        if (q >= 1) return null;
        const e = E.outQuint(q), k = 1 - e;
        return { dx: dir * k * it.size * 0.82, a: Math.pow(Z.clamp(q * 1.65), 1.4), skew: dir * 7 * k };
      });
    },
  },
  trackFocus: {
    name: '字距合焦', tags: ['calm', 'editorial', 'emotional'], w: 1.2,
    inDur: dur => Z.clamp(dur * 0.5, 0.25, 0.85),
    apply(env, it, p) {
      const e = E.outQuint(p), k = 1 - e;
      it.track = (it.track || 0) + 0.82 * k;
      it.alpha = (it.alpha ?? 1) * E.outCubic(Z.clamp(p * 1.55));
      it.charFns.push((i, g, n) => ({ dy: (order(i, n) - 0.5) * it.size * 0.34 * k, a: 0.55 + 0.45 * e }));
    },
  },
  softWhip: {
    name: '柔性甩入', tags: ['graphic', 'pop'], w: 1.1,
    inDur: dur => Z.clamp(dur * 0.36, 0.2, 0.55),
    apply(env, it, p) {
      const dir = (it.seed & 1) ? 1 : -1;
      const e = E.outQuint(p), k = 1 - e;
      it.x += dir * Math.min(env.W * 0.42, it.size * 3.8) * k;
      it.skew = (it.skew || 0) + dir * 19 * k;
      it.alpha = (it.alpha ?? 1) * Z.clamp(p * 5);
      if (p < 0.85) it.streak = { n: 3, dx: -dir * it.size * 0.34 * k, dy: 0, a: 0.27 * k };
    },
  },
  softWave: {
    name: '逐字波起', tags: ['calm', 'emotional', 'pop'], w: 1.2,
    inDur: dur => Z.clamp(dur * 0.52, 0.28, 0.85),
    apply(env, it, p) {
      it.charFns.push((i, g, n) => {
        const q = phase(p, i, n, 0.42);
        if (q <= 0) return { hide: true };
        if (q >= 1) return null;
        const e = E.outCubic(q), arc = Math.sin(Math.PI * q) * (1 - q * 0.36);
        return { dy: -arc * it.size * 0.56 + (1 - e) * it.size * 0.22, rot: -arc * 7, a: Z.clamp(q * 3.2) };
      });
    },
  },
  cursorInk: {
    name: '色条扫字', tags: ['graphic', 'editorial'], w: 1.15,
    inDur: dur => Z.clamp(dur * 0.48, 0.24, 0.72),
    apply(env, it, p) {
      const box = Z.itemBox(it);
      const e = E.outCubic(p);
      const x = Z.lerp(box.x0 - it.size * 0.15, box.x1 + it.size * 0.25, e);
      it.clip = [-env.W, x];
      if (p < 0.98) it.wipeBar = { x, h: box.h * 1.2 };
      it.alpha = (it.alpha ?? 1) * Z.clamp(p * 5);
    },
  },
}, 'studio');

Z.registerAll('hold', {
  lineFloat: {
    name: '低频浮移', tags: ['calm', 'emotional'], w: 0.9,
    apply(env, it, amt) {
      const s = env.fx.motion ?? 0.7;
      it.y += Math.sin(env.lt * 1.6 + (it.seed % 7)) * it.size * 0.018 * s * amt;
      it.x += Math.sin(env.lt * 0.9) * it.size * 0.01 * s * amt;
    },
  },
}, 'studio');

Z.registerAll('exit', {
  trailFade: {
    name: '逐字拖尾', tags: ['graphic', 'pop'], w: 1.1,
    outDur: dur => Z.clamp(dur * 0.28, 0.16, 0.52),
    apply(env, it, p) {
      const dir = (it.seed & 1) ? 1 : -1;
      it.charFns.push((i, g, n) => {
        const q = phase(p, i, n, 0.28);
        const e = E.inQuad(q);
        return { dx: dir * it.size * 0.72 * e, a: 1 - e, skew: dir * 9 * e };
      });
      if (p > 0.08) it.streak = { n: 3, dx: -dir * it.size * 0.17 * p, dy: 0, a: 0.2 * (1 - p) };
    },
  },
  trackFade: {
    name: '字距散去', tags: ['calm', 'editorial'], w: 1,
    apply(env, it, p) {
      const e = E.inQuad(p);
      it.track = (it.track || 0) + 0.9 * e;
      it.alpha = (it.alpha ?? 1) * (1 - e);
      it.y -= it.size * 0.16 * e;
    },
  },
  foldDown: {
    name: '收折退场', tags: ['graphic', 'editorial'], w: 0.9,
    apply(env, it, p) {
      const e = E.inCubic(p);
      it.sy = (it.sy || 1) * Math.max(0.02, 1 - e);
      it.y += it.size * 0.24 * e;
      it.alpha = (it.alpha ?? 1) * (1 - Z.clamp((p - 0.64) / 0.36));
    },
  },
}, 'studio');
})();
