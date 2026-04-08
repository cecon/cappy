# ADR-0001: Design System — The Intelligent Monolith

- **Status:** Accepted
- **Date:** 2026-04-08
- **Authors:** @cecon

## Context

Cappy needs a cohesive visual identity that differentiates it from generic chat UIs and aligns with the developer-tool aesthetic. Without a formal design system, components will diverge in color usage, spacing, typography, and elevation — leading to inconsistency and slower iteration.

## Decision

Adopt the **"Digital Curator"** design system as the single source of truth for all Cappy UI surfaces (webview, extension panels, marketing).

## Consequences

- All new UI components **must** follow the token palette, typography rules, and elevation guidelines defined below.
- Deviations require a follow-up ADR explaining the rationale.
- The token table serves as the contract between design and implementation; changes to tokens require updating this ADR.

---

## 1. Overview & Creative North Star

The Creative North Star for this design system is **"The Digital Curator."**

This is not a generic chat interface; it is a high-performance environment for technical decision-making. Unlike consumer-grade apps that rely on heavy borders and bright primary colors, "The Digital Curator" leverages **low-saturation depth** and **tonal layering** to create an interface that feels like an extension of the developer's OS.

We break the "template" look by eschewing standard grids in favor of an asymmetric, editorial flow. Information density is managed through varying levels of surface luminescence rather than structural lines, allowing the user's code and logic to remain the focal point. The aesthetic is "Pro-Inertia"—it feels stable, heavy, and authoritative.

---

## 2. Colors: Tonal Architecture

The palette is built on a foundation of deep charcoals and desaturated blues to reduce eye strain during long sessions.

### The "No-Line" Rule

**Explicit Instruction:** Do not use 1px solid borders to define main sections (Sidebar, Chat Window, Inspector). Instead, boundaries must be defined by shifts in background tokens.

- A `surface-container-low` (#0F131B) code block should sit directly on a `surface` (#0B0E14) background.
- The contrast between these two tones is the boundary. This creates a "seamless" feel that mimics high-end IDEs like Cursor.

### Surface Hierarchy & Nesting

Treat the UI as physical layers. Each "inner" step of the hierarchy should use a progressively higher or lower tier:

1. **The Base:** `surface` (#0B0E14) — The canvas.
2. **The Context:** `surface-container` (#151A23) — Used for the main chat stream background.
3. **The Focus:** `surface-container-highest` (#202632) — Used for active input fields or focused tool logs.

### The "Glass & Gradient" Rule

To add "soul," use `surface-tint` (#ABC7FF) at 5% opacity combined with a `backdrop-blur` (12px-20px) for floating overlays (like command palettes or hover tooltips). For primary CTAs, use a subtle linear gradient from `primary` (#ABC7FF) to `primary_container` (#0368D2) at a 135-degree angle to provide a metallic, premium sheen.

### Token Reference

| Token                        | Hex       | Usage                                      |
|------------------------------|-----------|---------------------------------------------|
| `surface`                    | #0B0E14   | Base canvas                                 |
| `surface-dim`                | #0B0E14   | Dimmed areas                                |
| `surface-container-lowest`   | #000000   | Recessed nested elements                    |
| `surface-container-low`      | #0F131B   | Secondary containers, code blocks           |
| `surface-container`          | #151A23   | Main chat stream background                 |
| `surface-container-high`     | #1A202A   | Tool logs, elevated sections                |
| `surface-container-highest`  | #202632   | Active input fields, focused elements       |
| `surface-bright`             | #262C39   | Bright surface variant                      |
| `surface-variant`            | #202632   | Input field backgrounds (60% opacity)       |
| `surface-tint`               | #ABC7FF   | Glass overlays (5% opacity + blur)          |
| `background`                 | #0B0E14   | Page background                             |
| `on-surface`                 | #DFE5F6   | Primary text color                          |
| `on-surface-variant`         | #A5ABBB   | Secondary/muted text                        |
| `on-background`              | #DFE5F6   | Text on background                          |
| `primary`                    | #ABC7FF   | Primary accent                              |
| `primary-dim`                | #629DFF   | Inline code links                           |
| `primary-container`          | #0368D2   | CTA gradient endpoint                       |
| `primary-fixed`              | #4C92FE   | "Complete" status chips                     |
| `primary-fixed-dim`          | #3B85F0   | Dimmed primary fixed                        |
| `on-primary`                 | #003E83   | Text on primary                             |
| `on-primary-container`       | #FFFFFF   | Text on primary container                   |
| `secondary`                  | #CDBDFF   | Secondary accent                            |
| `secondary-dim`              | #7E51FF   | Dimmed secondary                            |
| `secondary-container`        | #4300B2   | "Processing" status chips (20% opacity)     |
| `on-secondary`               | #4800BF   | Text on secondary                           |
| `on-secondary-container`     | #C6B5FF   | Text on secondary container                 |
| `tertiary`                   | #F4F6FF   | Tertiary accent                             |
| `error`                      | #FA746F   | Error state                                 |
| `error-container`            | #871F21   | Error container                             |
| `on-error`                   | #490006   | Text on error                               |
| `on-error-container`         | #FF9993   | Text on error container                     |
| `outline`                    | #6F7584   | Outlines                                    |
| `outline-variant`            | #424856   | Ghost borders (20% opacity)                 |
| `inverse-surface`            | #F9F9FF   | Inverse surface                             |
| `inverse-on-surface`         | #52555C   | Text on inverse surface                     |
| `inverse-primary`            | #005DBD   | Inverse primary                             |

---

## 3. Typography: Editorial Logic

We utilize a dual-font strategy to separate **Interface** from **Intellect**.

- **UI & Navigation (Inter):** Clean, neo-grotesque. Used for all labels, headings, and system messages.
- **Data & Logic (JetBrains Mono / Fira Code):** Used for code snippets, tool outputs, and variable names.

### Hierarchy & Brand Voice

- **Headline-LG (2rem):** Used sparingly for workspace titles. It should feel authoritative.
- **Label-SM (0.6875rem):** Used for "System Tags" (e.g., TOOL, SYSTEM, ASSISTANT). These should always be uppercase with 0.05em letter spacing to mimic architectural blueprints.
- **Body-MD (0.875rem):** The workhorse for chat messages. Line height should be generous (1.6) to ensure long technical explanations remain readable.

---

## 4. Elevation & Depth

In this system, depth is a function of light, not lines.

- **The Layering Principle:** Place `surface-container-lowest` (#000000) cards on a `surface-container-low` (#0F131B) section. This "recessed" look is ideal for secondary tool logs or terminal outputs, making them feel nested within the application.
- **Ambient Shadows:** For floating elements (Modals, Popovers), use a shadow color derived from `on-surface` (#DFE5F6) at 6% opacity. Set blur to 40px and spread to -10px. This creates a soft glow rather than a harsh drop shadow, simulating light passing through glass.
- **The "Ghost Border" Fallback:** If accessibility requires a stroke, use `outline-variant` (#424856) at 20% opacity. It should be felt, not seen.

---

## 5. Components: Technical Precision

### The Chat Stream

- **User Messages:** Use a subtle background of `primary_container` (#0368D2) at 15% opacity with `rounded-md` (12px). Position them with intentional asymmetry—slightly narrower than the assistant's response.
- **Assistant Responses:** Transparent background. Use `markdown` styling with `title-sm` for headers. No borders.
- **Tool Execution Logs:** Compact, high-density blocks using `surface-container-high` (#1A202A). Use Monospace font at `body-sm`. Forbid dividers; use 12px vertical spacing to separate logs.

### Buttons & Chips

- **Primary Button:** Gradient fill (`primary` to `primary_container`). `rounded-DEFAULT` (8px). Text in `on_primary_container` (#FFFFFF).
- **Status Chips:** Use `secondary_container` (#4300B2) for "Processing" and `primary_fixed` (#4C92FE) for "Complete." Keep backgrounds low-opacity (20%) to maintain the "Pro" feel.

### Input Fields (The Command Bar)

- **The "Glass Box":** The main input should use a `backdrop-blur` and a `surface-variant` (#202632) at 60% opacity.
- **States:** On focus, transition the "Ghost Border" from 20% to 50% opacity using `primary`. Do not change the background color.

---

## 6. Do's and Don'ts

### Do

- **Do** use vertical white space (16px, 24px, 32px) to separate logical groups.
- **Do** use `primary_dim` (#629DFF) for inline code links to ensure they pop against the dark backgrounds.
- **Do** apply `rounded-md` (12px) to large containers and `rounded-sm` (4px) to small chips for a sophisticated, varied radius scale.

### Don't

- **Don't** use pure white (#FFFFFF) for text. Always use `on_surface` (#DFE5F6) to avoid high-contrast "vibration" on dark backgrounds.
- **Don't** use 100% opaque borders. This kills the "Digital Curator" aesthetic and makes the UI look like a legacy bootstrap site.
- **Don't** use shadows on nested elements. Shadows are reserved strictly for elements that physically "float" above the base UI (e.g., dropdowns).
