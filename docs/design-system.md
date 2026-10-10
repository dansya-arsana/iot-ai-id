# Design system

One system for the landing page, public pages, workspace and backoffice. Living reference: `/design` (not linked from navigation, disallowed in robots.txt).

## Layers
- **Tokens** — `apps/web/src/design/tokens.css`. The only file allowed to contain raw colour values. Monochrome ground (`--ds-ground`), ink at three strengths, one inverse surface, rationed status hues (`--ds-ok`, `--ds-warn`, `--ds-error`), type scale, 4px spacing scale, radius, two shadows, one motion curve.
- **Primitives** — `apps/web/src/ui/` (`Button`, `LinkButton`, `AnchorButton`, `IconButton`, `TextLink`, `Eyebrow`, `PageHeader`, `SectionHeader`, `Card`, `CardLink`, `Tag`, `TagList`, `Input`, `Select`, `Textarea`, `Segmented`, `LangToggle`, `Stat`, `StatGrid`, `Notice`, `EmptyState`, `CodeBlock`, `SpecList`, `Container`, `Spinner`).
- **Shell** — `apps/web/src/site-shell.tsx`: one `SiteHeader`, `SiteFooter` and `PageShell` for every public page; the landing uses the header in overlay mode.
- **Language** — `apps/web/src/i18n.tsx`. English is the default; Indonesian is opt-in through the EN/ID toggle and remembered per browser. Write UI copy as `tr('English','Indonesia')`. Catalog data stays as authored.

## Rules
- Page styles live next to their component, scoped under a prefix (`rl-` landing, `hl-` hardware library, `cp-`/`xp-` content and learning, `bp-`/`swk-` build and sites, `wb-` workbench, `bo-` backoffice).
- `npm run check:tokens` fails on raw colours outside the token file. Data-encoding colours (wire colours, breadboard drawing) are allowed with a `ds-allow-hex` comment on the same line.
- The workbench canvas always fills the viewport; workbench chrome floats above it and publishes its height as `--wb-chrome-h` for panels.
- `styles.css` holds only the global reset and the shared `BoardDrawing` illustration.
