package org.example.backend.catalog;

import java.math.BigDecimal;

public record GeneratedBundleGiftBagDto(
        String code,
        String name,
        BigDecimal retailPriceAdjustment,
        boolean isDefault
) {
    public static GeneratedBundleGiftBagDto from(GeneratedBundleGiftBag giftBag) {
        if (giftBag == null) {
            return null;
        }
        return new GeneratedBundleGiftBagDto(
                giftBag.getGiftBagOption().getCode(),
                giftBag.getNameSnapshot(),
                giftBag.getRetailPriceAdjustmentSnapshot(),
                giftBag.isDefault()
        );
    }
}
