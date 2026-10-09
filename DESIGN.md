# Adopted design foundation

This foundation was authored directly from project context and adapted Impeccable guidance. It is not output from the official Impeccable launcher. The landing is the first adopted surface; other application surfaces can adopt these choices deliberately.

## Direction

Warm lab notebook clarity: familiar daylight surfaces, precise hardware references, readable language and generous separation between tasks. Hardware and evidence carry the story. Avoid decorative eyebrows, section numbers, terminal costumes and hard offset shadows.

## Tokens

The implementation lives in `apps/web/src/landing.css` for `.landing-page` and `apps/web/src/shell.css` for shared navigation and `.app-shell` pages.

| Token | Value | Use |
| --- | --- | --- |
| paper | #f7f5ef | Page background |
| ink | #252a25 | Primary text |
| accent | #b33e2e | Primary action and mismatch emphasis |
| muted | #626b60 | Supporting text |
| line | #d8dcd2 | Quiet separators |
| surface | #eeeee5 | Hardware reference surface |
| raised surface | #fffef9 | Prompt and menu |
| success | #3e654c | Focus and evidence color |
| radius | 14px | Large contained surfaces |
| spacing | 8, 16, 24, 40, 64, 96px | Group and section rhythm |
| content width | 1280px | Landing width cap |

## Typography and composition

Use self-hosted Archivo for headings, prose and controls. Use IBM Plex Mono only for code, pin data and observations. Headings use −0.03em tracking, balanced wrapping and a maximum of 5rem on this landing, below the 6rem ceiling. Body text is 16px; supporting content remains readable. Two-column desktop compositions become one column at 800px. Mobile gutters are 24px.

The first viewport prioritizes the pinned phrase, clear physical workflow, working prompt and reference hardware. Entrance links are editorial rows. The process uses a meaningful seven-stage sequence without decorative numbering. Evidence demo, catalog and proposed Indonesia program follow in reading order.

## Interaction and truth

Controls retain their existing routes and API behavior. Focus uses a visible green ring. Prompt has a visible focus boundary, caret and disclosure. Evidence changes use one brief background transition; reduced-motion removes animation and transitions. Demo state is announced with a polite live region. All visual-only, demo and proposed states are stated honestly.

## Adoption boundary

Shared Header and Footer use the same foundation on landing and internal pages. Build and Page-based reference, learning, and community routes adopt the foundation under `.app-shell`. Navigation exposes Build, Sites and Learn directly, with secondary routes grouped under Resources. Fullscreen project, site canvas and backoffice routes retain their independent shells. Never widen `.app-shell` or `.landing-page` selectors without checking those routes.

## Outcome-led landing — 10 October 2026

The Home route now uses an independent `.result-landing` surface in `landing-new.tsx`, `landing-new.css`, and `landing-motion.ts`. The previous `.landing-page` rules remain historical and do not own Home. Internal `.app-shell` and canvas surfaces keep their existing design system.

The user selected GetLayers Baseline: white and light gray surfaces, blue `#2563c9`, rounded product panels, and spring reveals. Muted text is darkened to `#626975` for contrast. Self-hosted Archivo and IBM Plex Mono remain. Display type reaches 84px on desktop and scales down for mobile. The hero uses an original, transparent humanoid concept image following the user's supplied composition. The humanoid is not an available product or proof of robotics execution.

The opening curtain uses a timed line without a fake percentage, a 1400ms minimum, 2600ms cap, and 850ms exit. Content mounts immediately, begins revealing at curtain exit, and restores scrolling. Reduced motion bypasses the curtain and movement. Animation frames, observers, timers, inert state, and overflow are cleaned up on unmount. Header entrance descends from above; the header stays sticky afterward.

Public CTAs lead to the catalog, learning, public source, desktop preview release, and a downloadable partnership brief. Official distribution, inventory, member counts, testimonials, and partner logos are withheld until evidenced.
