/* ============================================================
   RuiC-TextPV — 输出
   MP4（WebCodecs + mp4-muxer）/ 连番 PNG（ZIP）/ 工程 JSON
   全部在浏览器里算完，不上传任何东西。
   ============================================================ */
(() => {
'use strict';

/* ---------- 存文件 ---------- */
Z.saveFile = async (filename, data) => {
  const blob = data instanceof Blob ? data : new Blob([data]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return 'saved';
};

/* ---------- 编码器协商 ---------- */
Z.pickVideoCodec = async (w, h, fps, bitrate) => {
  if (typeof VideoEncoder === 'undefined') return null;
  const cands = [
    { codec: 'avc1.640033', mux: 'avc', label: 'H.264 High' },
    { codec: 'avc1.4d0033', mux: 'avc', label: 'H.264 Main' },
    { codec: 'avc1.42003e', mux: 'avc', label: 'H.264 Baseline' },
    { codec: 'vp09.00.51.08', mux: 'vp9', label: 'VP9' },
    { codec: 'av01.0.12M.08', mux: 'av1', label: 'AV1' },
  ];
  for (const c of cands) {
    const cfg = { codec: c.codec, width: w, height: h, bitrate, framerate: fps };
    if (c.mux === 'avc') cfg.avc = { format: 'avc' };
    try {
      const s = await VideoEncoder.isConfigSupported(cfg);
      if (s.supported) return Object.assign({}, c, { cfg });
    } catch (e) {}
  }
  return null;
};
Z.pickAudioCodec = async (sr, chn) => {
  if (typeof AudioEncoder === 'undefined') return null;
  for (const c of [{ codec: 'mp4a.40.2', mux: 'aac', sr: 48000 }, { codec: 'opus', mux: 'opus', sr: 48000 }]) {
    try {
      const s = await AudioEncoder.isConfigSupported({ codec: c.codec, sampleRate: c.sr, numberOfChannels: chn, bitrate: 192000 });
      if (s.supported) return c;
    } catch (e) {}
  }
  return null;
};
async function resample(buffer, sr, duration) {
  const chn = Math.min(2, buffer.numberOfChannels);
  const len = Math.ceil(duration * sr);
  const oc = new OfflineAudioContext(chn, len, sr);
  const src = oc.createBufferSource();
  src.buffer = buffer;
  src.connect(oc.destination);
  src.start(0);
  return oc.startRendering();
}

/* ---------- MP4 ---------- */
Z.exportMP4 = async ({ plan, project, audio, quality = 'high', onProgress, signal }) => {
  const [w, h] = Z.outputSize(project);
  const fps = plan.fps;
  const bitrate = Math.round(w * h * fps * (quality === 'max' ? 0.42 : quality === 'high' ? 0.28 : 0.16));
  const vc = await Z.pickVideoCodec(w, h, fps, bitrate);
  if (!vc) throw new Error('这个浏览器不支持 WebCodecs 视频编码，请用最新版 Chrome 或 Edge 打开。');
  let ac = null;
  if (audio && audio.buffer && project.includeAudio !== false) {
    ac = await Z.pickAudioCodec(48000, Math.min(2, audio.buffer.numberOfChannels));
  }
  const target = new Mp4Muxer.ArrayBufferTarget();
  const muxOpts = {
    target,
    video: { codec: vc.mux, width: w, height: h, frameRate: fps },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  };
  if (ac) muxOpts.audio = { codec: ac.mux, numberOfChannels: Math.min(2, audio.buffer.numberOfChannels), sampleRate: ac.sr };
  const muxer = new Mp4Muxer.Muxer(muxOpts);
  let err = null;
  const venc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: e => { err = e; } });
  venc.configure(Object.assign({}, vc.cfg, { latencyMode: 'quality' }));

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: false });
  const R = new Z.Renderer();
  const total = Math.max(1, Math.round(plan.duration * fps));
  const scale = w / plan.W;
  const prevRes = Z.glyphs.maxRes;
  Z.glyphs.maxRes = h >= 1000 ? 768 : 512;      // 高分辨率导出时字形碎块更细
  try {
    for (let i = 0; i < total; i++) {
      if (signal && signal.aborted) { try { venc.close(); } catch (e) {} throw new Error('已取消'); }
      if (err) throw err;
      R.frame(ctx, plan, i / fps, { scale });
      const vf = new VideoFrame(canvas, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
      venc.encode(vf, { keyFrame: i % (fps * 2) === 0 });
      vf.close();
      while (venc.encodeQueueSize > 4) await new Promise(r => setTimeout(r, 2));
      if (i % 3 === 0) {
        onProgress && onProgress(i / total, `第 ${i + 1} / ${total} 帧`);
        await new Promise(r => setTimeout(r, 0));
      }
    }
  } finally {
    Z.glyphs.maxRes = prevRes;
  }
  await venc.flush();
  venc.close();
  if (ac) {
    onProgress && onProgress(0.99, '音频编码中');
    const rs = await resample(audio.buffer, ac.sr, plan.duration);
    const chn = rs.numberOfChannels;
    const aenc = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: e => { err = e; } });
    aenc.configure({ codec: ac.codec, sampleRate: ac.sr, numberOfChannels: chn, bitrate: 192000 });
    const frames = rs.length, block = 4800;
    for (let off = 0; off < frames; off += block) {
      const n = Math.min(block, frames - off);
      const data = new Float32Array(n * chn);
      for (let c = 0; c < chn; c++) data.set(rs.getChannelData(c).subarray(off, off + n), c * n);
      const ad = new AudioData({
        format: 'f32-planar', sampleRate: ac.sr, numberOfFrames: n,
        numberOfChannels: chn, timestamp: Math.round(off * 1e6 / ac.sr), data,
      });
      aenc.encode(ad);
      ad.close();
      if (aenc.encodeQueueSize > 16) await new Promise(r => setTimeout(r, 1));
    }
    await aenc.flush();
    aenc.close();
    if (err) throw err;
  }
  muxer.finalize();
  onProgress && onProgress(1, '完成');
  return { blob: new Blob([target.buffer], { type: 'video/mp4' }), codec: vc.label, audio: ac ? ac.mux : null, width: w, height: h };
};

/* ---------- 连番 PNG 打包成 ZIP（不压缩，省时间） ---------- */
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (u8) => {
  let c = 0xffffffff;
  for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
class ZipWriter {
  constructor() { this.parts = []; this.central = []; this.offset = 0; }
  add(name, u8) {
    const nb = new TextEncoder().encode(name), crc = crc32(u8);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
    lh.setUint16(8, 0, true); lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, u8.length, true); lh.setUint32(22, u8.length, true);
    lh.setUint16(26, nb.length, true); lh.setUint16(28, 0, true);
    this.parts.push(lh.buffer, nb, u8);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, 0, true);
    ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true); ch.setUint32(20, u8.length, true);
    ch.setUint32(24, u8.length, true); ch.setUint16(28, nb.length, true); ch.setUint32(42, this.offset, true);
    this.central.push(ch.buffer, nb);
    this.offset += 30 + nb.length + u8.length;
  }
  finish() {
    const cdSize = this.central.reduce((s, p) => s + (p.byteLength ?? p.length), 0);
    const n = this.central.length / 2;
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, n, true); end.setUint16(10, n, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, this.offset, true);
    return new Blob([...this.parts, ...this.central, end.buffer], { type: 'application/zip' });
  }
}
Z.exportPNGZip = async ({ plan, project, transparent, onProgress, signal, every = 1 }) => {
  const [w, h] = Z.outputSize(project);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const R = new Z.Renderer();
  const fps = plan.fps;
  const total = Math.max(1, Math.round(plan.duration * fps));
  const zip = new ZipWriter();
  const scale = w / plan.W;
  for (let i = 0; i < total; i += every) {
    if (signal && signal.aborted) throw new Error('已取消');
    R.frame(ctx, plan, i / fps, { scale, transparent });
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    zip.add(`ruic_${String(i).padStart(5, '0')}.png`, new Uint8Array(await blob.arrayBuffer()));
    onProgress && onProgress(i / total, `PNG ${i + 1} / ${total}`);
  }
  onProgress && onProgress(1, '完成');
  return zip.finish();
};

/* ---------- 工程 JSON ---------- */
Z.projectJSON = (project, plan) => {
  const clean = JSON.parse(JSON.stringify(plan, (k, v) => (k === 'energy' || k === 'buffer' || k === 'peaks' ? undefined : v)));
  clean.version = 2;
  clean.generator = 'RuiC-TextPV';
  clean.width = Z.outputSize(project)[0];
  clean.height = Z.outputSize(project)[1];
  /* 把零件名也带上，方便人工读这份 JSON */
  clean.partNames = {};
  for (const c of clean.cuts || []) {
    for (const [g, k] of [['layout', c.layout], ['enter', c.enter], ['exit', c.exit], ['hold', c.hold], ['treat', c.treat], ['bg', c.bg], ['cam', c.cam], ['trans', c.trans]]) {
      if (!k || k === 'none') continue;
      if (!clean.partNames[g]) clean.partNames[g] = {};
      if (Z.registry(g)[k]) clean.partNames[g][k] = Z.registry(g)[k].name;
    }
    for (const d of c.decor || []) {
      if (!clean.partNames.decor) clean.partNames.decor = {};
      if (Z.DECOR[d.id]) clean.partNames.decor[d.id] = Z.DECOR[d.id].name;
    }
  }
  return clean;
};

/* ---------- 纯数据版的工程存档（可再读回来） ---------- */
Z.trimProject = (project) => {
  const p = JSON.parse(JSON.stringify(project));
  delete p._audio;
  return p;
};
Z.loadProject = (obj) => {
  const base = Z.defaultProject();
  const p = Object.assign(base, obj || {});
  p.fx = Object.assign(base.fx, (obj && obj.fx) || {});
  p.timing = Object.assign(base.timing, (obj && obj.timing) || {});
  p.colors = Object.assign({ enabled: false }, (obj && obj.colors) || {});
  p.enabled = (obj && obj.enabled) || {};
  p.overrides = (obj && obj.overrides) || {};
  p.fonts = (obj && obj.fonts) || {};
  return p;
};
})();
