/* RuiC-TextPV 版式组：让同一段歌词在不同镜头里有明确的主次关系。 */
(() => {
'use strict';
const split = text => {
  const a = [...String(text)];
  const at = Math.max(1, Math.ceil(a.length / 2));
  return [a.slice(0, at).join(''), a.slice(at).join('')];
};

Z.registerAll('layout', {
  pulsePoster: {
    name: '脉冲海报', w: 1.25, emph: 2, portrait: 1.2,
    fits: n => n >= 1 && n <= 11,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.display), index: rng.int(1, 9) }; },
    render(env) {
      const { W, H, sc, cut } = env, p = cut.params;
      const size = Z.fitSize(cut.text, p.font, W * 0.78, H * 0.38);
      const barX = W * 0.11, barY = H * 0.24;
      env.rect(barX, barY, W * 0.11, Math.max(4, H * 0.01), sc.accent, 0.95);
      env.rect(barX, H * 0.78, W * 0.78, Math.max(2, H * 0.004), sc.sub, 0.55);
      Z.mkItem(env, { text: `PV / ${String(p.index).padStart(2, '0')}`, font: 'mono', size: H * 0.025,
        x: W * 0.83, y: H * 0.25, color: sc.sub, enter: 'cut', exit: 'cut', hold: 'still', mi: 2, ghost: false });
      return Z.mkItem(env, { text: cut.text, font: p.font, size, x: W * 0.5, y: H * 0.51 });
    },
  },
  splitHeadline: {
    name: '错位双行', w: 1.1, emph: 1.6, portrait: 1,
    fits: n => n >= 3,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.display), body: rng.pick(st.fonts.body) }; },
    render(env) {
      const { W, H, sc, cut } = env, p = cut.params, [a, b] = split(cut.text);
      const top = Z.fitSize(a, p.font, W * 0.69, H * 0.27);
      const bottom = Z.fitSize(b || a, p.body, W * 0.68, H * 0.2);
      env.rect(W * 0.12, H * 0.49, W * 0.75, Math.max(3, H * 0.005), sc.accent, 0.92);
      const first = Z.mkItem(env, { text: a, font: p.font, size: top, x: W * 0.38, y: H * 0.32, align: 'center' });
      if (b) Z.mkItem(env, { text: b, font: p.body, size: bottom, x: W * 0.66, y: H * 0.65,
        color: sc.fg, mi: 1 });
      return first;
    },
  },
  accentGlyph: {
    name: '字首聚焦', w: 1.1, emph: 1.8, portrait: 1.3,
    fits: n => n >= 2 && n <= 12,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.display), body: rng.pick(st.fonts.serif) }; },
    render(env) {
      const { W, H, sc, cut } = env, p = cut.params, chars = [...cut.text];
      const a = chars.shift(), b = chars.join('');
      const lead = Z.fitSize(a, p.font, W * 0.3, H * 0.72);
      const rest = Z.fitSize(b, p.body, W * 0.62, H * 0.32);
      const main = Z.mkItem(env, { text: a, font: p.font, size: lead, x: W * 0.27, y: H * 0.51,
        color: sc.accent });
      env.rect(W * 0.46, H * 0.27, Math.max(2, W * 0.002), H * 0.47, sc.sub, 0.8);
      Z.mkItem(env, { text: b, font: p.body, size: rest, x: W * 0.7, y: H * 0.53,
        color: sc.fg, mi: 1 });
      return main;
    },
  },
  tideLine: {
    name: '潮汐长线', w: 0.9, portrait: 1,
    fits: n => n >= 1,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.display) }; },
    render(env) {
      const { W, H, sc, cut } = env, p = cut.params;
      const size = Z.fitSize(cut.text, p.font, W * 0.77, H * 0.35);
      const u = Z.clamp(env.lt / Math.max(0.3, cut.dur));
      const wave = Math.sin(u * Math.PI * 2) * H * 0.014;
      env.rect(W * 0.1, H * 0.74, W * 0.8, Math.max(2, H * 0.003), sc.sub, 0.42);
      env.rect(W * 0.1, H * 0.74, W * 0.8 * u, Math.max(3, H * 0.006), sc.accent, 0.9);
      return Z.mkItem(env, { text: cut.text, font: p.font, size, x: W * 0.5,
        y: H * 0.47 + wave, hold: 'lineFloat' });
    },
  },
  orbitCaption: {
    name: '环线注释', w: 0.8, portrait: 1.2,
    fits: n => n <= 9,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.display), turns: rng.range(0.5, 1.2) }; },
    render(env) {
      const { W, H, sc, cut } = env, p = cut.params;
      const cx = W * 0.5, cy = H * 0.5, rx = Math.min(W * 0.36, H * 0.49), ry = H * 0.34;
      const pts = [];
      for (let j = 0; j <= 48; j++) {
        const a = j / 48 * Z.TAU;
        pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
      }
      env.line(pts, sc.sub, Math.max(1.5, H * 0.002), 0.5);
      const angle = env.lt * p.turns + (cut.seed % 6);
      env.rect(cx + Math.cos(angle) * rx - H * 0.012, cy + Math.sin(angle) * ry - H * 0.012,
        H * 0.024, H * 0.024, sc.accent, 0.95);
      const size = Z.fitSize(cut.text, p.font, W * 0.62, H * 0.24);
      return Z.mkItem(env, { text: cut.text, font: p.font, size, x: cx, y: cy });
    },
  },
  tickerStack: {
    name: '三轨歌词', w: 0.8, portrait: 0.7,
    fits: n => n >= 2 && n <= 12,
    plan(rng, info, st) { return { font: rng.pick(st.fonts.display), dir: rng.chance(0.5) ? 1 : -1 }; },
    render(env) {
      const { W, H, sc, cut, ctx } = env, p = cut.params;
      const size = Z.fitSize(cut.text, p.font, W * 0.7, H * 0.19);
      ctx.save(); ctx.beginPath(); ctx.rect(0, H * 0.18, W, H * 0.64); ctx.clip();
      const drift = Math.sin(env.lt * 1.45) * W * 0.035 * p.dir;
      Z.mkItem(env, { text: cut.text, font: p.font, size: size * 0.67, x: W * 0.48 - drift,
        y: H * 0.28, color: sc.sub, alpha: 0.31, enter: 'cut', exit: 'cut', hold: 'still', ghost: false, mi: 2 });
      const main = Z.mkItem(env, { text: cut.text, font: p.font, size, x: W * 0.5 + drift,
        y: H * 0.5, color: sc.fg });
      Z.mkItem(env, { text: cut.text, font: p.font, size: size * 0.67, x: W * 0.52 - drift,
        y: H * 0.72, color: sc.accent, alpha: 0.32, enter: 'cut', exit: 'cut', hold: 'still', ghost: false, mi: 3 });
      ctx.restore();
      return main;
    },
  },
}, 'studio');
})();
