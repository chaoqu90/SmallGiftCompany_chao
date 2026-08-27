/**
 * Request/response DTOs — camelCase field names for the API layer.
 *
 * Zod schemas provide runtime validation. TypeScript types are inferred from
 * the schemas so they stay in sync automatically.
 *
 * Maps to Java DTOs: BundleGenerationRequest, GeneratedBundleResponse,
 * GeneratedBundleItemDto, GeneratedBundleUpgradeDto, GeneratedBundleGiftBagDto,
 * EventCaptureRequest.
 */
import { z } from 'zod';

// ─── Bundle Generation ────────────────────────────────────────────────────────

/**
 * Zod schema for POST /api/generated-bundles request body.
 * Mirrors Spring Boot @Valid annotations on BundleGenerationRequest.java.
 */
export const BundleGenerationRequestSchema = z.object({
  /** Child's age — required, integer 3–12 inclusive (AC4.2) */
  age: z
    .number({ required_error: 'age is required', invalid_type_error: 'age must be a number' })
    .int()
    .min(3, 'age must be at least 3')
    .max(12, 'age must be at most 12'),

  /** Audience preference — required enum (AC4.2) */
  audiencePreference: z.enum(['FEMININE', 'MASCULINE', 'NO_PREFERENCE'], {
    required_error: 'audiencePreference is required',
    invalid_type_error: 'audiencePreference must be FEMININE, MASCULINE, or NO_PREFERENCE',
  }),

  /** Interest — required enum (AC4.2) */
  interest: z.enum(['POP_MUSIC', 'TOYS_PLAY', 'CUTE_MAGICAL', 'SPORTS', 'READING_PUZZLE'], {
    required_error: 'interest is required',
    invalid_type_error: 'interest must be one of POP_MUSIC, TOYS_PLAY, CUTE_MAGICAL, SPORTS, READING_PUZZLE',
  }),

  /** Party type — required enum (AC4.2) */
  partyType: z.enum(['CELEBRATION', 'HALLOWEEN'], {
    required_error: 'partyType is required',
    invalid_type_error: 'partyType must be CELEBRATION or HALLOWEEN',
  }),

  /** Budget tier code — required, 2–10 characters (AC4.2) */
  budgetTierCode: z
    .string({ required_error: 'budgetTierCode is required' })
    .min(2, 'budgetTierCode must be at least 2 characters')
    .max(10, 'budgetTierCode must be at most 10 characters'),

  /**
   * Maximum retail price ceiling — optional (nullable).
   * null = unconstrained (PATH 1); number = constrained (PATH 2+3).
   */
  maxRetailPrice: z.number().nullable().optional(),
});

export type BundleGenerationRequest = z.infer<typeof BundleGenerationRequestSchema>;

// ─── Analytics Event ──────────────────────────────────────────────────────────

/**
 * Zod schema for POST /api/analytics/events request body.
 * Mirrors Spring Boot @Valid annotations on EventCaptureRequest.java.
 */
export const EventCaptureRequestSchema = z.object({
  /** Event type — required, non-blank (AC6.2, AC6.4) */
  eventType: z
    .string({ required_error: 'eventType is required' })
    .min(1, 'eventType must not be blank'),

  /** Bundle public ID — optional (nullable) */
  bundleId: z.string().nullable().optional(),

  /** Session ID — optional (nullable) */
  sessionId: z.string().nullable().optional(),

  /** Arbitrary JSON string — optional (nullable) */
  metadataJson: z.string().nullable().optional(),
});

export type EventCaptureRequest = z.infer<typeof EventCaptureRequestSchema>;

// ─── Response DTOs ────────────────────────────────────────────────────────────

/**
 * One item in a generated bundle (one template slot filled).
 * Maps to Java: GeneratedBundleItemDto
 */
export interface GeneratedBundleItemDto {
  slotCode: string;
  productName: string;
  sku: string;
  description: string | null;
  formFactor: string;
  quantityPerBag: number;
  displayOrder: number;
}

/**
 * Standard + premium upgrade pair for a generated bundle.
 * Maps to Java: GeneratedBundleUpgradeDto
 */
export interface GeneratedBundleUpgradeDto {
  standardProductName: string | null;
  standardSku: string | null;
  standardRetailAdjustment: number | null;
  upgradedProductName: string | null;
  upgradedSku: string | null;
  upgradedRetailAdjustment: number | null;
}

/**
 * Gift bag snapshot for a generated bundle.
 * Maps to Java: GeneratedBundleGiftBagDto
 */
export interface GeneratedBundleGiftBagDto {
  code: string;
  name: string;
  retailPriceAdjustment: number;
  isDefault: boolean;
}

/**
 * Full generated bundle response.
 * Maps to Java: GeneratedBundleResponse
 * Returned for POST /api/generated-bundles (201) and GET /api/generated-bundles/:publicId (200).
 */
export interface GeneratedBundleResponse {
  generatedBundleId: string;      // public_id, format: gb_<12-char-hex>
  templateCode: string;
  standardItemCogsSnapshot: number;
  bundleRetailPrice: number;
  items: GeneratedBundleItemDto[];
  upgrade: GeneratedBundleUpgradeDto | null;
  giftBag: GeneratedBundleGiftBagDto | null;
}

// ─── RFC 7807 ProblemDetail ───────────────────────────────────────────────────

/**
 * Error response shape matching RFC 7807 ProblemDetail format.
 * Must match the Spring Boot GlobalExceptionHandler output exactly (AC11.1–AC11.5).
 */
export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  // Optional extension for bundle generation failures (AC11.3)
  failureCode?: string;
}

// ─── Admin request DTOs ───────────────────────────────────────────────────────

export const CreateProductRequestSchema = z.object({
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  cost: z.number().positive(),
  cogOverhead: z.number().min(0),
  inventoryQuantity: z.number().int().min(0),
  minAge: z.number().int().min(0).max(18),
  maxAge: z.number().int().min(0).max(18),
  category: z.string().min(1).max(30),
  formFactor: z.string().min(1).max(30),
  upgradeTier: z.enum(['STANDARD', 'PREMIUM']),
  themeCode: z.string().max(50).nullable().optional(),
});

export type CreateProductRequest = z.infer<typeof CreateProductRequestSchema>;

export const AffinityPayloadSchema = z.object({
  interests: z.array(z.object({
    interest: z.string().min(1),
    weight: z.number().int().min(0).max(100),
  })),
  audiences: z.array(z.object({
    audience: z.string().min(1),
    weight: z.number().int().min(0).max(100),
  })),
  roles: z.array(z.object({
    role: z.string().min(1),
    weight: z.number().int().min(0).max(100),
  })),
  occasions: z.array(z.object({
    occasion: z.string().min(1),
  })),
});

export type AffinityPayload = z.infer<typeof AffinityPayloadSchema>;
