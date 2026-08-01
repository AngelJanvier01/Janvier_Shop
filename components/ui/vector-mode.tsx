"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import styles from "./vector-mode.module.css";

const SETTINGS = {
  friction: 0.82,
  magnetRadius: 90,
  magnetStrength: 0.08,
  maxVelocity: 55,
  sensitivity: 1
} as const;

type Point = {
  x: number;
  y: number;
};

type PointerLockTarget = HTMLElement & {
  requestPointerLock: (options?: {
    unadjustedMovement?: boolean;
  }) => Promise<void> | void;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function isInteractiveTarget(element: HTMLElement | null) {
  if (
    !element ||
    element.matches("[hidden], [aria-hidden='true'], [aria-disabled='true']")
  ) {
    return false;
  }

  if (element instanceof HTMLButtonElement && element.disabled) {
    return false;
  }

  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.pointerEvents !== "none" &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function getTargetLabel(element: HTMLElement | null) {
  if (!element) {
    return "";
  }

  return (
    element.getAttribute("aria-label") ??
    element.textContent?.replace(/\s+/g, " ").trim().slice(0, 24) ??
    "TARGET"
  );
}

export function VectorMode() {
  const pathname = usePathname();
  const [isAvailable, setIsAvailable] = useState(false);
  const [phase, setPhase] = useState<"idle" | "locked" | "released">("idle");
  const [notice, setNotice] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const passiveCursorRef = useRef<HTMLSpanElement>(null);
  const clickLabelRef = useRef<HTMLSpanElement>(null);
  const targetLabelRef = useRef<HTMLSpanElement>(null);
  const trailRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const releaseTimerRef = useRef<number | undefined>(undefined);
  const requestTimerRef = useRef<number | undefined>(undefined);
  const lockedRef = useRef(false);
  const requestPendingRef = useRef(false);
  const fallbackAttemptedRef = useRef(false);
  const fallbackRequestRef = useRef<(() => void) | null>(null);
  const pointRef = useRef<Point>({ x: 0, y: 0 });
  const velocityRef = useRef<Point>({ x: 0, y: 0 });
  const inputRef = useRef<Point>({ x: 0, y: 0 });
  const historyRef = useRef<Point[]>([]);
  const targetsRef = useRef<HTMLElement[]>([]);
  const lastFrameRef = useRef(0);
  const lastMovementRef = useRef(0);
  const clickUntilRef = useRef(0);
  const targetRef = useRef<HTMLElement | null>(null);
  const targetNameRef = useRef("");

  const isExcludedRoute =
    pathname.startsWith("/admin") || pathname.startsWith("/checkout");

  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateAvailability = () => {
      setIsAvailable(finePointer.matches && !reducedMotion.matches);
    };

    updateAvailability();
    finePointer.addEventListener("change", updateAvailability);
    reducedMotion.addEventListener("change", updateAvailability);
    return () => {
      finePointer.removeEventListener("change", updateAvailability);
      reducedMotion.removeEventListener("change", updateAvailability);
    };
  }, []);

  useEffect(() => {
    if (!isAvailable || isExcludedRoute) {
      return;
    }

    const root = document.documentElement;

    function clearPendingRequest() {
      requestPendingRef.current = false;
      window.clearTimeout(requestTimerRef.current);
      requestTimerRef.current = undefined;
    }

    function clearAnimation() {
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
      velocityRef.current = { x: 0, y: 0 };
      inputRef.current = { x: 0, y: 0 };
      historyRef.current = [];
      targetRef.current = null;
      targetNameRef.current = "";
      rootRef.current?.removeAttribute("data-cursor-state");
      clickLabelRef.current?.style.setProperty("opacity", "0");
      if (targetLabelRef.current) {
        targetLabelRef.current.textContent = "";
      }
    }

    function requestFallbackLock() {
      fallbackAttemptedRef.current = true;
      const target = document.documentElement as PointerLockTarget;
      try {
        void Promise.resolve(target.requestPointerLock()).catch(() => {
          clearPendingRequest();
          setNotice("POINTER_CONTROL_UNAVAILABLE");
        });
      } catch {
        clearPendingRequest();
        setNotice("POINTER_CONTROL_UNAVAILABLE");
      }
    }

    fallbackRequestRef.current = requestFallbackLock;

    function finishRelease() {
      clearPendingRequest();
      if (!lockedRef.current && root.dataset.vectorMode !== "active") {
        return;
      }

      lockedRef.current = false;
      clearAnimation();
      delete root.dataset.vectorMode;
      setPhase("released");
      setNotice("POINTER_CONTROL_RELEASED");
      window.clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = window.setTimeout(() => {
        setPhase("idle");
        setNotice("");
      }, 240);
    }

    function findMagnet(point: Point) {
      let closest: HTMLElement | null = null;
      let closestDistance: number = SETTINGS.magnetRadius;

      for (const candidate of targetsRef.current) {
        if (!isInteractiveTarget(candidate)) {
          continue;
        }
        const rect = candidate.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distance = Math.hypot(centerX - point.x, centerY - point.y);
        if (distance < closestDistance) {
          closest = candidate;
          closestDistance = distance;
        }
      }

      return closest;
    }

    function render(now: number) {
      if (!lockedRef.current) {
        return;
      }

      const elapsed = lastFrameRef.current
        ? Math.min((now - lastFrameRef.current) / 16.67, 2)
        : 1;
      lastFrameRef.current = now;
      const point = pointRef.current;
      const velocity = velocityRef.current;

      const magnet = findMagnet(point);
      if (magnet) {
        const rect = magnet.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const deltaX = centerX - point.x;
        const deltaY = centerY - point.y;
        const movingAway = inputRef.current.x * deltaX + inputRef.current.y * deltaY < 0;

        if (!movingAway) {
          velocity.x += deltaX * SETTINGS.magnetStrength;
          velocity.y += deltaY * SETTINGS.magnetStrength;
          velocity.x *= 0.9;
          velocity.y *= 0.9;
          targetRef.current = magnet;
        } else {
          targetRef.current = null;
        }
      } else {
        targetRef.current = null;
      }

      point.x += velocity.x * elapsed;
      point.y += velocity.y * elapsed;
      velocity.x *= Math.pow(SETTINGS.friction, elapsed);
      velocity.y *= Math.pow(SETTINGS.friction, elapsed);

      const maximumX = window.innerWidth - 1;
      const maximumY = window.innerHeight - 1;
      if (point.x < 0 || point.x > maximumX) {
        point.x = clamp(point.x, 0, maximumX);
        velocity.x *= -0.16;
      }
      if (point.y < 0 || point.y > maximumY) {
        point.y = clamp(point.y, 0, maximumY);
        velocity.y *= -0.16;
      }

      historyRef.current.unshift({ x: point.x, y: point.y });
      historyRef.current.length = Math.min(
        historyRef.current.length,
        trailRefs.current.length
      );
      const speed = Math.hypot(velocity.x, velocity.y);
      const isClicking = now < clickUntilRef.current;
      const target = targetRef.current;
      const state = isClicking
        ? "click"
        : target
          ? "target"
          : speed > 0.45
            ? "moving"
            : now - lastMovementRef.current > 600
              ? "idle"
              : "default";

      rootRef.current?.setAttribute("data-cursor-state", state);
      cursorRef.current?.style.setProperty(
        "transform",
        `translate3d(${point.x}px, ${point.y}px, 0)`
      );

      trailRefs.current.forEach((trail, index) => {
        const sample = historyRef.current[index + 1] ?? point;
        trail?.style.setProperty(
          "transform",
          `translate3d(${sample.x}px, ${sample.y}px, 0)`
        );
      });

      const nextLabel = getTargetLabel(target);
      if (nextLabel !== targetNameRef.current) {
        targetNameRef.current = nextLabel;
        if (targetLabelRef.current) {
          targetLabelRef.current.textContent = nextLabel;
        }
      }

      if (clickLabelRef.current) {
        clickLabelRef.current.style.opacity = isClicking ? "1" : "0";
      }

      animationFrameRef.current = window.requestAnimationFrame(render);
    }

    function beginLock() {
      window.clearTimeout(releaseTimerRef.current);
      lockedRef.current = true;
      pointRef.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      velocityRef.current = { x: 0, y: 0 };
      inputRef.current = { x: 0, y: 0 };
      historyRef.current = [];
      lastFrameRef.current = 0;
      rootRef.current?.removeAttribute("data-passive-cursor");
      targetsRef.current = Array.from(
        document.querySelectorAll<HTMLElement>("a, button, [data-cursor-target]")
      );
      lastFrameRef.current = performance.now();
      lastMovementRef.current = performance.now();
      root.dataset.vectorMode = "active";
      rootRef.current?.removeAttribute("data-passive-cursor");
      setPhase("locked");
      setNotice("POINTER_CONTROL_GRANTED | MOVE_TO_NAVIGATE | PRESS_ESC_TO_RELEASE");
      animationFrameRef.current = window.requestAnimationFrame(render);
    }

    function onPointerLockChange() {
      if (document.pointerLockElement === root) {
        clearPendingRequest();
        beginLock();
      } else {
        finishRelease();
      }
    }

    function onPointerLockError() {
      if (!fallbackAttemptedRef.current) {
        fallbackRequestRef.current?.();
        return;
      }

      clearPendingRequest();
      finishRelease();
      setNotice("POINTER_CONTROL_UNAVAILABLE");
    }

    function onMouseMove(event: MouseEvent) {
      if (!lockedRef.current) {
        passiveCursorRef.current?.style.setProperty(
          "transform",
          `translate3d(${event.clientX}px, ${event.clientY}px, 0)`
        );
        rootRef.current?.setAttribute("data-passive-cursor", "visible");
        return;
      }

      const velocity = velocityRef.current;
      inputRef.current = { x: event.movementX, y: event.movementY };
      velocity.x = clamp(
        velocity.x + event.movementX * SETTINGS.sensitivity,
        -SETTINGS.maxVelocity,
        SETTINGS.maxVelocity
      );
      velocity.y = clamp(
        velocity.y + event.movementY * SETTINGS.sensitivity,
        -SETTINGS.maxVelocity,
        SETTINGS.maxVelocity
      );
      lastMovementRef.current = performance.now();
    }

    function onMouseDown(event: MouseEvent) {
      if (!lockedRef.current) {
        return;
      }

      if (
        event.target instanceof Element &&
        event.target.closest<HTMLElement>("[data-vector-mode-control]")
      ) {
        return;
      }

      const point = pointRef.current;
      const candidate = document
        .elementFromPoint(point.x, point.y)
        ?.closest<HTMLElement>("a, button, [data-cursor-target]");

      if (!candidate || !isInteractiveTarget(candidate)) {
        return;
      }

      event.preventDefault();
      clickUntilRef.current = performance.now() + 280;
      candidate.click();
    }

    function onVisibilityChange() {
      if (document.hidden && lockedRef.current) {
        void document.exitPointerLock?.();
        finishRelease();
      }
    }

    function onWindowBlur() {
      if (lockedRef.current) {
        void document.exitPointerLock?.();
        finishRelease();
      }
    }

    document.addEventListener("pointerlockchange", onPointerLockChange);
    document.addEventListener("pointerlockerror", onPointerLockError);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);

    return () => {
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      document.removeEventListener("pointerlockerror", onPointerLockError);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
      window.cancelAnimationFrame(animationFrameRef.current ?? 0);
      window.clearTimeout(releaseTimerRef.current);
      window.clearTimeout(requestTimerRef.current);
      fallbackRequestRef.current = null;
      if (document.pointerLockElement === root) {
        void document.exitPointerLock?.();
      }
      delete root.dataset.vectorMode;
      lockedRef.current = false;
      requestPendingRef.current = false;
    };
  }, [isAvailable, isExcludedRoute]);

  async function activateVectorMode() {
    if (
      !isAvailable ||
      isExcludedRoute ||
      requestPendingRef.current ||
      document.pointerLockElement === document.documentElement
    ) {
      return;
    }

    const target = document.documentElement as PointerLockTarget;
    if (typeof target.requestPointerLock !== "function") {
      setNotice("POINTER_CONTROL_UNAVAILABLE");
      return;
    }

    requestPendingRef.current = true;
    fallbackAttemptedRef.current = false;
    setNotice("POINTER_CONTROL_REQUESTED");
    window.clearTimeout(requestTimerRef.current);
    requestTimerRef.current = window.setTimeout(() => {
      requestPendingRef.current = false;
      setNotice((current) => (current === "POINTER_CONTROL_REQUESTED" ? "" : current));
    }, 900);

    try {
      await target.requestPointerLock({ unadjustedMovement: true });
    } catch {
      fallbackRequestRef.current?.();
    }
  }

  function releaseVectorMode() {
    void document.exitPointerLock?.();
  }

  if (!isAvailable || isExcludedRoute) {
    return null;
  }

  return (
    <div
      className={styles.root}
      data-phase={phase}
      data-testid="vector-mode"
      ref={rootRef}
    >
      <span
        aria-hidden="true"
        className={styles.passiveCursor}
        data-testid="passive-vector-cursor"
        ref={passiveCursorRef}
      />
      <div className={styles.cursor} data-testid="vector-cursor" ref={cursorRef}>
        <span className={styles.crosshair} />
        <span className={styles.radar} />
        <span className={styles.targetLabel} ref={targetLabelRef} />
        <span className={styles.clickLabel} ref={clickLabelRef}>
          TARGET_CONFIRMED
        </span>
      </div>
      {[0, 1, 2, 3].map((index) => (
        <span
          className={styles.trail}
          key={index}
          ref={(element) => {
            trailRefs.current[index] = element;
          }}
          style={{ "--trail-index": index } as CSSProperties}
        />
      ))}

      <div className={styles.controls}>
        <button
          className={styles.activate}
          data-cursor-target
          data-vector-mode-control
          data-testid="vector-mode-activate"
          onClick={activateVectorMode}
          type="button"
        >
          [ ACTIVAR VECTOR_MODE_84 ]
        </button>
        {phase === "locked" ? (
          <button
            className={styles.exit}
            data-cursor-target
            data-vector-mode-control
            data-testid="vector-mode-exit"
            onClick={releaseVectorMode}
            type="button"
          >
            [ SALIR / ESC ]
          </button>
        ) : null}
      </div>
      <p aria-live="polite" className={styles.notice}>
        {notice}
      </p>
    </div>
  );
}
