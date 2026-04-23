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

    interface Drop { x: number; y: number; length: number; speed: number; alpha: number; slant: number; width: number }
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
      drops = Array.from({ length: 250 }, () => ({
        x: Math.random() * (w + 200) - 100,
        y: Math.random() * h,
        length: 15 + Math.random() * 25,
        speed: 6 + Math.random() * 10,
        alpha: 0.4 + Math.random() * 0.5,
        slant: 0.2 + Math.random() * 0.15,
        width: 1 + Math.random(),
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const d of drops) {
        ctx.strokeStyle = `rgba(0,217,255,${d.alpha})`;
        ctx.lineWidth = d.width;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + d.slant * d.length, d.y + d.length);
        ctx.stroke();
        d.y += d.speed;
        d.x += d.slant * d.speed;
        if (d.y > h + d.length) {
          d.y = -d.length;
          d.x = Math.random() * (w + 200) - 100;
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
