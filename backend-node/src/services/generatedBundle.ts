/**
 * Generated bundle retrieval service.
 *
 * Thin service wrapping the repository call. Used by the GET /api/generated-bundles/:publicId
 * and GET /admin/api/bundles/:publicId endpoints.
 *
 * Maps the GeneratedBundleAggregate to GeneratedBundleResponse DTO.
 */
import type { GeneratedBundleResponse } from '../types/dtos.js';
import * as generatedBundlesRepo from '../repositories/generatedBundles.js';

/**
 * Retrieves a bundle by public ID and maps it to the API response DTO.
 * Returns null if not found (route handler returns 404).
 */
export async function getByPublicId(
  publicId: string,
): Promise<GeneratedBundleResponse | null> {
  const agg = await generatedBundlesRepo.findBundleByPublicId(publicId);
  if (!agg) return null;

  const { bundle, items, upgrade, giftBag, templateCode } = agg;

  return {
    generatedBundleId: bundle.public_id,
    templateCode,
    standardItemCogsSnapshot: parseFloat(bundle.standard_item_cogs_snapshot),
    bundleRetailPrice: bundle.base_retail_price ? parseFloat(bundle.base_retail_price) : 0,
    items: items.map(item => ({
      slotCode: item.slot_code,
      productName: item.product_name_snapshot,
      sku: item.sku_snapshot,
      description: item.description_snapshot,
      formFactor: item.form_factor_snapshot,
      quantityPerBag: item.quantity_per_bag,
      displayOrder: item.display_order,
    })),
    upgrade:
      upgrade && (upgrade.standard_product_name_snapshot || upgrade.product_name_snapshot)
        ? {
            standardProductName: upgrade.standard_product_name_snapshot,
            standardSku: upgrade.standard_sku_snapshot,
            standardRetailAdjustment: upgrade.standard_retail_adjustment_snapshot
              ? parseFloat(upgrade.standard_retail_adjustment_snapshot)
              : null,
            upgradedProductName: upgrade.product_name_snapshot,
            upgradedSku: upgrade.sku_snapshot,
            upgradedRetailAdjustment: upgrade.retail_price_adjustment_snapshot
              ? parseFloat(upgrade.retail_price_adjustment_snapshot)
              : null,
          }
        : null,
    giftBag: giftBag
      ? {
          code: giftBag.gift_bag_option_code ?? '',
          name: giftBag.name_snapshot,
          retailPriceAdjustment: parseFloat(giftBag.retail_price_adjustment_snapshot),
          isDefault: giftBag.is_default,
        }
      : null,
  };
}
