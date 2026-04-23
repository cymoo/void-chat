import { useEffect, useRef } from "react";

interface Props {
  onDone?: () => void;
}

export function FireworksEffect({ onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let animId = 0;
    let running = true;
    let w = 0;
    let h = 0;

    interface Particle {
      x: number; y: number; vx: number; vy: number;
      alpha: number; color: string; trail: Array<{x: number; y: number}>;
    }

    const particles: Particle[] = [];
    const HUE_PALETTE = [
      "#00ff41", "#00d9ff", "#ff6b6b", "#ffd93d", "#c56cf0", "#ff9ff3",
    ];

    const resize = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    const explode = (x: number, y: number) => {
      const color = HUE_PALETTE[Math.floor(Math.random() * HUE_PALETTE.length)]!;
      for (let i = 0; i < 60; i++) {
        const angle = (i / 60) * Math.PI * 2;
        const speed = 2 + Math.random() * 5;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          color,
          trail: [],
        });
      }
    };

    // Three waves; track pending launches so we know when all have fired
    const wave1 = [[0.2, 0.3], [0.5, 0.2], [0.8, 0.3]];
    const wave2 = [[0.35, 0.25], [0.65, 0.2], [0.5, 0.35]];
    const wave3 = [[0.3, 0.4], [0.7, 0.25]];
    let pendingLaunches = wave1.length + wave2.length + wave3.length;

    const launchAll = () => {
      for (const [rx, ry] of wave1) {
        setTimeout(() => {
          if (running) explode(w * rx!, h * ry!);
          pendingLaunches--;
        }, Math.random() * 400);
      }
      for (const [rx, ry] of wave2) {
        setTimeout(() => {
          if (running) explode(w * rx!, h * ry!);
          pendingLaunches--;
        }, 800 + Math.random() * 600);
      }
      for (const [rx, ry] of wave3) {
        setTimeout(() => {
          if (running) explode(w * rx!, h * ry!);
          pendingLaunches--;
        }, 1700 + Math.random() * 600);
      }
    };

    const draw = () => {
      ctx.fillStyle = "rgba(10,14,20,0.15)";
      ctx.fillRect(0, 0, w, h);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 5) p.trail.shift();

        for (let t = 0; t < p.trail.length; t++) {
          const pt = p.trail[t]!;
          ctx.globalAlpha = (t / p.trail.length) * p.alpha * 0.4;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();

        p.vy += 0.08;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.97;
        p.vy *= 0.97;
        p.alpha -= 0.012; // slower fade — particles last ~1.4s at 60fps
        if (p.alpha <= 0) particles.splice(i, 1);
      }
      ctx.globalAlpha = 1;

      if (running) {
        // All launches fired and all particles gone → unmount immediately
        if (pendingLaunches === 0 && particles.length === 0) {
          running = false;
          onDone?.();
          return;
        }
        animId = requestAnimationFrame(draw);
      }
    };

    resize();
    launchAll();
    animId = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    return () => {
      running = false;
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [onDone]);

  return <canvas ref={canvasRef} className="effect-layer" aria-hidden="true" />;
}
