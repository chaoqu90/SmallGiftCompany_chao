# Phase 02 — Dynamic Bundle Generation Data Model & Business Logic

## 0. This Replaces the Old Bundle Model

This document is the new source of truth.

Remove/retire the old primary model based on:

```text
predefined Bundle
bundle_tag
bundle_item
replacement_option
predefined bundle variants
```

The new model is:

```text
Product Inventory
        ↓
Rich Product Metadata
        ↓
User Questionnaire
        ↓
Hard Constraints
        ↓
Bundle Template / Composition Rules
        ↓
Slot-Based Product Scoring
        ↓
Budget-Aware Selection
        ↓
Generated Bundle Snapshot
        ↓
Apple-style Configurator
```

Important:

> Do NOT predefine actual bundle contents.
> DO predefine bundle composition/quality rules.


## 1. User Questionnaire

Collect:

```text
Audience preference:
- Girl
- Boy
- No preference

Age:
- 3–5
- 6–8
- 9–12

Interest:
- POP_MUSIC
- TOYS_PLAY
- CUTE_MAGICAL
- SPORTS
- READING_PUZZLE

Party type:
- CELEBRATION
- HALLOWEEN

Budget:
- LOW
- MID
- HIGH
```

Rules:
- Audience/gender is a SOFT signal only.
- Age is a HARD eligibility constraint.
- Interest is the strongest scoring signal.
- Party type can be a HARD compatibility rule.
- Budget is retail intent; generator uses a separate internal COGS ceiling.
- PRESCHOOL is NOT an interest. Handle preschool by age + template.
- Explicit user interest must outweigh gender stereotypes.


## 2. Product Is the Core Catalog Entity

Recommended fields:

```text
product
--------------------------------
id
sku
name
description

cost
inventory_quantity

min_age
max_age

category
form_factor
upgrade_tier
theme_code nullable

active
created_at
updated_at
```

Suggested `category` enum:

```text
STATIONERY
BOOK
PUZZLE
TOY
ACCESSORY
WEARABLE
COLLECTIBLE
NOVELTY
STICKER_TATTOO
ACTIVITY
SPORT
OTHER
```

Suggested `form_factor` enum for the geometric configurator:

```text
BAR
FLAT_RECT
ROUND
CUBE
IRREGULAR_VOLUME
SMALL_VOLUME
BAG
OTHER
```

Suggested `upgrade_tier`:

```text
STANDARD
PREMIUM
```


## 3. Weighted Product Metadata

### Interest affinity

```text
product_interest_affinity
--------------------------------
product_id
interest
weight
```

Weight range: `0–100`.

Example:

```text
Pop Star Bracelet

POP_MUSIC       90
CUTE_MAGICAL    50
TOYS_PLAY       10
```

### Audience affinity

```text
product_audience_affinity
--------------------------------
product_id
audience
weight
```

Audience values:

```text
FEMININE
MASCULINE
UNIVERSAL
```

This must remain a small scoring component.

### Occasion compatibility

```text
product_occasion
--------------------------------
product_id
occasion
```

Values:

```text
CELEBRATION
HALLOWEEN
```

A product may have both rows.

If no row matches the selected occasion, the product is ineligible.

### Bundle role affinity

```text
product_role_affinity
--------------------------------
product_id
role
weight
```

Suggested roles:

```text
UTILITY
ACTIVITY
PLAY
TACTILE
WEARABLE
COLLECTIBLE
NOVELTY
READING
PUZZLE
SIMPLE_TOY
PREMIUM
```

Examples:

```text
Gel Pen
UTILITY 100
ACTIVITY 20

Mini Activity Book
ACTIVITY 100
READING 60

Bracelet
WEARABLE 100
TACTILE 40

Collectible Cards
COLLECTIBLE 100
NOVELTY 30

Mini Figure
PLAY 90
SIMPLE_TOY 80
PREMIUM 100
```


## 4. Theme / IP Layer

Interest and theme are different.

Example:

```text
interest = POP_MUSIC
theme_code = GENERIC_KPOP
```

Possible theme codes:

```text
GENERIC_KPOP
FAIRY
PRINCESS
SOCCER
BASKETBALL
HALLOWEEN
```

Do not make a single current IP the core questionnaire taxonomy.

Any use of third-party names, logos, characters, or images must be separately reviewed for licensing/resale/marketing rights.


## 5. Budget Tier

Create:

```text
budget_tier
--------------------------------
id
code
retail_min
retail_max
max_item_cogs
target_retail_price
active
```

Example values are TEST DATA ONLY:

```text
LOW
retail $6–8
max_item_cogs $2.50

MID
retail $8–12
max_item_cogs $4.00

HIGH
retail $12–15
max_item_cogs $5.50
```

Human owner must set real values after considering:

```text
product cost
gift bag / packaging
labor
payment fees
shipping subsidy
damaged/lost inventory
marketing
future donation commitments
desired margin
```

Do not expose `max_item_cogs` to the customer.


## 6. BundleTemplate — Predefine Structure, Not Contents

Create:

```text
bundle_template
--------------------------------
id
code
name
min_age
max_age
active
```

and:

```text
bundle_template_slot
--------------------------------
id
bundle_template_id
slot_code
display_order
required
```

Allow multiple roles per slot via either a join table or equivalent structure.

### GENERAL_4_ITEM

```text
Slot 1: UTILITY
Slot 2: ACTIVITY
Slot 3: PLAY / WEARABLE / TACTILE
Slot 4: NOVELTY / COLLECTIBLE
```

### PRESCHOOL_4_ITEM

```text
Slot 1: ACTIVITY
Slot 2: TACTILE
Slot 3: SIMPLE_TOY
Slot 4: NOVELTY
```

### Optional READING_PUZZLE_4_ITEM

```text
Slot 1: READING
Slot 2: PUZZLE
Slot 3: UTILITY / STATIONERY
Slot 4: NOVELTY
```

Template selection can be simple:

```text
if age is preschool:
    PRESCHOOL_4_ITEM
else if interest == READING_PUZZLE and template enabled:
    READING_PUZZLE_4_ITEM
else:
    GENERAL_4_ITEM
```


## 7. Hard Constraints

Run BEFORE scoring.

A Product is eligible only if:

```text
active = true
requestedAge >= min_age
requestedAge <= max_age
occasion matches
inventory is usable
product can fill target slot
cost is feasible within remaining COGS budget
```

Hard constraints cannot be overridden by a high score.

Never select:
- inactive product
- age-inappropriate product
- occasion-incompatible product
- clearly unavailable product


## 8. Scoring Model

Score candidates PER SLOT, not globally.

Suggested MVP score:

```text
Interest affinity       0–100
Audience adjustment    -10–15
Age quality bonus        0–10
Occasion bonus           0–20
Role suitability         0–20
```

Interest must dominate.

Example audience behavior:

```text
exact preference match  +15
UNIVERSAL                +8
opposite leaning         -5
```

These are test/config values, not fixed business truth.

Do NOT:

```text
ORDER BY score DESC
LIMIT 4
```

Instead:

```text
for each required slot:
    find eligible products for that slot
    score candidates
    choose best feasible item
```


## 9. Budget-Aware Slot Selection

Constraints:
- no duplicate Product in one generated bundle
- total Standard item COGS <= BudgetTier.max_item_cogs
- preserve enough remaining budget for remaining required slots

MVP algorithm can be greedy + fallback:

```text
eligibleProducts =
    active
    + age-compatible
    + occasion-compatible
    + inventory-feasible

selected = []
remainingCOGS = budgetTier.max_item_cogs

for slot in template:
    candidates =
        eligibleProducts
        matching slot roles
        excluding selected products
        with cost <= remainingCOGS

    score candidates

    choose highest-scoring feasible candidate

    if no candidate:
        use fallback/backtracking

    selected.add(candidate)
    remainingCOGS -= candidate.cost
```

Do not introduce dynamic programming unless simple greedy+fallback proves insufficient.


## 10. Standard and Upgrade

### Standard
The Standard configuration is exactly the 4 generated fixed items.

Example:

```text
UTILITY       → Pop Star Pen
ACTIVITY      → Mini Notebook
WEARABLE      → Bracelet
COLLECTIBLE   → Cards
```

These appear as the four fixed `Included` cards in the configurator.

They are NOT user-replaceable.

### Upgrade
Do NOT regenerate the entire bundle.

Preferred UX:

```text
Upgrade
○ Standard
● Premium Upgrade
```

The Premium Upgrade normally ADDS one premium product.

Premium candidate must:

```text
upgrade_tier = PREMIUM
active
age eligible
occasion compatible
inventory feasible
strong interest match
not already in Standard
business/margin rule satisfied
```

Example:

```text
Mini Figure
+$3.00 / bag
```

Upgrade retail adjustment must come from business configuration/data, not simply equal Product cost.


## 11. Gift Bag

Model separately:

```text
gift_bag_option
--------------------------------
id
code
name
description
cost
retail_price_adjustment
active
is_default
```

MVP:

```text
CLASSIC_BAG
```

Keep it extensible for future:
- premium bags
- colors
- materials
- themed bags


## 12. Generated Bundle Snapshot

Once generation succeeds, SAVE the result.

Do NOT rerun recommendation every time the user loads the configurator.

Create:

```text
generated_bundle
--------------------------------
id
public_id
session_id nullable

requested_age
audience_preference
interest
party_type
budget_tier_id

bundle_template_id

base_retail_price
standard_item_cogs_snapshot

status
created_at
expires_at nullable
```

Generated fixed items:

```text
generated_bundle_item
--------------------------------
id
generated_bundle_id
slot_code
product_id

product_name_snapshot
sku_snapshot
cost_snapshot

quantity_per_bag
display_order
```

Generated upgrade:

```text
generated_bundle_upgrade
--------------------------------
id
generated_bundle_id
product_id

product_name_snapshot
sku_snapshot
cost_snapshot
retail_price_adjustment_snapshot
```

Generated gift bag:

```text
generated_bundle_gift_bag
--------------------------------
generated_bundle_id
gift_bag_option_id

name_snapshot
cost_snapshot
retail_price_adjustment_snapshot
is_default
```

Why snapshot?

```text
Generate at 5:01
→ show Pen + Notebook + Bracelet + Cards

Product metadata changes at 5:03

Parent continues at 5:05
→ must still see the original recommendation
```

Checkout will revalidate inventory later.


## 13. Example — Pop & Music / MID Budget

User:

```text
Age: 8
Audience: FEMININE
Interest: POP_MUSIC
Party: CELEBRATION
Budget: MID
```

Example candidate products:

```text
Pop Pen          $0.60
Mini Notebook    $0.90
Bracelet         $0.70
Cards            $0.80
Tattoo           $0.35
Badge            $0.45
Mini Figure      $1.60 PREMIUM
```

If `max_item_cogs = $4.00`, possible Standard:

```text
UTILITY       Pop Pen         $0.60
ACTIVITY      Mini Notebook   $0.90
WEARABLE      Bracelet        $0.70
COLLECTIBLE   Cards           $0.80
----------------------------------
Standard COGS                 $3.00
```

Upgrade:

```text
Mini Figure
PREMIUM
```

Configurator:

```text
Included
- Pop Pen
- Mini Notebook
- Bracelet
- Cards

Upgrade
○ Standard
● Collector Upgrade

Gift Bag
- Classic Bag
```


## 14. Same Interest, Different Budget

Same user profile can produce different combinations.

LOW budget example:

```text
Pen
Tattoo
Bracelet
Badge
```

MID:

```text
Pen
Notebook
Bracelet
Cards
```

HIGH:

```text
Higher-quality Pen
Notebook
Bracelet
Premium collectible candidate
```

Do NOT pre-create separate bundles for each tier.


## 15. Halloween Example

Input:

```text
Age 7
CUTE_MAGICAL
HALLOWEEN
MID
```

Celebration-only products are removed by hard filtering.

Possible Standard:

```text
Halloween Pencil
Mini Activity Book
Glow Bracelet
Temporary Tattoo
```

Premium:

```text
Halloween-themed Toy
```


## 16. Recommended APIs

Generate:

```http
POST /api/generated-bundles
```

Request:

```json
{
  "age": 8,
  "audiencePreference": "FEMININE",
  "interest": "POP_MUSIC",
  "partyType": "CELEBRATION",
  "budgetTierCode": "MID"
}
```

Response concept:

```json
{
  "generatedBundleId": "gb_abc123",
  "standardPrice": 10.99,
  "items": [
    {
      "slotCode": "UTILITY",
      "productId": 101,
      "name": "Pop Star Pen",
      "description": "...",
      "formFactor": "BAR"
    }
  ],
  "upgrade": {
    "productId": 205,
    "productName": "Mini Figure",
    "priceAdjustment": 3.00
  },
  "giftBagOptions": [
    {
      "code": "CLASSIC_BAG",
      "name": "Classic Party Bag",
      "default": true
    }
  ]
}
```

Then navigate:

```text
/configure/{generatedBundleId}
```

Load snapshot:

```http
GET /api/generated-bundles/{generatedBundleId}
```

GET must NOT rerun generation.


## 17. Suggested Backend Components

```text
QuestionnaireMapper
BundleTemplateSelector
ProductEligibilityService
ProductScoringService
BundleGenerationService
UpgradeGenerationService
GeneratedBundleService
```

Do not put all generation logic into Controller or Repository.


## 18. Java Enums

Recommended:

```java
Interest {
    POP_MUSIC,
    TOYS_PLAY,
    CUTE_MAGICAL,
    SPORTS,
    READING_PUZZLE
}
```

```java
AudiencePreference {
    FEMININE,
    MASCULINE,
    NO_PREFERENCE
}
```

```java
AudienceAffinity {
    FEMININE,
    MASCULINE,
    UNIVERSAL
}
```

```java
PartyType {
    CELEBRATION,
    HALLOWEEN
}
```

```java
BundleRole {
    UTILITY,
    ACTIVITY,
    PLAY,
    TACTILE,
    WEARABLE,
    COLLECTIBLE,
    NOVELTY,
    READING,
    PUZZLE,
    SIMPLE_TOY,
    PREMIUM
}
```

```java
FormFactor {
    BAR,
    FLAT_RECT,
    ROUND,
    CUBE,
    IRREGULAR_VOLUME,
    SMALL_VOLUME,
    BAG,
    OTHER
}
```

```java
UpgradeTier {
    STANDARD,
    PREMIUM
}
```

Do not add unused enums speculatively.


## 19. Seed/Test Data Strategy

Seed enough Products to test the engine, not only one happy-path bundle.

For each interest category, aim for multiple products across:
- role
- price
- occasion
- age range
- premium/standard

Also include:
- Halloween-only Product
- Celebration-only Product
- BOTH-occasion Product
- low-stock Product
- inactive Product
- age-ineligible Product

This is required to prove hard constraints and scoring work correctly.


## 20. Core Automated Tests

### Eligibility
- inactive excluded
- wrong age excluded
- Halloween-only excluded for Celebration
- Celebration-only excluded for Halloween
- unavailable product excluded where required

### Scoring
- strong interest match beats gender mismatch
- audience match is only a small bonus
- better slot-role match wins when other factors are similar

### Composition
- no global top-4 behavior
- every required slot filled
- same Product not selected twice
- total COGS <= max_item_cogs
- different budget tiers can produce different bundles
- preschool template chosen correctly
- reading/puzzle template chosen when configured

### Upgrade
- Premium Product not already in Standard
- Upgrade obeys age/occasion
- invalid premium skipped

### Snapshot
1. generate bundle
2. modify Product name/cost/metadata
3. load generated bundle
4. snapshot stays unchanged


## 21. Inventory Boundary

Phase 02 generation is recommendation, NOT final reservation.

Later:

```text
User selects quantity = 25 bags
```

Backend must revalidate:

```text
required units =
25 × quantity_per_bag
```

Do not attempt full checkout inventory concurrency in this phase.


## 22. Old Tables / Concepts to Remove

If they exist only for predefined bundles, remove or migrate away from:

```text
bundle
bundle_item
bundle_tag
replacement_option
bundle_upgrade_option
bundle_upgrade_item
bundle_gift_bag_option
```

Replace primary model with:

```text
product
product_interest_affinity
product_audience_affinity
product_occasion
product_role_affinity

budget_tier

bundle_template
bundle_template_slot
(template-slot allowed-role relation if needed)

gift_bag_option

generated_bundle
generated_bundle_item
generated_bundle_upgrade
generated_bundle_gift_bag
```

IMPORTANT:
- inspect existing Flyway migrations first
- do not rewrite already-applied persistent production migrations
- do not delete real data without human approval
- for local-only/dev DB, clean reset is acceptable only after human approval


## 23. Implementation Order

```text
1. Refactor Product schema/enums
2. Add affinity/occasion/role tables
3. Add BudgetTier
4. Add BundleTemplate + slots
5. Seed representative test products
6. Implement hard eligibility
7. Implement Product scoring
8. Implement slot-based budget-aware generation
9. Implement Premium Upgrade generation
10. Persist GeneratedBundle snapshot
11. Add POST /api/generated-bundles
12. Add GET /api/generated-bundles/{id}
13. Connect Gift Finder → GeneratedBundle → Configurator
```

Do not start by wiring frontend before generation tests pass.


## 24. Human Decisions Required

AI may implement code and test data, but human owner must decide real:
- product catalog
- Product costs
- inventory
- min/max ages
- occasion compatibility
- Product roles
- Product interest weights
- Product audience weights
- BudgetTier retail ranges
- max COGS
- Premium upgrade pricing
- Gift Bag pricing
- theme/IP permissions

AI must label invented values as TEST DATA.


## 25. Acceptance Criteria

Complete only when:

1. Actual bundle contents are not predefined.
2. Product is the reusable inventory core.
3. Product has structured age/category/form-factor/upgrade data.
4. Weighted interest affinity exists.
5. Weighted audience affinity exists.
6. Occasion compatibility exists.
7. Weighted bundle-role affinity exists.
8. Retail budget and internal COGS ceiling are separate.
9. BundleTemplate defines structure, not exact products.
10. Hard constraints run before scoring.
11. Scoring happens per slot.
12. Interest dominates audience preference.
13. Generator respects COGS.
14. Generator prevents duplicate products.
15. Standard result contains 4 fixed generated items.
16. Premium Upgrade is generated separately.
17. Gift Bag is separate and extensible.
18. Generated result is persisted as snapshot.
19. GET does not regenerate.
20. Gift Finder routes directly to Configurator using generatedBundleId.
21. Old predefined Bundle model is no longer the primary source of truth.


## 26. Prompt for Coding AI

```text
Read 02_DYNAMIC_BUNDLE_GENERATION_DATA_MODEL.md completely.

This document replaces the previous predefined Bundle/bundle_tag/bundle_item model.

Before writing code, inspect all current:
- entities
- Flyway migrations
- repositories
- services
- seed data
- controllers
- DTOs
- frontend Gift Finder / Bundle code

First give me a refactor plan showing:
1. old code/tables to remove;
2. code that can be reused;
3. new migrations/entities needed;
4. whether existing migrations can be reset locally or require forward migrations;
5. any destructive change that requires my approval.

Do NOT delete persistent data without telling me first.

Implement incrementally:

A. Product metadata/enums
B. Product interest/audience/occasion/role affinities
C. BudgetTier
D. BundleTemplate + slots
E. representative seed test data
F. hard eligibility service
G. scoring service
H. slot-based budget-aware generator
I. Premium Upgrade generator
J. GeneratedBundle snapshot persistence
K. POST /api/generated-bundles
L. GET /api/generated-bundles/{id}
M. Gift Finder → Configurator integration

Rules:
- no predefined actual bundle contents;
- explicit interest must outweigh gender/audience preference;
- hard constraints run before scoring;
- score candidates per slot, never global top-4;
- Standard Product COGS must stay within BudgetTier.max_item_cogs;
- generated results are immutable snapshots for the user session;
- use simple greedy+fallback before considering advanced optimization;
- no ML/AI recommender;
- no unrelated checkout/payment work.

Add tests for every business rule.

At the end report:
1. files changed;
2. migrations added/changed;
3. old entities/tables removed/deprecated;
4. scoring/generation logic summary;
5. test commands/results;
6. manual business data I still need to provide;
7. unresolved risks.
```
