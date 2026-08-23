# Phase 02 UX Override — Apple-Style Goodie Bag Configurator

## 0. Purpose
This document overrides any earlier Phase 02 UX requirements that conflict with it.

New primary flow:

```text
Homepage / Gift Finder
        ↓
Answer a few questions
        ↓
Directly enter a recommended Goodie Bag Configurator
        ↓
Review 4 fixed party favors
        ↓
Choose 1 of 2 Upgrade options
        ↓
Review/select Gift Bag option
        ↓
Continue to later Phase 03/checkout flow
```

There is NO standalone Bundle Gallery page in this version.

The interaction should be inspired by the clarity and hierarchy of premium product configurators such as Apple product purchase/configuration pages:
- large visual product representation on the left;
- structured choice cards on the right;
- one decision group at a time;
- calm premium styling;
- interactive correspondence between selected configuration and the visual.

Do NOT copy Apple branding, assets, exact typography, wording, or trade dress. The inspiration is the interaction model and information hierarchy only.

## 1. UX Principle
Communicate:

> We already curated a strong starting combination for you.
> You can understand exactly what is inside, explore each item visually,
> and make only a small number of meaningful choices.

This is NOT unlimited build-your-own.
This is NOT a catalog grid.
This is a guided configurator.

Parent should feel:
- clear
- premium
- easy
- trustworthy
- not overwhelmed

Child should feel:
- visually interesting
- tactile
- able to understand what is inside

## 2. Routes
Recommended:

```text
/                         Homepage + Gift Finder
/configure/:bundleId      Recommended Goodie Bag Configurator
```

Do NOT route the primary journey through:

```text
/bundles
```

If an old `/bundles` route already exists:
- redirect it to homepage/Gift Finder; or
- keep it only for development if needed;
- do not expose it in the primary UX.

## 3. Gift Finder → Recommendation
Gift Finder remains lightweight:

```text
Let's find their favorites ✨

How old are they?
[ 3–5 ] [ 6–8 ] [ 9–12 ]

What are they into?
[ Creative ]
[ Animals ]
[ Adventure ]
[ Magical ]
[ Games ]

What's the occasion?
[ Birthday ]
[ School ]
[ Celebration ]

[ Show Me Their Goodie Bag → ]
```

After submit:

```text
Gift Finder answers
      ↓
deterministic filter/mapping
      ↓
recommended bundle
      ↓
navigate to /configure/{recommendedBundleId}
```

MVP does NOT need an AI recommendation engine.
If multiple bundles match, use a stable ranking/priority rule.
Do NOT show a Gallery.

## 4. Desktop Configurator Layout
Use a two-column layout.

```text
┌──────────────────────────────────────────────────────────────┐
│ Header                                                       │
├────────────────────────────┬─────────────────────────────────┤
│                            │ Your Goodie Bag                 │
│ LARGE VISUAL AREA          │ Ages 6–8 · Creative            │
│                            │                                 │
│ GEOMETRIC ITEM MAP         │ Included                        │
│                            │ [ Fixed Item 1 ]                │
│ [shape] [shape]            │ [ Fixed Item 2 ]                │
│   [shape]                  │ [ Fixed Item 3 ]                │
│ [shape] [bag]              │ [ Fixed Item 4 ]                │
│                            │                                 │
│                            │ Upgrade                         │
│                            │ [ Standard ] [ Upgraded ]       │
│                            │                                 │
│                            │ Gift Bag                        │
│                            │ [ Default Bag ]                 │
│                            │                                 │
│                            │ [ Continue ]                    │
└────────────────────────────┴─────────────────────────────────┘
```

Suggested ratio:
```text
Left visual: 50–58%
Right configurator: 42–50%
```

Desktop:
- left visual may be sticky;
- right column scrolls naturally;
- avoid nested scroll containers.

## 5. Mobile Layout
Do NOT compress the desktop columns.

Use:

```text
[ Product / geometric visual ]

Your Goodie Bag
Ages 6–8 · Creative

Included

[ Fixed Item 1 ]
[ Fixed Item 2 ]
[ Fixed Item 3 ]
[ Fixed Item 4 ]

Upgrade

[ Standard ]
[ Upgraded ]

Gift Bag

[ Default Bag ]

[ Continue ]
```

Visual remains near the top and updates when cards are tapped.
No essential interaction may depend on hover.

## 6. Left Visual — Geometric Product Map
For MVP, represent the physical geometry of the four party favors using abstract shapes.

Purpose:
- pen/pencil → long narrow form
- notebook/booklet → flat rectangular form
- toy → dimensional/volumetric form
- sticker/card → flat sheet form
- gift bag → larger container shape

Illustrative mapping:

```text
Pen / pencil
→ long rounded rectangle / capsule / bar

Notebook / activity booklet
→ thin rectangular plate

Small toy / squishy
→ rounded 3D-ish blob / cube / sphere-like shape

Sticker pack / flat card
→ thin sheet / small rectangle

Gift bag
→ larger outlined bag/container shape
```

Prefer a presentational shape type:

```text
BAR
FLAT_RECT
CUBE
ROUND
IRREGULAR_VOLUME
BAG
```

If backend lacks this field, use a documented frontend mapping by category/type rather than changing unrelated domain logic.

## 7. Geometry Styling
The visual should feel premium/editorial, not cartoonish.

Use:
- soft neutral fills
- subtle shadows
- subtle depth/perspective
- rounded edges
- calm background
- generous spacing

Avoid:
- rainbow coding
- cartoon outlines
- labels covering shapes
- complex 3D libraries

Preferred implementation:
- SVG
- CSS shapes
- simple React components

Do NOT add Three.js.

## 8. Interactive Highlighting
REQUIRED:

```text
Click/tap fixed item card
        ↓
matching shape on left highlights
```

Suggested behavior:
- selected shape opacity 1
- inactive shapes opacity 0.45–0.65
- selected shape gets stronger border/shadow
- slight scale 1.03–1.06
- transition 150–250ms
- no bouncing

Respect reduced motion.

SHOULD HAVE:
Click/tap a shape on left → select the corresponding card on right.
On mobile, may optionally scroll the related card into view.

## 9. Included Section — 4 Fixed Party Favors
Title:

```text
Included
```

Optional helper:

```text
Four kid-picked favorites are included in this bag.
Tap any item to see where it fits.
```

The 4 included items are NOT replaceable in this version.

Each card should look like a premium configuration option.

Example:

```text
┌─────────────────────────────────────┐
│ Scented Gel Pen                     │
│ Smooth-writing colorful gel pen     │
│ Long · lightweight                  │
└─────────────────────────────────────┘
```

```text
┌─────────────────────────────────────┐
│ Mini Activity Book                  │
│ Pocket-sized drawing & activity     │
│ booklet                             │
│ Flat · compact                      │
└─────────────────────────────────────┘
```

```text
┌─────────────────────────────────────┐
│ Mini Squishy Toy                    │
│ Soft tactile toy for play           │
│ Small · dimensional                 │
└─────────────────────────────────────┘
```

Recommended card content:
- item name
- concise 1–2 line description
- optional geometry/size descriptor
- no price
- no Swap button

Selected card:
- stronger border
- subtle background
- optional check/indicator
- selection not communicated by color alone

## 10. Upgrade Section
Below Included:

```text
Upgrade
```

Helper:
```text
Choose the version that fits your party.
```

Exactly 2 mutually exclusive options:

```text
Standard
Upgraded
```

Example:

```text
┌───────────────────────────┐
│ Standard                  │
│ The original curated set  │
│ Included                  │
└───────────────────────────┘

┌───────────────────────────┐
│ Upgraded                  │
│ Includes the premium      │
│ upgrade item/version      │
│ +$X.XX per bag            │
└───────────────────────────┘
```

This is logically a radio group, even if rendered as cards.

Default:
```text
Standard
```
unless business data says otherwise.

Selecting Upgraded:
- updates price summary if price exists
- updates left visual if physical selection changes
- if geometry changes, update the relevant shape

## 11. Gift Bag Section
Below Upgrade:

```text
Gift Bag
```

MVP has 1 default option.

Example:

```text
┌─────────────────────────────────────┐
│ Classic Party Bag                   │
│ Included                            │
│ Our standard ready-to-fill gift bag │
└─────────────────────────────────────┘
```

Even with one option, implement it as a reusable selection group so future options can be added:
- colors
- premium bag
- paper/fabric
- themed bag
- packaging upgrade

Do NOT hard-code this as non-reusable plain text.

## 12. Price / Summary
If pricing exists in the current code:

```text
Starting at $9.50 per guest
```

After upgrade:
```text
$11.00 per guest
```

Price should be clear but not visually dominant.

Do not trust frontend prices for future checkout.
If upgrade pricing is not yet implemented, do not invent values.

## 13. Continue CTA
At bottom:

```text
[ Continue ]
```

or:

```text
[ Continue with This Bag ]
```

If Phase 03/cart does not exist:
- route to the next existing step; or
- keep a non-production placeholder;
- do NOT invent checkout architecture in this UX task.

If Phase 03 exists, pass:
- upgradeOptionId
- giftBagOptionId
through existing configuration/cart state.

## 14. Styling Direction
Aesthetic:
- premium configurator clarity
- warm boutique personality
- calm e-commerce trust

Suggested palette:

```text
Page Background       #F7F7F5
Surface               #FFFFFF
Primary Text          #1D1D1F
Secondary Text        #6E6E73
Border                #D2D2D7
Selected Border       #4A6FA5
Warm Accent           #F47F6B
Soft Highlight        #FFF4EF
```

Use warm accent sparingly.
This page should be calmer than the old Gallery designs.

## 15. Typography
Recommended:
```text
DM Sans / Inter / Manrope
```

A slightly rounder brand font may remain in logo/hero, but configurator UI should be restrained.

Suggested:
```text
Page title: 36–48px desktop / 30–36px mobile
Section title: 24–28px
Option title: 17–19px
Body: 15–17px
Helper/meta: 13–15px
```

## 16. Option Card Component
Shared style:

```text
border: 1px solid neutral
border-radius: 12–16px
padding: 16–20px
background: white
```

Desktop hover:
- slightly stronger border
- no dramatic shadow

Selected:
- 2px selected border or equivalent
- subtle selected background
- optional check icon

Build one reusable `OptionCard`.

## 17. Responsive Behavior
Mobile < ~600px:
- one column
- visual first
- full-width cards
- full-width CTA

Tablet ~600–899px:
- may remain stacked
- split only if readability remains strong

Desktop >= ~900px:
- two columns
- sticky left visual allowed
- right side natural scrolling

Use responsive breakpoints, not device detection.

## 18. Accessibility
Required:
- Included item cards use button semantics if clickable
- Upgrade uses radio semantics
- Gift Bag uses radio/selection-group semantics
- visible keyboard focus
- selected state not color-only
- AA contrast
- reduced-motion support
- geometric visual is supplementary, never the only product information

## 19. State Model
Recommended frontend state:

```ts
type ConfiguratorState = {
  highlightedItemId: string | number | null;
  upgradeOptionId: string | number;
  giftBagOptionId: string | number;
};
```

Important:
`highlightedItemId` is informational only.

It must NOT change bundle composition.

Upgrade and Gift Bag selections DO change configuration.

## 20. Suggested Component Structure

```text
ConfiguratorPage
│
├── ConfiguratorVisual
│   ├── GeometryItemShape
│   └── GiftBagShape
│
├── ConfiguratorPanel
│   ├── IncludedSection
│   │   └── IncludedItemCard
│   │
│   ├── UpgradeSection
│   │   └── OptionCard
│   │
│   ├── GiftBagSection
│   │   └── OptionCard
│   │
│   └── ConfiguratorSummary
│
└── ContinueButton
```

Do not make one huge page component.

## 21. Explicit Overrides of Old UX Specs

REMOVE / INVALIDATE:
```text
Bundle Gallery as primary post-Finder page
Multiple bundle cards after Finder
Gallery filter chips as the main post-Finder interaction
Surprise Me in Gallery
Peek Inside from Gallery cards
Mobile one-card-per-row Gallery requirement
Shop-by-vibe Gallery behavior
```

REPLACE WITH:
```text
Gift Finder
→ directly recommended bundle
→ Configurator
```

KEEP:
```text
mobile-first
parent trust + child appeal
high-quality presentation
simple Gift Finder
no customer login
no unnecessary child personal data
accessible controls
restrained animation
responsive design
```

## 22. Non-Goals
Do NOT implement:
- unlimited swapping
- arbitrary item replacement
- Bundle Gallery
- wishlist
- reviews
- customer account
- AI recommendation engine
- WebGL/3D
- drag-and-drop item arrangement
- inventory reservation
- payment
- shipping
- complex bag color picker

## 23. Acceptance Criteria
Done only when:

1. Gift Finder routes directly to a recommended Configurator.
2. No Bundle Gallery step is required.
3. Desktop is clearly two-column.
4. Left side shows a large geometric representation of 4 favors + bag.
5. Right side shows exactly 4 fixed included item cards.
6. Clicking each fixed item card clearly highlights its matching shape.
7. Fixed items cannot be replaced.
8. Upgrade section appears below Included.
9. Upgrade has exactly 2 mutually exclusive options.
10. Gift Bag appears below Upgrade.
11. Gift Bag is a reusable option group even with one choice.
12. Mobile is single-column and touch-friendly.
13. No essential interaction depends on hover.
14. Styling is calm, premium, clear, and configurator-like.
15. No Apple assets/branding/exact trade dress are copied.
16. Existing backend/catalog logic is preserved where possible.
17. No unrelated Phase 03+ features are added.

## 24. Manual QA
Desktop:
```text
1440×900
1280×800
1024×768
```

Check:
- left visual remains prominent
- right choices are easy to scan
- sticky visual does not overlap header/footer
- card ↔ geometry mapping is obvious

Mobile:
```text
375×667
390×844
430×932
```

Check:
- no horizontal scroll
- cards easy to tap
- each of 4 cards updates highlight
- upgrade selection works
- Gift Bag selected state is clear
- CTA reachable

Tablet:
```text
768×1024
1024×768
```

Interaction:
- rapidly switch included-item cards
- Standard → Upgraded → Standard
- keyboard navigation
- reduced motion
- direct URL refresh
- shape click → card select if implemented

## 25. Prompt for Coding AI

```text
Read this file completely before changing code.

This file overrides any older Phase 02 UX requirement that conflicts with it.

First inspect the repository and identify:
1. the existing Gift Finder flow;
2. the existing Bundle Gallery route/components;
3. the existing Bundle Detail/configuration data;
4. any Phase 03 code that must not be broken.

Before implementing, tell me:
- which old components/routes will be removed, redirected, or left unused;
- which files you will add/change;
- whether the current backend already contains enough data for:
  a) four fixed included items,
  b) two upgrade options,
  c) one gift-bag option,
  d) item-to-geometry mapping.

Then implement the smallest coherent version of the configurator described here.

Important:
- do not create a replacement Gallery;
- do not invent an AI recommender;
- do not add Three.js/3D libraries;
- do not add checkout/payment;
- do not copy Apple assets or exact styling;
- preserve existing backend behavior where possible;
- add tests for routing, selection state, mutually exclusive Upgrade options, and fixed-item highlight behavior.

At the end report:
1. files changed;
2. old UX behavior removed/overridden;
3. tests run and results;
4. manual responsive checks I still need to perform;
5. any backend/data gaps that remain.
```
