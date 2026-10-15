// Ambient particles for the special dates, loaded by seasons.js only when a
// season is on and reduced motion is not requested. One fixed canvas behind
// the content's interactive layer, a few dozen particles, paused while the
// tab is hidden. start(id) returns a stop function.
const KINDS = {
  newyear: { kind: 'fireworks', colors: ['#E9B949', '#E4472B', '#2FA3A3', '#DB5A93'] },
  carnival: { kind: 'confetti', colors: ['#E9B949', '#1F8A8A', '#C2407A', '#E4472B', '#7D79E0'] },
  easter: { kind: 'petals', colors: ['#B9A3E8', '#F2A7B5', '#8FD3B6', '#F5D978', '#8DB8E8'] },
  valentine: { kind: 'hearts', colors: ['#E2566E', '#F2A7B5', '#C2407A'] },
  junina: { kind: 'sparks', colors: ['#FFD36B', '#F0954A', '#E4472B'] },
  halloween: { kind: 'leaves', colors: ['#E8892F', '#B9601C', '#C8463A', '#E9B949'] },
  christmas: { kind: 'snow', colors: ['#FFFFFF', '#E9EEF8'] },
};

export function start(id) {
  const cfg = KINDS[id];
  if (!cfg) return () => {};
  const canvas = document.createElement('canvas');
  canvas.className = 'season-fx';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, raf = 0, last = 0, t = 0;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function size() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = innerWidth;
    H = innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  size();
  const count = Math.round(Math.min(34, Math.max(14, W / 50)));
  const rising = cfg.kind === 'sparks';
  const make = (fresh) => ({
    x: rnd(0, W), y: fresh ? rnd(0, H) : rising ? H + 10 : -20, s: rnd(4, 9), vx: rnd(-12, 12), vy: rising ? rnd(-40, -20) : rnd(18, 42),
    a: rnd(0, 6.28), va: rnd(-2, 2), c: pick(cfg.colors), life: rnd(0.5, 1), sway: rnd(0.6, 1.6),
  });
  let ps = Array.from({ length: count }, () => make(true));
  let bursts = [];
  let bats = [];

  function shape(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a);
    ctx.fillStyle = p.c;
    const k = cfg.kind;
    if (k === 'snow') {
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.arc(0, 0, p.s * 0.45, 0, 6.28);
      ctx.fill();
    } else if (k === 'confetti') {
      ctx.globalAlpha = 0.7;
      ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2 * Math.abs(Math.cos(t * 3 + p.a)) + 1);
    } else if (k === 'hearts') {
      ctx.globalAlpha = 0.55;
      const s = p.s * 0.6;
      ctx.beginPath();
      ctx.moveTo(0, s);
      ctx.bezierCurveTo(-s * 1.4, 0, -s, -s, 0, -s * 0.35);
      ctx.bezierCurveTo(s, -s, s * 1.4, 0, 0, s);
      ctx.fill();
    } else if (k === 'sparks') {
      ctx.globalAlpha = Math.max(0, p.life) * 0.8;
      ctx.beginPath();
      ctx.arc(0, 0, p.s * 0.25, 0, 6.28);
      ctx.fill();
    } else {
      // leaves and petals: a pointed oval
      ctx.globalAlpha = k === 'leaves' ? 0.7 : 0.6;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.s, p.s * 0.45, 0, 0, 6.28);
      ctx.fill();
    }
    ctx.restore();
  }

  function batShape(b) {
    ctx.save();
    ctx.translate(b.x, b.y + Math.sin(t * 6 + b.p) * 6);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = b.c;
    const f = Math.sin(t * 14 + b.p) * 5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-8, -6 - f, -18, -2 - f);
    ctx.quadraticCurveTo(-12, 2, -9, 5);
    ctx.quadraticCurveTo(-4, 2, 0, 6);
    ctx.quadraticCurveTo(4, 2, 9, 5);
    ctx.quadraticCurveTo(12, 2, 18, -2 - f);
    ctx.quadraticCurveTo(8, -6 - f, 0, 0);
    ctx.fill();
    ctx.restore();
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    t += dt;
    ctx.clearRect(0, 0, W, H);
    if (cfg.kind === 'fireworks') {
      if (Math.random() < dt * 0.7 && bursts.length < 3) {
        const x = rnd(W * 0.1, W * 0.9), y = rnd(H * 0.08, H * 0.4), c = pick(cfg.colors);
        bursts.push({ life: 1, parts: Array.from({ length: 22 }, (_, i) => ({ x, y, vx: Math.cos(i / 22 * 6.28) * rnd(50, 90), vy: Math.sin(i / 22 * 6.28) * rnd(50, 90), c })) });
      }
      bursts = bursts.filter((b) => (b.life -= dt * 0.6) > 0);
      for (const b of bursts) {
        ctx.globalAlpha = b.life * 0.8;
        for (const q of b.parts) {
          q.x += q.vx * dt;
          q.y += q.vy * dt;
          q.vy += 30 * dt;
          q.vx *= 0.985;
          ctx.fillStyle = q.c;
          ctx.fillRect(q.x - 1.5, q.y - 1.5, 3, 3);
        }
      }
      ctx.globalAlpha = 1;
      return;
    }
    for (const p of ps) {
      p.x += (p.vx + Math.sin(t * p.sway + p.a) * 14) * dt;
      p.y += p.vy * dt;
      p.a += p.va * dt;
      if (rising) p.life -= dt * 0.18;
      shape(p);
    }
    ps = ps.map((p) => (p.y > H + 20 || p.y < -30 || p.x < -30 || p.x > W + 30 || p.life <= 0 ? make(false) : p));
    if (id === 'halloween') {
      if (Math.random() < dt * 0.12 && bats.length < 2) bats.push({ x: -30, y: rnd(H * 0.1, H * 0.5), v: rnd(70, 120), p: rnd(0, 6), c: getComputedStyle(document.documentElement).getPropertyValue('--soft-ink').trim() || '#59558F' });
      bats = bats.filter((b) => (b.x += b.v * dt) < W + 40);
      bats.forEach(batShape);
    }
  }
  const onVis = () => {
    cancelAnimationFrame(raf);
    last = 0;
    if (!document.hidden) raf = requestAnimationFrame(frame);
  };
  addEventListener('resize', size);
  document.addEventListener('visibilitychange', onVis);
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    removeEventListener('resize', size);
    document.removeEventListener('visibilitychange', onVis);
    canvas.remove();
  };
}
