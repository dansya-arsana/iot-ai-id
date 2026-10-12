

# perf

I drove the local build with Playwright at 2000x1150 and 390x844 (iPhone UA, touch). The path was: click Java, open Jakarta, go back, open Bekasi–Karawang, close, turn on the Industrial AMR lens, turn on the Schools lens, open Java again, scroll to the CTA, click it. No repo files were edited. Screenshots and JSON logs are in `/private/tmp/claude-501/-Users-macbook-Documents-GPT-Project-iot-ai-id-public/30b119ae-cf49-43dd-95ad-515a4fa511f3/scratchpad/ux/` (`desk-*.png`, `phone-*.png`, `desk-log.json`, `phone-log.json`, script `drive.cjs`). The server is stopped.

## First impressions (VP BD, Japanese AMR maker)
- **27-inch:** the headline is strong and the dot map looks good. But the map is 1436x520 px on a 2000x1150 screen, and about 60% of it is empty sea. The busy part is the lens block: 5 rows and 38 chips sit above the map before I have clicked anything. Next to the map is a 658 px white box with one sentence and a button. It reads like a filter form, not a map I want to explore.
- **iPhone:** the first 1.2 s is a black splash screen. After that the map is **351x127 px**: dots about 1.4 px, and city pins sit on top of each other. The lens rows take about 900 px of scrolling before the map starts. Region chips are the only real way to choose a region.
- Content is fine. Presentation is a research document dropped into a sidebar.

## Friction (measured)
1. **The layout grows when you select something.** On desktop the hero goes from 1150 to **1348 px** on Java and Bekasi (1288 on Jakarta) and shrinks back on close. The panel grows to 856 px and still needs its own scroll (Java: 1019 px of content in an 854 px box). Everything below the hero moves by about 200 px on every select and close. This is the "pulled" feeling.
   - I clicked with the mouse and the page did not scroll (scrollDelta 0). I did not reproduce the 240 px Sumatra scroll. A likely cause is the keyboard path, which calls `title.focus()` without `preventScroll`, or scroll anchoring while the hero resizes.
2. **The CTA is below the fold in every card that matters.**
   - Desktop Java: CTA top at 1326 in a 1150 viewport; Bekasi: 1175; Jakarta just fits (1102–1144).
   - Phone: the CTA is below the sheet's fold in every card: 1073 (Java), 884 (Jakarta), 935 (Bekasi).
   - To reach it on desktop I had to scroll the page 607 px, which pushed the map off screen.
3. **The card is a wall of text:** 182 words for Java, 175 for Jakarta, 210 for Bekasi. Facts are full sentences with superscript citations in mono type, which is hard to scan. The SMK block alone is about 40 words of disclaimer. A region card shows the full list of 9 cities as tall rows, then test scenarios below them.
4. **Clicking the middle of Java opens Kendal.** The Semarang/Kendal pin covers the visual centre of Java, so the obvious "click Java" gesture lands on a city card. I had to search for a dot that was not under a pin.
5. **No spatial feedback after selecting.** Selecting Jakarta or Bekasi does not zoom. Java stays about 280 px wide and the 9 Java pins sit within about 40 px of each other, so their labels are suppressed by the crowding rule (more than 3 pins). The card says "Bekasi"; the map shows a black blob.
6. **On the phone the bottom sheet hides the map.** It covers 72% of the screen (top at y=236; the map is at y=670, underneath it). You never see what you selected. The only view is the sheet.
7. **Lag:** every lens chip click causes a 50–70 ms main-thread long task on a fast desktop CPU. The Schools lens causes **155 ms**, and the phone run hit 168 ms. On a mid-range Android that is 300–600 ms, which is the "laggy" feeling. Each toggle re-renders and restyles the whole SVG (CSS `r` transitions on thousands of circles, plus a looping opacity animation on lit regions).
8. **Hover:** the tooltip is pinned to the bottom-left of the map, far from the cursor. Moving between islands passes over the "Maritime Indonesia" sea target, so the text keeps switching between a region and the sea. That is the flicker. Region labels also sit on top of the dots (the "Java" label is covered by the cursor and the dots).
9. **Lenses don't explain themselves.** With the AMR lens on, the side panel still says "Where would it break?". It never says "2 regions and 6 sites fit AMR, start with Bekasi". Selecting a region with a lens active doesn't reorder or filter the card. The lens only dims dots.
10. **Placeholders** (`We reply within [X] business days [placeholder]`) show on 127.0.0.1. That is by design (`placeholdersAllowed` allows local hosts), but check that production at iot.ai.id hides them.
11. **CTA handoff works:** `/partner?region=java` pre-fills "Your test context: Java". That part is good.

## What a professional data-exploration UI does differently
- **The card is a fixed-size overlay on the map, not a grid column that grows** (Mapbox storytelling, Flightradar24 aircraft card). The panel floats over the right side of the map with a fixed height (for example `min(560px, 100% of the stage)`). The CTA is pinned in a sticky footer inside the card and is always visible. The page height never changes, and select/close causes no layout shift.
- **Zoom to the selection** (Flightradar, Windy, Mapbox `flyTo`). Clicking Java animates the SVG viewBox to Java, at about 4x scale. City pins spread out and get permanent labels. A breadcrumb ("Indonesia › Java › Bekasi") replaces the "← Java" link. This is camera movement inside the map, not scroll-jacking, and it is the main thing that makes it feel like a product.
- **On the phone, use a three-detent sheet** (Apple Maps, Google Maps): peek (about 120 px: name, 2 KPIs, CTA), half, and full. The default is peek, so the zoomed map stays visible above it.
- **Lenses become one control** (Windy's single layer picker, Stripe globe's single story). Use one segmented "I build…" control as the primary entry. Stressor, Month, Access and Schools go into a compact "Layers" popover. Show a result line: "AMR / cobot: 6 sites match · Java ranks first". Months become a slider or scrubber, not 12 chips.
- **Hover tooltip follows the cursor** (Stripe globe, Flightradar), with about 80 ms hysteresis. Treat the sea as "no region" during hover so it stops flickering. Keep the click-on-sea action for Maritime.
- **Performance** (Linear-level polish):
  - Do not transition `r` on thousands of circles. Draw each region as one `<path>` like the neighbours already are, or use a canvas layer.
  - Restyle by toggling a class on the parent `<g>`.
  - Remove the infinite shimmer animation.
  - Wrap lens changes in `startTransition`.
  - Aim for under 16 ms per toggle.
- **Progressive disclosure:** show 3 KPI tiles with a small source tag ("BPS 2024 ↗"). The full sentence and citation open on tap or in the Sources drawer, which already exists and is good. All the honesty data stays one tap away and is never hidden.
- Cut the mobile splash. A foreign buyer on a phone will not wait 1.2 s for a logo.

## Information hierarchy I expect
**Region card (Java), about 60 words, no scrolling:**
1. Name plus a one-line identity, with the breadcrumb.
2. Three KPI tiles with big numbers: "106 / 179 industrial estates", "32–36 °C dry-season max, RH > 80%", "1,088 flood events (2024)". Each has a small source and year tag.
3. A "Fit for your build" row, driven by the lens: for example "AMR / cobot: strong · 4 sites".
4. Top 3 sites as chips, ranked by the lens: Bekasi–Karawang (PLANNED), Jakarta, Kendal. A "+6 more" item lights them up on the map.
5. A collapsed "Schools nearby: 8,149 SMK" row, with "existing schools, not partners" as a one-line tooltip or expander.
6. Sticky CTA: "Get a Java test plan →", with reply time and price band underneath.

**City card (Bekasi–Karawang), more concrete and operational:**
1. Name, a kind badge (Industrial area) and a **PLANNED LAB** badge at the same visual weight as the name. Underneath: "No lab operates here yet."
2. The one commercial fact that matters to me: "~70% of GRDP is manufacturing · 1,650 companies in Jababeka".
3. A strip of stressor icons (heat, haze, flood, grid dips): what will break my robot here.
4. **Test scenarios first**, filtered to my lens. For AMR that is "Pilot AMRs on live automotive lines, measuring uptime under heat, dust and grid dips". This is the reason a BD person clicks a city, and today it sits below the citations.
5. Logistics context such as Patimban Port and Cikarang Dry Port as a single line.
6. Nearby SMK count, collapsed.
7. Sticky CTA: "Plan an AMR pilot in Bekasi →", which carries build, site and stressor to /partner (that already works).

The main fix is a fixed-height overlay card with a sticky CTA plus a camera zoom on select. Lens performance and pin placement (pins taking the region's click target) come second.

# visitor-de-agri

Selecting a region at 1440x900 makes the hero grow from 900px to 1094px, and the "Get a test plan" button lands at y≈1159, below the fold. I recommend **Concept B**: a full-width map that zooms to the selected region, with a fixed-size card inside the map frame. I measured all of this on a local build with Playwright; no repo files were edited and the server has been stopped.

## What's causing the clunky feel

| # | Problem | What I measured at 1440x900 (2000x1150 in brackets) |
|---|---|---|
| 1 | **The hero grows when you select something.** The panel sits in a grid row that stretches to fit it, so the whole hero gets taller. | Hero 900→1094px (1150→1348). Panel 412→606px, with 855px of content for Sumatra and 1019px for Java, so it also scrolls inside itself. CTA at y=1159 for Sumatra and y=1323 for Java. Scrolling the mouse wheel inside the panel carries on into the page once the panel hits its end. That is most likely the "pulled" feeling. |
| 2 | **The text and lens rows push the map down.** The lens chips wrap to 5–7 rows. | The top block is 312px tall and the map is only 926x335, about 37% of the screen. The map's fixed shape (246:89) means it can't get taller. Space is lost to the top block and the empty area under the map, not to the map. |
| 3 | **Java is crowded.** | 9 pins in about 130x37px. Their 28px click areas overlap. The Bandung pin blocks clicks on the Java dots (Playwright's click timed out on it), and the "Java" label sits under the pins. |
| 4 | **Hover labels flicker.** | When the mouse crosses the gap between two islands, `pick()` returns `maritime`. The hint text flips Region → Maritime → Region. Every mouse move also re-renders the whole hero component. |
| 5 | **The map is heavy to draw.** | 4,659 separate dot elements. Highlighting a region animates `r` on every dot, which the GPU can't speed up. My hover sweep showed no long tasks on this Mac, but it will lag on mid-range laptops. |
| 6 | **The panel reads as prose.** | Name, one-line description, 3 fact paragraphs with inline citations, a ~60-word SMK paragraph, the cities list, test scenarios, a note, then the CTA. |

The `[placeholder]` reply-time and price lines only appear on the local build. `useCompany` hides them on the public host, so that is fine.

Screenshots and scripts are in `/private/tmp/claude-501/-Users-macbook-Documents-GPT-Project-iot-ai-id-public/30b119ae-cf49-43dd-95ad-515a4fa511f3/scratchpad/ux/`: `{1440,2000}-{idle,sumatra,java,pin}.png`, `shot.mjs`, `perf.mjs`, `bbox.ts`.

## What all three concepts share

- **Lens toolbar.** The 5 lens rows become one 44px row: `[I build ▾ Any] [Stressor ▾ Any] [Month ◂ Jul ▸] [◇ Access] [▲ SMK reach] · Clear`. Each dropdown is a popover over the map, so opening it doesn't move anything. Chosen values show inside the trigger, e.g. "Drone ×". Month becomes a stepper with a 12-tick track that appears on focus. This frees about 230px.
- **Fixed panel layout.** The panel has a fixed size and never scrolls inside.
  - **Header:** name, one-line description and a close button.
  - **Stat row:** 3 big numbers. Each needs a new short figure field per fact in `regions.ts`/`hotspots.ts` (value, label, source and year). The source link is a superscript like `¹` that opens the Sources drawer at that fact.
  - **SMK line:** one line, "2,879 SMK in Sumatra · potential reach, not partners ⓘ".
  - **Tabs:** `Tests | Cities (n) | Sources`, with a fixed-height body.
  - **CTA:** always visible at the bottom.
- **Smaller dot map.** Draw each region as one `<path>` with round caps, as the neighbour countries already are: 8 elements instead of 4,659. `pick()` already works out the region from the grid, so the separate dots aren't needed for clicks. Selected and dimmed states then change stroke width and opacity on 8 elements. Keyboard focus stays on the `<g>` groups.
- **Hover fixes.**
  - Update hover at most once per frame (`requestAnimationFrame`).
  - Keep the last region if the pointer is within 2 cells of its dots, and wait 100ms before switching to the sea.
  - Move the hover hint into its own small component so the rest of the hero doesn't re-render.
- **Label placement.** A greedy algorithm, run with `useMemo` only when the selection, lenses, zoom or container size change (never on mouse move). With 30 or fewer labels the cost doesn't matter.
  - **Priority order:** selected pin, then pins in the selected region (by kind), then region labels, then neighbour country labels.
  - **Width:** estimated from the monospace font (about 6.0px per character at 10px, plus 10px padding), or measured once with canvas and cached.
  - **Positions tried:** E, W, NE, NW, SE, SW, N, S at offset r. If none fit, try with a leader line at 2r and then 3r, drawn in one SVG path.
  - **Rejected if** the label overlaps a placed label, another pin's click area, the card, or the frame edge. Positions covering the selected region's dots score worse.
  - **If nothing fits:** hide the label and show a "+n" badge on the cluster. Every name still appears in the Cities tab and the screen-reader list.
  - Pin click areas shrink to 20px inside clusters, and a pin wins a click only within 10px of its centre.
- **Zoom to region.** Not scroll-jacking: it only happens on click or Enter, never on wheel or gesture, and there's no pan.
  - Zoom = min(2.6, (map width × 0.6) ÷ region width, map height ÷ region height), with 6 cells of padding.
  - Results: Java ≈ 2.2x (its pins go from ~130px to ~290px across), Sumatra ≈ 1.35x, Maritime stays at 1x.
  - Apply it as a CSS transform (translate and scale) on a wrapper around the SVG, over 450ms. Don't animate the viewBox; that redraws every dot each frame.
  - Pins and labels sit in a separate layer that isn't scaled. Their positions are computed once, they fade out during the zoom and fade back in when it ends.
  - With reduced motion turned on, it jumps instantly. `will-change` is set only while the zoom runs.

## Concept A: map plus a fixed side panel with tabs

```
0   [nav ........................................................................]
96  eyebrow
112 Prove your robot where it          | Indonesia puts tropical heat, humidity >80%...
    actually breaks.  (44px, 2 lines)  | 27.5 °C (BMKG) · RH 70–100% (BMKG) · Sources
236 [I build ▾][Stressor ▾][Month ◂ Jul ▸][◇ Access][▲ SMK]  Lenses combine. Clear
290 +------------------- map 926x335 (centred vertically) ------+-- panel 360 x 540 --+
    |                                                         | SUMATRA          ×  |
    |    ███ selected, others dimmed                          | Estate crops on peat|
    |   ██●Medan                                              | +-----+-----+-----+ |
    |    ██●Pekanbaru                                         | |19.1%|Aug– |88.6%| |
    |      ●Palembang                                         | |palm¹|Sep² |rubb³| |
    |                                                         | +-----+-----+-----+ |
    |                                                         | 2,879 SMK · potential reach, not partners ⓘ |
    |                                                         | [Tests][Cities 4][Sources]|
    |                                                         | - Palm harvest on peat    |
    |                                                         | - Optical sensing in haze |
    |                                                         | - Grid ride-through       |
    |                                                         |---------------------|
    |                                                         |[Get a test plan →]  |
830 +---------------------------------------------------------+---------------------+
860 Scroll to the gap ↓                       General conditions, not test results.
```

- **Pros:**
  - The smallest change from today.
  - The panel is always in the same place, so it's predictable.
  - Easy to test with fixed selectors.
  - Hovering a row in the Cities tab highlights its pin on the map, and the other way round.
- **Cons:**
  - The map stays small (926x335) and the space under it stays empty.
  - It still feels like a sidebar app.
  - Java needs the zoom to be readable anyway.
- **Complexity:** Low to medium, about 1–1.5 days. Lock the stage row height (`height: calc(100svh - top)`, panel `height: 100%`), add tabs, add stat fields to the data.

## Concept B (recommended): full-width map that zooms, with a card inside the map frame

```
0   [nav ........................................................................]
96  eyebrow · Prove your robot where it actually breaks.   (headline left, sub right)
236 [I build ▾][Stressor ▾][Month ◂ Jul ▸][◇ Access][▲ SMK]  Lenses combine. Clear
290 +--------------------------- map frame 1310 x 474 --------------------------------+
    | IDLE: whole archipelago, full width;                                            |
    | idle prompt card in the bottom-right sea:                                       |
    | "Where would it break? / Partner with us →"                                     |
    |---------------------------------------------------------------------------------|
    | SELECTED (Java, zoom 2.2x, region framed in left 60%)   +- card 380 x 430 ----+ |
    |                                                         | JAVA  ← Indonesia  ×| |
    |      Jakarta●──      ●Bekasi–Karawang PLANNED           | dense, hot, industr.| |
    |   Cilegon●   ●Bandung PLANNED       ●Semarang           | [106/179][32–36°C][1,088]| |
    |              ████████████████████      ●Surabaya        | estates¹  dry max² floods³| |
    |          ●Yogyakarta ██████████  ●Gresik ●Malang        | 8,149 SMK · potential reach, not partners ⓘ | |
    |  (leader lines where crowded, "+n" if no space)         | [Tests][Cities 9][Sources]| |
    |                                                         | body (fixed 150px)  | |
    |                                                         |[Get a test plan →]  | |
    |                                                         +---------------------+ |
764 +---------------------------------------------------------------------------------+
860 Scroll to the gap ↓                       General conditions, not test results.
```

- **How it works:**
  - **Card position:** on the opposite side of the frame from the region's centre. Regions in the east (Maluku, Papua) put the card on the left and frame the region in the right 60%.
  - **Card size:** max height = frame height − 32px, with the CTA at the bottom.
  - **Pin to pin:** clicking a pin keeps the zoom, focuses that pin and swaps the card content with a 150ms cross-fade.
  - **Leaving:** Esc, the close button or "← Indonesia" zooms back out.
  - **Keyboard:** focus moves to the card heading, and Esc returns focus to where the user was (as now).
  - **Mobile (under 900px):** keep the bottom sheet, with a fixed height of 56svh, the same tabs, the CTA in the sheet footer, and the same zoom.
- **Pros:**
  - The map is 40% wider and about 140px taller.
  - Nothing outside the map frame changes size, so there's no layout shift.
  - Clicking zooms in and the card slides in, which feels like a real map product.
  - It fixes Java's crowding.
  - The card never covers the selected region.
- **Cons:**
  - Needs the zoom code and the label-placement code.
  - The card covers some of the other regions while it's open; they're dimmed anyway.
  - e2e tests must wait for `transitionend`, or run with reduced motion turned on.
- **Complexity:** Medium, about 2.5–3 days, including the zoom, the card position flip, the label algorithm, the tabs and the path-based dots.

## Concept C: full-width map with a fixed bottom strip

```
236 [lens toolbar ........................................................................]
284 +----------------------------- map 1310 x 400 (zoomed on select) ---------------------+
684 +-- strip 1310 x 150, always present, content swaps ---------------------------------+
    | SUMATRA ×        | 19.1% palm¹  Aug–Sep haze²  88.6% rubber³ | Cities: [Medan][KEK SMK][Pekanbaru][Palembang] | [Get a test plan →] |
    | Estate crops     | 2,879 SMK · potential reach, not partners ⓘ | Tests: Palm harvest · Haze optics · Grid ride-through | Sources        |
834 +--------------------------------------------------------------------------------------+
```

- **Pros:**
  - Easy to scan left to right, like a dashboard.
  - The strip is there before anything is selected, so selecting causes no shift.
  - The CTA is always in the same spot.
- **Cons:**
  - Only 150px of height, so the test scenarios must be cut to ~40 characters each.
  - Doesn't fit a 1440x800 screen without shrinking the map.
  - The cities row overflows for Java (9 cities).
  - On mobile the strip becomes a sheet anyway, so there are two patterns to maintain.
- **Complexity:** Medium, about 2 days.

## Recommendation

Go with **B**. It's the only concept that both enlarges the map and keeps the selected region visible, and the zoom is what makes Java readable at 1440.

1. **Same release, whatever concept you pick:**
   - the lens toolbar;
   - the fixed-height panel;
   - path-based dots;
   - the hover fixes;
   - `overscroll-behavior: contain` on the panel and sheet.
2. **Next:** the zoom and the in-frame card.
3. **Last:** label collision with leader lines.

**Honesty rules are kept:**
- Each stat links to its source.
- Low-confidence facts stay out of the card.
- The SMK line always says "potential reach, not partners" in visible text; the ⓘ only adds detail.
- Planned labs keep the "PLANNED" badge.
- Placeholders stay hidden through `useCompany`.
- /id is not touched.

**Changes to `tests/e2e/19-hero-map.spec.ts`:**
- Assert that the hero's height is the same before and after a click (±1px).
- Assert that `[data-cta=hero-test-plan]` is inside the viewport after selecting Sumatra, Java, a pin, and Maritime, at 1440x900 and 1280x720.
- Assert that `scrollY === 0` after a click.
- Switch between tabs with Arrow keys (`role=tablist`, `aria-controls`).
- Assert that `data-zoom=java` is set on the stage.
- With reduced motion on, assert there's no transition.
- Assert that no two visible label boxes overlap.

# visitor-jp-amr

Persona: Head of Field Operations at a German ag-robot startup, on a 1440x900 laptop. I drove the local build (fixture server) and the live https://iot.ai.id/ with the `iot_region=global` cookie. Screenshots are in `/private/tmp/claude-501/-Users-macbook-Documents-GPT-Project-iot-ai-id-public/30b119ae-cf49-43dd-95ad-515a4fa511f3/scratchpad/ux/`. The scripts there are `drive.mjs` to `drive4.mjs`, with logs in `run*.log`. I edited no repo files. The local API server crashed partway through, so `drive2` to `drive4` ran against live only.

## Root causes found (measured)

1. **The page "pull" is scroll chaining out of a panel that runs below the fold, not code scrolling the page.**
   - `.hm-aside` has `max-height: calc(100svh - 104px - 190px)`, which assumes the top block is 190px. In reality the map and panel start at y=434 because of the 26 lens chips.
   - At 1440x900 the Sumatra panel is 606px tall, from y=434 to y=1040. The hero grows from 900px to 1094px and the CTA sits at y=1159, below the fold.
   - Reading the panel with the mouse wheel scrolls the panel to its end, then carries on into the page:
     - 1366x768: page scrolls exactly **240px**, the founder's number (`W-1366-panel-read.png`).
     - 1280x720: 480px.
     - 1440x900: 720px, and the map disappears under the sticky nav (`W-1440-panel-read.png`).
   - Clicking a region alone never scrolled the page (scrollY stayed 0 in every run). The first wheel tick does not jump to `#gap` either; it scrolls a normal 40px.
2. **Overlapping pins: clicking one city opens another.**
   - Java is only about 206x59px on screen (bbox 257,661 to 463,720) and carries 9 pins with 28px hit boxes.
   - Hit test on live: clicking **Jakarta opens Bandung**, **Bekasi opens Bandung**, and **Surabaya opens Malang**. Hovering Jakarta shows the "Bandung PLANNED" label (`LIVE-07-jakarta-hover-zoom.png`).
   - Only 130 of Java's 325 dots sit outside a pin's hit box. My first "click Java" opened Bandung instead of Java (`04-click-java.png`).
3. **Hover flicker.**
   - A 220px sweep along Java changed the label 9 times, because a pin label pops up roughly every 25px.
   - Crossing the few-pixel sea strip between Sumatra and Kalimantan switches the highlight to "Maritime Indonesia" and back.
   - The caption under the map rewrites itself on every change.
   - This is not a frame-rate problem: frames held at p95 17ms, with no long tasks.
4. **Lenses show almost no feedback.** With Sumatra open, choosing Drone or Aug left the panel unchanged. Only a few pin outlines changed (`LIVE-03-drone-lens-open.png`). As a visitor I could not tell what the filter did.
5. **Placeholders show locally but are hidden on live.** The local fixture build shows "We reply within [X] business days [placeholder]" and "Test plans from [price band] [placeholder]" (`02-hover-sumatra.png`). Live hides them, so this is fine as long as that holds.
6. **Splash screen.** On live the hero is first visible and clickable at about 2.0s. Locally, at 1.2s the screen was still the black "AIoT" dot splash (`01-first-load.png`).

## Persona report

- **First 5 seconds:** About 2 seconds of black splash. Then I read "Prove your robot where it actually breaks", which is strong and I get it: Indonesia as a harsh test field. The whole top half of the screen is 26 pill buttons (I BUILD / STRESSOR / MONTH / ACCESS / SCHOOLS), so it looks like a filter form before I've seen the product. The map, which is the hook, starts at y=434, below that (`02-hover-sumatra.png`).
- **Where it felt slow, pulled or confusing:**
  - When I scrolled to read the Sumatra panel, the whole page slid up and the map went under the nav. That is the "pulled" feeling (`W-1366-panel-read.png`, `W-1440-panel-read.png`).
  - I clicked Jakarta and got Bandung; I aimed at Java and got Bandung too. At that point I stop trusting the map.
  - Labels pop in and out as I move the mouse, and crossing a narrow strait flips the highlight to "Maritime Indonesia".
  - Clicking lenses did nothing visible.
- **What I wanted first after clicking Sumatra:** a one-glance verdict, not prose. For example: the stressors as 2–3 icons (Haze Aug–Sep · Peat ground · Grid outages), a fit score for my ground/ag robot, and the 4 city pins lit up on the map. Then the button. The 3 palm/rubber facts with citations are background reading.
- **What I skipped as a wall of text:**
  - All three fact paragraphs (169 words in the Sumatra panel).
  - The SMK block: 2,879 schools plus a citation plus a disclaimer, which means nothing to a German ops lead at this step.
  - The "Test scenarios" bullets, because they come after the cities and are below the fold.
- **Did I find the cities and the CTA?**
  - Cities: only by scrolling inside the panel. "Cities & potential areas" begins at y=850 at the bottom edge (`03-click-sumatra.png`). The same cities exist as pins on the map, but those pins are dimmed to 0.35 opacity and tiny.
  - CTA: "Get a test plan · Sumatra" is at y=1159 at 1440x900, so it is not visible without scrolling. Without the script I would have missed it. When I reached it, it worked: `/partner?region=sumatra` pre-fills the region (`12-after-cta.png`).
- **What would make me click "Get a test plan":**
  - The button is always visible: pinned at the bottom of a fixed-height panel that never scrolls the page.
  - It is preceded by something about *my* robot: "Ground robot × Sumatra: haze Aug–Sep, soft peat, grid outages → 3 test scenarios".
  - It shows a concrete next step: a reply time and a price band, once those are real.

## Placement recommendations

- **Layout:**
  - Put the map at the top under the headline. The map plus the panel must fit in 100svh.
  - Collapse the lenses into one "I build…" segmented row. Move Stressor, Month, Access and Schools into a compact "Filters" popover, or show them as map-overlay toggles.
- **Panel:**
  - Size the panel to the map's height, not to a viewport formula. Set `overscroll-behavior: contain` on `.hm-aside`.
  - Use a sticky footer for the CTA and Sources.
  - Order the content as: identity line, then stressor and season chips with a month strip, then the cities as clickable chips that are also highlighted on the map, then tabs or "More" for facts, test scenarios and SMK.
  - Keep the facts behind a "Why (3 sources)" toggle so the honesty rules stay intact.
- **Map:**
  - On region select, hide pins from other regions and spread out overlapping pins: cluster Java into "Jakarta area (4)" or use leader-line labels.
  - Region hit-testing should beat pins unless the cursor is within about 8px of a pin centre.
  - Debounce hover by about 80ms, ignore "Maritime" for gaps under about 2 dots, and keep the caption at a fixed height.
- **Lens feedback:** dim non-matching regions strongly, add a "fit" badge in the open panel, and give a count ("3 of 8 regions match").
- **Splash:** cut it or shorten it to under 500ms.

# layout-concepts

I measured the hero map locally (1440x900 and 1280x720, CPU at 1x and 4x slowdown, plus an iPhone 13 profile) and A/B-tested the fixes by injecting CSS. No repo files were edited and my server on port 8897 is stopped. The lag has one dominant cause: every dot has its own CSS transition. The "page scroll" is really the hero growing taller, not a window scroll.

## Measurements

- **DOM:** the hero SVG has 4,675 nodes, of which 4,659 are `<circle>` elements, one per dot (Kalimantan 1,185, Sumatra 1,099, Papua 963 and so on). The whole hero is 4,857 of the page's 5,427 nodes. Only the neighbour countries are drawn as a single `<path>`.
- **What changes on hover or select:** one `data-s` attribute per region `<g>` (8 groups). But every circle has `transition: fill .25s, opacity .25s, r .25s`, so one change restarts transitions on every circle underneath.
  - Running transitions right after one hover change: 2,850–5,295.
  - Right after a click: 6,424.
- **React:** the whole `GlobalHero` re-renders on every hover change. Script time was small, though: 0.19s over an 8s hover sweep at 1x. The cost is style recalculation and paint, not JavaScript.

| Before | 1x CPU | 4x CPU |
|---|---|---|
| Hover into a region → second frame | 34–56 ms | 106–321 ms (avg 188–197) |
| Hover sweep frames, p95 / max | 16.8 / 33 ms | 66.6 / 166.7 ms (43 frames over 33 ms) |
| Hover sweep style recalculation | 0.71 s over 8 s | 1.85 s |
| Click Sumatra: pointerdown → next frame | 122–155 ms | 488–644 ms |
| Longest input event during that click (the click handler itself runs only 0.7–6 ms) | 280–304 ms | 624–768 ms |
| Lens chip toggle → second frame | ~105 ms | ~395 ms |
| Frames after the click, max | 83 ms | 200 ms |

## The "page scroll" on select

I could not reproduce a window scroll. `scrollY` stayed exactly the same (0, or 120 when I started there) for a mouse click, for keyboard Enter and for a plain `focus()`. Nothing called `scrollIntoView` or `scrollTo`. The only focus on click is the browser's own focus of the `<g tabIndex=0>`, which is already on screen.

What does happen is the hero gets taller:

| Viewport | Hero height | Panel height | Panel content | "Get a test plan" CTA after click |
|---|---|---|---|---|
| 1440x900 | 900 → 1,094 px (+194) | 412 → 606 px | 855 px tall, about 1,120 characters | bottom at y=1,201, below the fold |
| 1280x720 | 754 → 897 px (+143) | 282 → 426 px | same | bottom at y=1,184, below the fold |

When the visitor has already scrolled a little, this registers as a layout shift (CLS 0.02, coming from `.rl-gap` and `.hm-bottom`). To reach the CTA they must scroll the page or the panel's inner scrollbar. That matches the "pulled, long wall of text" complaint.

On a phone the bottom sheet is 478 of 664 px tall and covers 123 px of the 127 px-tall map. Its content is 799 px, so the CTA (bottom at y=896) also needs scrolling inside the sheet.

## Root causes, ranked by impact

1. **A transition on all 4,659 circles** (`hero-map.css:23`). This is about 85% of the lag. With only `.hm-g circle{transition:none}` injected:
   - hover → 31 ms (was 188 at 4x);
   - click → 87 ms (was 578 at 4x) and 33 ms (was 121 at 1x);
   - frames after the click: max 16.8 ms (was 200);
   - running animations after a click: 16 (was 6,424).

   **Fix:** no transitions on circles. Put the dimming on the `<g>` once: `.hm-g{transition:opacity .2s}.hm-g[data-s=dim]{opacity:.28}`. I measured this with the fade kept: click 76 ms, hover 31 ms at 4x.
2. **Per-dot geometry changes through the CSS `r` property** (`hero-map.css:24-27`, `:91`). Every state change re-lays out thousands of circles. Once transitions are off this is a smaller second-order cost, about 3 ms in the A/B test.

   **Fix:** keep `r` constant and show state with fill/opacity on the `<g>`. Better still, draw each region as one `<path d="M x y h0 …">` with `stroke-linecap:round` (the neighbour countries already work this way, `index.tsx:35`). That takes the SVG from about 4,675 nodes to about 15, with one per-region path for the selected or lit state. A `<canvas>` is not needed at this size.
3. **The panel decides the grid row height** (`hero-map.css:2` rows `minmax(0,1fr)`; `:48` `max-height` instead of a fixed height; `index.tsx:130-139` renders identity, 3 facts, the SMK block, the cities list, test scenarios and the CTA all at once).

   **Fix:** use `.hm-aside{height:0;min-height:100%;max-height:none}` so the panel never grows the row, and make the CTA `position:sticky;bottom:0`. I measured this: the hero stays at 900/754 px and the CTA stays in view (bottom y=772 at 1440, 626 at 1280). The real fix is a compact panel:
   - a header plus 2 key facts;
   - tabs or segments for Conditions / Cities / Tests / Schools;
   - the CTA always pinned at the bottom.

   This keeps the honesty rules: facts stay sourced and the SMK line keeps its "not partners" wording.
4. **Hover state lives in the root component** (`index.tsx:48`, `:116` `onPointerMove` → `setHover`, `:117`/`:119` `onFocus` → `setHover`). Each region change re-renders labels, pins, chips and the panel. The CPU cost is small, but it adds up with cause 1.

   **Fix:** handle `pointermove` in a requestAnimationFrame callback and write `svg.dataset.hover=id` straight to the DOM. Style the hovered region with CSS selectors on that attribute and update the tip text through a ref. Keep a memoized `<DotLayer>` that only re-renders on select or lens changes. Hover flicker also comes from the `pick` fallback to `'maritime'` at coasts (`index.tsx:76-78`) together with 250 ms transitions that keep getting interrupted. Add hysteresis: keep the current region while the pointer is within about 3 cells of it.
5. **Phone bottom sheet** (`hero-map.css:85`): 72svh with no fixed snap height. Use a peek height of about 40svh with the CTA sticky, so the map stays visible above it.
6. **Smaller items:**
   - `title.current?.focus()` (`index.tsx:54`, keyboard path only) and `o.focus()` in `close` (`:53`) should get `{preventScroll:true}`. They did not scroll in my tests, but this guards against it.
   - The wheel and touch "scroll assist" (`index.tsx:61-72`) calls `scrollIntoView(#gap)` on the first downward wheel at the top of the page. That is effectively scroll-jacking, which the constraints rule out. It did not fire in my test (a single 40 px wheel scrolled 40 px normally), so I could not confirm the conditions that trigger it. I recommend removing it.
   - The infinite `hm-shimmer` animation (`hero-map.css:30`) measured as negligible on the main thread (10 ms of style work per 3 s idle). It is low priority, but it can go too.

For the e2e tests: the `data-s`, `data-region`, `data-testid` and `aria-pressed` hooks can all stay as they are. Fixes 1, 2 and 4 change only how things are rendered.

All files are in `/private/tmp/claude-501/-Users-macbook-Documents-GPT-Project-iot-ai-id-public/30b119ae-cf49-43dd-95ad-515a4fa511f3/scratchpad/ux/perfeng/`:
- Scripts: `perf.mjs`, `ab.mjs`, `ab2.mjs`, `layout.mjs`, `mobile.mjs`, `idle.mjs`
- Results: `p-1440-1.json`, `p-1440-4.json`, `p-1280-1.json`, `p-1280-4.json`
- Screenshots: `click-top-*.png`, `layout-baseline-*.png` vs `layout-fixedAside-*.png`, `mobile-sumatra.png`