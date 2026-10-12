# Hero map v2: performance and panel redesign plan

# Hero map rebuild plan: zooming map, fixed in-frame card, path-drawn dots

I read `apps/web/src/hero-map/index.tsx`, `hero-map.css` and `model.ts`, the first entries of `regions.ts`, and `tests/e2e/19-hero-map.spec.ts`. I did not edit any repo files. Everything below rests on the measurements from the PERF, Visitor A, Visitor B and Layout Concepts inputs. The plan is Concept B, simplified wherever a cheaper option gives the same premium feel.

## 0. Diagnosis

Three problems, in order of how much they hurt:

1. **The lag is a CSS transition on all 4,659 dot circles.**
   - One `data-s` change restarts up to 6,424 transitions (`hero-map.css:23`).
   - At 4x CPU a click takes 488–644 ms before the next frame, and a hover takes 188 ms.
2. **The "page pull" is two things.**
   - The panel sets the grid row height, so the hero grows by 143 px at 1280x720, 194 px at 1440x900 and 198 px at 2000x1150.
   - The panel's own scroll then carries on into the page once it reaches its end (measured 240 px at 1366, 720 px at 1440).
   - No code scrolls the window on click.
3. **The panel reads as a document, and the map gives no spatial feedback.**
   - The Sumatra panel is 169 words in a column 855 px tall, with the CTA at y=1159.
   - On Java, 9 pins share about 130x37 px, so clicking Jakarta opens Bandung and clicking the middle of Java opens Kendal.
   - Moving between islands crosses a narrow strait that `pick()` maps to the sea, so the highlight flips to Maritime and back.

## 1. Chosen layout: one fixed-height map frame with the card inside it

Nothing outside the map frame changes size when a region is selected. The hero is exactly one viewport tall (`height:100svh`, not `min-height`), with these rows:

- the top copy;
- a 44 px lens toolbar;
- the map frame, which takes the remaining height;
- a 28 px bottom line.

The card is absolutely positioned inside the frame. Its height can never exceed the frame, so it cannot push anything down.

### Desktop 1440x900

```
  0 [nav ..........................................................................]
 96 THE REAL-WORLD GATEWAY…           | Indonesia puts tropical heat, humidity >80%,
    Prove your robot where it         | haze, floods, salt air and unstable power in
    actually breaks.     (40px)       | one country. 27.5 °C (BMKG) · RH 70–100% · Sources
244 [I build: Any ▾][Stressor: Any ▾][◂ Month: Any ▸][◇ Access][▲ SMK reach]   Drone · 5/8 regions · 9 sites  Clear
296 +--------------------------------- map frame 1310 x 552 ----------------------------------+
    | IDLE: whole archipelago (1310x474, centred).                                           |
    | +- prompt card 300x112 (bottom-left, open sea) -+                                       |
    | | Where would it break?                          |   cursor tooltip: "Java · dense, hot,|
    | | Click a region. [Partner with us →]           |    industrial baseline"            |
    | +------------------------------------------------+                                       |
    |----------------------------------------------------------------------------------------|
    | SELECTED Sumatra (k≈1.4, framed in the left 1310-380-48 px)  +- card 380 x 520 -------+ |
    |      Medan●                                                    | Indonesia › Sumatra  × | |
    |   █████  ●Pekanbaru                                            | Estate-crop belt on peat,| |
    |    ███████  ●Palembang                                         |  with a haze season     | |
    |       ████████                                                 | [19.06%][Aug–Sep][88.6%]| |
    |                                                                | CPO,Riau  haze    rubber| |
    |                                                                | Kementan¹ BMKG²  Kementan³| |
    |                                                                | ◐ Haze Aug–Sep · ⚡ Power | |
    |                                                                | 2,879 SMK · potential   | |
    |                                                                |  reach, not partners ⓘ | |
    |                                                                | [Tests][Sites 4][Why]   | |
    |                                                                | ▸ Palm harvest on peat  | |
    |                                                                | ▸ Optical sensing in haze| |
    |                                                                | ▸ Grid-outage ride-through| |
    |                                                                |━━━━━━━━━━━━━━━━━━━━━━━━| |
    |                                                                | [Get a Sumatra test plan →]| |
    |                                                                | Sources                 | |
    |                                                                +-------------------------+ |
848 +----------------------------------------------------------------------------------------+
872 Scroll to the gap ↓                                General conditions in Indonesia, not test results.
900
```

The CTA's bottom edge sits at about y=820, inside the viewport.

### Desktop 2000x1150

```
  0 [nav ...................................................................................................]
104 eyebrow / h1 (46px, 2 lines)                          | sub + proof line
260 [lens toolbar, single row] ..................................................... result line · Clear
316 +----------------------------------- frame 1820 x 778 (map 1820x658, centred) ---------------------------+
    |  Java SELECTED: k=2.6 (cap), Java fills the left ~1360px                     +- card 400 x 560 -------+ |
    |      Jakarta●─┐   ●Bekasi–Karawang PLANNED                                   | (same card, roomier;   | |
    |   Cilegon●    Bandung● PLANNED          ●Semarang & KEK Kendal               |  card height is capped | |
    |        ██████████████████████████████████        ●Surabaya  ●Gresik          |  at 560 and vertically | |
    |              ●Yogyakarta    ████████████    ●Malang                          |  centred, not stretched)| |
    |                                                                              +------------------------+ |
1094 +--------------------------------------------------------------------------------------------------------+
1122 Scroll to the gap ↓                                                       General conditions…
```

### Mobile 390x844 (and 390x664 with browser chrome)

```
  0 [nav 64]
 80 Prove your robot where it actually breaks.   (h1 30px, 2 lines; eyebrow hidden <900px)
160 [I build ▾][Stressor ▾][◂ Month ▸][◇][▲]  → one row, horizontal scroll
206 [Sumatra][Batam][Java][Kalimantan]…          region chips, horizontal scroll
246 +--------------- frame 390 x 220 (full bleed) ---------------+
    |  map at k=1 is 351x127; selecting zooms up to k=4 into the  |
    |  part of the frame above the sheet (the "safe rect")        |
466 +-------------------------------------------------------------+
    sub + proof line + "Scroll to the gap" continue below
--- sheet PEEK: height min(232px, 34svh), fixed to the bottom ---
612 ═══ (grab handle = "More details" button, aria-expanded=false)
    Java                                             ×
    The dense, hot, industrial baseline.   (1 line, clamped)
    [106/179 estates][32–36 °C][1,088 floods]   (compact tiles)
    [ Get a Java test plan → ]
844
--- sheet FULL (after tapping the handle): 86svh, tabs Tests | Sites | Why, CTA in a sticky footer ---
```

At 390x664 the peek sheet's top is at y≈438, so 192 px of the frame stays visible. The camera frames the region inside that visible part.

## 2. Rendering the dots and pins

### Dots

- **One `<path>` per region instead of 4,659 circles.**
  - Precompute each region's path at module load: `M{c+.5} {r+.5}h0` per dot, the same way `NeighbourDots` already works (`index.tsx:35`).
  - `stroke-linecap:round`; `stroke-width:.68` is the base dot diameter.
  - Precompute a bounding box per region in grid cells (`BBOX[id]`) at the same time.
  - The SVG drops from about 4,675 nodes to about 15.
- **Keep the existing hooks on each region `<g>`:** `class="hm-g" role=button tabIndex=0 aria-label aria-pressed data-region data-s data-season data-dens`. Only the child changes from circles to one path.
- **State changes only `stroke`, `stroke-width` and `opacity` on 8 elements.**

  | State | Style |
  |---|---|
  | `base` | `--ds-ink-2`, width .68 |
  | `hover` / `lit` | `--ds-ink`, width .9 |
  | `sel` | `--ds-ink`, width 1.0 |
  | `dim` | on the `<g>`: `opacity:.28` |
  | season `wet` | width 1.0 |
  | season `dry` | `--ds-ink-3` (a hollow ring isn't possible with round caps) |
  | season `haze` | `--ds-warn` |
  | `data-dens` 1–4 | width .55 / .7 / .9 / 1.1, opacity .5 / .7 / 1 / 1 |

- **Transitions:** only `.hm-g{transition:opacity .2s}`. No transitions on the path. Delete the `hm-shimmer` animation (`css:30-31`); a `lit` region is shown by its colour alone.
- **Hit-testing stays grid-based:** `pick()` uses the SVG's `getBoundingClientRect()`. That rect already includes the camera transform, so `pick()` works unchanged while zoomed.

### Pins

- Pins and region labels stay as HTML in an overlay, but the overlay moves **inside** the camera wrapper (section 3).
- They counter-scale with `transform:translate(-50%,-50%) scale(calc(1/var(--k)))` so they stay the same size on screen.
- **Which pins show:**
  - With nothing selected: the `h.pin` pins, or the lens matches.
  - With a region selected: **only that region's pins**. Other regions' pins are removed, not dimmed.
- **Hit area:** 20 px (10 px radius). The visual dot stays 8 px.
- **Idle rule.** This is what stops "Jakarta opens Bandung" and "middle of Java opens Kendal":
  - At k=1, a pin **without** a visible label is decorative: `pointer-events:none`, `tabIndex=-1`, `aria-hidden`.
  - A click there falls through to the region, which then zooms.
  - A pin **with** a placed label (for example the Access lens labels at idle) is clickable on its label box, which is collision-free and therefore unambiguous.
  - After zooming, all pins in the selected region are clickable and in the tab order.
  - Keyboard and screen-reader users still reach every site through the existing `.hm-sr` list, which stays unchanged.

### React structure (removes the per-hover re-render)

- **`<DotLayer sel lens>`** is memoised. It renders the 8 `<g>` elements and re-renders only on select or lens changes.
- **Hover never touches React state:**
  - A `pointermove` handler stores the latest event. One `requestAnimationFrame` callback then runs `pick()` and applies hysteresis (below).
  - It writes `frame.dataset.hover = id` and moves the tooltip, then sets `tipRef.current.textContent` and `style.transform = translate(x,y)`.
  - CSS does the highlight: `.hm-frame[data-hover=java] .hm-g[data-region=java]:not([data-s=dim])` gets the hover stroke. To avoid 8 selectors, also set `data-h` on the `<g>` directly from the rAF callback; that is a single attribute write.
- **The keyboard-focus highlight** uses `.hm-g:focus-visible`. Drop `onFocus`/`onBlur` → `setHover`.
- **Lens changes** go inside `startTransition(()=>setLens(...))`.
- **Label placement** is a `useMemo` keyed on `[sel, lens, k, frameSize]`. It never runs on mouse move.

## 3. Exact behaviours

### Select (click, tap, or Enter/Space on a `<g>` or region chip)

1. `setSel({region})`. The card renders immediately with its 150 ms fade-in.
2. **Camera:**
   - Compute the *safe rect*:
     - desktop: the frame minus the card's side plus a 24 px gutter;
     - mobile: the frame ∩ the area above the sheet's top.
   - `k = clamp(min(safe.w/((bw+12)·u), safe.h/((bh+12)·u)), 1, kMax)`, where `u` is px per cell at k=1 and `kMax` is 2.6 on desktop, 4 on mobile.
   - `t` = the offset that maps the bbox centre to the safe-rect centre, clamped so the map never leaves the frame.
   - Apply `.hm-cam{transform:translate(tx,ty) scale(k);transform-origin:0 0}` with a 450 ms `cubic-bezier(.2,.8,.2,1)` transition.
   - Set `will-change:transform` only while it runs, and remove it on `transitionend` so the map re-rasterises sharp.
   - With reduced motion: no transition, instant jump.
   - Maritime and Batam: k=1. Batam gets k≤2 centred on Batam.
   - Expose the result as `data-zoom={region}` and `--k` on the stage.
3. **Card side:**
   - The card sits on the opposite side from the region's centre. Bbox-centre x > 55% of the frame (Maluku, Papua) → card on the left; otherwise on the right.
   - The idle prompt card is always bottom-left; that area is open sea.
4. **Pins and labels during the zoom:** they fade to 0 within 100 ms of the zoom starting. Labels are placed for the final k, and everything fades back in 120 ms on `transitionend`.
5. **Pin to pin while zoomed:** keep the camera where it is. Swap the card to the site with a 150 ms cross-fade, mark the pin `data-on`, and set the breadcrumb to `Indonesia › Java › Bekasi–Karawang`.
6. **Leaving:** the close button (×), Esc, or the breadcrumb "Indonesia" zooms back to k=1. Breadcrumb "Java" goes from a site back to the region and keeps the camera.

### Hover (mouse only)

- The tooltip follows the cursor, offset by 14 px, and flips at the frame edges. It is one line, for example `Java · The dense, hot, industrial baseline.`, and is `aria-hidden`.
- The caption line under the map is removed, so nothing reflows on hover.
- **Hysteresis:**
  - If `pick()` returns another region, switch only after 2 consecutive rAF frames on it, or immediately if the pointer is more than 3 cells from the current region's nearest dot.
  - If `pick()` returns `maritime` or null while the pointer is within 3 cells of the current region, keep the current region.
  - Otherwise switch to the sea only after the pointer has stayed there 120 ms. Track this with a timestamp, not a `setTimeout`.
- The `pick()` fallback to `'maritime'` stays **for clicks only**. Hover uses a variant that returns null for open sea.
- No hover while zoomed into a different region. Hover only highlights dots of non-dimmed regions.

### Keyboard

- **Tab order:** lens toolbar → sea `<g>` → 8 region `<g>` elements → the selected region's pins (only after a selection) → card (breadcrumb, close, tab list, panel, CTA, Sources).
- **Enter/Space on a region** selects it. If it was keyboard-triggered, focus moves to the card `<h2>` with `{preventScroll:true}`.
- **Esc order:** open popover → expanded sheet → selected site → selected region. When the region closes, focus returns to the element that opened it, with `{preventScroll:true}`. Both `focus()` calls get `preventScroll` (`index.tsx:53-54`).
- **Tabs** use the WAI-ARIA tabs pattern: `role=tablist`, `aria-controls`, roving tabindex, Arrow Left/Right, Home/End. Tabs activate on arrow (automatic activation).
- **Lens popovers:**
  - The trigger is a `<button aria-expanded aria-controls>`.
  - Options are `aria-pressed` buttons, so the current test hooks keep working, placed in a `role=group`.
  - Focus moves to the selected option or the first one. Esc or an outside click closes the popover and returns focus to the trigger.
  - The popover is absolutely positioned over the frame and never moves the layout.

### Scroll

- **Delete the wheel/touch "scroll assist"** effect (`index.tsx:60-72`). It is scroll-jacking, which the constraints rule out.
- Keep the "Scroll to the gap" link; it is an explicit user action.
- Card body and sheet get `overscroll-behavior:contain`, so wheel or touch inside them never chains to the page.
- No code path calls `scrollIntoView` or `scrollTo` on select.

## 4. Label-collision algorithm

This is pure arithmetic in screen pixels, with at most about 30 labels. It runs in the `useMemo` described in section 2.

1. **Candidates, in priority order:**
   1. the selected pin;
   2. the selected region's pins, ordered planned first, then lens matches, then by kind (industrial, city, special-zone, agri, marine, energy);
   3. the region labels of non-dimmed regions; when a region is selected, only its own label, placed above its bbox;
   4. the neighbour-country labels.
2. **Screen position of each anchor:** `p = t + k·cell(lon,lat)·u`.
3. **Label box:**
   - Width is computed once with a canvas `measureText` on IBM Plex Mono 10px and cached per string, plus 10 px padding, plus 52 px for the `PLANNED` badge.
   - Height is 16 px.
4. **Try the offsets E, W, NE, NW, SE, SW, N, S at r=8 px.** If none fits, try E, W, N, S at 2r and then 3r with a leader line.
5. **Reject a position if it:**
   - overlaps an already-placed label box, with 2 px padding;
   - overlaps another visible pin's 20 px hit circle;
   - overlaps the card rect, the toolbar popovers or the idle prompt card;
   - falls outside the frame minus 4 px.
6. **Among positions that pass, pick the lowest score:** the number of selected-region dots under the box (sample the grid cells it covers) × 2, plus the leader length divided by r, plus 0.5 for N or S.
7. **If nothing fits:**
   - pins: label hidden, and the pin joins its nearest placed neighbour's cluster, which shows a `+n` badge;
   - region and neighbour labels: dropped.
   - Every name is still in the Sites tab and the `.hm-sr` list.
8. **Output:** `{id, x, y, anchor, leader?}`. All leader lines go into one `<path>` in an unscaled SVG overlay.

Expected outcomes:

- Java at 1440 (k≈2.2–2.6): all 9 labels placed, about 2 with leaders.
- Java at k=1 with the Access lens: the 3 planned labs are labelled; the others show as dots.
- Mobile: labels only for the selected pin and the top 3 pins of the selected region.

## 5. Card content (fixed size; the CTA is never scrolled away)

The card's height is `min(frameH − 32, 560)` and its width 380 (400 at ≥1800 px). It is a `grid-template-rows: auto auto auto auto auto 1fr auto` stack:

```
1 Breadcrumb + × (24px)        Indonesia › Sumatra
2 Name h2 (22px) + identity     ≤ 60 chars, clamped to 2 lines
3 Stat tiles ×3 (≤ 64px)       value ≤ 8 chars (20px, bold) · label ≤ 22 chars · source tag "BMKG ’26" (button)
4 Stressor/season row (20px)   ≤ 3 chips from region.stress, plus the season derived from region.season ("Haze Aug–Sep")
                               + when the build lens is on: "Our read: fits Drone" / "Not a typical Drone site"
5 SMK line (1 line, data-testid=schools-line)  "2,879 SMK · potential reach, not partners ⓘ"
6 Tabs + body (1fr, overflow:auto, overscroll-behavior:contain)
7 Sticky footer: CTA + reply/price small text (only when useCompany returns them) + "Sources"
```

### Region tabs

- **Tests** (default):
  - ≤3 rows. Each shows `short(t)` as the title (≤64 chars) and the remainder of the sentence as one muted, clamped line.
  - Clicking a row expands it in place (`aria-expanded`) and reveals the full text.
- **Sites (n)** (hidden when n=0):
  - Chips that wrap: name, plus `PLANNED`, plus a kind dot.
  - Hovering or focusing a chip sets `data-hot` on its pin, and hovering a pin highlights its chip.
  - Clicking a chip opens the site card.
- **Why:**
  - the 3 full fact sentences with source, year and link (the current `FactList`);
  - `region.note`;
  - the full SMK sentence with its citation and the "About Lab Mitra (Indonesian)" link.

### Site card (same frame)

1. **Header:**
   - Breadcrumb.
   - Name, then a kind badge, then a **PLANNED LAB** badge at the same visual weight as the name.
   - If planned, the second line reads "A planned AIoT lab city. No lab operates there yet."
2. **Stats:** ≤3 tiles from the site's hero facts.
3. **Stressor row and SMK line**, as on the region card.
4. **Tabs:** Tests (default, sorted so tests matching the build lens come first) | Why.
5. **CTA:** `Get a test plan · {short}`, keeping the existing `ctaHref` with `site`.

### Data change (the only content work)

- Add an optional field to `Fact`: `stat?:{v:string;l:string}`. Fill it for each fact with `hero:true`, about 26 regional facts plus each site's hero facts. Examples:
  - Sumatra: `{v:'19.06%',l:'of national CPO · Riau'}`, `{v:'Aug–Sep',l:'fire & haze peak'}`, `{v:'88.6%',l:'rubber smallholder'}`
  - Java: `{v:'106/179',l:'industrial estates'}`, `{v:'32–36 °C',l:'dry-season max'}`, `{v:'1,088',l:'flood events, 2024'}`
- If a hero fact has no `stat`, it shows as a 2-line clamped text tile.
- **Honesty:**
  - A tile is a verbatim number from the sourced sentence, never a derived one.
  - Each tile's source tag opens the Sources drawer scrolled to that fact. Give each drawer `<li>` an `id` like `fact-{region}-{i}` and call `scrollIntoView` on it inside the dialog only.
  - The full sentence is in the Why tab, and the tile's `aria-label` reads the full sentence.
  - Facts with `conf='L'` never become tiles. The existing filter stays.
- **Must not be touched:** the drawer contents, the `UNKNOWNS` list, `useCompany` placeholder hiding, and `/id`.

### Idle card (frame bottom-left, 300 px wide, about 112 px tall)

- With no lens: "Where would it break?" / "Click a region to zoom in." / `[Partner with us →]` (`data-cta=hero-partner`) / Sources.
- With a lens: one result line, for example "Drone: 5 of 8 regions, 9 sites. Java and Sumatra fit best." It is computed from `regionLit` and `hotspotMatches`, so it is our editorial reading, which the drawer already explains.

## 6. Lens toolbar (frees about 230 px)

- One row: `[I build: Any ▾] [Stressor: Any ▾] [◂ Month: Any ▸] [◇ Access] [▲ SMK reach] · result text · Clear`.
- The chosen value shows inside the trigger, for example `I build: Drone ×`.
- **Month stepper:**
  - ◂/▸ cycle through Off, Jan … Dec.
  - The middle button opens a 12-cell popover (the current month buttons, keeping `aria-pressed`).
- When a lens is on, the notes "typical pattern, BMKG; varies by zone and year." and "existing schools (not partners)" appear in the result slot, so the honesty copy stays visible.
- **Below 900 px:** the same buttons sit in one horizontally scrolling row. `.hm-chips` keeps `overflow-x:auto` for the mobile test.

## 7. CSS skeleton (key rules)

```css
.rl-hero.hm{height:100svh;min-height:640px;grid-template:auto 44px minmax(0,1fr) 28px/1fr;grid-template-areas:"top" "lens" "stage" "bottom";padding:96px 4.5% 0;gap:12px}
.hm-stage{position:relative;overflow:hidden;contain:layout paint}     /* frame */
.hm-cam{position:absolute;inset:0;transform-origin:0 0;transition:transform .45s cubic-bezier(.2,.8,.2,1)}
.hm-map{position:absolute;inset:0}  /* svg meet, no aspect-ratio box */
.hm-g{transition:opacity .2s}.hm-g path{fill:none;stroke-linecap:round;stroke:var(--ds-ink-2);stroke-width:.68}
.hm-aside{position:absolute;top:16px;right:16px;width:380px;max-height:min(calc(100% - 32px),560px);display:grid;grid-template-rows:auto auto auto auto auto minmax(0,1fr) auto;overflow:hidden}
.hm-aside[data-side=left]{right:auto;left:16px}
.hm-tabbody{overflow:auto;overscroll-behavior:contain}
.hm-cta{position:sticky;bottom:0;background:var(--ds-surface-raised);border-top:1px solid var(--rl-line)}
@media (prefers-reduced-motion:reduce){.hm-cam,.hm-g,.hm-pin{transition:none}}
@media (max-width:899px){
  .rl-hero.hm{height:auto;min-height:100svh}
  .hm-stage{height:220px}
  .hm-aside{position:fixed;left:0;right:0;bottom:0;top:auto;width:auto;height:min(232px,34svh);overscroll-behavior:contain}
  .hm-aside[data-full]{height:86svh}
}
@media (max-height:760px) and (min-width:900px){ /* 1280x720: compact tiles (value+label one line), h1 34px, sub clamped to 2 lines */ }
```

The `min-height:640px` floor means that on viewports under 640 px tall the hero is taller than the viewport. That only adds a constant height, not a change on select.

## 8. Acceptance criteria (run with Playwright on the local build)

| # | Criterion | Threshold |
|---|---|---|
| A1 | No page scroll on select (mouse, Enter, chip, pin, Esc close) at 1440x900, 1280x720, 2000x1150 | `scrollY` unchanged, Δ = 0 |
| A2 | Hero height before vs after select and close | Δ ≤ 1 px at all three desktop sizes |
| A3 | Layout shift over select → pin → close, starting from scrollY=120 | CLS ≤ 0.001 |
| A4 | Card height ≤ stage height, and stage bottom ≤ hero bottom | always |
| A5 | `[data-cta=hero-test-plan]` fully inside the viewport, no scrolling | Sumatra, Java, Java›Bekasi, Maritime, Papua (card on the left) at 1440x900 and 1280x720; mobile peek at 390x844 and 390x664 |
| A6 | Hover sweep, 8 s, 4x CPU throttle | p95 frame ≤ 20 ms, max ≤ 50 ms, 0 long tasks over 50 ms, 0 React commits caused by hover (React Profiler or a commit counter in dev) |
| A7 | Click → next frame at 4x CPU | ≤ 100 ms (was 578); at 1x ≤ 40 ms |
| A8 | Lens toggle → second frame at 4x CPU | ≤ 80 ms (was 395) |
| A9 | Running animations 50 ms after a click | ≤ 40 (was 6,424) |
| A10 | SVG node count | ≤ 30 |
| A11 | Hover flicker: 220 px sweep along Java, then crossing the Sumatra–Kalimantan strait | ≤ 2 tooltip changes; never shows Maritime while within 3 cells of land |
| A12 | Hit accuracy at k=1 | clicking the screen position of Jakarta, Bekasi, Surabaya or the centre of Java selects **Java** (region card), never a site |
| A12b | Hit accuracy after zooming into Java | each pin's centre opens that pin's own card (9/9) |
| A13 | Labels after Java select at 1440 | no two visible label boxes intersect; no label intersects the card |
| A14 | Text budget | region card ≤ 70 visible words in the default tab state (excluding the tab body's 2nd and 3rd rows); site card ≤ 80 |
| A15 | Honesty | every stat tile has a source button showing a year; SMK line visible text matches `/potential reach, not partners/`; `PLANNED` shown on every planned site (pin, chip, card); placeholders absent on the public host (existing test) |
| A16 | a11y | axe: 0 serious/critical issues on idle, Java selected, and the sheet open; the focus-return and tabs keyboard patterns pass |

## 9. e2e changes (`tests/e2e/19-hero-map.spec.ts`)

**Selector updates:**

- `.hm-g circle` → `.hm-g path` (lines 17–18). For line 18, assert `data-region` on the parent `<g>` instead.
- "Cities & potential areas" heading (lines 83, 153) → `getByRole('tab',{name:/Sites/})`, clicked, then look for the chip or pin.
- Line 152, mobile sheet bottom = 844: keep. Add a check that the sheet's top is ≥ 844 − 232.
- Lines 40–42, facts: assert ≤ 3 `.hm-stat` elements, each with a `sup`/source button containing a 4-digit year; `19.06%` stays visible.
- Lens tests: open the popover first, for example `getByRole('button',{name:/I build/}).click()` and then the option. The `aria-pressed` and `data-s` / `data-season` assertions stay as they are.

**Delete:** lines 121–141 (the one-wheel-flick assist and its panel guard). Replace them with "wheel over the map and the card scrolls the page or nothing, never jumps": wheel 40 px → `scrollY` = 40.

**Add tests:**

1. A1/A2/A5 in a loop over `[1440x900, 1280x720]` × `[sumatra, java, java›bekasi-karawang, maritime, papua]`.
2. `data-zoom="java"` on the stage after select. With `reducedMotion:'reduce'`, the camera has computed `transition-duration` of `0s`, and `data-zoom` is removed after Esc.
3. Tabs: focus the tablist; ArrowRight moves `aria-selected`; `aria-controls` points to a visible panel.
4. A12/A12b hit tests: compute pin centres with `boundingBox()`; click at idle → Java heading; after zoom → the site heading.
5. A13 label overlap: collect `.hm-pin[data-label] span, .hm-label` boxes and check pairwise intersections.
6. A11 flicker: count tooltip text changes during a `page.mouse.move` path with `steps:40`.
7. Perf smoke (not CI-gating, tagged `@perf`): CDP `Emulation.setCPUThrottlingRate(4)`, then `document.getAnimations().length` ≤ 40 after a click.

## 10. Implementation order (about 2.5 days)

1. **P0 perf (½ day; ships alone if needed):**
   - path-per-region `DotLayer` with memo;
   - remove the circle transitions and the shimmer;
   - rAF/DOM hover with hysteresis and a cursor tooltip;
   - remove the scroll assist;
   - `preventScroll`.
2. **P0 layout (½ day):**
   - fixed 100svh hero and in-frame card with grid rows and a sticky CTA;
   - `overscroll-behavior` on card and sheet;
   - lens toolbar with popovers.
3. **P1 card (½ day):** stat tiles plus the `stat` data; stressor row; SMK line; tabs; site card; breadcrumb.
4. **P1 camera (½ day):** safe rect, k and t; pins in the camera with counter-scale; fade around the zoom; card side flip; idle-pin decorative rule.
5. **P2 labels (¼ day):** the greedy placer, leaders and `+n`.
6. **P2 mobile (¼ day):** peek/full sheet, safe rect above the sheet, kMax 4.
7. **Then:** e2e updates and a full `npm run build` with the e2e suite.

**Optional, outside `hero-map/`:** the splash (`landing-new.tsx:88`, `landing-motion.ts:25`, an 850 ms exit) delays first interaction by about 1.2–2 s. Shortening it to ≤ 400 ms is worthwhile, but the landing component may also serve `/id`. Gate it on the global landing only, or leave it.

## 11. Risks

1. **The zoom feels like motion sickness or "hijacking".** Mitigations:
   - it is triggered only by a click, a tap or Enter;
   - no wheel, pinch or pan;
   - kMax is 2.6 on desktop;
   - 450 ms easing; instant with reduced motion.
2. **Hit-testing under a CSS transform.** `pick()` relies on `svg.getBoundingClientRect()` including the transform, which it does. Pin positions also live inside the camera. A test covers clicks during a zoom: ignore clicks while `data-zooming` is set.
3. **Dots look blurry or thick when zoomed.** Strokes scale with k by design, so a dot is about 2.2x bigger at Java's zoom. If it reads as too heavy, set `stroke-width:calc(.68/var(--k)*1.4)` on `[data-zoom]` after `transitionend`. Dropping `will-change` after the transition re-rasterises the map sharp.
4. **Short desktop viewports (≤720 px tall):** the card body area gets small. Use the compact tile variant via `max-height:760px`; the tabs body scrolls internally and is contained; the CTA stays pinned. Check 1280x720 and 1366x768 explicitly.
5. **Stat tiles misstate a fact** (honesty). Tiles must be verbatim figures from the sentence. Review each `stat` against `docs/research/hero-map-spec.md`, and keep the full sentence one tap away (Why tab and drawer anchor).
6. **Decorative idle pins lower discoverability.** Mitigated by the region zoom, the Sites tab, the labelled Access-lens pins staying clickable, and the `.hm-sr` list for assistive technology. Watch the "Java shows its hotspots" test at line 80: `jakarta` must still be *visible* at idle.
7. **Label placer edge cases** (very long names, the PLANNED badge). Canvas measurement and the `+n` fallback cover these. Every name exists in the Sites tab.
8. **Popover a11y and focus traps.** Use the plain disclosure pattern (button with `aria-expanded`), not `role=menu`, and test Esc ordering.
9. **Mobile sheet at 390x664** leaves only about 190 px of map. The camera targets the visible part, and the full state is opt-in.
10. **The `/id` route and the shared landing CSS.** All hero changes stay scoped under `.rl-hero.hm` and `apps/web/src/hero-map/`. Do not touch `landing-new.*` except for the optional splash change gated on the global landing.

Source files reviewed:

- `/Users/macbook/Documents/GPT Project/iot-ai-id-public/apps/web/src/hero-map/index.tsx`
- `/Users/macbook/Documents/GPT Project/iot-ai-id-public/apps/web/src/hero-map/hero-map.css`
- `/Users/macbook/Documents/GPT Project/iot-ai-id-public/apps/web/src/hero-map/model.ts`
- `/Users/macbook/Documents/GPT Project/iot-ai-id-public/apps/web/src/hero-map/regions.ts`
- `/Users/macbook/Documents/GPT Project/iot-ai-id-public/tests/e2e/19-hero-map.spec.ts`