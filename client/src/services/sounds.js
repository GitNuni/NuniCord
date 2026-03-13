// Soundboard — all sounds generated via Web Audio API, no external files needed

let ctx = null;
function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

function master(ac, gainVal = 0.4) {
  const g = ac.createGain();
  g.gain.setValueAtTime(gainVal, ac.currentTime);
  g.connect(ac.destination);
  return g;
}

function osc(ac, type, freq, start, dur, dest, gain = 0.4) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ac.currentTime + start);
  g.gain.setValueAtTime(gain, ac.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + start + dur);
  o.connect(g);
  g.connect(dest);
  o.start(ac.currentTime + start);
  o.stop(ac.currentTime + start + dur);
}

export const SOUNDS = [
  { id: 'airhorn',     label: '📯 Airhorn',       color: '#ff6b00' },
  { id: 'bruh',        label: '😐 Bruh',           color: '#2a5870' },
  { id: 'ding',        label: '🔔 Ding',            color: '#00d4ff' },
  { id: 'trombone',    label: '😢 Sad Trombone',   color: '#5a3a8a' },
  { id: 'victory',     label: '🎉 Victory',         color: '#00ff88' },
  { id: 'error',       label: '💥 Error',           color: '#ff3c00' },
  { id: 'laser',       label: '⚡ Laser',           color: '#00d4ff' },
  { id: 'alarm',       label: '🚨 CTOS Alert',     color: '#ff3c00' },
  { id: 'glitch',      label: '👾 Glitch',          color: '#c084fc' },
  { id: 'coin',        label: '💰 Coin',            color: '#f0d020' },
];

export function playSound(id) {
  try {
    const ac = getCtx();
    if (ac.state === 'suspended') ac.resume();
    const out = master(ac, 0.5);
    sounds[id]?.(ac, out);
  } catch (e) {
    console.warn('Sound playback error:', e);
  }
}

export async function playCustomSound(url) {
  try {
    const ac = getCtx();
    if (ac.state === 'suspended') await ac.resume();
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ac.decodeAudioData(arrayBuffer);
    const source = ac.createBufferSource();
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.6, ac.currentTime);
    source.buffer = audioBuffer;
    source.connect(gain);
    gain.connect(ac.destination);
    source.start();
  } catch (e) {
    console.warn('Custom sound playback error:', e);
  }
}

const sounds = {
  airhorn(ac, out) {
    // Loud sustained blast
    for (let i = 0; i < 3; i++) {
      const freq = 220 + i * 110;
      osc(ac, 'sawtooth', freq, 0, 1.2, out, 0.3);
    }
    osc(ac, 'square', 110, 0, 1.2, out, 0.15);
  },

  bruh(ac, out) {
    // Deep descending "bruh" tone
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(180, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(80, ac.currentTime + 0.6);
    g.gain.setValueAtTime(0.5, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.8);
    o.connect(g); g.connect(out);
    o.start(); o.stop(ac.currentTime + 0.8);
  },

  ding(ac, out) {
    // Bell-like tone
    osc(ac, 'sine', 1400, 0,    0.8, out, 0.4);
    osc(ac, 'sine', 2100, 0,    0.5, out, 0.2);
    osc(ac, 'sine', 1050, 0.05, 0.6, out, 0.15);
  },

  trombone(ac, out) {
    // Wah wah wah wahhhhh
    const notes = [392, 350, 311, 196];
    const times = [0, 0.35, 0.7, 1.05];
    notes.forEach((f, i) => osc(ac, 'sawtooth', f, times[i], 0.5, out, 0.25));
  },

  victory(ac, out) {
    // Ascending fanfare
    const notes = [262, 330, 392, 523, 659, 784];
    notes.forEach((f, i) => osc(ac, 'square', f, i * 0.1, 0.25, out, 0.25));
    osc(ac, 'square', 784, 0.5, 0.5, out, 0.3);
  },

  error(ac, out) {
    // Windows XP-style error beeps
    const freqs = [600, 400, 600, 300];
    freqs.forEach((f, i) => osc(ac, 'square', f, i * 0.15, 0.12, out, 0.3));
  },

  laser(ac, out) {
    // Pew pew frequency sweep
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(1500, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(100, ac.currentTime + 0.5);
    g.gain.setValueAtTime(0.4, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5);
    o.connect(g); g.connect(out);
    o.start(); o.stop(ac.currentTime + 0.5);
  },

  alarm(ac, out) {
    // CTOS-style pulsing alarm
    for (let i = 0; i < 6; i++) {
      const t = i * 0.15;
      osc(ac, 'square', i % 2 === 0 ? 880 : 660, t, 0.1, out, 0.25);
    }
  },

  glitch(ac, out) {
    // Random noise bursts
    for (let i = 0; i < 8; i++) {
      const t = i * 0.07 + Math.random() * 0.02;
      const f = 100 + Math.random() * 1200;
      osc(ac, 'sawtooth', f, t, 0.05, out, 0.2);
    }
  },

  coin(ac, out) {
    // Mario coin-style
    osc(ac, 'square', 988,  0,    0.1, out, 0.3);
    osc(ac, 'square', 1319, 0.1,  0.2, out, 0.3);
  },
};
