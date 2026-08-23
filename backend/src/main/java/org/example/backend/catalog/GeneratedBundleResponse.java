package org.example.backend.catalog;

import java.math.BigDecimal;
import java.util.List;

public record GeneratedBundleResponse(
        String generatedBundleId,
        String templateCode,
        BigDecimal standardItemCogsSnapshot,
        BigDecimal bundleRetailPrice,
        List<GeneratedBundleItemDto> items,
        GeneratedBundleUpgradeDto upgrade,
        GeneratedBundleGiftBagDto giftBag
) {
    public static GeneratedBundleResponse from(GeneratedBundle bundle) {
        return new GeneratedBundleResponse(
                bundle.getPublicId(),
                bundle.getBundleTemplate().getCode(),
                bundle.getStandardItemCogsSnapshot(),
                bundle.getBaseRetailPrice(),
                bundle.getItems().stream().map(GeneratedBundleItemDto::from).toList(),
                GeneratedBundleUpgradeDto.from(bundle.getUpgrade()),
                GeneratedBundleGiftBagDto.from(bundle.getGiftBag())
        );
    }
}
