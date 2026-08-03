"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./ascii-animation.module.css";

type AsciiAnimationProps = {
  className?: string;
  fps?: number;
  src: string;
};

function classNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

function isFrameSequence(value: unknown): value is string[][] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (frame) =>
        Array.isArray(frame) &&
        frame.length > 0 &&
        frame.every((line) => typeof line === "string")
    )
  );
}

export function AsciiAnimation({
  className,
  fps = 6,
  src
}: Readonly<AsciiAnimationProps>) {
  const rootRef = useRef<HTMLPreElement>(null);
  const [frames, setFrames] = useState<string[][]>();
  const [isVisible, setIsVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(true);
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(query.matches);

    updatePreference();
    query.addEventListener("change", updatePreference);
    return () => query.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reducedMotion) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { rootMargin: "240px 0px" }
    );
    observer.observe(root);

    return () => observer.disconnect();
  }, [reducedMotion]);

  useEffect(() => {
    const updateVisibility = () =>
      setIsDocumentVisible(document.visibilityState === "visible");

    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    if (!isVisible || reducedMotion || frames) {
      return;
    }

    const controller = new AbortController();

    fetch(src, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : undefined))
      .then((payload: unknown) => {
        if (isFrameSequence(payload)) {
          setFrames(payload);
        }
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.warn("Unable to load ASCII animation", error);
        }
      });

    return () => controller.abort();
  }, [frames, isVisible, reducedMotion, src]);

  useEffect(() => {
    if (
      !frames ||
      frames.length < 2 ||
      !isVisible ||
      !isDocumentVisible ||
      reducedMotion
    ) {
      return;
    }

    const interval = window.setInterval(
      () => {
        setFrameIndex((currentIndex) => (currentIndex + 1) % frames.length);
      },
      1000 / Math.min(Math.max(fps, 1), 12)
    );

    return () => window.clearInterval(interval);
  }, [fps, frames, isDocumentVisible, isVisible, reducedMotion]);

  return (
    <pre
      aria-hidden="true"
      className={classNames(styles.animation, className)}
      data-loaded={frames ? "true" : undefined}
      ref={rootRef}
    >
      {frames?.[reducedMotion ? 0 : frameIndex].join("\n")}
    </pre>
  );
}
