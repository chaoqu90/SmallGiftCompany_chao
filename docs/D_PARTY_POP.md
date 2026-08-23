# UX Option D — Party Pop

## Product Context
Same Phase 02 functionality:
- Homepage + Gift Finder
- Bundle Gallery
- Bundle Detail

Parents purchase; kids should notice and enjoy the site. This version should also translate strongly to booth signage, QR cards, packaging stickers, and social media.

## Positioning
Bright, celebratory, modern DTC, Instagram-friendly, field-marketing friendly.

Target:
- 55% clean commercial UI
- 45% party energy

White/cream canvas + strong accent blocks. Do not make every section bright.

## Colors
```text
Soft White        #FFFDFC
Hot Coral/Pink    #F35F74
Orange            #F59B4C
Party Yellow      #F5D547
Purple            #A978D4
Aqua              #63C7C8
Deep Charcoal     #2D2D2D
Muted Text        #6B6664
Soft Border       #ECE5E1
```

Primary CTA: coral/pink.
Secondary: aqua/purple.
Yellow: highlight/badge only.

Never put all accent colors in one card.

## Typography
Suggested:
```text
Heading: Fredoka or another bold rounded display font
Body: DM Sans or Inter
```

Hero can use bold stacked text.

## Homepage Hero
Preferred:
```text
GOODIES
THEY'LL
TALK ABOUT. 🎉

Party favors picked
with a little help from kids.

[ Find My Goodie Bag ]
```

Alternative:
```text
Party favors
with more personality. ✨

Curated for kids.
Easy for grown-ups.

[ Find Their Bag ]
```

Visual:
- strong hero bundle photo
- a few floating stars/shapes
- one or two sticker-like accents
- no complex animation

## Shop by Vibe
Add a secondary browse section:

```text
SHOP BY VIBE

🎨 Little Creators
🐶 Animal Lovers
✨ Magic & Sparkle
🚀 Big Adventures
🎲 Game Night
```

Each tile may use a bold color block and simple icon. This does not replace Gift Finder.

## Gift Finder
```text
Let's find their party vibe ✨

How old are they?
[ 3–5 ] [ 6–8 ] [ 9–12 ]

What are they into?
[ 🎨 Creative ]
[ 🐾 Animals ]
[ 🚀 Adventure ]
[ ✨ Magical ]
[ 🎲 Games ]

What's the occasion?
[ 🎂 Birthday ]
[ 🏫 School ]
[ 🎉 Celebration ]

[ Show Me the Goodies → ]
```

Selected states:
- strong color fill
- clear contrast
- subtle scale
- no shaking/bouncing

## Gallery
```text
Your Party Picks ✨

Ages 6–8 × Creative × Birthday

23 goodie bags
```

Filters are colorful pills. Mobile chips may scroll horizontally.

Include:
```text
✨ Surprise Me
```

## Product Card
```text
┌──────────────────────────┐
│      PRODUCT PHOTO       │
│     ♥ KID PICK           │
├──────────────────────────┤
│ LITTLE ARTIST            │
│ 🎨 Creative · Ages 6–8   │
│ 5 fun favors             │
│ $9.50 / guest            │
│ [ SEE INSIDE → ]         │
└──────────────────────────┘
```

Use bold bundle names, simple metadata, one colorful CTA. One badge maximum.

## Peek Inside
Make it playful but controlled.

Desktop:
- slight card lift
- CTA opens contents panel/drawer

Mobile:
- bottom sheet or inline reveal

```text
WHAT'S INSIDE? ✨

🖍 Mini markers
🌈 Scratch art
⭐ Sticker sheet
🧸 Squishy
✏️ Pencil

[ VIEW THIS BAG ]
```

No swaps in Phase 02.

## Bundle Detail
```text
[Bold bundle hero photo]

LITTLE ARTIST

Made for creative party kids 🎨

Ages 6–8
5 favors
$9.50 / guest

WHAT'S INSIDE
[item cards / thumbnails]

[ Browse More ]
```

Use color-block sections carefully so the page stays commercial, not chaotic.

## Mobile-First
Rules:
- one card per row
- full-width CTAs
- large tap targets
- sticky filter control allowed
- hero headline must fit phone viewport
- no autoplay carousels
- no tiny two-column cards

## Photography
Use clean cream/white base with one colored paper/accent backdrop per shoot.

Arrange favors around the bag. Photos should be reusable on:
- website
- QR flyer
- booth cards
- Instagram

## Offline Brand Compatibility
Reusable brand elements:
- Kid Pick heart badge
- party star
- rounded sticker shapes
- coral CTA
- bold heading font

Booth sign and website should visibly feel like the same brand.

## Motion
Allowed:
- small hover lift
- 150–220ms chip transitions
- subtle CTA arrow movement
- tiny decorative float if non-distracting

Avoid:
- confetti explosions on every action
- scroll-trigger animation everywhere
- heavy animation libraries

Respect reduced motion.

## States
Loading: skeleton cards with small accent.

Empty:
```text
No perfect party match yet ✨

Try another vibe or let us surprise you.

[ Change Filters ]
[ Surprise Me ]
```

Error:
```text
Oops — the goodies didn't load.

[ Try Again ]
```

## Accessibility
- AA contrast
- state not color-only
- keyboard support
- clear focus ring
- semantic headings
- image alt text
- reduced motion

## Coding AI Rules
Must:
- reusable MUI tokens
- contain bright color with whitespace
- clean product cards
- mobile-first
- preserve backend/catalog behavior

Must not:
- turn the site into a game
- use full-screen animations
- add checkout/customization
- add unverified charity text
- add unrelated pages/features

## Acceptance
- immediately celebratory and recognizable
- still trustworthy for parents
- enough color/energy for kids
- fast Gift Finder
- readable gallery
- product image remains dominant
- visual identity translates naturally to booth signage
