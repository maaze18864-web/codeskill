# Team helix gallery

The CodeSkill team section now uses an independent CSS 3D helix built with the
existing `motion/react` dependency. It does not use the paid Motion+ Gallery
package, WebGL, a canvas, wheel interception, or a continuous animation loop.

Desktop scrolling drives nine portrait layers using Motion values. Each portrait
only changes its transform and opacity. ResizeObserver measures the stage only
when its size changes. Images keep fixed aspect ratios and are loaded as the
section approaches the viewport. Only visible gallery cards get will-change.

The gallery stays in view during a bounded 1,200px native scroll journey and then
releases into the next section. Previous/next buttons and left/right arrow keys
use native smooth scrolling. Small screens, short viewports, and reduced-motion
preferences receive a normal portrait grid with every name and role visible.

Tune `TEAM_HELIX_CONFIG` in
`frontend-v2/src/components/skill-development/TeamHelixGallery.tsx`:

- `layout.scrollTravel`: larger = longer journey; smaller = faster completion.
- `layout.headingGap`: space directly below the green underline.
- `geometry.itemsPerTurn`: portraits in one complete spiral turn.
- `geometry.radiusRatio`, `radiusMax`, `depthRatio`: spread and depth.
- `geometry.pitch`: vertical distance between portraits.
- `scrollSpring`: raise stiffness for faster tracking; raise damping for a calmer
  response. Avoid very low damping, which makes scrolling feel elastic.
- `heading`: entrance delays and durations.

Team photos and names remain in `frontend-v2/src/data/team.ts`. No packages added.
The previous fan-out version is preserved in Git history through PR #122.

Reference: https://motion.dev/docs/react-gallery (the example's Gallery is a
Motion+ product) and https://motion.dev/docs/performance.
