/* RuiC-TextPV 的音乐标记与留白背景：丰富画面，同时让歌词保持最亮。 */
(() => {
'use strict';

Z.registerAll('bg', {
  scoreLines: {
    name: '节拍谱线', subtle: true, w: 0.8,
    draw(env, p) {
      const { W, H, sc } = env;
      const y0 = H * 0.12, y1 = H * 0.88, gap = H * 0.027;
      for (let j = 0; j < 4; j++) {
        const y = j % 2 ? y1 + j * gap : y0 + j * gap;
        env.rect(W * 0.07, y, W * 0.86, Math.max(1.4, H * 0.0017), sc.sub, 0.22);
      }
      const beats = 12, active = Math.floor(Z.clamp(env.lt / Math.max(0.3, env.cut.dur)) * beats);
      for (let i = 0; i < beats; i++) {
        const x = W * (0.07 + i * 0.86 / (beats - 1));
        env.rect(x, H * 0.12, Math.max(1.6, W * 0.0014), H * (i <= active ? 0.023 : 0.012),
          i <= active ? sc.accent : sc.sub, i <= active ? 0.7 : 0.34);
      }
    },
  },
  gradientArc: {
    name: '偏心光弧', subtle: true, w: 0.7,
    draw(env, p) {
      const { ctx, W, H, sc } = env;
      const t = env.lt / Math.max(0.3, env.cut.dur);
      const cx = W * (0.72 + Math.sin(t * 1.6) * 0.04), cy = H * 0.35;
      const R = Math.min(W, H) * 0.72;
      ctx.save();
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      glow.addColorStop(0, Z.rgba(sc.accent, 0.15));
      glow.addColorStop(0.5, Z.rgba(sc.accent2 || sc.fg, 0.06));
      glow.addColorStop(1, Z.rgba(sc.accent, 0));
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
      ctx.restore();
      const pts = [];
      for (let i = 0; i <= 48; i++) {
        const a = (-0.75 + i / 48 * 1.45) * Math.PI;
        pts.push([cx + Math.cos(a) * R * 0.83, cy + Math.sin(a) * R * 0.83]);
      }
      env.line(pts, sc.accent, Math.max(1.6, W * 0.0014), 0.22);
    },
  },
}, 'studio');

Z.registerAll('decor', {
  beatRail: {
    name: '拍点轨', subtle: true, w: 0.7,
    draw(env, bb, p) {
      if (env.plan.keyBg) return;
      const { W, H, sc, cut } = env;
      const x = W * 0.065, y = H * 0.91;
      const progress = Z.clamp(env.lt / Math.max(0.3, cut.dur));
      env.rect(x, y, W * 0.18, Math.max(1.5, H * 0.002), sc.sub, 0.28, false);
      env.rect(x, y, W * 0.18 * progress, Math.max(2.5, H * 0.004), sc.accent, 0.78, false);
      for (let i = 0; i < 5; i++) {
        const tick = x + i * W * 0.045;
        env.rect(tick, y - H * 0.009, Math.max(1.4, W * 0.001), H * 0.009, sc.sub, 0.58, false);
      }
      if (env.pass === 'main') Z.drawText(env, {
        text: `L${String(Math.max(0, cut.line + 1)).padStart(2, '0')} / C${String(cut.index + 1).padStart(2, '0')}`,
        font: 'mono', size: H * 0.018, x: W * 0.88, y: y,
        color: sc.sub, alpha: 0.65, ghost: false,
      });
    },
  },
}, 'studio');
})();
