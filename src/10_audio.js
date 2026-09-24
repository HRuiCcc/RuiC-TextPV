/* ============================================================
   RuiC-TextPV — 音频分析
   解码 → 能量包络 → 起音强度 → 自相关测速 → 拍网格
   全部在浏览器本地完成，文件不上传。
   ============================================================ */
(() => {
'use strict';

Z.analyzeAudio = async (file) => {
  const buf = await file.arrayBuffer();
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC();
  let audioBuffer;
  try { audioBuffer = await ac.decodeAudioData(buf.slice(0)); }
  finally { try { ac.close(); } catch (e) {} }

  const sr = audioBuffer.sampleRate, len = audioBuffer.length, ch = audioBuffer.numberOfChannels;
  const mono = new Float32Array(len);
  for (let c = 0; c < ch; c++) {
    const d = audioBuffer.getChannelData(c);
    for (let i = 0; i < len; i++) mono[i] += d[i] / ch;
  }
  /* ---- 50Hz 帧：宽带能量 + 高通能量（起音用） ---- */
  const rate = 50, hop = Math.max(1, Math.round(sr / rate)), n = Math.floor(len / hop);
  const energy = new Float32Array(n), flux = new Float32Array(n);
  let prevHP = 0, prevX = 0;
  for (let f = 0; f < n; f++) {
    let e = 0, eh = 0;
    const end = Math.min(len, (f + 1) * hop);
    for (let i = f * hop; i < end; i++) {
      const x = mono[i]; e += x * x;
      const hp = 0.92 * (prevHP + x - prevX);       // 一阶高通
      prevHP = hp; prevX = x; eh += hp * hp;
    }
    energy[f] = Math.sqrt(e / hop);
    flux[f] = Math.sqrt(eh / hop);
  }
  /* ---- 起音强度：高通能量的对数正向变化 vs 局部均值 ---- */
  const onset = new Float32Array(n);
  for (let f = 1; f < n; f++) {
    const cur = Math.log(1e-4 + flux[f]);
    let m = 0, k = 0;
    for (let j = Math.max(0, f - 4); j < f; j++) { m += Math.log(1e-4 + flux[j]); k++; }
    onset[f] = Math.max(0, cur - m / Math.max(1, k));
  }
  /* ---- 速度：70~180 BPM 自相关 + 抛物线插值 ---- */
  const minLag = Math.round(rate * 60 / 180), maxLag = Math.round(rate * 60 / 70);
  const scores = [];
  let best = 0, bestLag = Math.round(rate * 0.5);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let f = lag; f < n; f++) s += onset[f] * onset[f - lag];
    const bpm = 60 * rate / lag;
    s *= Math.exp(-0.5 * Math.pow(Math.log2(bpm / 125) / 0.7, 2));   // 往 125BPM 收一点
    scores[lag] = s;
    if (s > best) { best = s; bestLag = lag; }
  }
  let lagF = bestLag;
  if (scores[bestLag - 1] != null && scores[bestLag + 1] != null) {
    const a = scores[bestLag - 1], b = scores[bestLag], c = scores[bestLag + 1];
    const den = (a - 2 * b + c);
    if (den !== 0) lagF = bestLag + 0.5 * (a - c) / den;
  }
  const period = lagF / rate;
  /* ---- 相位：让拍点落在起音上 ---- */
  let bestPh = 0, bestPS = -1;
  for (let ph = 0; ph < lagF; ph += 0.5) {
    let s = 0;
    for (let t2 = ph; t2 < n; t2 += lagF) s += onset[Math.round(t2)] || 0;
    if (s > bestPS) { bestPS = s; bestPh = ph; }
  }
  const beats = [];
  for (let t2 = bestPh / rate; t2 < audioBuffer.duration; t2 += period) beats.push(+t2.toFixed(4));
  /* ---- 归一化能量（95 分位）+ 波形峰值（画时间轴） ---- */
  const sorted = Array.from(energy).sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 1;
  const energyN = new Float32Array(n);
  for (let f = 0; f < n; f++) energyN[f] = Math.min(1, energy[f] / p95);
  const bins = 1600, peaks = new Float32Array(bins), per = Math.max(1, Math.floor(len / bins));
  for (let b = 0; b < bins; b++) {
    let m = 0;
    for (let i = b * per, e2 = Math.min(len, (b + 1) * per); i < e2; i += 4) { const v = Math.abs(mono[i]); if (v > m) m = v; }
    peaks[b] = m;
  }
  return {
    name: file.name, duration: audioBuffer.duration, sampleRate: sr, buffer: audioBuffer,
    bpm: Math.round(60 / period * 10) / 10, beats, energy: energyN, energyRate: rate, peaks,
  };
};

/* 用用户指定的 BPM + 首拍偏移重建拍网格 */
Z.beatGrid = (bpm, offset, duration) => {
  const out = [];
  if (!(bpm > 0)) return out;
  const p = 60 / bpm;
  for (let t = offset; t < duration + 0.01; t += p) if (t >= 0) out.push(+t.toFixed(4));
  return out;
};
})();
