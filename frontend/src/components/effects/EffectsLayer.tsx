import { useEffect } from "react";
import { useUiStore } from "@/stores/uiStore";
import { SnowEffect } from "./SnowEffect";
import { ConfettiEffect } from "./ConfettiEffect";
import { FireworksEffect } from "./FireworksEffect";
import { RainEffect } from "./RainEffect";

// Maximum display time as a safety fallback for all effects
const EFFECT_DURATION_MS = 8000;

function renderEffect(name: string, onDone: () => void): React.ReactNode {
  switch (name) {
    case "snow": return <SnowEffect />;
    case "rain": return <RainEffect />;
    case "confetti": return <ConfettiEffect onDone={onDone} />;
    case "fireworks": return <FireworksEffect onDone={onDone} />;
    default: return null;
  }
}

export function EffectsLayer() {
  const activeEffect = useUiStore((s) => s.activeEffect);
  const clearEffect = useUiStore((s) => s.clearEffect);

  useEffect(() => {
    if (!activeEffect) return;
    // Safety fallback: unmount if the effect never calls onDone
    const timer = window.setTimeout(clearEffect, EFFECT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [activeEffect, clearEffect]);

  if (!activeEffect) return null;

  const effect = renderEffect(activeEffect.name, clearEffect);
  if (!effect) return null;

  return <>{effect}</>;
}
