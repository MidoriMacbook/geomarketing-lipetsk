# Hero motion island

This is a self-contained local ES module. It is loaded asynchronously by
`/static/js/hero-loader.js`; Flask, Leaflet, the Material bundle and application
state do not depend on it. React 19.3.1 and ReactDOM 19.3.1 mount an empty effect
controller in `#hero-motion-root`. React does not render the heading, subtitle,
controls or SVG.

## React Bits provenance

Official repository: https://github.com/DavidHDev/react-bits

Pinned revision: `e12c22192ac7b4b452c5e2feb9b586d74765d696`, retrieved 2026-10-22.

Original JS/CSS components are retained under
`scripts/frontend/hero/upstream/{SplitText,BlurText,ScrollReveal,Magnet}.jsx`, along with
the exact upstream license. Their original paths are
`src/content/TextAnimations/<name>/<name>.jsx` at that revision. SHA-256 values
are recorded in `scripts/frontend/hero/upstream/PROVENANCE.json` (upstream LF
line endings, normalized on Windows checkouts) and verified
by `pnpm check:hero`. These snapshots are reference source, not build inputs.

Upstream is **MIT + Commons Clause License Condition v1.0**, not plain MIT.
The exact notice is reproduced in LICENSES.txt. These adaptations are supplied
as part of this application; they are not a standalone component package.
GSAP and @gsap/react have GreenSock's standard license, also linked in the notice.

## Adaptations (not drop-in upstream components)

- `SplitText.js` retains the React/useGSAP lifecycle, GSAP SplitText word splitting,
  font gate, timeline/fromTo/stagger algorithm and revert cleanup. It targets the
  existing static h1, uses words at 32px/740ms with 85ms stagger, and omits upstream rendering,
  loops, hover springs, clipping and ScrollTrigger. It immediately rejects a
  split that changes measured heading dimensions. Temporary word wrappers keep
  original whitespace and textContent, and are reverted on finish, interruption,
  print, reduced motion and unmount. No duplicate or hidden text is rendered.
- `BlurText.js` retains upstream blur/direction snapshots and buildKeyframes.
  Motion's `motion/react-mini` useAnimate hook applies the three snapshots to the
  existing short subtitle as one paragraph (8px blur/14px y/750ms, delay480ms after fonts). Upstream per-word rendering, duplicate
  screen-reader text, trigger loops and spring effects are omitted. Inline styles
  are restored on finish and cancellation.
- `ScrollReveal.js` adapts the enter-mode once guard to five existing blocks.
  GSAP fromTo handles opacity0→1/y24→0/700ms; IntersectionObserver replaces
  text splitting and ScrollTrigger scrub. A JS-only preparation class is removed
  on entry, focus or cleanup. Pointerdown pauses geometry through pointerup.
- `Magnet.js` adapts upstream reach/maxOffset and numerical spring solver to one
  existing static CTA. Source: `src/content/Animations/Magnet/Magnet.jsx`, same
  pinned revision, retrieved 2026-10-23. SHA256 is included in PROVENANCE.json.
  Global registry, multiple ownership, tilt, scale and JSX are omitted. Max6px,
  fine pointer only, keyboard/print/reduce reset, bounded event-driven RAF.
- `CityMotion.js` is application code: finite CSS SVG route/response lifecycle; automatic visibility pause, no user control or infinite pulse.
- `PointerDrift.js` is application code, not a claimed React Bits component.
  Fine hover only, +/-6px maximum, event-driven requestAnimationFrame. It has
  no permanent frame loop, and resets on leave, blur, offscreen, visibility,
  print and runtime reduced motion.

Runtime dependencies are exact top-level versions in package.json, with exact
transitive resolutions/integrity in pnpm-lock.yaml. Motion's mini React hook
keeps the required genuine Motion engine without bundling its full component
renderer. No Tailwind, CDN dependency, WebGL or second React application tree.

Build: `pnpm build:hero`. Verify reproducibility, source hashes and <=180 KiB
gzip budget: `pnpm check:hero`. The existing Material scripts/output are separate.
The bundle retains package license banners; full notices are in LICENSES.txt.
