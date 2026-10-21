"use client";

import { motion, useReducedMotion } from "motion/react";
import { UsersRound } from "lucide-react";
import TeamHelixGallery, { TEAM_HELIX_CONFIG } from "./TeamHelixGallery";

function TeamHeading() {
  const reduced = useReducedMotion();
  const config = TEAM_HELIX_CONFIG;
  const reveal = (delay: number, y: number, blur = false) => ({
    initial: reduced ? false as const : { opacity: 0, y, ...(blur ? { filter: "blur(6px)" } : {}) },
    whileInView: { opacity: 1, y: 0, ...(blur ? { filter: "blur(0px)" } : {}) },
    viewport: { once: true, amount: 0.3 },
    transition: { duration: reduced ? config.heading.reducedFade : config.heading.duration, delay: reduced ? 0 : delay, ease: config.ease },
  });
  return <header className="relative shrink-0 text-center">
    <motion.p {...reveal(config.heading.labelDelay, 12)} className="inline-flex items-center justify-center gap-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary sm:text-xs lg:text-sm"><UsersRound className="h-5 w-5 shrink-0" aria-hidden="true" /><span className="h-5 w-px bg-primary/40" aria-hidden="true" />OUR DEVELOPERS &amp; CONTRIBUTORS</motion.p>
    <motion.h2 {...reveal(config.heading.titleDelay, 24, true)} className="mx-auto mt-4 max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">Meet the Team Behind CodeSkill</motion.h2>
    <motion.p {...reveal(config.heading.subtitleDelay, 0)} className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">The team building practical, hands-on learning experiences.</motion.p>
    <motion.span aria-hidden="true" initial={reduced ? false : { scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: reduced ? 0 : config.heading.lineDuration, delay: reduced ? 0 : config.heading.subtitleDelay, ease: config.ease }} className="mx-auto mt-5 block h-1 w-12 origin-center rounded-full bg-primary" />
  </header>;
}

export default function TeamSection() {
  return <section id="team" aria-label="Meet the Team Behind CodeSkill" className="relative mx-auto mt-14 max-w-screen-2xl rounded-[2rem] border border-border bg-card shadow-sm sm:mt-16" style={{ scrollMarginTop: TEAM_HELIX_CONFIG.layout.navbarOffset }}>
    <TeamHelixGallery heading={<TeamHeading />} />
  </section>;
}
