import { useEffect, useRef } from "react";

const COLORS = ["#00ff41", "#00d9ff", "#ff6b6b", "#ffd93d", "#c56cf0", "#ff9ff3", "#fff"];

export function ConfettiEffect() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let animId = 0;
    let w = 0;
    let h = 0;

    interface Piece {
      x: number; y: number; vx: number; vy: number;
      color: string; rotation: number; rotSpeed: number;
      width: number; height: number;
    }

    let pieces: Piece[] = [];

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

    const burst = () => {
      pieces = Array.from({ length: 200 }, () => ({
        x: w / 2 + (Math.random() - 0.5) * w * 0.4,
        y: h * 0.3,
        vx: (Math.random() - 0.5) * 12,
        vy: -8 - Math.random() * 10,
        color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.3,
        width: 6 + Math.random() * 8,
        height: 3 + Math.random() * 5,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of pieces) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
        ctx.restore();
        p.vy += 0.25; // gravity
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        p.vx *= 0.99;
      }
      pieces = pieces.filter((p) => p.y < h + 20);
      if (pieces.length > 0) {
        animId = requestAnimationFrame(draw);
      }
    };

    resize();
    burst();
    animId = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="effect-layer" aria-hidden="true" />;
}
