# CodeSkill team portrait direction

This note describes the previous fan-out design from PR #122. For the current
helix implementation and its settings, see [team-helix-gallery.md](team-helix-gallery.md).

The section uses the existing `motion/react` dependency and existing photos. The
row occupies its final layout from the first render, so the entrance cannot move
the next section or create a long pinned scroll area. On desktop the centre card
lands first, followed by symmetric pairs. Names appear after all springs finish.

Edit `TEAM_MOTION_CONFIG` at the top of
`frontend-v2/src/components/skill-development/TeamSection.tsx`:

- Faster/slower: change `timing.headingDuration`, `timing.lineDuration`, and
  `timing.cardStagger`. `timing.pauseAfterLine` is the intentional pause before
  the portraits start; its default is 0.4 seconds.
- Bouncier: lower `spring.damping`. Calmer: raise it. Higher `spring.stiffness`
  makes the cards settle faster. Defaults are stiffness 120 and damping 16.
- Trigger earlier/later: change `trigger.amount` (default 0.33) and
  `trigger.margin` (default `0px 0px -4% 0px`).
- Heading-to-card distance: `layout.headingGap` is 64 pixels. Navbar clearance
  is controlled by `layout.navbarHeight`, `navbarTop`, and `navbarClearance`.
- Hover: adjust `hover.maxTilt`, `hover.scale`, `hover.lift`, and
  `hover.neighbourOpacity`; `hoverSpring` controls pointer smoothing.

Team content lives in `frontend-v2/src/data/team.ts`. Add optional `linkedin` or
`github` URLs only when the team provides real profile links.

## Reusable design prompt

Design a compact, cinematic team portrait section for CodeSkill. Use neutral
charcoal surfaces, restrained green accents, the existing portraits, and generous
but controlled typography. Preserve the team heading, subtitle, and short green
underline. Place the portrait row 64px below the underline. Reveal the label,
title, and subtitle in sequence, then grow the underline from its centre. Wait
400ms after the underline finishes before spreading the portraits from a small
central stack into one straight row. Reveal the centre portrait first and fan out
in symmetric pairs using 70ms stagger and a spring of stiffness 120, damping 16.
Reveal captions only when every portrait has settled. Add gentle pointer tilt,
a cursor-following green border spotlight, a short photo glare, and a subtle
lift. Support the same emphasis with keyboard focus. Below 768px use a horizontal
snap row, fade portraits into view, and reveal captions on tap. Respect reduced
motion. Keep all layout static, reserve photo dimensions, use next/image, and
animate only transforms, opacity, and a brief title blur. Avoid pinned scroll
sections, tall empty stages, automatic loops, and additional animation packages.

Reference: https://motion.dev/docs/react-scroll-animations and
https://motion.dev/docs/react-use-spring.
