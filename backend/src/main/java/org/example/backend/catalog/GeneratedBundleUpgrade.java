package org.example.backend.catalog;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "generated_bundle_upgrade")
public class GeneratedBundleUpgrade {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "generated_bundle_id", nullable = false)
    private GeneratedBundle generatedBundle;

    // Standard product fields
    @Column(name = "standard_product_id")
    private Long standardProductId;

    @Column(name = "standard_product_name_snapshot", length = 100)
    private String standardProductNameSnapshot;

    @Column(name = "standard_sku_snapshot", length = 50)
    private String standardSkuSnapshot;

    @Column(name = "standard_cost_snapshot", precision = 10, scale = 2)
    private BigDecimal standardCostSnapshot;

    @Column(name = "standard_retail_adjustment_snapshot", precision = 10, scale = 2)
    private BigDecimal standardRetailAdjustmentSnapshot = BigDecimal.ZERO;

    // Premium product fields (existing)
    @Column(name = "product_id")
    private Long productId;

    @Column(name = "product_name_snapshot", length = 100)
    private String productNameSnapshot;

    @Column(name = "sku_snapshot", length = 50)
    private String skuSnapshot;

    @Column(name = "cost_snapshot", precision = 10, scale = 2)
    private BigDecimal costSnapshot;

    @Column(name = "retail_price_adjustment_snapshot", precision = 10, scale = 2)
    private BigDecimal retailPriceAdjustmentSnapshot = BigDecimal.ZERO;

    protected GeneratedBundleUpgrade() {}

    /** No-product fallback constructor. */
    public GeneratedBundleUpgrade(GeneratedBundle generatedBundle) {
        this.generatedBundle = generatedBundle;
    }

    /** Premium-only constructor (backward compat). Standard fields remain null. */
    public GeneratedBundleUpgrade(GeneratedBundle generatedBundle, Product product) {
        this.generatedBundle = generatedBundle;
        this.productId = product.getId();
        this.productNameSnapshot = product.getName();
        this.skuSnapshot = product.getSku();
        this.costSnapshot = product.getCost();
        this.retailPriceAdjustmentSnapshot = BigDecimal.ZERO;
    }

    /** Standard-only constructor. Premium fields remain null. */
    public GeneratedBundleUpgrade(GeneratedBundle generatedBundle,
                                  Product standardProduct, BigDecimal standardRetailAdj) {
        this.generatedBundle = generatedBundle;
        this.standardProductId = standardProduct.getId();
        this.standardProductNameSnapshot = standardProduct.getName();
        this.standardSkuSnapshot = standardProduct.getSku();
        this.standardCostSnapshot = standardProduct.getCost();
        this.standardRetailAdjustmentSnapshot = standardRetailAdj;
    }

    /** Two-product constructor: standard + premium. */
    public GeneratedBundleUpgrade(GeneratedBundle generatedBundle,
                                  Product standardProduct, BigDecimal standardRetailAdj,
                                  Product premiumProduct, BigDecimal premiumRetailAdj) {
        this.generatedBundle = generatedBundle;
        // Standard
        this.standardProductId = standardProduct.getId();
        this.standardProductNameSnapshot = standardProduct.getName();
        this.standardSkuSnapshot = standardProduct.getSku();
        this.standardCostSnapshot = standardProduct.getCost();
        this.standardRetailAdjustmentSnapshot = standardRetailAdj;
        // Premium
        this.productId = premiumProduct.getId();
        this.productNameSnapshot = premiumProduct.getName();
        this.skuSnapshot = premiumProduct.getSku();
        this.costSnapshot = premiumProduct.getCost();
        this.retailPriceAdjustmentSnapshot = premiumRetailAdj;
    }

    public Long getId()                                           { return id; }
    public GeneratedBundle getGeneratedBundle()                   { return generatedBundle; }

    // Standard getters
    public Long getStandardProductId()                            { return standardProductId; }
    public String getStandardProductNameSnapshot()                { return standardProductNameSnapshot; }
    public String getStandardSkuSnapshot()                        { return standardSkuSnapshot; }
    public BigDecimal getStandardCostSnapshot()                   { return standardCostSnapshot; }
    public BigDecimal getStandardRetailAdjustmentSnapshot()       { return standardRetailAdjustmentSnapshot; }

    // Premium getters
    public Long getProductId()                                    { return productId; }
    public String getProductNameSnapshot()                        { return productNameSnapshot; }
    public String getSkuSnapshot()                                { return skuSnapshot; }
    public BigDecimal getCostSnapshot()                           { return costSnapshot; }
    public BigDecimal getRetailPriceAdjustmentSnapshot()          { return retailPriceAdjustmentSnapshot; }
}
