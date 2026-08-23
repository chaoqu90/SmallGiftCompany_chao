package org.example.backend.catalog;

import java.math.BigDecimal;

public record GeneratedBundleUpgradeDto(
        String standardProductName,
        String standardSku,
        BigDecimal standardRetailAdjustment,
        String upgradedProductName,
        String upgradedSku,
        BigDecimal upgradedRetailAdjustment
) {
    public static GeneratedBundleUpgradeDto from(GeneratedBundleUpgrade upgrade) {
        if (upgrade == null) return null;
        // Must have at least a standard product to be worth returning
        if (upgrade.getStandardProductNameSnapshot() == null
                && upgrade.getProductNameSnapshot() == null) return null;
        return new GeneratedBundleUpgradeDto(
                upgrade.getStandardProductNameSnapshot(),
                upgrade.getStandardSkuSnapshot(),
                upgrade.getStandardRetailAdjustmentSnapshot(),
                upgrade.getProductNameSnapshot(),       // premium (nullable)
                upgrade.getSkuSnapshot(),               // premium (nullable)
                upgrade.getRetailPriceAdjustmentSnapshot()
        );
    }
}
