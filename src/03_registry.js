/* ============================================================
   RuiC-TextPV — 零件注册表
   每个"零件"是一种演出：布局 / 入场 / 保持 / 退场 / 装饰 /
   文字加工 / 背景 / 相机 / 画面特效 / 转场。
   规划器从每个分类里各抽一个，组合成一个镜头。
   ============================================================ */
(() => {
'use strict';

const GROUPS = {
  layout: ['LAYOUTS', 'LAYOUT_ORDER'],   // 文字怎么摆
  enter: ['ENTER', 'ENTER_ORDER'],       // 怎么出现
  hold: ['HOLD', 'HOLD_ORDER'],          // 停留时怎么动
  exit: ['EXIT', 'EXIT_ORDER'],          // 怎么消失
  decor: ['DECOR', 'DECOR_ORDER'],       // 叠加的图形（0~3 个）
  treat: ['TREAT', 'TREAT_ORDER'],       // 文字本身的加工（描边/立体/霓虹…）
  bg: ['BG', 'BG_ORDER'],                // 整屏背景图形（逐行选）
  cam: ['CAMERA', 'CAMERA_ORDER'],       // 镜头运动
  fx: ['FX', 'FX_ORDER'],                // 画面特效与转场素材
  trans: ['TRANS', 'TRANS_ORDER'],       // 镜头与镜头之间的切换
};
Z.GROUPS = Object.keys(GROUPS);

/* 先把十个注册表和它们的顺序数组建好，后面的零件包直接往里注册 */
for (const g of Z.GROUPS) {
  const [reg, order] = GROUPS[g];
  Z[reg] = Z[reg] || {};
  Z[order] = Z[order] || [];
}

Z.TREAT = { none: { name: '原样', apply() {} } };
Z.TREAT_ORDER = ['none'];
Z.BG = { none: { name: '无', draw() {} } };
Z.BG_ORDER = ['none'];
Z.FX = {
  slice: { name: '切片故障', builtin: true },
  block: { name: '色块故障', builtin: true },
  invert: { name: '反相', builtin: true },
  flash: { name: '闪白', builtin: true },
  zoom: { name: '变焦拖影', builtin: true },
  mosaic: { name: '马赛克', builtin: true },
  shake: { name: '震动', builtin: true },
  chroma: { name: '色散跳变', builtin: true },
};
Z.FX_ORDER = ['chroma', 'shake', 'slice', 'block', 'invert', 'flash', 'zoom', 'mosaic'];
Z.CAMERA = { push: { name: '缓推', tags: ['*'], w: 5, get: (env) => ({ s: 1 + 0.03 * (env.fx.motion ?? 0.7) * Z.clamp(env.lt / Math.max(0.3, env.cut.dur)) }) } };
Z.CAMERA_ORDER = ['push'];
Z.TRANS = {};
Z.TRANS_ORDER = [];

Z.registry = g => Z[GROUPS[g][0]];
Z.order = g => Z[GROUPS[g][1]];

/* 注册一个零件。def.name 必填；tags 是它适合的"气质"；
   w 是基础权重；pack 标记来自哪个零件包。 */
Z.register = (group, key, def, pack) => {
  const G = GROUPS[group];
  if (!G) throw new Error('未知分类: ' + group);
  if (!def || !def.name) throw new Error(`${group}.${key} 缺少 name`);
  const reg = Z[G[0]], order = Z[G[1]];
  if (reg[key] && reg[key].pack && reg[key].pack !== pack) console.warn(`RuiC-TextPV：${group}.${key} 被覆盖`);
  def.pack = pack || def.pack || 'core';
  if (def.pack === 'design') def.design = true;      // 动效设计层
  if (def.pack === 'wa') def.wa = true;              // 和风元素
  reg[key] = def;
  if (!def.special && !order.includes(key)) order.push(key);
  return def;
};
Z.registerAll = (group, defs, pack) => { for (const k of Object.keys(defs)) Z.register(group, k, defs[k], pack); };
Z.taggedWith = (group, mood) => Z.order(group).filter(k => { const d = Z.registry(group)[k]; return d && d.tags && (d.tags.includes(mood) || d.tags.includes('*')); });

/* 零件总览（给 UI 的手法面板用） */
Z.catalog = () => {
  const out = {};
  for (const g of Z.GROUPS) out[g] = Z.order(g).map(k => ({ key: k, name: Z.registry(g)[k].name, pack: Z.registry(g)[k].pack, tags: Z.registry(g)[k].tags || [] }));
  return out;
};
Z.countParts = () => Z.GROUPS.reduce((n, g) => n + Z.order(g).length, 0);
})();
