/**
 * TypeScript string union types mirroring the Java enum classes exactly.
 *
 * Using union types rather than the `enum` keyword avoids ESM transpilation
 * quirks and keeps the bundle smaller. All values match the Java enum constant
 * names verbatim.
 */

/** Maps to Java: ProductCategory */
export type ProductCategory =
  | 'STATIONERY'
  | 'BOOK'
  | 'PUZZLE'
  | 'TOY'
  | 'ACCESSORY'
  | 'WEARABLE'
  | 'COLLECTIBLE'
  | 'NOVELTY'
  | 'ACTIVITY'
  | 'SPORT'
  | 'STICKER_TATTOO'
  | 'OTHER';

/** Maps to Java: FormFactor */
export type FormFactor =
  | 'BAR'
  | 'FLAT_RECT'
  | 'ROUND'
  | 'CUBE'
  | 'IRREGULAR_VOLUME'
  | 'SMALL_VOLUME'
  | 'OTHER';

/** Maps to Java: UpgradeTier */
export type UpgradeTier = 'STANDARD' | 'PREMIUM';

/** Maps to Java: Interest */
export type Interest =
  | 'POP_MUSIC'
  | 'TOYS_PLAY'
  | 'CUTE_MAGICAL'
  | 'SPORTS'
  | 'READING_PUZZLE';

/** Maps to Java: PartyType */
export type PartyType = 'CELEBRATION' | 'HALLOWEEN';

/** Maps to Java: AudiencePreference (request-side — what the customer requests) */
export type AudiencePreference = 'FEMININE' | 'MASCULINE' | 'NO_PREFERENCE';

/** Maps to Java: AudienceAffinity (product-side — how a product is tagged) */
export type AudienceAffinity = 'FEMININE' | 'MASCULINE' | 'UNIVERSAL';

/**
 * Maps to Java: BundleRole.
 * Extended with NOVELTY, COLLECTIBLE, SIMPLE_TOY, READING, PUZZLE roles used in
 * bundle template slot configuration (see V7 seed migration).
 */
export type BundleRole =
  | 'UTILITY'
  | 'ACTIVITY'
  | 'PLAY'
  | 'TACTILE'
  | 'WEARABLE'
  | 'PREMIUM'
  | 'NOVELTY'
  | 'COLLECTIBLE'
  | 'SIMPLE_TOY'
  | 'READING'
  | 'PUZZLE';

// ─── Runtime arrays for validation and iteration ────────────────────────────

export const ALL_PRODUCT_CATEGORIES: ProductCategory[] = [
  'STATIONERY', 'BOOK', 'PUZZLE', 'TOY', 'ACCESSORY', 'WEARABLE',
  'COLLECTIBLE', 'NOVELTY', 'ACTIVITY', 'SPORT', 'STICKER_TATTOO', 'OTHER',
];

export const ALL_FORM_FACTORS: FormFactor[] = [
  'BAR', 'FLAT_RECT', 'ROUND', 'CUBE', 'IRREGULAR_VOLUME', 'SMALL_VOLUME', 'OTHER',
];

export const ALL_UPGRADE_TIERS: UpgradeTier[] = ['STANDARD', 'PREMIUM'];

export const ALL_INTERESTS: Interest[] = [
  'POP_MUSIC', 'TOYS_PLAY', 'CUTE_MAGICAL', 'SPORTS', 'READING_PUZZLE',
];

export const ALL_PARTY_TYPES: PartyType[] = ['CELEBRATION', 'HALLOWEEN'];

export const ALL_AUDIENCE_PREFERENCES: AudiencePreference[] = [
  'FEMININE', 'MASCULINE', 'NO_PREFERENCE',
];

export const ALL_AUDIENCE_AFFINITIES: AudienceAffinity[] = [
  'FEMININE', 'MASCULINE', 'UNIVERSAL',
];

export const ALL_BUNDLE_ROLES: BundleRole[] = [
  'UTILITY', 'ACTIVITY', 'PLAY', 'TACTILE', 'WEARABLE', 'PREMIUM',
  'NOVELTY', 'COLLECTIBLE', 'SIMPLE_TOY', 'READING', 'PUZZLE',
];
