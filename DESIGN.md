---
name: qEvent
description: Instant Event Ticketing & Anti-Fraud Gate Check-In Design System (Ant Design-derived, compact)
colors:
  primary: "#0958D9"
  primary-foreground: "#FFFFFF"
  primary-light: "#E6F4FF"
  surface: "#FFFFFF"
  neutral-bg: "#F5F5F5"
  table-header: "#FAFAFA"
  text-primary: "#1F1F1F"
  text-secondary: "#595959"
  border: "#D9D9D9"
  border-subtle: "#F0F0F0"
  success: "#237804"
  warning: "#AD6800"
  error: "#CF1322"
  overlay: "rgba(0, 0, 0, 0.45)"
typography:
  display:
    fontFamily: "System, Roboto, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.4
  headline:
    fontFamily: "System, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.4
  title:
    fontFamily: "System, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.5715
  body:
    fontFamily: "System, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5715
  label:
    fontFamily: "System, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  control: "6px"
  card: "8px"
  tag: "4px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.control}"
    height: "32px"
    padding: "0 16px"
  button-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.control}"
    height: "32px"
  card:
    backgroundColor: "{colors.surface}"
    border: "1px solid {colors.border-subtle}"
    rounded: "{rounded.card}"
    padding: "16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.control}"
    height: "32px"
    padding: "0 10px"
  badge:
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.primary}"
    rounded: "{rounded.tag}"
    height: "20px"
    padding: "0 6px"
---

# Design System: qEvent

## Scope

- **Web staff console (`web/`) is the only UI in this repository.** It is shadcn/ui (Radix + Tailwind 4)
  restyled as an **Ant Design–derived compact console**: 1px neutral borders, 6px control radius,
  32px controls, dense tables, information-first layout.
- `web/src/styles/globals.css` is the single source of truth for tokens. This document explains the
  rules behind them; if the two disagree, the CSS wins and this file is a bug.
- A native mobile app is planned but not implemented here. Mobile-only rules (haptics, screen-capture,
  48dp targets) are listed under "Mobile (planned)" and must not be applied to the web console.

## Overview

**Creative North Star: "The High-Throughput Beacon"**

qEvent runs at noisy venue gates, dim auditoriums and crowded queues. The console must be readable at a
glance and dense without becoming noisy: staff scan, reconcile and check queues in seconds. The visual
language is therefore **utilitarian, bordered and compact** — borders define structure, colour is
reserved for state, and every screen shows more rows per viewport than a marketing-style admin theme.

**Key Characteristics:**

- **Bordered structure, not shadow soup.** Separation comes from 1px `#D9D9D9` controls, `#F0F0F0`
  card dividers and the `#F5F5F5` canvas. Shadows are tertiary and downward only.
- **Compact density.** 32px controls, 40px table rows, 14px body, 16px page rhythm.
- **High-visibility status hierarchy.** Colour is semantic only: blue = action/selection, green =
  valid, amber = warning/duplicate/offline, red = invalid/cancelled.
- **AA contrast, no pale greys.** Primary text `#1F1F1F`, secondary `#595959` (7:1 and 6:1 on white).
  Placeholders may be faint, real copy may not.
- **No blur, no dark mode.** Flat scrims, no glassmorphism, light theme only.

## Colors

### Primary

- **Console Blue** (`#0958D9`): primary action, links, active tab underline, selected menu item text,
  focus halo. Ant Design's `#1677FF` is *not* used for filled controls because white 14px text on it is
  4.1:1 (below AA); `#0958D9` keeps 6.3:1.
- **Selection Container** (`#E6F4FF`): selected table row, checked select item, active sidebar item,
  info badge background.

### Neutral

- **Canvas** (`#F5F5F5`): app background.
- **Surface** (`#FFFFFF`): cards, table body, header, sidebar, dropdowns.
- **Table Header** (`#FAFAFA`): table head and hover row fill.
- **Text Primary** (`#1F1F1F`): headings, values, table cells.
- **Text Secondary** (`#595959`): descriptions, metadata, helper text, table captions.
- **Border** (`#D9D9D9`): inputs, selects, buttons, table row separators.
- **Border Subtle** (`#F0F0F0`): card outline, dividers inside cards, table header rule.
- **Muted Fill** (`#FAFAFA`): hover states, secondary buttons, tag background.

### Functional / Semantic

- **Valid Green** (`#237804` on `#F6FFED` 10% tint): successful scan, confirmed order, paid ticket.
- **Warning Amber** (`#AD6800` on tint): duplicate scan, offline queue, pending reconciliation.
- **Error Red** (`#CF1322` on tint): fraudulent ticket, cancelled, failed payment.

### Named Rules

**The Primitive Border Rule.** Borders are allowed and expected — but only in `src/components/ui/**`
and the token layer. Feature code never writes `border`, hex colours or raw Tailwind palettes; it uses
the primitives and semantic tokens. `bun run lint:design` enforces this.

**The High-Contrast Legibility Rule.** Never use pale grey text (`#94A3B8`, `#CBD5E1`, `#9CA3AF`) for any
label, cell or action. Body copy must stay ≥4.5:1 on its surface.

**The Semantic Monosemy Rule.** Green, amber and red are exclusively state colours. Blue is the only
action/accent colour; never tint a non-interactive surface for decoration.

**The Standalone Icon Rule.** Icon-only buttons are borderless and transparent until hover/focus; the
icon itself carries the colour, never a coloured container.

## Typography

**Family:** system sans (Roboto / Segoe UI / SF). **Mono:** ticket codes and order ids only.

### Hierarchy

| Token | Size / weight | Use |
|---|---|---|
| `text-display` | 20 / 600 | Page title, KPI number |
| `text-headline` | 16 / 600 | Card title, section header |
| `text-title` | 14 / 600 | Table header, emphasised value, dialog title |
| body | 14 / 400, line-height 1.5715 | Everything else |
| `text-label` | 12 / 500 | Badges, captions, helper text, column labels |

**Rules:** no font weights below 400; no sizes between the five steps; numbers in tables, stat cards and
money use `tabular-nums`.

## Layout

Web console breakpoints (`AppShell`):

| Breakpoint | Navigation | Content |
|---|---|---|
| ≥1280px | sidebar 200px, always open | max-width 1440px, 24px horizontal padding |
| 768–1279px | rail 64px (icons + tooltip) | full width, 20px padding |
| <768px | bottom bar (≤5 items) | 16px padding; tables scroll horizontally in their own container |

- Header bar: 48px tall, white surface, `shadow-subtle`, holds the sidebar trigger, event selector and
  account menu.
- Page rhythm: 16px between cards, 24px between sections, 32px between feature groups.
- **Density is the feature:** prefer one more row over one more decorative gap.

## Elevation & Depth

Ant Design elevation, downward only:

- **Subtle / Card** — `0 1px 2px rgba(0,0,0,.03), 0 1px 6px -1px rgba(0,0,0,.02), 0 2px 4px rgba(0,0,0,.02)`.
  Header bar, cards, default buttons.
- **Float** — `0 6px 16px rgba(0,0,0,.08), 0 3px 6px -4px rgba(0,0,0,.12), 0 9px 28px 8px rgba(0,0,0,.05)`.
  Dropdowns, selects, dialogs, sheets.

**Rules:** no `blur` / `backdrop-filter`; scrims are flat `rgba(0,0,0,.45)`; no negative-Y or omni glow.

## Shapes

- **Control radius 6px** (`--radius`): buttons, inputs, selects, dropdown items use 4px.
- **Card radius 8px** (`--radius-card`): cards, dialogs, popovers, dropdown panels.
- **Tag radius 4px**: badges and status tags.
- **Pills** (`9999px`): avatars and status dots only.
- **No exception:** every control has exactly one of the radii above — no per-screen overrides.

## Components

### Buttons

- Height 32px (small 24, large 40); radius 6px; 14px normal weight; icon 16px.
- **Primary:** `#0958D9` fill, white text, no border.
- **Default / secondary:** white fill, `1px #D9D9D9`, `#1F1F1F` text; hover turns border and text blue.
- **Text (ghost):** transparent, hover `#FAFAFA`; **danger:** `#CF1322` fill.
- Disabled: 50% opacity, no pointer events. Focus: 2px blue halo, never an outline.

### Cards

- White surface, `1px #F0F0F0`, radius 8px, 16px internal padding, `shadow-card`, no nested cards.

### Inputs / Selects

- Height 32px, radius 6px, white background, `1px #D9D9D9`; hover border `#0958D9` at 60%.
- Focus: 2px `rgba(9,88,217,.2)` halo. Placeholder is the only faint text allowed (`foreground/30`).
- Labels sit 6px above the field at 12/500; errors replace helper text and set the border red.

### Tables

- Header `#FAFAFA`, 36px tall, 14/600 text, `1px #F0F0F0` bottom rule.
- Rows 40px, `1px #F0F0F0` separators, hover `#FAFAFA`, selected `#E6F4FF`.
- Text left, numbers/money right and tabular, status in its own badge column.

### Tabs

- Ant Design line style: transparent list with a 1px bottom rule, 32px tall; active tab 2px blue underline
  and blue 14/500 text. No pill background.

### Badges / Tags

- 20px tall, 4px radius, 12/500, tinted background + matching darker text (`bg-*/10` + semantic colour).
- Status is a badge, never bare coloured text.

### Sidebar & Header

- White surfaces; sidebar item 32px, 4px radius, hover `#FAFAFA`, active `#E6F4FF` with blue text.
- Header 48px with the event selector at 32px and the account menu collapsed to an avatar.

### Overlays

- Dialogs: white, radius 8px, `shadow-float`, max-width 560px, focus trap, `Esc` closes, focus returns.
- Dropdown/select panels: radius 8px, `1px #F0F0F0`, `shadow-float`, 32px items.

## Mobile (planned)

Not implemented in this repository. When built with Expo, keep: light theme, semantic colours, no blur,
`expo-screen-capture` on the dynamic QR screen, haptic + audio feedback for scan results, ≥48dp targets,
and primary gate actions in the lower two-thirds of the viewport. The bordered compact rules above are
web-only; mobile keeps surface-contrast separation and downward elevation.

## Do's and Don'ts

### Do

- **Do** put borders in primitives and tokens; keep feature code on semantic classes only.
- **Do** show more data per screen: 40px rows, 32px controls, 16px page gaps.
- **Do** keep status colour semantic and always pair it with a label.
- **Do** keep ≥4.5:1 contrast for every real text string, including table metadata.
- **Do** keep the scan/check-in primary action ≥44px tall even though the console default is 32px.

### Don't

- **Don't** hard-code hex, raw Tailwind palettes (`blue-600`, `emerald-500`) or `border-*` in feature code.
- **Don't** use pale grey text, low-contrast placeholders in labels, or colour as decoration.
- **Don't** add blur, glassmorphism, gradients or dark mode.
- **Don't** use pill radii for tags or 12–16px radii on controls — they are no longer the house style.
- **Don't** add a second design language (e.g. default Ant Design components next to the shadcn ones).
