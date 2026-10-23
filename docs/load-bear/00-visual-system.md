# Load Bear — visual system extracted from the Brand Strategy board

Source: the two Load Bear Brand Strategy images supplied with the build brief
(brand board + App Store / onboarding board). This document is the canonical
reading of those images for implementation. Where the board and the brief
disagree, the brief's UX rules win and the board's visual language wins.

## 1. Mama Bear (the brand device)

* Abstract, flat-shaded bear in **navy** silhouette with **cream** muzzle,
  brow and inner-ear markings. Eyes are simple, calm and confident.
* **Coral bandana with white polka dots**, knotted on top of the head, tails
  flying to the left — the Rosie-the-Riveter signifier.
* **Mustard** block on the chest/shoulder reads as a rolled-sleeve workwear
  top; one arm raised in the classic flexed-bicep pose.
* Occasional **mustard "energy" tick marks** beside the head on hero uses.
* Rendering is screen-print flat: no gradients inside the character, hard
  edges, at most four inks (navy, coral, mustard, cream). The character is
  never outlined in black and never drawn as a cute cub.
* Use sparingly: welcome, capture success, reassurance, completion, empty
  states. Everywhere else the UI carries the brand through colour, type and
  copy, not the mascot. Implemented as an inline SVG component
  (`components/bear/mama-bear.tsx`) with a `pose` prop (`hero`, `calm`,
  `wave`) and reduced-motion-safe bandana animation.

## 2. Wordmark and lock-ups

* "LOAD" in navy stacked over "BEAR" in coral, Archivo Black, tight leading,
  slight optical rotation on hero uses (about −3°).
* Tagline "Your mental load is ours to bear." in Caveat, navy, with a
  **mustard hand-drawn underline swash** under "ours to bear".
* App icon: bear head on a coral tile (colour) or navy tile (mono).
* Alternative lock-up: circular coral badge, bear head centred, text on the
  ring. Used for stickers / "Bear's got it" moments only.

## 3. Colour

| Token    | Hex       | Meaning from the board            | Use in UI                                   |
|----------|-----------|-----------------------------------|---------------------------------------------|
| navy     | `#102A43` | Trust · Focus · Depth             | Primary text, primary buttons, nav icons    |
| coral    | `#FF5147` | Energy · Action · Confidence      | The + Bear action, selected checks, key CTA |
| mustard  | `#FFB72B` | Optimism · Momentum · Warmth      | Highlights, underline swash, Wealth accent  |
| teal     | `#18B7AA` | Balance · Calm · Clarity          | Confirmation, "Bear's handling", Health     |
| blush    | `#FF9FA3` | Warmth · Care · Approachability   | Soft tints, Happiness accent, family chips  |
| cream    | `#FFF7E8` | Space · Simplicity · Breathability| App background                              |

Rules: cream base, navy type, glass surfaces; coral/mustard/teal used as
purposeful accents only. Never all six on one screen. Category chips use
pastel tints of the palette with a navy glyph (board's "Home / Work / Family /
Health / Finances" chips): mustard-tint, sky-tint, blush-tint, coral-tint,
teal-tint, lavender-tint.

## 4. Typography

* **Archivo Black** — wordmark, screen titles, big numbers ("$184.60").
* **Inter** — all UI and body text. 17px base on mobile, 15px secondary.
* **Caveat** — handwriting for brand moments and Mama Bear comments only.
  Never for amounts, dates, field labels or anything the user must act on.

All three are loaded through `next/font/google` and self-hosted by Next, so
the existing `font-src 'self'` CSP still holds.

## 5. Surfaces and depth ("liquid glass")

The board's app screens use white-on-cream cards with soft, barely-there
shadows and rounded corners (~22px). The brief asks for Apple-style liquid
glass. Implementation:

* `glass` surface: `rgba(255,255,255,.62)` fill, `backdrop-filter: blur(18px)
  saturate(1.4)`, 1px top-light border (`rgba(255,255,255,.75)`), 1px
  bottom/ambient border (`rgba(16,42,67,.08)`), inset highlight on the top
  edge, shadow `0 10px 30px -18px rgba(16,42,67,.35)`.
* `glass-strong` for sheets and the bottom bar: higher fill opacity
  (`.78`) and 24px blur so text stays WCAG AA on top of imagery.
* Only sheets, the bottom bar, floating cards and the capture surface are
  translucent. Content cards on the dashboard are near-opaque white so
  readability is never compromised.
* Backgrounds carry a soft cream → blush/sky "sunrise" gradient with a very
  low-contrast mountain silhouette at the foot of onboarding screens, echoing
  the board's illustrated horizon. Never behind dense text.

## 6. Motion

* Spring transitions (`cubic-bezier(.2,.9,.3,1.1)`, 320–420ms) for sheets
  and cards appearing.
* Bandana tails sway (3s ease-in-out loop, ±3°) on the welcome hero only.
* Extraction "emerges": each extracted field fades/slides up out of the
  source thumbnail in sequence.
* Completed tasks fade and collapse quietly; no confetti by default.
* All motion is wrapped in `@media (prefers-reduced-motion: no-preference)`.

## 7. Photography and illustration

* Warm, golden-hour Australian lifestyle photography (woman with coffee,
  mum and daughter looking at a city skyline, coast walk) with Caveat
  overlays like "A calmer you." These are campaign assets, not UI chrome.
* Bear illustration panels on flat colour blocks (mustard, coral, blush,
  sky) with short Caveat captions ("Real life.", "Real support.").
* In the MVP we do not have licensed photography, so onboarding uses the
  gradient horizon illustration and Mama Bear. Photo slots are structured
  as replaceable CSS variables (`--bear-photo-welcome`, …) so licensed
  photography can drop in later without layout changes.

## 8. Tone of voice chips

Warm · Confident · Supportive · Practical · Relatable · Optimistic · A little
bit cheeky · Real · Uplifting. Copy lives in `lib/bear/copy.ts`; the user's
chosen tone (Warm & encouraging / Straight to the point / A little cheeky)
selects a variant for Bear's lines.

## 9. Navigation (from the board, adapted to the brief)

Five destinations: **My Bear · Bear Ideas · + Bear · My Wins · Me**. The
central + Bear is a 64px coral circle that sits proud of the glass bar, with
a white plus glyph, and a soft coral halo. Active tab glyphs are navy; the
label is Inter 11px.
