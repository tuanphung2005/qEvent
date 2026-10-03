---
name: qCheck
description: Instant Event Ticketing & Anti-Fraud Gate Check-In Design System
colors:
  primary: "#2563EB"
  primary-hover: "#1D4ED8"
  primary-light: "#EFF6FF"
  surface: "#FFFFFF"
  neutral-bg: "#F8FAFC"
  text-primary: "#0F172A"
  text-secondary: "#334155"
  text-muted: "#475569"
  neutral-fill: "#F1F5F9"
  success: "#10B981"
  success-light: "#ECFDF5"
  warning: "#D97706"
  warning-light: "#FFFBEB"
  error: "#DC2626"
  error-light: "#FEF2F2"
  overlay: "rgba(15, 23, 42, 0.45)"
typography:
  display:
    fontFamily: "System, Roboto, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.5px"
  headline:
    fontFamily: "System, Roboto, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.3
  title:
    fontFamily: "System, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "System, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "System, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.2px"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  "2xl": "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-secondary:
    backgroundColor: "{colors.neutral-fill}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "16px"
  input:
    backgroundColor: "{colors.neutral-fill}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  badge:
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
---

# Design System: qCheck

## Overview

**Creative North Star: "The High-Throughput Beacon"**

qCheck is an operational mobile tool built for intense, high-stakes physical environments: noisy venue entrance gates, dim auditoriums, and crowded queue lines under bright outdoor glare. The visual architecture rejects decorative fluff, blurred materials, and multi-layered visual noise in favor of immediate, unambiguous clarity. Every interface element exists to accelerate a physical interaction—scanning a QR code in under 500ms, glancing at synchronization queues, or voting on live session queries.

The aesthetic posture is clean, modern, and rigorously utilitarian. Visual grouping is achieved strictly through spatial contrast, flat tonal surfaces, and downward directional elevation. The experience communicates reliability, cryptographic certainty, and effortless velocity.

**Key Characteristics:**
- **Zero-Border Discipline:** Total elimination of outline borders, hairlines, and card strokes. Spatial separation is managed via background contrast (`#F8FAFC` vs `#FFFFFF`) and downward shadow elevation.
- **High-Visibility Status Hierarchy:** Immediate color-coded states (Emerald for valid check-in, Amber for duplicate/offline, Red for invalid) paired with multi-sensory haptic and audio feedback.
- **Glare-Resistant Light Theme:** High-contrast dark Slate typography (`#0F172A`) over immaculate white and slate foundations.
- **No Light Grey Text:** Total elimination of washed-out light grey typography (`#94A3B8`, `#CBD5E1`). All body text, subheadings, labels, and placeholders maintain high contrast (≥4.5:1) for daylight outdoor readability.
- **Gluestack + Native Ergonomics:** Large touch targets (≥48dp), predictable bottom bar layouts, and touchable card containers tailored to single-handed operation.

## Colors

The qCheck color system employs a high-contrast functional palette rooted in clean Slate neutrals and distinct chromatic signals.

### Primary
- **Electric Blue** (`#2563EB`): The primary interaction and action color. Guides attendees toward primary tickets and staff toward scan confirmation.
- **Deep Blue Active** (`#1D4ED8`): Active/pressed state for primary touch targets.
- **Soft Blue Container** (`#EFF6FF`): Background container for informational chips, badge containers, and hero icon surfaces.

### Neutral
- **Background Slate** (`#F8FAFC`): The global screen background, establishing a soft, glare-free canvas.
- **Surface White** (`#FFFFFF`): Primary elevated surface for cards, bottom sheets, headers, and floating dialogs.
- **Text Slate 900** (`#0F172A`): High-contrast primary headlines, titles, and critical attendee details (17.5:1 contrast).
- **Text Slate 700** (`#334155`): Secondary descriptions, uppercase tracking labels, timestamps, and venue metadata (9.6:1 contrast).
- **Text Slate 600** (`#475569`): Muted input placeholder hints, subtle category headers (5.8:1 contrast). Total elimination of low-contrast light grey (`#94A3B8`).
- **Field Neutral** (`#F1F5F9`): Unbordered input container and secondary button fill.
- **Neutral Dark** (`#E2E8F0`): Subtle fill for pressed states and active toggles.

### Functional / Semantic
- **Emerald Valid** (`#10B981` / Light: `#ECFDF5`): Sub-second successful scan validation, active check-in badges, and verified ticket state.
- **Amber Warning** (`#D97706` / Light: `#FFFBEB`): Duplicate scan warnings, offline queuing mode, and pending synchronization items (4.5:1 contrast).
- **Crimson Error** (`#DC2626` / Light: `#FEF2F2`): Fraudulent ticket signals, revoked QR tokens, and network error alerts (5.9:1 contrast).

### Named Rules
**The Borderless Boundary Rule.** Never use `borderWidth: 1` or hairline divider lines to separate components or card sections. Content hierarchy must be defined by surface contrast (`#FFFFFF` on `#F8FAFC`), 12–20px spacing gaps, or subtle background tint fills.

**The High-Contrast Legibility Rule.** Never use light grey text colors (`#94A3B8`, `#CBD5E1`, `#9CA3AF`, etc.) for any label, placeholder, or indicator. All typography must maintain sharp, high-visibility contrast (≥4.5:1 against surface background) to guarantee instant readability outdoors and under harsh gate lighting.

**The Semantic Monosemy Rule.** Emerald (`#10B981`), Amber (`#D97706`), and Crimson (`#DC2626`) are strictly reserved for ticket validation and synchronization state. They are never used for decorative accents.

**The Standalone Icon Rule.** Standalone icon-only buttons and elements (such as the back button, logout button, torch button, or modal close button) must never have a background container (no rounded or circular colored boxes behind them) and must be rendered in pure black (#000000). Icons that are paired with labels or placed inside styled buttons/badges retain their contextual colors.

## Typography

**Display Font:** System Default (Roboto on Android, San Francisco on iOS)
**Body Font:** System Default
**Mono/Code Font:** Monospace (used for truncated ticket IDs and cryptographic tokens)

**Character:** Clean, legible, and unpretentious system typography that renders natively without font-download lag or layout shift.

### Hierarchy
- **Display** (Bold 700, 24–28px, line-height 32px): Screen hero titles and event names.
- **Headline** (Bold 700, 18–20px, line-height 26px): Modal titles, card section headers, and scanner status announcements.
- **Title** (SemiBold 600, 15–16px, line-height 22px): Ticket tier names, attendee name, and button text.
- **Body** (Regular 400, 14px, line-height 20px): Venue instructions, session details, and Q&A question copy.
- **Label** (SemiBold 600, 11–12px, line-height 16px, uppercase letter-spacing 0.5px): Badges, countdown timer chips, and form input headers.

### Named Rules
**The No-Hairline-Type Rule.** Thin or ultra-light weights are prohibited. All interactive labels and status badges must use a minimum weight of 600 (SemiBold) to ensure immediate legibility under rapid movement and bright sunlight.

## Layout

The mobile layout adheres to strict single-handed thumb zone ergonomics:
- **Screen Margins:** Horizontal padding of 20px (`px="$5"` in Gluestack) across all primary containers.
- **Vertical Flow Rhythm:** 16px default spacing between list cards; 24px between distinct functional sections.
- **Thumb Zone Anchoring:** Primary gate actions (camera scan trigger, sync action button, ticket QR presentation) reside within the lower two-thirds of the viewport.
- **Safe Area Inset Discipline:** All screen containers consume `SafeAreaView` from `react-native-safe-area-context` with explicit edge management to prevent notch and navigation bar overlap.

## Elevation & Depth

qCheck utilizes natural, downward-directed elevation rather than multi-directional drop shadows or heavy strokes.

### Shadow Vocabulary
- **Subtle Elevation** (`elevation: 2`, `offset: {0, 2}`, `opacity: 0.05`, `radius: 6`): Top navigation bars and subtle list items.
- **Card Elevation** (`elevation: 3`, `offset: {0, 4}`, `opacity: 0.07`, `radius: 10`): Standard content cards, ticket list items, and Q&A cards.
- **Floating Elevation** (`elevation: 6`, `offset: {0, 8}`, `opacity: 0.12`, `radius: 16`): Sticky summary bars, bottom sheets, and scanner feedback dialogs.

### Named Rules
**The Downward Gravity Rule.** Shadows must have a strictly positive Y-offset (`height >= 2`). Omni-directional glow shadows are banned.

**The Absolute No-Blur Rule.** Glassmorphism and `BlurView` components are prohibited. Translucent sheets must use flat alpha scrims (`rgba(15, 23, 42, 0.45)`) over opaque surfaces.

## Shapes

- **Base Radius:** 16px (`borderRadius: 16`) for cards and surface containers.
- **Interactive Radius:** 12px (`borderRadius: 12`) for buttons, inputs, and pressable list rows.
- **Pill Badges:** 9999px (`borderRadius: 20`+) for status badges, tags, and category chips.
- **Zero Border Invariant:** `borderWidth: 0` on every component without exception.

## Components

### Buttons
- **Shape:** Rounded rectangle (12px radius)
- **Primary:** Background `#2563EB`, text `#FFFFFF`, font weight 600, min-height 48dp.
- **Secondary:** Background `#F1F5F9`, text `#0F172A`, font weight 600.
- **States:** Active opacity `0.85` on press; disabled background `#E2E8F0` with text `#334155`.

### Cards
- **Shape:** Rounded container (16px radius), background `#FFFFFF`, zero border.
- **Shadow:** Standard `shadows.card` (elevation 3) or `shadows.floating` (elevation 6).
- **Internal Padding:** 16px (`p="$4"`).

### Inputs
- **Shape:** Soft pill-cornered box (12px radius), background `#F1F5F9`, zero border.
- **Focus:** Background shifts to `#E2E8F0` without adding a stroke outline.
- **Label:** Small uppercase label (12px, SemiBold) placed 6px above field.
- **Placeholder:** Crisp Slate-600 (`#475569`, 5.8:1 contrast).

### Badges / Status Chips
- **Shape:** Pill container (full radius 20px), padding `4px 10px`, zero border.
- **Success:** Background `#ECFDF5`, text `#10B981`.
- **Warning:** Background `#FFFBEB`, text `#D97706`.
- **Info:** Background `#EFF6FF`, text `#2563EB`.

### Top Header Bar
- **Shape:** Full-width surface `#FFFFFF`, zero border, subtle elevation shadow (`shadows.subtle`).
- **Affordance:** Back button with minimum 48×48dp pressable area.

## Do's and Don'ts

### Do:
- **Do** maintain strict zero-border geometry (`borderWidth: 0`) across all UI elements.
- **Do** provide immediate haptic and audio feedback on gate scanning operations.
- **Do** ensure all interactive buttons and icons have at least 48×48dp touchable bounding boxes.
- **Do** preserve the anti-screenshot screen capture protection on the ticket detail screen.
- **Do** display dynamic 30-second countdown rings or progress indicators on QR codes.
- **Do** enforce high text contrast (≥4.5:1) for all typography and placeholders.

### Don't:
- **Don't** add outline borders, border-bottom lines, or hairlines anywhere in the application.
- **Don't** use light grey text colors (`#94A3B8`, `#CBD5E1`, `#9CA3AF`, etc.) for any label, placeholder, or indicator.
- **Don't** introduce dark mode or dark themes unless explicitly directed; the app is built exclusively as an outdoor glare-resistant Light Theme.
- **Don't** use `expo-blur`, `BlurView`, or frosted glass backgrounds.
- **Don't** place critical gate validation controls in the hard-to-reach top quarter of the screen.
