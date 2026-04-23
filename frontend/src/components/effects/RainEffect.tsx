import { useEffect, useRef } from "react";

export function RainEffect() {
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

    interface Drop { x: number; y: number; length: number; speed: number; alpha: number }
    let drops: Drop[] = [];

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
      drops = Array.from({ length: 150 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        length: 12 + Math.random() * 24,
        speed: 4 + Math.random() * 8,
        alpha: 0.3 + Math.random() * 0.5,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const d of drops) {
        ctx.strokeStyle = `rgba(0,217,255,${d.alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - 1, d.y + d.length);
        ctx.stroke();
        d.y += d.speed;
        if (d.y > h + d.length) {
          d.y = -d.length;
          d.x = Math.random() * w;
        }
      }
      animId = requestAnimationFrame(draw);
    };

    resize();
    animId = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="effect-layer" aria-hidden="true" />;
}
