# ⬡ HOROLOGIUM DESIGN SYSTEM (v1.0.0-PRO)
**Codename:** `Calibre-01` | **Classification:** Enterprise Temporal, Telemetry & High-Precision Operations Architecture  
**Aesthetic Posture:** Swiss High-Horology (Patek / A. Lange & Söhne) × Braun Industrial Hardware (Dieter Rams) × Mission-Critical Telemetry

---

## 0. PRODUCT VISION, PHILOSOPHY & ANTI-SLOP MANIFESTO
Horologium is engineered for mission-critical enterprise software—global temporal synchronization engines, distributed system orchestrators, financial ledgers, and high-density analytical workbenches. 
- **The Mechanical Metaphor:** Every UI component is treated as a CNC-machined, jewel-bearing mechanical part. Surfaces do not "float" with blurry drop shadows; they interlock inside a `1px` exposed structural chassis.
- **Zero-Slop Mandate:** 
  - **BANNED FONTS:** `Inter`, `Roboto`, `Poppins`, `Montserrat`, `Open Sans`, `Plus Jakarta Sans`, `Space Grotesk`.
  - **BANNED COLORS:** `#000000` (Pure Black), `#FFFFFF` (Pure White), `#0F172A` (Tailwind Slate-900), `#6366F1` to `#8B5CF6` (Indigo-Purple AI Gradients).
  - **BANNED LAYOUTS:** Centered SaaS hero sandwiches, 3-equal-card feature rows with glowing top-left circular icons, nested card-in-card padding, and blurry neon outer glows (`blur-3xl`).

---

## 1. MODULE 01: TRI-TIER TYPOGRAPHY ARCHITECTURE ("THE GENEVA CALIBRE")

### 1.1 Font Stack & Hierarchy
1. **Primary (Display / H1–H3 / Architectural Headers):**
   - **Font:** `'Neue Haas Grotesk Display Pro'`, `'Switzer'`, or `'Uncut Sans'`
   - **Posture:** Weight `500 Medium` (Never clunky `700/800` bold at large scales). Tight apertures, razor-sharp horizontal terminals.
2. **Secondary (UI Chrome / Body / Long-Form Prose):**
   - **Font:** `'Suisse Int\'l'`, `'General Sans'`, or `'Instrument Sans'`
   - **Posture:** Weight `400 Regular` & `500 Medium`. Neutral, high x-height, zero decorative bloat.
3. **Tertiary (Horological Telemetry / Timestamps / UTC Offsets / Metrics / Badges):**
   - **Font:** `'Commit Mono'`, `'Berkeley Mono'`, or `'JetBrains Mono'`
   - **Posture:** Weight `400` & `500`. Strict `tabular-nums` (`tnum`) and `slashed-zero` (`zero`) locked globally.

### 1.2 Fluid Mathematical Type Scale & Tracking Inversion
| Token | CSS `clamp()` Size | Line-Height | Tracking (`letter-spacing`) | Assigned Tier & Usage |
| :--- | :--- | :--- | :--- | :--- |
| `--font-micro` | `0.6875rem` (`11px`) | `1.2` | `+0.07em` (Uppercase) | **Tertiary Mono:** Axis labels, keycaps, UTC zone codes |
| `--font-xs` | `0.75rem` (`12px`) | `1.35` | `+0.01em` | **Tertiary Mono:** Table cells, timestamps, log streams |
| `--font-sm` | `0.8125rem` (`13px`) | `1.4` | `-0.005em` | **Secondary Sans:** Default Pro-App UI controls, buttons, inputs |
| `--font-base` | `0.9375rem` (`15px`) | `1.55` | `-0.01em` | **Secondary Sans:** Inspector documentation, prose (`60ch–68ch`) |
| `--font-lg` | `clamp(1.125rem, 1rem + 0.3vw, 1.25rem)` | `1.35` | `-0.015em` | **Primary Display:** Panel titles, modal headers |
| `--font-xl` | `clamp(1.5rem, 1.3rem + 0.8vw, 2rem)` | `1.12` | `-0.025em` | **Primary Display:** Section headers (`500` weight) |
| `--font-display`| `clamp(2.25rem, 1.8rem + 2.2vw, 3.75rem)`| `1.02` | `-0.035em` | **Primary Display:** Architectural mastheads (`500` weight) |

### 1.3 Dark-Mode Halation Compensation
In Dark Mode (`[data-theme="obsidian"]`), apply `-webkit-font-smoothing: antialiased;` and reduce variable font grade (`font-variation-settings: "GRAD" -25`) so white-on-dark glyphs never bleed or thicken.

---

## 2. MODULE 02: 4-TIER CHROMATIC & SURFACE SYSTEM

Horologium operates in two calibrated physical finishes:
- **Default Dark (`Obsidian Rhodium`):** Anodized titanium dial, tungsten bridges, safety-vermilion escapement hands, and Super-LumiNova telemetry.
- **Daylight High-Craft (`Silvered Dial`):** Bead-blasted silver-oxide dial plate, blued-steel hands, and deep ink markings.

### 2.1 Complete 4-Tier Color Token Matrix
| Token Name | Dark (`Obsidian Rhodium`) | Light (`Silvered Dial`) | Architectural Role (60 / 25 / 10 / 5 Rule) |
| :--- | :--- | :--- | :--- |
| **TIER 1: PRIMARY CANVAS (60%)** | | | |
| `--bg-0` (App Chassis / Recessed) | `#08090B` | `#EAECEF` | Outer frame, recessed input wells, timeline gutters |
| `--bg-1` (Primary Workspace Sheet)| `#0E1014` | `#F5F6F8` | Main elevated stage, primary data grid surface |
| `--bg-2` (Elevated Card / Panel) | `#14171D` | `#FFFFFF` | Bento cells, inspector drawers, active rows |
| `--bg-3` (Floating HUD / Modal) | `#1B1F27` | `#FFFFFF` | Command palette (`Cmd+K`), popovers, menus |
| **TIER 2: SECONDARY INK & STRUCTURE (25%)** | | | |
| `--fg-0` (Primary Ink - 100%) | `#EDEFF2` | `#0D1017` | Primary values, headings, active labels (`APCA Lc 90+`) |
| `--fg-1` (Secondary Ink - 65%) | `#8E95A2` | `#525A68` | Column headers, field labels, icons (`APCA Lc 60+`) |
| `--fg-2` (Muted Telemetry - 40%) | `#5A6270` | `#848D9C` | Inactive ticks, disabled states, line numbers (`APCA Lc 35`) |
| `--border-hairline` | `rgba(237, 239, 242, 0.07)` | `rgba(13, 16, 23, 0.08)` | Exposed `1px` structural grid skeleton |
| `--border-interactive` | `rgba(237, 239, 242, 0.15)` | `rgba(13, 16, 23, 0.16)` | Input borders, button frames, active dividers |
| `--border-specular` | `rgba(255, 255, 255, 0.09)` | `rgba(255, 255, 255, 0.65)` | Top `1px` inset edge highlight on elevated surfaces |
| **TIER 3: TERTIARY FOCAL ACTION (10%)** | | | |
| `--accent-primary` | `#FF4400` (Chronograph Vermilion) | `#0038CC` (Blued Steel Cobalt) | Primary CTA buttons, live "Now" laser cursor, active bar |
| `--accent-hover` | `#FF5E24` | `#002999` | Hover state (`+5%` OKLCH lightness shift) |
| `--accent-ink` | `#08090B` | `#FFFFFF` | Text/Icon ink placed directly on `--accent-primary` |
| **TIER 4: FOURTH COUNTER & SEMANTICS (5%)** | | | |
| `--accent-counter` | `#00E5B8` (Super-LumiNova) | `#D9381E` (Ruby Jewel Bearing) | Secondary data series, anomaly markers, active node links |
| `--semantic-success` | `#22C55E` | `#0D9488` | Sync locked, zero drift, optimal SLA |
| `--semantic-warning` | `#F59E0B` | `#D97706` | Clock skew detected, DST transition pending |
| `--semantic-danger` | `#F43F5E` | `#E11D48` | Node desync, pipeline failure, destructive trigger |

### 2.2 Semantic Pill Tinting Formula
Never render solid neon badges. Every status badge uses:
- `background: color-mix(in oklch, var(--semantic-color) 11%, transparent)`
- `border: 1px solid color-mix(in oklch, var(--semantic-color) 24%, transparent)`
- `color: var(--semantic-color)`

---

## 3. MODULE 03: SPATIAL GRIDS, LAYOUTS & NEGATIVE SPACE ENGINEERING

### 3.1 The 3 Core Horologium Layout Archetypes
1. **Workbench Mode (Zero-Scroll `100dvh` Recessed Hardware Well):**
   - Outer App Shell sits on `--bg-0`.
   - Left Icon Rail (`48px`) + Context Sidebar (`220px`) sit flush on `--bg-0`.
   - Main Stage (`1fr`) + Right Inspector (`340px`) sit inside an **inset sheet** (`margin: 6px 6px 6px 0; border-radius: 10px; background: var(--bg-1); border: 1px solid var(--border-hairline); overflow: hidden;`).
   - Bottom Telemetry Ribbon (`24px` tall, `--bg-0`) spans `100vw` displaying live UTC clock (`tnum`), system latency (`12ms`), active environment, and keyboard shortcut hints.
2. **Matrix Mode (`1px` Exposed Hairline Grid):**
   - Container uses `display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 1px; background-color: var(--border-hairline); border: 1px solid var(--border-hairline);`.
   - Every child cell sets `background-color: var(--bg-1); padding: 22px 24px 26px 24px;` (Optical bottom-padding compensation: `bottom = top + 4px`).
   - Zero double-borders (`1px + 1px = 2px` is strictly prevented).
3. **Temporal Scrubber Mode (24-Hour Gantt / Meridian Ribbon):**
   - Sticky left entity column (`220px`) + `24` fractional UTC hour columns (`repeat(24, minmax(44px, 1fr))`).
   - Off-duty / inactive hours use a subtle geometric hatch (`repeating-linear-gradient(-45deg, transparent, transparent 4px, var(--border-hairline) 4px, var(--border-hairline) 5px)`).
   - A continuous `1px solid var(--accent-primary)` vertical laser line marks the exact sub-second UTC current time across all rows, crowned by a `5px` inverted triangle playhead in the ruler header.

### 3.2 Law of Concentric Radii ($R_{\text{outer}} = R_{\text{inner}} + \text{Padding}$)
- App Inset Sheet: `10px` radius.
- Modal / Command Palette Shell: `12px` outer radius (`6px` internal padding $\rightarrow$ `6px` inner row radius).
- Standard Controls (Buttons / Inputs): `6px` radius.
- Micro-Badges / Keycaps (`<kbd>`): `4px` radius.
- Exposed Matrix Cells: `0px` radius.

---

## 4. MODULE 04: TACTILE UI COMPONENT BLUEPRINTS & TOKENS

### 4.1 Control Height Cadence
- `--ctrl-xs`: `22px` (Inline telemetry pills, `<kbd>` caps, table row action chips)
- `--ctrl-sm`: `28px` (Toolbar controls, scrubbable numeric boxes, segmented tabs)
- `--ctrl-md`: `32px` (Default desktop button and input height on `@media (pointer: fine)`)
- `--ctrl-lg`: `40px` (Primary auth inputs / marketing CTAs; `44px` enforced on `@media (pointer: coarse)`)

### 4.2 Signature Component Specifications
1. **Machined Primary Button:**
   - Height `32px`, padding `0 12px`, radius `6px`, font `13px` Medium (`--accent-ink`).
   - Background: `linear-gradient(180deg, color-mix(in oklch, var(--accent-primary), white 8%) 0%, var(--accent-primary) 100%)`.
   - Shadow: `inset 0 1px 0 0 rgba(255,255,255,0.25), inset 0 -1px 0 0 rgba(0,0,0,0.3), 0 1px 2px 0 rgba(0,0,0,0.2)`.
   - Zero-CLS Loading Lock: Uses `display: inline-grid; grid-template-areas: "stack";` so swapping label visibility for the spinner never alters button width by a single pixel.
2. **Obsidian Ghost / Secondary Button:**
   - Background `var(--bg-2)`, border `1px solid var(--border-interactive)`, top inner specular lip `inset 0 1px 0 0 var(--border-specular)`.
3. **Recessed Instrument Input (With Monospace Prefix Slot):**
   - Height `32px`, radius `6px`, background `var(--bg-0)`, border `1px solid var(--border-interactive)`, shadow `inset 0 1.5px 3px rgba(0,0,0,0.18)`.
   - Left slot (`background: var(--bg-2); border-right: 1px solid var(--border-hairline); padding: 0 8px; font: 11px var(--font-mono); color: var(--fg-1);`) houses fixed units (`UTC`, `ms`, `https://`, `CRON`).
4. **Segmented Vernier Capacity Meter:**
   - Replaces rounded progress bars. `display: grid; grid-template-columns: repeat(24, 1fr); gap: 2px; height: 10px;`. Filled ticks render in `--accent-counter` (`1–18`), `--semantic-warning` (`19–21`), and `--semantic-danger` (`22–24`).
5. **Subpixel Data Grid & Hover Quick-Action Rail:**
   - Header height `30px` (`11px` Mono uppercase, `+0.06em` tracking, `--fg-1`). Row height `34px`.
   - Numeric columns right-aligned with `tabular-nums`.
   - Row actions (`Copy`, `Inspect`, `Pin`) remain hidden until `tr:hover` or `tr:focus-within`, appearing inside a `26px`-tall floating pill anchored at `right: 12px`.
6. **Horological Ruler Header (Tick-Mark Scale):**
   - Every timeline, chart, or split-pane header features a `16px`-tall procedural SVG tick ruler (`1px` vertical ticks every `10px` at `4px` height; major ticks every `50px` at `8px` height with `10px` Mono numerals).

---

## 5. MODULE 05: FRONTEND KINEMATICS, INTERACTION LAWS & PHYSICS

1. **Critically Damped Motion Tokens (Zero Bounce Slop):**
   - `--ease-snappy: cubic-bezier(0.2, 0, 0, 1)` (`120ms` for micro-states; `80ms` exit).
   - `--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)` (`220ms` for drawers, sheets, and `Cmd+K` modals; `130ms` exit).
   - **Never use `transition: all`.** Explicitly declare `transition-property: background-color, border-color, color, opacity, transform;`.
2. **`pointerdown` vs. `click` Execution Split:**
   - Navigation tabs, sidebar switches, segmented controls, and `Cmd+K` triggers execute on **`onPointerDown`** (shaving `~100ms` of release latency).
   - Network mutations and destructive actions execute on **`onClick`** (`pointerup`).
3. **Doherty Threshold Latency Gate:**
   - `0ms–120ms`: Render nothing (no spinner flash).
   - `120ms–400ms`: Inline width-locked button spinner.
   - `>400ms`: Exact-geometry structural skeleton with a `110deg` subtle luminescence wave.
4. **9-State Component Completeness:**
   - Every view and component must explicitly support: `Idle`, `Hover` (gated by `@media (hover: hover) and (pointer: fine)`), `Focus-Visible`, `Active`, `Loading`, `Disabled`, `Empty` (1px schematic wireframe SVG + single CTA), `Overflow` (`min-width: 0; text-overflow: ellipsis;` tested against 120-char hashes), and `Error`.

---

## 6. MODULE 06: COGNITIVE PSYCHOLOGY, BEHAVIORAL ERGONOMICS & A11Y

1. **3-Level Contrast Budget (APCA Calibrated):**
   - User Data / Primary Signal: `100%` contrast (`--fg-0`, APCA `Lc 90+`).
   - UI Chrome / Labels / Icons: `60%` contrast (`--fg-1`, APCA `Lc 60+`).
   - Structural Hairlines / Ticks: `8%–15%` contrast (`--border-hairline`, APCA `Lc 15–20`).
2. **Reward Early, Punish Late Form Validation:**
   - Never show red validation errors while the user is typing for the first time (`validate onBlur`). Once an error is active, clear it in `0ms` the instant the input becomes valid (`validate onChange`).
3. **Tiered Destructive Safeguards (Zero Confirmation-Modal Blindness):**
   - **Reversible Actions:** Execute in `0ms` Optimistic UI + show `5000ms` stacked bottom toast with `<kbd>Z</kbd> Undo`.
   - **High-Impact Actions:** Require a **`1.2s` Press-and-Hold** button where a linear vermilion fill sweeps across the button background before firing.
   - **Catastrophic Actions:** Require typing the exact resource identifier in a monospace input.
4. **Dual-Channel Signaling & Keyboard Parity:**
   - Every semantic state pairs Color + Shape/Icon (`●` Locked, `▲` Skew, `■` Halted) + Monospace Code (`[SYNC]`, `[WARN]`, `[ERR]`).
   - Global `:focus-visible` double-ring (`0 0 0 2px var(--bg-0), 0 0 0 4px var(--accent-primary)`).
   - Full `prefers-reduced-motion: reduce` safety override.

---

## 7. MODULE 07: SURFACE MICRO-PHYSICS, VECTOR PRECISION & PERFORMANCE INFRASTRUCTURE

1. **Sub-Perceptual Tactile Surface Grain (`1.8%` Monochromatic SVG Noise):**
   - Flat digital hex colors look like dead plastic. Horologium overlays a fixed, pointer-through SVG `<feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/>` surface texture at `opacity: 0.018` across `--bg-0` and `--bg-1` to replicate bead-blasted anodized titanium and cotton archival paper.
2. **Vector & Icon Engineering (`1.5px` Non-Scaling Stroke):**
   - All icons lock to a `16px × 16px` grid (`viewBox="0 0 16 16"`), `stroke-width: 1.5px`, `stroke-linecap: square` (or crisp `round`), and `vector-effect: non-scaling-stroke`.
   - All chart sparklines, node connectors, and schematic empty states use `1px` crisp geometry (`shape-rendering: geometricPrecision`).
3. **user-select & Clipboard Hygiene:**
   - `user-select: none` on all buttons, navbars, table headers, badges, and icons.
   - `user-select: all` on cryptographic hashes, API keys, ISO-8601 timestamps, and node IDs so a single click highlights the entire token.
