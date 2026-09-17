"use client";

import { useEffect, useRef, useState } from "react";

export function useAutoAdvance(enabled: boolean, advance: () => void) {
  const containerRef = useRef<HTMLElement>(null);
  const advanceRef = useRef(advance);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    advanceRef.current = advance;
  }, [advance]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(media.matches);
    updateMotion();
    media.addEventListener("change", updateMotion);
    return () => media.removeEventListener("change", updateMotion);
  }, []);

  useEffect(() => {
    const updateVisibility = () => setPageVisible(document.visibilityState === "visible");
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(Boolean(entry?.isIntersecting)),
      { rootMargin: "120px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const isRunning =
    enabled && !interactionPaused && isVisible && pageVisible && !reducedMotion;

  useEffect(() => {
    if (!isRunning) return;
    const cycle = window.setInterval(() => advanceRef.current(), 3000);
    return () => window.clearInterval(cycle);
  }, [isRunning]);

  return {
    containerRef,
    isRunning,
    setInteractionPaused
  };
}
