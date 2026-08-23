# UX Option A — Playful Boutique

## Product Context
English-language goodie-bag e-commerce MVP. Parents are the decision-makers and purchasers; kids should still find the site exciting. No login required for browsing. Phase 02 includes Homepage + Gift Finder, Bundle Gallery, and Bundle Detail only.

Core routes:
- `/`
- `/bundles`
- `/bundles/:id`

Core UX principle:
> Kids should say “I want that!”
> Parents should think “This is cute, easy, and trustworthy.”

Do not add checkout, cart, swap/customization, customer login, child personal-data fields, or unverified charity claims in Phase 02.

## Positioning
Warm, curated, playful, boutique, kid-friendly, parent-trustworthy. Think modern independent children's boutique, not preschool game or cheap toy marketplace.

Target balance:
- 70% calm boutique
- 30% playful celebration

Use cream backgrounds, rounded cards, colorful accents, small stars/confetti/doodles, and strong product photography. Avoid rainbow overload, full-screen cartoons, flashing effects, and heavy animation.

## Colors
```text
Cream              #FFF9F1
Primary Coral      #F47F6B
Butter Yellow      #F6D76B
Soft Sage          #A9C9A4
Dusty Blue         #91B8D0
Lavender           #C5B4DB
Charcoal           #333333
Muted Text         #6F6A64
Border             #E9E0D5
White              #FFFFFF
```

Cream is dominant. Coral is primary CTA. Yellow/Sage/Blue/Lavender are accents only.

## Typography
Preferred:
```text
Headings: Fredoka
Body/UI: DM Sans
```

Fallback:
```text
Headings: Nunito
Body/UI: Inter
```

Suggested sizes:
```text
Hero H1: 44–56px desktop / 34–40px mobile
Section H2: 30–36px / 26–30px mobile
Card title: 20–22px
Body: 16–18px
Metadata: 13–14px
```

## Spacing / Shape
Use generous whitespace and spacing tokens:
```text
4, 8, 12, 16, 24, 32, 48, 64, 96
```

Corners:
```text
Buttons: 14–18px
Cards: 20–24px
Chips: pill
```

Use subtle shadows only.

## Homepage Hero
Preferred copy:
```text
Goodie bags
kids actually get excited about. ✨

Thoughtfully bundled party favors,
with a little help from kids themselves.

[ Find Their Goodie Bag ]
```

Alternative:
```text
Find a Goodie Bag
They'll Actually Love ✨
```

Show one strong bundle/product photo plus only a few small decorative accents.

Optional value props:
```text
🧒 Kid-picked favorites
🎁 Ready-to-party bundles
💛 Thoughtfully curated
```

Do not claim that purchases support animal rescue until the donation mechanism is real.

## Gift Finder
Do NOT make a multi-page onboarding wizard. Use a compact panel completable in about 15–30 seconds.

```text
Let's find their favorites ✨

① How old are they?
[ 3–5 ]   [ 6–8 ✓ ]   [ 9–12 ]

② What are they into?
[ 🎨 Creative ] [ 🐾 Animals ✓ ]
[ 🚀 Adventure ] [ ✨ Magical ]
[ ⚽ Active ] [ 🎲 Games ]

③ What's the celebration?
[ 🎂 Birthday ✓ ]
[ 🏫 School Party ]
[ 🎉 Celebration ]
[ 🎁 Other ]

[ Show Me Their Goodie Bags → ]
```

Do not use boy/girl as the primary recommendation signal.

Optional style preference only if backend data supports it:
```text
Bright & Bold
Sweet & Magical
Cool & Adventurous
Surprise Me
```

Selected state:
- subtle 1.01–1.02 scale
- colored border/background
- no bouncy animation

## Bundle Gallery
Header:
```text
Goodie Bags for Ages 6–8 ✨

[6–8 ×] [Creative ×] [Birthday ×]

23 bags found
```

Use simple filter chips:
```text
For: Ages 6–8 ▼
Interest: Creative ×
Party: Birthday ×
Price: Any ▼
Clear all
```

Include optional:
```text
✨ Surprise Me
```

Do not build an Amazon-style dense sidebar.

## Bundle Card
Only show what parents need immediately:
1. photo
2. bundle name/theme
3. favor count
4. price per guest

```text
┌──────────────────────────┐
│       PRODUCT PHOTO      │
│   Kid Pick ♥             │
├──────────────────────────┤
│ Little Artist            │
│ 🎨 Creative · Ages 6–8   │
│ 5 favors                 │
│ $9.50 / guest            │
│ [ See What's Inside → ]  │
└──────────────────────────┘
```

Do not expose SKU, inventory, product IDs, or internal cost.

Use at most one badge per card. Preferred:
```text
♥ Kid Pick
```

Possible future badges:
```text
★ Parent Favorite
🐾 Gives Back
```
Do not show `Gives Back` before donation is real.

## Peek Inside
This should feel like a signature interaction.

Desktop: subtle hover affordance/button.
Mobile: tap `See What's Inside`.

```text
What's inside?

🖍 Mini markers
🌈 Rainbow scratch art
⭐ Sticker sheet
🧸 Squishy
✏️ Pencil

[ View This Bag ]
```

No swaps in Phase 02.

## Bundle Detail
Show:
- hero photo
- bundle name
- short theme descriptor
- age range
- price per guest
- favor count
- `What's Inside`
- individual favor thumbnails if available

Example:
```text
Little Artist

Creative fun for ages 6–8

$9.50 / guest
5 favors included

What's Inside
[item][item][item][item][item]
```

No swap controls yet.

## Mobile-First
Primary acquisition is QR → phone.

Rules:
- one bundle card per row
- large product image
- large tap targets (~44px minimum)
- full-width primary CTA
- filter chips may scroll horizontally
- do NOT squeeze two tiny cards per row

## Photography
Photography matters more than decorative CSS.

Ideal bundle image:
```text
goodie bag
+
5 favors arranged around it
```

Use a consistent cream/pale background, consistent lighting, and crop. Individual item photos should use the same visual system.

## States
Loading: skeleton cards, not spinner-only.

Empty:
```text
No perfect match yet ✨
Try removing one filter or let us surprise you.

[ Clear a Filter ]
[ Surprise Me ]
```

Error:
```text
We couldn't load the goodies right now.
Please try again.

[ Try Again ]
```

## Accessibility
- WCAG AA contrast
- keyboard-accessible chips/buttons
- visible focus
- semantic headings
- image alt text
- selection not communicated by color alone
- respect reduced-motion

## Coding AI Rules
Must:
- use existing React + MUI
- create reusable theme/design tokens
- mobile-first
- preserve current catalog API/business logic
- do not invent backend fields

Must not:
- add checkout/cart
- add customization
- add login
- add charity claims
- add large animation libraries
- add unrelated dependencies

## Acceptance
- warm boutique + playful impression
- Gift Finder is compact, not a long wizard
- simple chip filters
- cards show image/name/theme/count/price only
- `Kid Pick` badge is restrained
- clear `See What's Inside`
- one strong card per mobile row
- no rainbow-overload
- parents quickly understand contents and price
- kids still see enough personality to engage
