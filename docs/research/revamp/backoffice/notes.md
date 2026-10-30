# Backoffice mockups (R0): notes

Static HTML, dark theme (`data-theme="dark"`), 1440 wide. These are for founder review only and are not production code.

## Files
| Page | File | PNG |
|---|---|---|
| Home (Today) | `today.html` | `png/today-1440.png` |
| Inquiries / CRM pipeline | `pipeline.html` | `png/pipeline-1440.png` |
| Field-test engagement plan | `testing.html` | `png/testing-1440.png` |
| Catalog with provenance | `catalog.html` | `png/catalog-1440.png` |
| Members and grants | `builder.html` | `png/builder-1440.png` |

- Shared files: `bo.css` holds the tokens and components, `shell.js` renders the sidebar and the icons, and `fonts/` holds the local Archivo 300–700 and Plex Mono files.
- To re-render: `node ../render-bo.cjs <this dir> today testing pipeline catalog builder`. It uses Playwright from the repo's node_modules, takes a full-page capture at 1440, and prints any horizontal overflow.

## Design system use (concept §2)
- **Tokens.** The `--ds-*` names are unchanged. The dark layer remaps them exactly as in concept §2.2, and the new tokens are `--ds-accent`, `--ds-info`, `--ds-hold` and `--ds-hatch`. Raw colours appear only in the token block at the top of `bo.css`.
- **One accent (#C9F5C0).** It's used only for the primary button, the Today marker and tag, the "today" day cell, the active underline, the `pro` grant chip and the "tested" provenance tag. The active nav item and the segmented tabs use the inverse white pill, as in the dashboard reference.
- **Status set.** Each status is a dot plus text, never colour alone: done = ok, in progress = info, late/blocked = warn, hold proposed = hold (outline), coming = hatch.
- **Type.** Page titles are Archivo 300 at 32px. Card titles are 400 at 20px. UI text is 13px. Labels, IDs, dates and numbers are Plex Mono, and numbers are tabular.
- **Shell.** The layout is inset, with a 248px sidebar panel and a main panel at 20px radius. The sidebar has a workspace switcher, ⌘K search, routes with counts, an "In flight" list with `Day N`, a pinned "Next gate" card, and System, Team and Sign out.

## Per page
- **Today:** a KPI strip (the spend meter shows the kill-switch line), late and blocked (every row carries a reason; one row deliberately shows `no reason recorded`), next 7 days, a timeline of test engagements (Today marker, gates row, legend, totals) and approval cards for the 4 gate types. This follows concept §3.3.
- **Pipeline:** the funnel uses the real `INQUIRY_STATUSES`. Filter chips, the CRM table using the real kinds (vendor/school/buyer/other), and a detail drawer (message, activity log, reply composer) sit next to each other. The 1-working-day reply SLA is labelled as founder decision 2's default.
- **Engagement plan:** this is the closest page to the dashboard reference. It shows a 30-day plan with workstreams (spec, bench, climate, field, evidence, report and payout), a Today line, gates that follow the real task flow, a day grid, a steps-done tick bar, the next gate, and late and blocked plus next 7 days scoped to the engagement. The fee shows the real 60/25/15 split.
- **Catalog:** provenance KPIs (the confidence mix, tested in lab, stale over 12 months, unverified/import only) match the existing filters. The table shows confidence bars, source tags and a lab-tested tag. Under it is a proposals queue. The drawer shows provenance for each field, with source, date and conflict notes, plus an approval card for the open proposal.
- **Members and grants:** KPIs for the grant mix, tokens, runs and spend. The member table has grant chips (`pro` in the accent colour, `pro-trial` dashed in the hold colour, a revoked grant struck through). The drawer has grant toggles, usage with no per-member cap (stated honestly), tokens shown by prefix only with Revoke, and recent project turns with stop reasons. Grant requests appear as approval cards.

## Honesty
- Every page has a dashed `SAMPLE DATA` banner. Organisations are named "Sample …", people are marked "(sample)", and emails use the `.example` domain.
- Part names on the catalog page are real catalog parts. Their scores, sources, dates and prices are illustrative, and the banner says so.
- `pro-trial` is shown as not yet shipped (R4). The Lab Mitra site appears as `Planned site`. Token values are never shown.

## Iterations (looked at the PNGs after each round)
1. **Today only.** The legend swatches were picking up the toggle-switch `.sw:after` knob, so they were renamed `.lsw`. In-flight labels were wrapping, so they now truncate with an ellipsis. The Today line was too heavy and was thinned. The gate chips overlapped, so the dates were moved apart.
2. **All 5 pages.** Tables overflowed beside the drawer: the drawer went to 360px, cell padding was tightened, and lower-value columns were dropped (Source, Category, Projects, Lab merged into Sources). Filter chips were wrapping to two lines, so they're now nowrap with shorter labels. The 30-day timeline was too narrow at 8/12 columns, so the plan now uses a `1fr + 336px` grid, short bars sit unlabeled with the label outside, the last gate chip is right-anchored, and the today tag no longer collides with the scale. The day grid had collapsed, so cells are now a fixed 30px. Unicode glyph icons were replaced with SVG icons.
3. **Tidy-up.** The legends had overflow and now wrap. The drawer token table overflowed and became compact rows. Grant requests moved into the left column to fill dead space. A proposals queue went under the catalog table. Prices became compact (`38k – 52k`) and the overflowing Checked column was fixed.
4. **Engagement page polish.** Overlapping field bars were merged. Text in the tiles was resized. A footnote in late and blocked explains the `no reason recorded` signal.

## Known gaps / for R1–R3
- The mockups are at 1440 only. Concept §3.1 specifies the 390 layout (sidebar as a bottom sheet, tables as 2-line cards), but it isn't mocked here.
- The light theme toggle isn't shown, though the tokens support it.
- Board and List views, the ⌘K menu and create drawers appear only as entry points.
- The data the timeline needs (`dueAt`, `blockedReason` on lab tasks) is still an assumption to check in R3b.
