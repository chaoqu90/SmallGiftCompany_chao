package org.example.backend.catalog;

public record GeneratedBundleItemDto(
        String slotCode,
        String productName,
        String sku,
        String description,
        String formFactor,
        int quantityPerBag,
        int displayOrder
) {
    public static GeneratedBundleItemDto from(GeneratedBundleItem item) {
        return new GeneratedBundleItemDto(
                item.getSlotCode(),
                item.getProductNameSnapshot(),
                item.getSkuSnapshot(),
                item.getDescriptionSnapshot(),
                item.getFormFactorSnapshot(),
                item.getQuantityPerBag(),
                item.getDisplayOrder()
        );
    }
}
