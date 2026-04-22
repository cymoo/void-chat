import { useEffect, useRef, useState } from "react";

/**
 * Detects soft keyboard visibility on mobile and provides keyboard height.
 * Uses visualViewport API when available (iOS Safari 13+, Chrome 61+).
 * 
 * Returns: { keyboardHeight: number, isKeyboardVisible: boolean }
 * 
 * This helps prevent layout shifts when the soft keyboard appears/disappears,
 * especially important on iOS where the viewport shrinks when keyboard opens.
 */
export function useSoftKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const initialWindowHeightRef = useRef<number>(window.innerHeight);
  const isDetectingRef = useRef(false);

  useEffect(() => {
    // Only on mobile/touch devices
    if (!("visualViewport" in window)) return;

    const viewport = window.visualViewport;
    if (!viewport) return;

    initialWindowHeightRef.current = window.innerHeight;

    const handleResize = () => {
      if (!isDetectingRef.current) return;

      const currentHeight = viewport.height || window.innerHeight;
      const windowHeight = initialWindowHeightRef.current;
      const calculatedKeyboardHeight = Math.max(0, windowHeight - currentHeight);

      setKeyboardHeight(calculatedKeyboardHeight);
    };

    const handleFocus = () => {
      isDetectingRef.current = true;
    };

    const handleBlur = () => {
      isDetectingRef.current = false;
      setKeyboardHeight(0);
    };

    // Listen to visualViewport resize
    viewport.addEventListener("resize", handleResize);

    // Also listen to input focus/blur for better detection
    document.addEventListener("focusin", handleFocus);
    document.addEventListener("focusout", handleBlur);

    return () => {
      viewport.removeEventListener("resize", handleResize);
      document.removeEventListener("focusin", handleFocus);
      document.removeEventListener("focusout", handleBlur);
    };
  }, []);

  const isKeyboardVisible = keyboardHeight > 50; // Threshold: consider visible if > 50px

  return { keyboardHeight, isKeyboardVisible };
}
