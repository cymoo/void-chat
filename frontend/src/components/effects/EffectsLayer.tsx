import { useEffect } from "react";
import { useUiStore } from "@/stores/uiStore";
import { SnowEffect } from "./SnowEffect";
import { ConfettiEffect } from "./ConfettiEffect";
import { FireworksEffect } from "./FireworksEffect";
import { RainEffect } from "./RainEffect";

const EFFECT_DURATION_MS = 8000;

const EFFECT_MAP: Record<string, React.ReactNode> = {
  snow: <SnowEffect />,
  confetti: <ConfettiEffect />,
  fireworks: <FireworksEffect />,
  rain: <RainEffect />,
};

export function EffectsLayer() {
  const activeEffect = useUiStore((s) => s.activeEffect);
  const clearEffect = useUiStore((s) => s.clearEffect);

  useEffect(() => {
    if (!activeEffect) return;
    const timer = window.setTimeout(clearEffect, EFFECT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [activeEffect, clearEffect]);

  if (!activeEffect) return null;

  const effect = EFFECT_MAP[activeEffect.name];
  if (!effect) return null;

  return <>{effect}</>;
}
