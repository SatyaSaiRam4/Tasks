/**
 * The real weather, lightly, behind Melo in his corner on Home: a soft sun
 * glow (or a few twinkles at night), slow clouds, thin rain, a faint flash in
 * a storm, drifting snow or a band of mist. It's a plain 2D canvas behind
 * the 3D stage, kept faint so Melo stays the star, with colours that read on
 * the cream (light) and midnight (dark) Home alike.
 *
 * createWeather() returns { set(kind, isDay), setPaused(bool) }, where kind
 * is 'clear', 'cloudy', 'fog', 'rain', 'storm', 'snow' or 'none'.
 */
export function createWeather({ reduced = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;z-index:-1;width:100%;height:100%;pointer-events:none;';
  document.body.insertBefore(canvas, document.body.firstChild);
  const g = canvas.getContext('2d');
  let kind = 'none';
  let day = true;
  let paused = false;
  let w = 0;
  let h = 0;
  let bits = [];

  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  window.addEventListener('resize', resize);
  resize();

  const rand = (a, b) => a + Math.random() * (b - a);
  const seed = () => {
    const n = { rain: 34, storm: 46, snow: 22, cloudy: 3, fog: 2, clear: day ? 0 : 9 }[kind] || 0;
    bits = Array.from({ length: n }, (_, i) => ({
      x: rand(0, 1),
      y: rand(0, 1),
      s: rand(0.6, 1.2),
      p: rand(0, Math.PI * 2),
      i,
    }));
  };

  const cloud = (x, y, r, alpha) => {
    g.fillStyle = `rgba(214, 220, 232, ${alpha})`;
    g.strokeStyle = `rgba(120, 132, 156, ${alpha * 0.6})`;
    g.lineWidth = 1;
    g.beginPath();
    g.arc(x - r * 0.9, y + r * 0.15, r * 0.6, 0, Math.PI * 2);
    g.arc(x, y - r * 0.15, r * 0.85, 0, Math.PI * 2);
    g.arc(x + r * 0.95, y + r * 0.2, r * 0.55, 0, Math.PI * 2);
    g.fill();
  };

  const draw = t => {
    g.clearRect(0, 0, w, h);
    if (kind === 'none') return;
    const sec = t / 1000;
    if (kind === 'clear' && day) {
      // A warm glow in the top corner, breathing slowly.
      const r = Math.min(w, h) * (0.55 + 0.04 * Math.sin(sec * 0.8));
      const sun = g.createRadialGradient(w * 0.92, h * 0.05, 0, w * 0.92, h * 0.05, r);
      sun.addColorStop(0, 'rgba(255, 196, 92, 0.30)');
      sun.addColorStop(0.45, 'rgba(255, 196, 92, 0.10)');
      sun.addColorStop(1, 'rgba(255, 196, 92, 0)');
      g.fillStyle = sun;
      g.fillRect(0, 0, w, h);
    } else if (kind === 'clear') {
      // A few soft twinkles in the upper half.
      for (const b of bits) {
        const a = 0.25 + 0.35 * Math.max(0, Math.sin(sec * 1.4 * b.s + b.p));
        g.fillStyle = `rgba(232, 214, 160, ${a})`;
        g.beginPath();
        g.arc(b.x * w, b.y * h * 0.45, 1.6 * b.s, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (kind === 'cloudy' || kind === 'rain' || kind === 'storm') {
      // Slow clouds drifting along the top.
      const n = kind === 'cloudy' ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const speed = 8 + i * 5;
        const x = ((sec * speed + i * w * 0.45) % (w + 160)) - 80;
        cloud(x, h * (0.1 + i * 0.07), 22 + i * 6, kind === 'cloudy' ? 0.32 : 0.26);
      }
    }
    if (kind === 'rain' || kind === 'storm') {
      g.strokeStyle = 'rgba(100, 130, 185, 0.5)';
      g.lineWidth = 1.2;
      g.beginPath();
      for (const b of bits) {
        const y = ((b.y * h + sec * 260 * b.s) % (h + 20)) - 20;
        const x = b.x * w - y * 0.12;
        g.moveTo(x, y);
        g.lineTo(x - 2, y + 11 * b.s);
      }
      g.stroke();
      // Now and then a faint flash.
      if (kind === 'storm') {
        const f = (sec % 7) / 7;
        if (f > 0.96) {
          g.fillStyle = `rgba(255, 255, 255, ${0.18 * Math.sin(((f - 0.96) / 0.04) * Math.PI)})`;
          g.fillRect(0, 0, w, h);
        }
      }
    }
    if (kind === 'snow') {
      for (const b of bits) {
        const y = ((b.y * h + sec * 22 * b.s) % (h + 10)) - 10;
        const x = b.x * w + 10 * Math.sin(sec * 0.9 + b.p);
        g.fillStyle = 'rgba(255, 255, 255, 0.85)';
        g.strokeStyle = 'rgba(110, 122, 150, 0.7)';
        g.lineWidth = 0.8;
        g.beginPath();
        g.arc(x, y, 2.2 * b.s, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
    }
    if (kind === 'fog') {
      // Two soft bands of mist sliding past at different speeds.
      for (const b of bits) {
        const y = h * (0.35 + b.i * 0.25);
        const x = ((sec * (10 + b.i * 6) + b.i * w * 0.5) % (w * 1.6)) - w * 0.3;
        const band = g.createRadialGradient(x, y, 0, x, y, w * 0.5);
        band.addColorStop(0, 'rgba(176, 184, 198, 0.26)');
        band.addColorStop(1, 'rgba(176, 184, 198, 0)');
        g.fillStyle = band;
        g.fillRect(0, 0, w, h);
      }
    }
  };

  let running = false;
  const loop = t => {
    if (paused || reduced || kind === 'none') {
      running = false;
      return;
    }
    draw(t);
    requestAnimationFrame(loop);
  };
  const kick = () => {
    if (reduced || kind === 'none') {
      draw(0); // still: one quiet frame (or clear it)
      return;
    }
    if (!running && !paused) {
      running = true;
      requestAnimationFrame(loop);
    }
  };

  return {
    set(next, isDay = true) {
      const k = ['clear', 'cloudy', 'fog', 'rain', 'storm', 'snow'].includes(next) ? next : 'none';
      if (k === kind && Boolean(isDay) === day) return;
      kind = k;
      day = Boolean(isDay);
      seed();
      kick();
    },
    setPaused(v) {
      paused = Boolean(v);
      kick();
    },
  };
}
