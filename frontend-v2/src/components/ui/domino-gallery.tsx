"use client";

import * as React from "react";
import Image from "next/image";

export interface DominoItem {
  src: string;
  alt?: string;
  title?: string;
}

export interface DominoGalleryProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  items: DominoItem[];
  cardWidth?: number;
  cardHeight?: number;
  gap?: number;
  /** Scroll distance in pixels that raises the whole row. */
  scrollLength?: number;
  /** Angle the standing cards lean back, in degrees. */
  standAngle?: number;
  /** Topple and rise while the visitor is idle. */
  autoplay?: boolean;
  /** Milliseconds for one autoplay topple; the rise takes the same. */
  autoplayDuration?: number;
  /** Externally driven progress from 0 (lying flat) to 1 (standing). */
  progress?: number;
  onSelect?: (index: number, item: DominoItem) => void;
  /** React 19 passes ref as a regular prop. */
  ref?: React.Ref<HTMLDivElement>;
}

const OVERLAP = 0.45;
const IDLE_BEFORE_AUTOPLAY_MS = 3500;
const AUTOPLAY_HOLD_MS = 1400;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function topple(value: number) {
  if (value < 0.72) {
    const phase = value / 0.72;
    return phase * phase;
  }
  const phase = (value - 0.72) / 0.28;
  return 1 + 0.06 * Math.sin(phase * Math.PI) * (1 - phase);
}

function cardProgress(progress: number, index: number, count: number) {
  if (count <= 1) return clamp01(progress);
  const window = 1 / (1 + OVERLAP * (count - 1));
  return clamp01((progress - index * window * OVERLAP) / window);
}

export function DominoGallery({
  items,
  cardWidth = 220,
  cardHeight = 330,
  gap = 18,
  scrollLength = 1000,
  standAngle = 94,
  autoplay = false,
  autoplayDuration = 2600,
  progress: controlledProgress,
  onSelect,
  ref,
  className,
  style,
  ...rest
}: DominoGalleryProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const cardRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const [selected, setSelected] = React.useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const [fitWidth, setFitWidth] = React.useState(cardWidth);
  const live = React.useRef({
    progress: 0,
    shown: -1,
    lastScrollAt: -Infinity,
    auto: { value: 0, direction: 1, hold: 0 },
    frame: 0,
    lastFrame: 0,
    visible: true,
  });
  const controlled = controlledProgress !== undefined;

  const setRootRef = React.useCallback((node: HTMLDivElement | null) => {
    rootRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }, [ref]);

  React.useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const fit = () => {
      const available = Math.max(0, root.clientWidth - 48);
      const perCard = (available - gap * (items.length - 1)) / Math.max(1, items.length);
      setFitWidth(Math.max(72, Math.min(cardWidth, Math.floor(perCard))));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(root);
    return () => observer.disconnect();
  }, [cardWidth, gap, items.length]);

  React.useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(motion.matches);
    updateMotion();
    motion.addEventListener("change", updateMotion);
    return () => motion.removeEventListener("change", updateMotion);
  }, []);

  const paint = React.useCallback((progress: number) => {
    const state = live.current;
    const rounded = Math.round(progress * 1000) / 1000;
    if (rounded === state.shown) return;
    state.shown = rounded;
    rootRef.current?.style.setProperty("--progress", String(rounded));
    items.forEach((_, index) => {
      const card = cardRefs.current[index];
      if (!card) return;
      const fall = reducedMotion ? 1 : topple(cardProgress(rounded, index, items.length));
      card.style.setProperty("--fall", String(Math.round(fall * 1000) / 1000));
      card.style.transform = `rotateX(${standAngle * (1 - fall)}deg)`;
    });
  }, [items.length, reducedMotion, standAngle]);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const state = live.current;
    state.shown = -1;

    const scrollProgress = () => {
      const rect = root.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      return travel <= 0 ? 0 : clamp01(-rect.top / travel);
    };

    const frame = (now: number) => {
      state.frame = 0;
      const delta = state.lastFrame ? Math.min(now - state.lastFrame, 80) : 16;
      state.lastFrame = now;
      let target = state.progress;
      let keepAnimating = false;

      if (controlled) {
        target = clamp01(controlledProgress as number);
      } else {
        const fromScroll = scrollProgress();
        const idle = now - state.lastScrollAt > IDLE_BEFORE_AUTOPLAY_MS;
        if (autoplay && idle && !reducedMotion && state.visible) {
          const auto = state.auto;
          if (auto.hold > 0) auto.hold -= delta;
          else {
            auto.value = clamp01(auto.value + (delta / autoplayDuration) * auto.direction);
            if (auto.value === 1 || auto.value === 0) {
              auto.direction *= -1;
              auto.hold = AUTOPLAY_HOLD_MS;
            }
          }
          target = auto.value;
          keepAnimating = true;
        } else {
          target = fromScroll;
          state.auto.value = fromScroll;
          state.auto.direction = fromScroll >= 0.999 ? -1 : 1;
        }
      }

      state.progress = target;
      paint(target);
      if (keepAnimating && !document.hidden && state.visible) {
        state.frame = requestAnimationFrame(frame);
      } else {
        state.lastFrame = 0;
      }
    };

    const kick = () => {
      if (!state.frame) state.frame = requestAnimationFrame(frame);
    };
    const onScroll = () => {
      state.lastScrollAt = performance.now();
      kick();
    };
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      state.visible = entry.isIntersecting;
      if (state.visible) kick();
      else if (state.frame) {
        cancelAnimationFrame(state.frame);
        state.frame = 0;
        state.lastFrame = 0;
      }
    }, { rootMargin: "120px 0px" });
    visibilityObserver.observe(root);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", kick);
    document.addEventListener("visibilitychange", kick);
    kick();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", kick);
      document.removeEventListener("visibilitychange", kick);
      visibilityObserver.disconnect();
      cancelAnimationFrame(state.frame);
      state.frame = 0;
      state.lastFrame = 0;
    };
  }, [autoplay, autoplayDuration, controlled, controlledProgress, paint, reducedMotion]);

  const width = fitWidth;
  const height = Math.round((fitWidth / cardWidth) * cardHeight);

  return (
    <div
      ref={setRootRef}
      data-slot="domino-gallery"
      className={`relative w-full ${className ?? ""}`}
      style={{ height: controlled ? height + 96 : `calc(100vh + ${scrollLength}px)`, ...style }}
      {...rest}
    >
      <div
        className="sticky top-0 flex h-screen w-full items-center justify-center"
        style={controlled ? { height: height + 96, position: "static" } : undefined}
      >
        <div
          role="list"
          aria-label="CodeSkill team portraits"
          className="flex w-full max-w-full justify-start overflow-x-auto px-6 py-8 md:justify-center"
          style={{ gap, perspective: 1500, perspectiveOrigin: "50% -45%", scrollbarWidth: "thin" }}
        >
          {items.map((item, index) => {
            const isSelected = selected === index;
            return (
              <div
                key={`${item.src}-${index}`}
                role="listitem"
                className="relative shrink-0"
                style={{ width, height, transformStyle: "preserve-3d" }}
              >
                <button
                  ref={(node) => { cardRefs.current[index] = node; }}
                  type="button"
                  aria-label={item.title ?? item.alt ?? `Image ${index + 1}`}
                  aria-pressed={isSelected}
                  onClick={() => {
                    const next = isSelected ? null : index;
                    setSelected(next);
                    if (next !== null) onSelect?.(index, item);
                  }}
                  className={`relative block size-full overflow-hidden rounded-2xl border border-border bg-card text-left shadow-[0_18px_40px_-16px_rgba(0,0,0,0.6)] transition-[outline,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${isSelected ? "ring-2 ring-primary" : ""}`}
                  style={{
                    transformOrigin: "50% 100%",
                    transform: `rotateX(${standAngle}deg)`,
                    backfaceVisibility: "hidden",
                    "--fall": 0,
                  } as React.CSSProperties}
                >
                  <Image
                    src={item.src}
                    alt={item.alt ?? ""}
                    fill
                    sizes="(max-width: 767px) 72px, 18vw"
                    quality={75}
                    loading="lazy"
                    draggable={false}
                    className="object-cover"
                    style={{ filter: "brightness(calc(0.58 + var(--fall) * 0.42))" }}
                  />
                  {item.title && (
                    <span
                      className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-10 text-xs font-semibold text-white"
                      style={{ opacity: "var(--fall)" }}
                    >
                      {item.title}
                    </span>
                  )}
                </button>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-2 -bottom-2 h-3 rounded-full bg-black/40 blur-md"
                  style={{
                    opacity: "calc(0.25 + var(--fall, 0) * 0.5)",
                    transform: "scaleX(calc(0.6 + var(--fall, 0) * 0.4))",
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default DominoGallery;
