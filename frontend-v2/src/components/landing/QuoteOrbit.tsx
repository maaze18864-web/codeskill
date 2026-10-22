"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Hand, RotateCcw, Sparkles } from "lucide-react";
import { practiceCards } from "@/data/practice-sphere";
import styles from "./QuoteOrbit.module.css";

const CONFIG = {
  dragDegrees: 1.05,
  dragThreshold: 3,
  frictionSeconds: 0.30,
  stopSpeed: 2,
  maxReleaseSpeed: 1000,
  releasePauseMs: 100,
  spring: { type: "spring", stiffness: 240, damping: 28, mass: 0.65 } as const,
};
const positions = practiceCards.map((_, i) => ({
  // A golden-angle distribution avoids aligned rows hiding one another.
  latitude: Math.asin(1 - (2 * (i + 0.5)) / practiceCards.length) * 180 / Math.PI,
  longitude: (i * 137.507764) % 360,
}));
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** Kept under the existing export so the homepage placement stays unchanged. */
export function QuoteOrbit() {
  const reducedMotion = useReducedMotion();
  const rotateX = useMotionValue(positions[4].latitude);
  const rotateY = useMotionValue(-positions[4].longitude);
  const [selected, setSelected] = useState(4);
  const [cardNumber, setCardNumber] = useState("5");
  const [revealed, setRevealed] = useState(false);
  const [attempts, setAttempts] = useState<Record<number, { value: string; correct?: boolean }>>({});
  const [dragging, setDragging] = useState(false);
  const [flat, setFlat] = useState(false);
  const gesture = useRef<{ id: number; x: number; y: number; rx: number; ry: number; moved: boolean; touch: boolean; lastX: number; lastY: number; time: number; vx: number; vy: number } | null>(null);
  const momentumFrame = useRef<number | null>(null);
  function stopMomentum() {
    if (momentumFrame.current !== null) cancelAnimationFrame(momentumFrame.current);
    momentumFrame.current = null;
  }
  const suppressClick = useRef(false);
  const card = practiceCards[selected];
  const attempt = attempts[selected] ?? { value: "" };
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, "").replace(/;+$/, "");
  const showExplanation = revealed || attempt.correct !== undefined;
  function updateAnswer(value: string) {
    setAttempts(previous => ({ ...previous, [selected]: { value } }));
    setRevealed(false);
  }
  function submitAnswer() {
    if (!attempt.value.trim()) return;
    const correct = card.acceptedAnswers.some(answer => normalize(answer) === normalize(attempt.value));
    setAttempts(previous => ({ ...previous, [selected]: { value: attempt.value, correct } }));
  }

  useEffect(() => {
    const stopWhenHidden = () => {
      if (document.hidden) {
        stopMomentum(); rotateX.stop(); rotateY.stop();
        gesture.current = null; setDragging(false);
      }
    };
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () => {
      stopMomentum(); rotateX.stop(); rotateY.stop();
      document.removeEventListener("visibilitychange", stopWhenHidden);
    };
  }, [rotateX, rotateY]);
  useEffect(() => {
    if (flat || reducedMotion) { stopMomentum(); rotateX.stop(); rotateY.stop(); }
  }, [flat, reducedMotion, rotateX, rotateY]);

  function moveTo(index: number) {
    const next = (index + practiceCards.length) % practiceCards.length;
    const position = positions[next];
    const current = rotateY.get();
    const currentX = rotateX.get();
    const nextX = currentX + ((position.latitude - currentX + 540) % 360 + 360) % 360 - 180;
    const delta = ((-position.longitude - current + 540) % 360 + 360) % 360 - 180;
    stopMomentum(); rotateX.stop(); rotateY.stop();
    if (reducedMotion) {
      rotateX.set(nextX); rotateY.set(current + delta);
    } else {
      animate(rotateX, nextX, CONFIG.spring);
      animate(rotateY, current + delta, CONFIG.spring);
    }
    setSelected(next); setCardNumber(String(next + 1)); setRevealed(false);
  }

  function start(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    stopMomentum(); rotateX.stop(); rotateY.stop(); suppressClick.current = false;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, rx: rotateX.get(), ry: rotateY.get(), moved: false, touch: event.pointerType !== "mouse", lastX: event.clientX, lastY: event.clientY, time: performance.now(), vx: 0, vy: 0 };
  }
  function drag(event: PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    const dx = event.clientX - g.x, dy = event.clientY - g.y;
    if (!g.moved) {
      // Leave a vertical touch gesture to the browser's normal page scrolling.
      if (g.touch && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > CONFIG.dragThreshold) { gesture.current = null; return; }
      if (Math.hypot(dx, dy) < CONFIG.dragThreshold) return;
      g.moved = true; suppressClick.current = true; setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const now = performance.now();
    const dt = Math.max(1, now - g.time) / 1000;
    // Sample actual pointer velocity, including a deliberate pause before release.
    const blend = 1 - Math.exp(-dt / 0.035);
    g.vy += (((event.clientX - g.lastX) * CONFIG.dragDegrees / dt) - g.vy) * blend;
    g.vx += (((g.touch ? 0 : g.lastY - event.clientY) * CONFIG.dragDegrees / dt) - g.vx) * blend;
    g.lastX = event.clientX; g.lastY = event.clientY; g.time = now;
    rotateY.set(g.ry + dx * CONFIG.dragDegrees);
    if (!g.touch) rotateX.set(g.rx - dy * CONFIG.dragDegrees);
  }
  function end(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    gesture.current = null; setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!g.moved || cancelled || reducedMotion) return;
    if (performance.now() - g.time > CONFIG.releasePauseMs) return;
    let vx = clamp(g.vx, -CONFIG.maxReleaseSpeed, CONFIG.maxReleaseSpeed);
    let vy = clamp(g.vy, -CONFIG.maxReleaseSpeed, CONFIG.maxReleaseSpeed);
    let lastTime = performance.now();
    // Integrate exponential friction: initial speed is continuous with the drag,
    // and each frame slows down without a spring target, snap, or rebound.
    const coast = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      const decay = Math.exp(-dt / CONFIG.frictionSeconds);
      const distance = CONFIG.frictionSeconds * (1 - decay);
      rotateX.set(rotateX.get() + vx * distance);
      rotateY.set(rotateY.get() + vy * distance);
      vx *= decay; vy *= decay;
      if (Math.hypot(vx, vy) > CONFIG.stopSpeed) momentumFrame.current = requestAnimationFrame(coast);
      else momentumFrame.current = null;
    };
    momentumFrame.current = requestAnimationFrame(coast);
  }

  return (
    <section id="practice-sphere" className={styles.section} aria-labelledby="practice-sphere-title">
      <div className={styles.inner}>
        <header className={styles.heading}>
          <p className={styles.eyebrow}><Sparkles size={15} aria-hidden="true" /> A SMALL CHALLENGE. A NEW PERSPECTIVE.</p>
          <h2 id="practice-sphere-title">A world of ways to think.</h2>
          <p>Turn a little curiosity into your next breakthrough. Explore {practiceCards.length} quick challenges, one perspective at a time.</p>
        </header>
        <div className={styles.toolbar}>
          <span><Hand size={17} aria-hidden="true" /> Drag to explore · select a card to solve</span>
          <button type="button" onClick={() => setFlat(value => !value)} aria-pressed={flat}>{flat ? "Sphere view" : `Browse all ${practiceCards.length}`}</button>
        </div>
        <div className={styles.experience}>
          <div className={styles.visual}>
            <div
              className={`${styles.stage} ${dragging ? styles.grabbing : ""} ${flat || reducedMotion ? styles.hidden : ""}`}
              onPointerDown={start} onPointerMove={drag} onPointerUp={event => end(event)}
              onPointerCancel={event => end(event, true)} onLostPointerCapture={event => end(event, true)}
              aria-label="Draggable question sphere. Drag with a mouse in any direction, or swipe horizontally on touch. Use the question selector for all cards."
            >
              <motion.div className={styles.sphere} style={{ rotateX, rotateY }}>
                {practiceCards.map((item, index) => {
                  const content = <>
                    <span className={styles.cardTop}><span>{item.type}</span><span>Q.{String(index + 1).padStart(2, "0")}</span></span>
                    <span className={styles.questionMark} aria-hidden="true">Q<span> / {String(index + 1).padStart(2, "0")}</span></span>
                    <span className={styles.cardTitle}>{item.title}</span>
                    <span className={styles.cardPrompt}>{item.prompt}</span>
                    <span className={styles.cardBottom}><span>{item.topic}</span><span>Answer ↗</span></span>
                  </>;
                  return <button type="button" key={item.title}
                    className={`${styles.card} ${styles[item.color]} ${styles[`design${index % 3}`]}`}
                    style={{ transform: `rotateY(${positions[index].longitude}deg) rotateX(${-positions[index].latitude}deg) translateZ(var(--radius))` }}
                    tabIndex={-1}
                    onClick={() => { if (!suppressClick.current) moveTo(index); }}
                    aria-label={`Question ${index + 1}, ${item.type}: ${item.title}`} aria-pressed={selected === index}>
                    <span className={styles.face}>{content}</span>
                    <span className={`${styles.face} ${styles.back}`} aria-hidden="true">{content}</span>
                  </button>;
                })}
              </motion.div>
            </div>
            {(flat || reducedMotion) && <div className={styles.grid} aria-label="All practice questions">{practiceCards.map((item, index) => (
              <button key={item.title} type="button" className={`${styles.listCard} ${styles[item.color]}`} aria-pressed={selected === index} onClick={() => moveTo(index)}>
                <span>{String(index + 1).padStart(2, "0")} · {item.type}</span><strong>{item.title}</strong><span>{item.topic} ↗</span>
              </button>
            ))}</div>}
            <div className={styles.controls}>
              <button type="button" onClick={() => moveTo(selected - 1)} aria-label="Previous question"><ArrowLeft size={18} /></button>
              <label className={styles.selectLabel}><span className={styles.srOnly}>Choose a question</span><select value={selected} onChange={event => moveTo(Number(event.target.value))}>{practiceCards.map((item, index) => <option key={item.title} value={index}>{String(index + 1).padStart(2, "0")} / {practiceCards.length} · {item.title}</option>)}</select></label>
              <button type="button" onClick={() => moveTo(selected + 1)} aria-label="Next question"><ArrowRight size={18} /></button>
              <button type="button" onClick={() => moveTo(4)} aria-label="Reset sphere"><RotateCcw size={16} /></button>
            </div>
            <form className={styles.jump} onSubmit={event => {
              event.preventDefault();
              const number = Number(cardNumber);
              if (Number.isInteger(number) && number >= 1 && number <= practiceCards.length) moveTo(number - 1);
            }}>
              <label htmlFor="sphere-card-number">Go to card</label>
              <input id="sphere-card-number" type="number" inputMode="numeric" min={1} max={practiceCards.length} step={1} required value={cardNumber} onChange={event => setCardNumber(event.target.value)} aria-label={`Card number, 1 to ${practiceCards.length}`} />
              <span>/ {practiceCards.length}</span>
              <button type="submit">Go <span aria-hidden="true">↗</span></button>
            </form>
          </div>
          <article className={styles.reader} aria-labelledby="sphere-question-title">
            <div className={styles.readerTop}><span className={styles.eyebrow}>QUESTION {String(selected + 1).padStart(2, "0")} / {practiceCards.length}</span><span className={styles.level}>Medium</span></div>
            <div aria-live="polite" aria-atomic="true">
              <p className={styles.topic}>{card.type} <span> / </span> {card.topic}</p>
              <h3 id="sphere-question-title">{card.title}</h3>
              <p className={styles.prompt}><strong className={styles.qLabel}>Q.</strong> {card.prompt}</p>
              {card.code && <pre className={styles.code}><code>{card.code}</code></pre>}

            </div>
            <form className={styles.answerForm} onSubmit={event => { event.preventDefault(); submitAnswer(); }}>
              {card.choices ? <fieldset className={styles.optionGroup}>
                <legend>Your answer</legend>
                {card.choices.map((choice, index) => <label key={choice} className={`${styles.option} ${attempt.value === choice ? styles.chosen : ""}`}>
                  <input type="radio" name={`sphere-answer-${selected}`} value={choice} checked={attempt.value === choice} onChange={() => updateAnswer(choice)} required />
                  <span className={styles.optionLetter}>{String.fromCharCode(65 + index)}</span><span>{choice}</span>
                </label>)}
              </fieldset> : <label className={styles.textAnswer}>
                <span>{card.inputLabel ?? "Your answer"}</span>
                <input key={selected} type="text" value={attempt.value} onChange={event => updateAnswer(event.target.value)} placeholder="Write your answer here…" autoComplete="off" spellCheck={false} maxLength={300} required />
              </label>}
              <button type="submit" disabled={!attempt.value.trim()} className={styles.reveal}>Submit answer<span aria-hidden="true">↗</span></button>
            </form>
            <div role="status" aria-live="polite">
              {attempt.correct !== undefined && <p className={`${styles.verdict} ${attempt.correct ? styles.correct : styles.incorrect}`}>{attempt.correct ? "✓ Correct! Nicely done." : "Not quite — here’s the answer and why."}</p>}
            </div>
            <button type="button" className={styles.skip} aria-expanded={showExplanation} aria-controls="sphere-answer" onClick={() => setRevealed(value => !value)} hidden={attempt.correct !== undefined}>{revealed ? "Hide answer" : "Need a hint? Reveal answer"}</button>
            <div id="sphere-answer" hidden={!showExplanation} className={styles.answer}><strong>{card.answer}</strong><p>{card.explanation}</p></div>
            <p className={styles.note}>Quick answer practice · not a code runner. Answers stay here while you explore.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
export default QuoteOrbit;
