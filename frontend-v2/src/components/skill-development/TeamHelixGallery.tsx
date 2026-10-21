"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Globe, MoveDown } from "lucide-react";
import { motion, useInView, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";
import { team, type TeamMember } from "@/data/team";
import styles from "./TeamHelixGallery.module.css";

function LinkedInIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.64a1.53 1.53 0 1 0 0 3.06 1.53 1.53 0 0 0 0-3.06Z" />
    </svg>
  );
}

function GitHubIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

function MemberSocialLinks({ member, className = "" }: { member: TeamMember; className?: string }) {
  if (!member.linkedin && !member.github && !member.portfolio) return null;
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {member.linkedin && (
        <a
          href={member.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
          aria-label={`${member.name}'s LinkedIn profile`}
        >
          <LinkedInIcon className="h-3.5 w-3.5" />
        </a>
      )}
      {member.github && (
        <a
          href={member.github}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
          aria-label={`${member.name}'s GitHub profile`}
        >
          <GitHubIcon className="h-3.5 w-3.5" />
        </a>
      )}
      {member.portfolio && (
        <a
          href={member.portfolio}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
          aria-label={`${member.name}'s Portfolio`}
        >
          <Globe className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

/** All geometry and motion controls are here; timings are seconds. */
export const TEAM_HELIX_CONFIG = {
  layout: { navbarOffset: 80, headingGap: 48, scrollTravel: 1200 },
  geometry: { itemsPerTurn: 7, radiusRatio: 0.3, radiusMin: 180, radiusMax: 410, depthRatio: 0.72, pitch: 62, cardHeightMax: 330, cardHeightRatio: 0.82, cardAspect: 0.7, faceTilt: 18, frontInset: 12 },
  scrollSpring: { stiffness: 240, damping: 30, mass: 0.45, restDelta: 0.0001 },
  heading: { labelDelay: 0, titleDelay: 0.12, subtitleDelay: 0.24, duration: 0.45, lineDuration: 0.4, reducedFade: 0.12 },
  preloadMargin: "500px 0px" as const,
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
};

type Geometry = { width: number; height: number; radius: number; pitch: number; anchorTravel: number };

function HelixPortrait({ member, index, phase, geometry, nearby, visible }: {
  member: TeamMember; index: number; phase: MotionValue<number>;
  geometry: Geometry; nearby: boolean; visible: boolean;
}) {
  const config = TEAM_HELIX_CONFIG.geometry;
  // Motion values write directly to this layer. No React state, DOM reads or
  // image decoding are triggered by a scroll frame.
  const transform = useTransform(phase, value => {
    const relative = index - value;
    const angle = relative * (Math.PI * 2 / config.itemsPerTurn);
    const x = Math.sin(angle) * geometry.radius;
    const y = relative * geometry.pitch + geometry.height / 2 + config.frontInset + value / (team.length - 1) * geometry.anchorTravel;
    const z = (Math.cos(angle) - 1) * geometry.radius * config.depthRatio;
    return `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(2)}px) rotateY(${(-Math.sin(angle) * config.faceTilt).toFixed(2)}deg)`;
  });
  const opacity = useTransform(phase, value => {
    const angle = (index - value) * (Math.PI * 2 / config.itemsPerTurn);
    return 0.5 + (Math.cos(angle) + 1) * 0.25;
  });

  return <motion.li aria-hidden="true" className={styles.portrait} style={{
    width: geometry.width, height: geometry.height, top: 0,
    marginLeft: -geometry.width / 2, marginTop: -geometry.height / 2,
    transform, opacity, willChange: visible ? "transform, opacity" : undefined,
  }}>
    <figure className="relative h-full w-full overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      <Image src={member.image} alt={`Portrait of ${member.name}, ${member.role}`} fill sizes="(max-width: 1024px) 180px, 240px" loading={nearby ? "eager" : "lazy"} decoding="async" className="object-cover object-top" />
      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/65 to-transparent px-4 pb-4 pt-12 text-white">
        <p className="text-sm font-semibold">{member.name}</p>
        <p className="mt-1 text-[11px] leading-tight text-white/75">{member.role}</p>
      </figcaption>
    </figure>
  </motion.li>;
}

export default function TeamHelixGallery({ heading }: { heading: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const nearby = useInView(track, { margin: TEAM_HELIX_CONFIG.preloadMargin, once: true });
  const visible = useInView(stage, { amount: 0.05 });
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const [geometry, setGeometry] = useState<Geometry>({ width: 220, height: 314, radius: 330, pitch: 62, anchorTravel: 140 });
  const { scrollYProgress } = useScroll({ target: track, offset: ["start start", "end end"] });
  const progress = useSpring(scrollYProgress, TEAM_HELIX_CONFIG.scrollSpring);
  const phase = useTransform(progress, [0, 1], [0, team.length - 1], { clamp: true });

  useMotionValueEvent(phase, "change", value => {
    const next = Math.max(0, Math.min(team.length - 1, Math.round(value)));
    if (next !== activeRef.current) { activeRef.current = next; setActive(next); }
  });

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const measure = () => {
      const width = element.clientWidth; const height = element.clientHeight;
      if (!width || !height) return;
      const config = TEAM_HELIX_CONFIG.geometry;
      const cardHeight = Math.min(config.cardHeightMax, height * config.cardHeightRatio);
      setGeometry({
        height: cardHeight, width: cardHeight * config.cardAspect,
        radius: Math.min(config.radiusMax, Math.max(config.radiusMin, width * config.radiusRatio)),
        pitch: Math.min(config.pitch, height * 0.16),
        anchorTravel: Math.max(0, height - cardHeight - config.frontInset * 2),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const goTo = useCallback((index: number) => {
    const element = track.current;
    if (!element) return;
    const next = Math.max(0, Math.min(team.length - 1, index));
    const start = element.getBoundingClientRect().top + window.scrollY;
    const travel = Math.max(0, element.offsetHeight - window.innerHeight);
    window.scrollTo({ top: start + travel * next / (team.length - 1), behavior: reduced ? "auto" : "smooth" });
  }, [reduced]);

  const variables = {
    "--helix-travel": `${TEAM_HELIX_CONFIG.layout.scrollTravel}px`,
    "--helix-nav": `${TEAM_HELIX_CONFIG.layout.navbarOffset}px`,
    "--helix-gap": `${TEAM_HELIX_CONFIG.layout.headingGap}px`,
  } as CSSProperties;

  return <>
    <div className={styles.desktop} style={variables}>
      <div ref={track} className={styles.track}>
        <div className={styles.viewport}>
          {heading}
          <div ref={stage} className={`${styles.stage} rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary`} role="group" tabIndex={0} aria-label="Team portrait helix. Use left and right arrow keys to explore." onKeyDown={event => {
            if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
              event.preventDefault(); goTo(activeRef.current + (event.key === "ArrowRight" ? 1 : -1));
            } else if (event.key === "Home" || event.key === "End") {
              event.preventDefault(); goTo(event.key === "Home" ? 0 : team.length - 1);
            }
          }}>
            <ul className={styles.space} aria-hidden="true">
              {team.map((member, index) => <HelixPortrait key={member.name} member={member} index={index} phase={phase} geometry={geometry} nearby={nearby} visible={visible} />)}
            </ul>
          </div>
          <div className="mt-4 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex"><MoveDown className="h-4 w-4 text-primary" />Scroll to explore · ← → to browse</p>
            <div className="min-w-40" aria-live="polite" aria-atomic="true">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{team[active].name}</p>
                <MemberSocialLinks member={team[active]} />
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{team[active].role}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-muted-foreground">{String(active + 1).padStart(2, "0")} <span className="text-primary">/</span> {String(team.length).padStart(2, "0")}</span>
              <button type="button" aria-label="Previous team member" disabled={active === 0} onClick={() => goTo(activeRef.current - 1)} className="rounded-lg border border-border p-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-30"><ArrowLeft className="h-4 w-4" /></button>
              <button type="button" aria-label="Next team member" disabled={active === team.length - 1} onClick={() => goTo(activeRef.current + 1)} className="rounded-lg border border-border p-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-30"><ArrowRight className="h-4 w-4" /></button>
            </div>
          </div>
          <ul className="sr-only" aria-label="All team members">{team.map(member => <li key={member.name}>{member.name}, {member.role}</li>)}</ul>
        </div>
      </div>
    </div>
    <div className={styles.fallback}>
      {heading}
      <ul className="mt-12 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 xl:grid-cols-9" aria-label="CodeSkill team">
        {team.map(member => <li key={member.name} className="min-w-0">
          <figure>
            <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-border bg-background"><Image src={member.image} alt={`Portrait of ${member.name}, ${member.role}`} fill sizes="(max-width: 640px) 42vw, (max-width: 1280px) 28vw, 10vw" className="object-cover object-top" /></div>
            <figcaption className="pt-3 text-center">
              <p className="text-sm font-semibold">{member.name}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{member.role}</p>
              <MemberSocialLinks member={member} className="mt-2 justify-center" />
            </figcaption>
          </figure>
        </li>)}
      </ul>
    </div>
  </>;
}
