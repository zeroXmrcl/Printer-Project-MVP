# PrintCast redesign spec

A darkroom instrument for watching one printer. The camera is the easel. Telemetry is the strip under the easel. Finished stills are the contact sheet.

This file is the direction (`DESIGN.md` equivalent) and the per-element contract. Implement against it. Do not invent a second palette, type scale, or card language.

**Design read:** workshop instrument for a maker watching a Bambu Lab P2S, in a darkroom / print-studio language, dial **ENERGY 2 / RHYTHM 2 / MOTION 2**.

**Craft references (feeling, not clone):** Linear and Raycast for density and restraint, Vercel for type and focus, Stripe for instrument-like numbers, Bambu Handy for printer-specific information architecture. PrintCast must still look like PrintCast if the name is swapped.

---

## 1. Anti-slop rules applied

Source: [miqdadbadjuber/anti-slop](https://github.com/miqdadbadjuber/anti-slop), design-system-first prompting, [design.yaps.ai principles](https://design.yaps.ai/docs/principles), [interfaces.dev cheat sheet](https://interfaces.dev/cheat-sheet).

### Filter (what must not appear)

- No purple-to-blue, aurora, or neon default palette. No gradient text. No radial glow blobs.
- No glass on header, cards, and overlays at once. Glass dose: camera cover scrim only.
- No pill-everything. Radius is a hierarchy tool: controls 6px, panels 10px, viewfinder 12px. Pills only on real status chips.
- No shadow on every card. Cards sit on a hairline. One shadow: the print dialog.
- No decorative emoji. No Lucide pack. Icons are custom and tied to the thing they mark (Wi-Fi bars, fan blades, filament reel, layered mark).
- No sparkle / beta / AI-powered badges. Badges mark printer state only.
- No left-edge color stripe as decoration. Share-card status rail is existing product language and stays there only.
- No endless pulse on dots. A live dot is static. Air streaks move only while airflow is actually heating, cooling, or laser, and stop under `prefers-reduced-motion`.
- No fake stats, fake activity, or filler names. Empty beats invented.
- No Inter / Geist / Space Grotesk. IBM Plex stays because it is an industrial instrument face already in the product.
- No template dashboard (sidebar + four stat cards + chart + table as the home). Home is camera, then job, then instruments.
- Copy uses commas, colons, and middle dots. No em dash in UI text.
- Contrast AA. Focus rings visible. Keyboard works. Tap targets 44px.
- Every control does something or is absent.

### Direction (what must appear)

- One focal point per screen: live camera on Home, the job row on Prints, the watt readout on Energy, the form on Settings.
- One accent: safelight amber. Green is status (live, ok, progress), not brand paint.
- Identity motif: viewfinder corners + develop reveal on stills + warm ink/paper.
- Whitespace is structural: 32px between major blocks, hairlines inside a cluster.
- Motion explains state: cover fade, job spinner to check, still develop, dialog enter. Hover is 140ms. No bounce.

### Dials

| Dial | Value | Why |
| --- | --- | --- |
| ENERGY | 2 | A live printer is tense. The UI should feel precise, not loud. |
| RHYTHM | 2 | Camera/job is one stage. Instruments share one panel. Filament and health are quieter blocks. |
| MOTION | 2 | State changes move. Idle chrome does not. |

### Major decisions (R-31)

- **Color:** Warm charcoal and paper because the product is a darkroom around a lit build plate, not a cool SaaS shell.
- **Accent:** Safelight amber because heat, waiting, and darkroom lamps are the product's real light.
- **Type:** IBM Plex Sans + IBM Plex Mono because the product is an instrument, and this pairing is already PrintCast's voice.
- **Layout:** Camera first, job attached, instruments as one clustered panel, because the user decides "is the print healthy?" from those three things in that order.
- **Cards:** One panel language with internal dividers, so six identical pills do not flatten hierarchy.
- **Theme:** Dark default (camera and workshop). Working light theme because the founder asked for both and some desks are bright.
- **Nav:** Header links on. Prints, Energy, and Settings exist and were unreachable after the previous hide.

---

## 2. Design system

### 2.1 Color tokens

Author in hex for implementation. Contrast is measured on the surface the text sits on.

#### Dark (default)

| Token | Value | Use |
| --- | --- | --- |
| `--page` | `#100f0d` | App ground |
| `--surface` | `#1a1815` | Panels |
| `--raised` | `#221f1b` | Hover / input fill |
| `--ink` | `#f3eee6` | Primary text |
| `--muted` | `#b7aea3` | Secondary text (AA on `--page` and `--surface`) |
| `--faint` | `#8d857b` | Labels, axis, unused ticks (large or short only; never long body) |
| `--line` | `#2f2b26` | Hairlines |
| `--line-strong` | `#4a443c` | Input border, focus neighbor |
| `--accent` | `#e4a24a` | Safelight: focus, drying heat, waiting word |
| `--ok` | `#3bb87a` | Live, finish, progress fill, healthy Wi-Fi |
| `--alarm` | `#e07a62` | HMS, failed, door open |
| `--heat` | `#e4a24a` | Same family as accent: nozzle/bed heat, air heating |
| `--cool` | `#6eb8d4` | Air cooling |
| `--laser` | `#e07a62` | Air laser |
| `--on-accent` | `#1a1408` | Text on amber fill |
| `--on-ok` | `#06140c` | Text on green fill |
| `--scrim` | `rgb(16 15 13 / 0.56)` | Camera cover and dialog veil |

#### Light (`[data-theme="light"]`)

| Token | Value | Use |
| --- | --- | --- |
| `--page` | `#f3efe6` | Paper ground |
| `--surface` | `#fffdf8` | Panels |
| `--raised` | `#ebe4d6` | Hover / input |
| `--ink` | `#1c1914` | Primary text |
| `--muted` | `#5c564c` | Secondary |
| `--faint` | `#7a7368` | Labels |
| `--line` | `#d8d1c3` | Hairlines |
| `--line-strong` | `#b7ae9f` | Input border |
| `--accent` | `#b56e12` | Safelight on paper (darker for AA) |
| `--ok` | `#1a7a4c` | Success |
| `--alarm` | `#b24332` | Fault |
| `--heat` | `#b56e12` | Heat |
| `--cool` | `#1f6f8a` | Cool |
| `--laser` | `#b24332` | Laser |
| `--on-accent` | `#fff8ec` | Text on amber |
| `--on-ok` | `#f3fff6` | Text on green |
| `--scrim` | `rgb(28 25 20 / 0.46)` | Veil |

Humidity A–E stays a functional scale, not a fifth brand color: A `#3bb87a`, B `#b7c04a`, C `#e4a24a`, D `#e07a62`, E `#9b2c2c` (light theme uses the darker set: `#1a7a4c`, `#7a7d1f`, `#b56e12`, `#b24332`, `#7a1d1d`).

`color-scheme` follows the theme. `html[data-theme]` is set before paint from `localStorage` key `printcast-theme`, else `prefers-color-scheme`, else dark.

### 2.2 Typography

- **Sans:** IBM Plex Sans 400 / 500 / 600. Reason: industrial instrument, already the product voice.
- **Mono:** IBM Plex Mono 400 / 500. Reason: dBm, MQTT age, file metadata, tabular readouts that must not shift.
- Rendering: `-webkit-font-smoothing: antialiased` on dark only.
- Features: `font-variant-numeric: tabular-nums` on every number that updates.
- Headings: `text-wrap: balance`. Quiet lines: `text-wrap: pretty`.
- Measure for notes and empty copy: max 68ch.

| Step | Size / line | Weight | Tracking | Use |
| --- | --- | --- | --- | --- |
| micro | 11 / 14 | 500 | 0.04em | Chip labels, speed names, table heads |
| caption | 12 / 16 | 400 | 0.01em | Wi-Fi, captions, AMS remain |
| body | 15 / 22 | 400 | 0 | Copy, table cells, form |
| title | 20 / 26 | 600 | -0.02em | Section titles, AMS name |
| display | 28 / 32 | 600 | -0.03em | Page H1 (device, Prints, Energy) |
| readout | 36 / 1 | 600 | -0.04em | Temps, watts, speed, percent |
| hero-read | 44 / 1 | 600 | -0.045em | Energy page watts only |

Mobile: display 24, readout 28, hero-read 36.

### 2.3 Spacing

4px base. Use the scale, not arbitrary gaps.

`4, 8, 12, 16, 24, 32, 48, 64`

- Shell width: `min(1180px, calc(100% - 48px))`. Mobile: `calc(100% - 24px)`.
- Section gap: 24 desktop, 16 mobile.
- Cluster internal: 0 (hairline grid).
- Panel padding: 16 20.
- Header height: 56.

### 2.4 Radius

| Token | Value | Use |
| --- | --- | --- |
| `--r-xs` | 4px | Inner ticks |
| `--r-sm` | 6px | Buttons, inputs, chips |
| `--r-md` | 10px | Panels, dialog, tables |
| `--r-lg` | 12px | Viewfinder |
| `--r-pill` | 999px | Status chip only |

Do not use 22px card radii.

### 2.5 Elevation

- Resting panel: `background: var(--surface); border: 1px solid var(--line);` No shadow.
- Header: opaque `--page`, 1px `--line` bottom. No backdrop blur.
- Dialog: panel treatment plus `box-shadow: 0 18px 40px rgb(0 0 0 / 0.4)`.
- Light dialog shadow: `0 18px 40px rgb(28 25 20 / 0.16)`.

### 2.6 Iconography

Custom 1.5px stroke / geometric fills. No icon font. No emoji.

- Brand mark: four descending bars (print layers). Recolor with `--ink` and `--faint`.
- Wi-Fi: three arcs + dot, lit by signal buckets.
- Door: outline + handle, `--alarm` only when open. Hidden when closed.
- Fan: three blades, lit 0–3 by speed.
- Reel: disc + hub + slot label.
- Droplet: humidity only.
- Check: job finished.

Sizes: 14, 18, 28, 40 (job thumb), 64 (dry ring).

### 2.7 Grid

Home:

```
mast (full)
status (title + chip + wifi)
stage (viewfinder + attached job)
cluster (3-col temps / fans+energy / speed+air)
filament
health
prints
```

Desktop cluster:

```
temps  temps  temps
fans          energy
speed         air
```

`1.4fr 0.8fr` for the split rows. One column under 800px. Fan row two columns under 800px, one under 420px. AMS reels: 5 columns, 3 at 800px, 2 at 420px.

### 2.8 Motion

| Token | Value |
| --- | --- |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` |
| `--t-hover` | 140ms |
| `--t-enter` | 220ms |
| `--t-cover` | 280ms |
| `--t-develop` | 1050ms |

Animate `opacity` and `transform` only, plus the existing job stroke-dashoffset (functional check draw).

`@media (prefers-reduced-motion: reduce)`: no loops, no develop, no cover transition, no air streaks, no gooey loader motion. Instant state.

---

## 3. Per-element spec

Every interactive state lists default / hover / focus-visible / active / disabled / loading / error. If a state does not apply, it is marked n/a.

Motion is listed per element. Reduced-motion fallback is always: no animation, final state visible.

### 3.1 App shell

**Purpose:** Hold the studio at a readable width.

**Anatomy:** `main.shell` > header + page body.

**States:** default only.

**Sizing:** see 2.3. Bottom padding 72px so the last panel clears the browser chrome.

**Motion:** none.

### 3.2 Header / mast

**Purpose:** Name the product and move between real pages.

**Anatomy:** brand (mark + title + notes) | nav | theme toggle | (admin: sign out).

**States:**
- default: opaque `--page`, 1px bottom `--line`.
- hover (links): color `--ink`.
- focus-visible: 2px `--accent` ring, 2px offset.
- active: color `--ink`.
- disabled: n/a.
- loading: n/a.
- error: n/a.
- current page: `aria-current="page"`, weight 600, `--ink`. Others `--muted`.

**Sizing:** 56px row, links min-height 44px, padding 10px 12px. Notes: caption, ellipsis, max 42ch (28ch on small phones).

**Motion:** link color 140ms. Sticky, no hide-on-scroll.

### 3.3 Brand mark

**Purpose:** PrintCast layers, not a hamburger.

**Anatomy:** 28×28 SVG, four bars.

**States:** default. Hover with the wordmark (no separate hit). Focus is on the home link if the mark is inside one. On Home the mark is not a second link.

**Sizing:** 28px. App icon 32px with `--page` tile, radius 6.

**Motion:** none.

### 3.4 Wordmark and notes

**Purpose:** Product name and the operator's own note (from Settings).

**Anatomy:** title 18/600, notes caption `--faint`.

**States:** default. Empty notes omit the line.

**Sizing:** title 18 desktop, 16 under 420px.

**Motion:** none.

### 3.5 Primary navigation

**Purpose:** Reach Dashboard, Prints, Energy, Settings. All four routes exist.

**Anatomy:** text links, no icons.

**States:** see 3.2. No "coming soon".

**Sizing:** 14px, 44px min height.

**Motion:** color 140ms.

**Mobile:** wrap under the brand, left aligned, still 44px.

### 3.6 Theme toggle

**Purpose:** Switch Ink (dark) and Paper (light).

**Anatomy:** button. Visible label is the target theme: "Paper" in dark, "Ink" in light. `aria-label` states the action.

**States:**
- default: ghost, `--muted`, height 44, radius `--r-sm`, padding 0 12.
- hover: `--ink`, `--raised` fill.
- focus-visible: accent ring.
- active: scale 0.98.
- disabled: n/a.
- loading: n/a.
- error: n/a.

**Sizing:** 44×auto.

**Motion:** 140ms color/background. Theme swap is instant (no page fade).

### 3.7 Status row (Home H1)

**Purpose:** Name the machine and say whether it is printing.

**Anatomy:** `h1` device title | status chip | Wi-Fi.

**States:** default. Title wraps; Wi-Fi does not.

**Sizing:** display type. Chip and Wi-Fi stay on the first row when space allows.

**Motion:** none for the title.

### 3.8 Status chip

**Purpose:** Real printer state. Not a decorative pill.

**Values:** Preparing, Printing, Paused, Idle, Finished, Unknown, Link stale (when `ageMs > 15000`).

**Anatomy:** optional 7px dot + label. Dot only for Preparing / Printing / Paused (live work). Finished uses `--ok` text, no dot. Link stale uses `--alarm` text. Idle/Unknown use `--muted`.

**States:**
- default: height 28, padding 0 10, radius `--r-pill`, fill `--raised`, 1px `--line`.
- hover: n/a (not a control).
- focus: n/a.
- active / disabled / loading / error: n/a.

**Sizing:** micro 11/500.

**Motion:** none. No pulse.

### 3.9 Wi-Fi mark

**Purpose:** Show RSSI with four buckets.

**Anatomy:** 18px SVG + tabular dBm caption.

**States:** 4/3/2/1/0 bars. Missing signal shows "-" and zero bars.

**Sizing:** 18px icon, caption 12.

**Motion:** none. Color change is instant with telemetry.

### 3.10 Door icon

**Purpose:** Door is open. Hidden when closed.

**Anatomy:** 14×18 outline in `--alarm`.

**States:** visible / hidden. Title "Door open".

**Sizing:** 44px hit if it ever becomes a control. Today it is not a control.

**Motion:** none.

### 3.11 Viewfinder (camera)

**Purpose:** The one focal object on Home. Show the public stream, or an honest cover.

**Anatomy:** 16:9 frame, video, optional last-frame canvas, scrim, cover copy, viewfinder corners when live, optional Live chip.

**States:**
- default live: video visible, cover opacity 0, corners on, Live chip on.
- hover: n/a.
- focus-visible: if the frame is not focusable, skip. Video has a title.
- active: n/a.
- disabled: n/a.
- loading / waiting: cover visible. Copy "Waiting for the camera". Last frame blurred if present.
- error / fatal: same cover. Copy stays "Waiting for the camera" (retry is automatic).
- not printing (camera hidden): cover, copy "Not printing".
- stream not set: frame, body copy "Stream not set".

**Sizing:** full shell width, radius `--r-md` on the stage. Desktop max-height `min(52vh, 480px)` so the job strip and temps stay on the first screen. Mobile keeps a free 16:9. Background `#0a0908`.

**Motion:** cover layers fade 280ms `--ease-out`. Reduced: instant. Existing `COVER_MIN_MS` / `COVER_FADE_MS` stay.

### 3.12 Camera cover brand

**Purpose:** Occupy the empty frame without a fake screenshot.

**Anatomy:** mark 40px + "PrintCast" display 28/600 + caption 13/500 `--muted`.

**States:** visible with cover.

**Sizing:** centered column, gap 12.

**Motion:** none (parent fades).

### 3.13 Live chip

**Purpose:** Playback is on the live edge. Hidden otherwise.

**Anatomy:** 7px `--ok` dot + "Live".

**States:** shown / hidden. No pulse.

**Sizing:** micro, padding 0 8, height 24, top-left 12px inset.

**Motion:** opacity 220ms.

### 3.14 Viewfinder corners

**Purpose:** Identity motif. Mark the live frame.

**Anatomy:** four 16px L corners, 1.5px `--ink` at 80% opacity.

**States:** only while live.

**Motion:** none.

### 3.15 Stage (camera + job)

**Purpose:** Bind the easel to the current job so they read as one object.

**Anatomy:** viewfinder on top, job strip attached below, shared `--surface` and `--line`, one radius.

**States:** default. When drying replaces the job, the dry strip attaches the same way.

**Sizing:** one panel.

**Motion:** none as a wrapper.

### 3.16 Job strip

**Purpose:** Name the file, percent, remaining time, layers, stage, filament move.

**Anatomy:** 40px thumb | column (filename, quiet line) | percent | full-width bar.

**States:**
- default idle: filename or "No file", percent "-", no bar unless `showBar`.
- printing: spinner thumb, bar if `showBar`.
- finished: check thumb, `--ok` percent, bar at 100%.
- hover (finished thumb): thumb fill `--ok`, check `--page` (existing easter egg, keep).
- focus-visible on thumb if it is a button in future. Today not a control.
- error: n/a (print error lives in Health).

**Sizing:** padding 16 20. Filename 15/600, wrap anywhere. Percent readout 36.

**Motion:** spinner 0.8s linear. Settle + check draw as today. Reduced: static ring, check visible if done.

### 3.17 Progress bar

**Purpose:** Job percent.

**Anatomy:** 4px track `--line`, fill `--ok`, radius 999 on the bar only (a meter, not a card).

**States:** width 0–100. Hidden when percent is null and not finished.

**Sizing:** full strip width, margin 10 0 0.

**Motion:** width can update with telemetry (layout). No shimmer.

### 3.18 Job quiet line

**Purpose:** Layer, stage, filament change.

**Anatomy:** `--muted` 13. Filament change colors the slot labels with real AMS colors. Arrow `→` is a path, not a CTA.

**States:** omitted when idle and there is nothing to say.

**Motion:** none.

### 3.19 Drying strip

**Purpose:** AMS dry cycle when it is the job, or alongside a print when AMS has its own supply.

**Anatomy:** "Drying" label, remaining time readout, program line, 64px ring, two stats (temp, humidity).

**States:** default with real numbers or "-".

**Sizing:** same padding as job. Time 40/600.

**Motion:** ring is a dashoffset, not an animation loop.

### 3.20 Instrument cluster

**Purpose:** Temps, fans, energy, speed, air as one instrument, not five twin cards.

**Anatomy:** one panel, hairline grid.

**States:** default.

**Sizing:** see 2.7. Cell padding 16 20.

**Motion:** none as a wrapper.

### 3.21 Temp cell (nozzle, bed, chamber)

**Purpose:** Actual / target °C.

**Anatomy:** kicker + readout + `/target°C` in muted.

**States:** null shows "-".

**Sizing:** kicker caption, readout 36.

**Motion:** number swap is instant (tabular).

### 3.22 Kicker

**Purpose:** Name a cell.

**Anatomy:** 12/500 `--muted`. No eyebrow pill.

**States:** default. Optional right slot for a unit.

**Motion:** none.

### 3.23 Fan cell

**Purpose:** Part, Aux, Heatbreak, Fan 2 speeds.

**Anatomy:** 28px blade icon + name + number.

**States:** blades 0–3. Hue `--ok` high, `--heat` mid, `--faint` off.

**Sizing:** auto-fit min 120px.

**Motion:** none. Do not spin blades (the job spinner already marks work).

### 3.24 Energy cell

**Purpose:** Live watts and job kWh.

**Anatomy:** kicker, readout, optional "n.nn kWh this job".

**States:** null watts show "-".

**Sizing:** readout 36. kWh 16 `--muted`.

**Motion:** none.

### 3.25 Speed cell

**Purpose:** Current magnitude and named mode.

**Anatomy:** readout + four-stop rail (Silent, Standard, Sport, Ludicrous). Active stop: fill `--ok`, label `--ink`. Others: track `--line`, label `--faint`.

**States:** level or magnitude match. Not a control (read-only product).

**Sizing:** rail 4 columns, gap 6, tick height 6, radius 999.

**Motion:** none.

### 3.26 Air cell

**Purpose:** Chamber airflow word, plus motion only when the air is doing something.

**Anatomy:** kicker, word (title 20), optional three streaks.

**States:** Cooling / Heating / Laser / "-". Streaks only for the first three.

**Sizing:** min-height 72 for the streak stage.

**Motion:** streaks 2.6s linear. Reduced: static 12px inset ticks.

### 3.27 Section title

**Purpose:** Filament, Health, Prints, By job.

**Anatomy:** title 20/600, 8px top, 8px bottom.

**States:** default.

**Motion:** none.

### 3.28 Filament tray

**Purpose:** AMS-A slots, humidity, grade, status, external spool.

**Anatomy:** head (title + meta) + 5 reel cells.

**States:** default.

**Sizing:** panel padding 16 20. Meta may scroll horizontally on small screens.

**Motion:** none.

### 3.29 Humidity grade

**Purpose:** A–E when the setting asks for it, or when the AMS is not percent-native.

**Anatomy:** five letters. Current letter is a 22px disc in the level color with `--on-ok`/`--on-accent` ink. Others are tinted letters, no disc.

**States:** current / rest. `aria-label` includes the letter.

**Sizing:** height 22, not a 44px control (not interactive).

**Motion:** none.

### 3.30 Humidity readout

**Purpose:** % RH and AMS °C.

**Anatomy:** droplet + `12% RH · 25°C`. Color follows A–D bands.

**States:** null shows "- RH".

**Sizing:** 13, nowrap.

**Motion:** none.

### 3.31 AMS status

**Purpose:** Off / Idle / slot (A1…) / Drying. One current word, not four competing pills.

**Anatomy:** four segments, current segment filled.

**States:** one `now` at a time. Slot fill uses the real filament color. Light ink when the fill is dark.

**Sizing:** height 28, padding 4 6, radius `--r-pill`.

**Motion:** none.

### 3.32 Reel

**Purpose:** Slot type, color, remain. Active reel is the one feeding.

**Anatomy:** type, SVG, remain %. External may be dashed "no RFID".

**States:**
- default: `--muted` type.
- active (`.on`): `--ink` type, slightly stronger disc.
- empty: "Empty", gray disc.
- hover: n/a (not a control).

**Sizing:** SVG max 72px.

**Motion:** none.

### 3.33 Health panel

**Purpose:** HMS links, print error, Wi-Fi, MQTT age, last pushall.

**Anatomy:** optional HMS list, then a compact pair list.

**States:**
- healthy: pairs only, print error "None".
- fault: HMS links first, `--alarm`.
- stale: MQTT age is just a number; the status chip already said "Link stale".

**Sizing:** pair 14, padding 8 0.

**Motion:** none.

### 3.34 HMS link

**Purpose:** Open the wiki for a real code.

**Anatomy:** mono code + message, `--alarm`.

**States:**
- default: underline none.
- hover: underline.
- focus-visible: accent ring.
- active: underline.
- disabled / loading / error: n/a.

**Sizing:** 14, min-height 44, padding 8 4, wrap.

**Motion:** none.

### 3.35 Prints gallery

**Purpose:** Finished jobs that have a still. Opens the dialog.

**Anatomy:** 28rem WebGL stage or fallback. Empty: body copy in the panel.

**Empty copy:** "No finished stills yet. A snapshot appears here when a job ends with a frame."

**States:** empty / loading (gooey, existing) / ready / error (boundary fallback).

**Sizing:** 28rem × 100%.

**Motion:** existing shader and drag. Reduced: still grid, no gooey motion.

### 3.36 Print dialog

**Purpose:** Inspect one finished still.

**Anatomy:** veil, 16:9 image, filename, Close, result · duration.

**States:**
- default open: focus on Close.
- hover Close: `--raised`.
- focus-visible Close: accent ring.
- active Close: scale 0.98.
- Escape and veil click close.
- disabled / loading / error: n/a.

**Sizing:** dialog `min(420px, 100%)`, radius `--r-md`. Close min-height 44, padding 0 14.

**Motion:** veil opacity 220ms. Reduced: instant.

### 3.37 Printer photos

**Purpose:** Optional operator photos from Settings/media.

**Anatomy:** 4-col frames, 2-col under 800px. Hidden when the list is empty.

**States:** default. Images `alt=""`.

**Sizing:** 16:9, radius `--r-sm`.

**Motion:** none.

### 3.38 Data table (Prints, Energy, Audit)

**Purpose:** Scan jobs or admin events.

**Anatomy:** wrap + table. Columns are the decision fields (file, result, when, time, % or kWh).

**States:**
- default: hairline rows.
- hover row: `--raised`.
- focus-visible on file link: accent ring.
- empty: panel copy, not a table.
- loading: n/a (SSR).
- error: n/a.

**Sizing:** cell padding 14 16, min row 48. Head micro `--faint`. Numbers mono tabular, right aligned. Horizontal scroll on the wrap, not the page.

**Motion:** hover 140ms.

**Result chip:** Finish `--ok`, Failed `--alarm`, others `--muted`. Text, no extra pill chrome.

### 3.39 Mini bar (Prints file column)

**Purpose:** Last percent on the list.

**Anatomy:** 3px track, `--ok` fill.

**States:** 0–100.

**Motion:** none.

### 3.40 Back link

**Purpose:** Return to Prints from a job.

**Anatomy:** "Prints", `--muted`, 13.

**States:** hover `--ink`, focus ring, min-height 44, inline-flex.

**Motion:** 140ms.

### 3.41 Telemetry spark

**Purpose:** Answer "how did nozzle, bed, and percent move on this job?"

**Anatomy:** SVG, three series. Legend row under the chart: Nozzle `--alarm`, Bed `--heat`, Progress `--ink`. Hidden if fewer than 2 points.

**States:** default. No tooltip in this pass (read-only spark).

**Sizing:** 200px tall, 100% wide.

**Motion:** none.

### 3.42 Timelapse frames

**Purpose:** Job media that is not the snapshot.

**Anatomy:** 16:9 image or video controls, caption time or "Timelapse".

**States:** default.

**Sizing:** same as printer photos.

**Motion:** none besides native video.

### 3.43 Energy hero

**Purpose:** Live watts (focal on Energy).

**Anatomy:** kicker "Live draw", hero-read, optional kWh so far, spark.

**States:** "-" when null.

**Sizing:** hero-read 44.

**Motion:** none.

### 3.44 Form label + input (admin + any future)

**Purpose:** Edit display and stream settings.

**Anatomy:** label stack, 12/500 `--muted` + control.

**States:**
- default: height 44, radius `--r-sm`, fill `--raised`, border `--line-strong`.
- hover: border `--ink` at 40%.
- focus-visible: accent ring, offset 1, border `--line-strong`.
- active: same as focus.
- disabled: `--faint`, cursor not-allowed, 0.55 opacity.
- loading: n/a (form submit uses native).
- error: page-level notice, not per-field chrome in this pass.
- textarea: min-height 96, padding 10 12.

**Sizing:** 44px inputs. Checkbox 18px inside a 44px row.

**Motion:** 140ms border.

Placeholder: honest ("https://stream.example/p2s/index.m3u8", "Leave blank to keep the saved password"). No fake names.

### 3.45 Button

**Purpose:** Sign in, save, sign out, try again, close.

**Anatomy:** label only. No trailing arrow.

**Kinds:** ghost (default), primary (paper fill in dark, ink fill in light).

**States:**
- default ghost: border `--line-strong`, fill `--surface`, ink text, height 44, radius `--r-sm`, padding 0 16, 14/500.
- default primary: fill `--ink`, color `--page`.
- hover ghost: `--raised`.
- hover primary: slightly brighter ink (dark: `#fff8ec`).
- focus-visible: accent ring.
- active: scale 0.98.
- disabled: 0.55, not-allowed.
- loading: disabled + label stays (no spinner unless a form is pending later).
- error: n/a.

**Sizing:** min 44×44.

**Motion:** 140ms. Active 100ms.

### 3.46 Notice (admin banners, error pages)

**Purpose:** Login failed, saved, not configured, camera warning, page error.

**Anatomy:** strong title + body. Roles: `alert` for errors, `status` for saved / warn.

**Kinds:** danger, warn, ok, plain.

**States:** visible / absent.

**Sizing:** padding 12 16, radius `--r-sm`, 14.

**Motion:** none.

### 3.47 Error page / global error / not-found

**Purpose:** Recover.

**Anatomy:** display title, body, "Try again" or "Back to dashboard".

**Copy:**
- Error: "Something went wrong" / "The page could not be shown. Try again."
- Not found: "Page not found" / "That route is not in PrintCast."

**States:** default.

**Sizing:** shell. Button 44.

**Motion:** none.

### 3.48 Admin login

**Purpose:** Authenticate.

**Anatomy:** centered panel, title "Sign in", helper, optional notices, username, password, primary "Sign in", "Back to dashboard".

**States:** configured / unconfigured (fields disabled + warn notice) / login error.

**Sizing:** `min(100%, 28rem)`.

**Motion:** none.

### 3.49 Admin settings

**Purpose:** Title, notes, stream, AMS flags, MediaMTX, audit.

**Anatomy:** same header language as the studio (not a second theme). Two panels: Display, Audit.

**States:** saved ok, form error, empty audit.

**Empty audit:** "No admin events yet."

**Motion:** none.

### 3.50 Focus ring (global)

**Purpose:** Keyboard.

**Anatomy:** `outline: 2px solid var(--accent); outline-offset: 2px` on `a`, `button`, `input`, `textarea`, `[tabindex="0"]`.

**Forbidden:** `outline: none` without a replacement.

### 3.51 Toasts

None. Do not add a toast stack. Admin notices and dialogs cover feedback.

---

## 4. Screen compositions

### Home

Focal: viewfinder. Order: mast, status, stage, cluster, filament, health, prints, optional photos.

### Prints

Focal: the file column. Title + table or empty.

### Print detail

Focal: job identity + spark. Back, job strip, estimate + spark, frames.

### Energy

Focal: live watts. Hero + by-job table.

### Settings

Focal: the form. Login or settings + audit.

---

## 5. Founder decisions

See the pull request. Implementation ships a default for each so the redesign is complete:

1. Header nav is on.
2. Dark is default. Paper theme is available.
3. Art gallery stays (existing still viewer).
4. Read-only product: speed rail and AMS are not controls.
5. Share-card colors stay on the existing tested tokens so link previews do not drift from tests in this pass.
