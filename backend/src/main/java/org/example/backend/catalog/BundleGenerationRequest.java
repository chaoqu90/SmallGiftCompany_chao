package org.example.backend.catalog;

import jakarta.validation.constraints.*;

public record BundleGenerationRequest(
        @NotNull @Min(3) @Max(12) Integer age,
        @NotNull AudiencePreference audiencePreference,
        @NotNull Interest interest,
        @NotNull PartyType partyType,
        @NotNull @Size(min = 2, max = 10) String budgetTierCode,
        @DecimalMin(value = "0.01") java.math.BigDecimal maxRetailPrice  // nullable; null = no ceiling
) {}
