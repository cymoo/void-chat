import { useEffect, useRef } from "react";

const RAIN_CHARS = "01ABCDEF0123456789$#@%&*+-";

export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let animationId = 0;
    let width = 0;
    let height = 0;
    let drops: number[] = [];
    const fontSize = 14;

    const resize = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.scale(dpr, dpr);
      context.font = `${fontSize}px monospace`;

      const columns = Math.ceil(width / fontSize);
      drops = Array.from({ length: columns }, () => Math.random() * (height / fontSize));
    };

    const draw = () => {
      context.fillStyle = "rgba(10, 14, 20, 0.08)";
      context.fillRect(0, 0, width, height);

      for (let i = 0; i < drops.length; i += 1) {
        const text = RAIN_CHARS[Math.floor(Math.random() * RAIN_CHARS.length)] || "0";
        const x = i * fontSize;
        const y = drops[i]! * fontSize;
        const glow = 0.2 + Math.random() * 0.35;

        context.fillStyle = `rgba(0, 255, 65, ${glow})`;
        context.fillText(text, x, y);

        if (y > height && Math.random() > 0.975) {
          drops[i] = 0;
        } else {
          drops[i] = drops[i]! + 1;
        }
      }

      animationId = window.requestAnimationFrame(draw);
    };

    resize();
    animationId = window.requestAnimationFrame(draw);
    window.addEventListener("resize", resize);

    return () => {
      window.cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="matrix-rain-layer" aria-hidden="true" />;
}
