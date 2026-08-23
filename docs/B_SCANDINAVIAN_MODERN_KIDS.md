# UX Option B — Scandinavian / Modern Kids

## Product Context
Same Phase 02 functionality and routes as the other options:
- `/`
- `/bundles`
- `/bundles/:id`

Parents make the purchasing decision; kids should still find products appealing. Do not add Phase 03+ functionality.

## Positioning
Premium, calm, thoughtful, quality-led, photography-led.

Visual feeling:
- Scandinavian children's boutique
- modern wooden-toy brand
- editorial lifestyle e-commerce

This design should counter the concern:
> “Is this just a bag of cheap plastic junk?”

It should instead communicate:
> curated, thoughtful, intentional.

Target:
- 85% calm/premium
- 15% playful

## Colors
```text
Warm White       #FAF8F4
Sand             #E8DDCF
Terracotta       #C97B63
Muted Sage       #A8B7A3
Dusty Blue       #9EB6C4
Soft Clay        #D7B5A6
Charcoal         #2F302E
Muted Text       #6E6B66
Border           #DED8D0
```

Use low-saturation color throughout. Primary CTA can use Charcoal or Terracotta.

## Typography
Suggested:
```text
Headings: DM Sans or Manrope
Body: Inter or DM Sans
```

Optional editorial serif accent:
```text
Fraunces
```
If used, serif only appears in selected hero/editorial moments.

## Homepage Hero
Preferred:
```text
Goodie bags,
picked with kids in mind.

Simple favors.
Thoughtfully bundled.

[ Find Their Bag ]
```

Alternative:
```text
Thoughtful party favors.
Less planning for parents.
More excitement for kids.

[ Find Their Bag ]
```

Hero image is large and beautifully styled. Avoid floating sticker/confetti decoration.

## Value Props
Use calm typography / line icons:
```text
Thoughtfully curated
Ready for the party
Made to feel special
```

## Gift Finder
Same product logic, calmer visual treatment:

```text
Find their bag

Age
[ 3–5 ] [ 6–8 ] [ 9–12 ]

Interests
[ Creative ] [ Animals ] [ Adventure ]
[ Magical ] [ Active ] [ Games ]

Occasion
[ Birthday ] [ School ] [ Celebration ]

[ See Matches ]
```

Use neutral chips/cards. Selected state uses muted sage or terracotta. Keep it compact, not a long form or wizard.

## Gallery
Example:
```text
Goodie bags for ages 6–8

Creative · Birthday

23 options
```

Filters:
```text
Age 6–8
Creative
Birthday
Price

Clear
```

Use outlined chips with muted selected backgrounds.

## Product Card
Photography dominates.

```text
┌────────────────────────────┐
│                            │
│      LARGE PRODUCT         │
│      PHOTOGRAPH            │
│                            │
├────────────────────────────┤
│ THE LITTLE MAKER           │
│                            │
│ 5 thoughtfully picked      │
│ favors                     │
│                            │
│ $11 / guest                │
│                            │
│ View bag →                 │
└────────────────────────────┘
```

Use minimal shadow, thin/no border, large image, generous breathing room.

## Contents Preview
Prefer editorial treatment:

```text
Inside the bag

Mini watercolor set
Wooden puzzle
Sticker sheet
Pencil
Charm

See the full bag →
```

Use small thumbnails beside names. Do not make Peek Inside highly animated.

## Bundle Detail
```text
[Large bundle photo]

Little Maker

Creative · Ages 6–8

Five thoughtfully selected party favors.

$11 / guest

Inside the bag
----------------
[photo] Mini watercolor set
[photo] Puzzle
[photo] Sticker set
...
```

Simple, transparent, editorial. No swaps in Phase 02.

## Mobile-First
Rules:
- one card per row
- large imagery
- 16–20px side padding
- compact filter controls
- minimal visual noise
- do not shrink photos just to show more products above the fold

## Photography
This option depends strongly on photo quality.

Use:
- warm natural light
- cream/sand backgrounds
- consistent crop
- tactile styling
- uncluttered arrangements

Photos should communicate quality and thoughtful curation.

## Motion
Only subtle:
- 150–220ms transitions
- gentle desktop image zoom
- button color transition

No bouncing or confetti.

## States
Loading: neutral skeletons.

Empty:
```text
No exact matches yet.

Try widening one of your filters,
or browse all thoughtfully curated bags.

[ Browse All ]
```

Error:
```text
Something went wrong while loading the collection.

[ Try Again ]
```

## Accessibility
- AA contrast
- keyboard focus
- semantic structure
- alt text
- reduced motion
- selected state not color-only

## Coding AI Rules
Must:
- prioritize whitespace and product photography
- keep styling restrained
- mobile-first
- reusable MUI theme
- preserve catalog logic

Must not:
- add playful animation
- overuse emoji
- use excessive gradients
- add cartoon decoration
- add checkout/customization
- invent charity claims

## Acceptance
- premium and calm
- product photography is visually dominant
- strong parent trust
- Gift Finder remains quick/simple
- gallery feels sparse/editorial
- name/count/price are immediately clear
- mobile is easy to scan
- muted accents prevent the site from feeling dull
