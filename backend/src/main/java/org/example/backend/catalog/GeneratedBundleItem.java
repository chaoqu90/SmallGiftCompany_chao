package org.example.backend.catalog;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "generated_bundle_item")
public class GeneratedBundleItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "generated_bundle_id", nullable = false)
    private GeneratedBundle generatedBundle;

    @Column(name = "slot_code", nullable = false, length = 30)
    private String slotCode;

    @Column(name = "product_id", nullable = false)
    private Long productId;

    @Column(name = "product_name_snapshot", nullable = false, length = 100)
    private String productNameSnapshot;

    @Column(name = "sku_snapshot", nullable = false, length = 50)
    private String skuSnapshot;

    @Column(name = "cost_snapshot", nullable = false, precision = 10, scale = 2)
    private BigDecimal costSnapshot;

    @Column(name = "description_snapshot", columnDefinition = "TEXT")
    private String descriptionSnapshot;

    @Column(name = "form_factor_snapshot", nullable = false, length = 30)
    private String formFactorSnapshot;

    @Column(name = "quantity_per_bag", nullable = false)
    private short quantityPerBag = 1;

    @Column(name = "display_order", nullable = false)
    private short displayOrder;

    protected GeneratedBundleItem() {}

    public GeneratedBundleItem(GeneratedBundle generatedBundle, String slotCode, Product product,
                                short displayOrder) {
        this.generatedBundle = generatedBundle;
        this.slotCode = slotCode;
        this.productId = product.getId();
        this.productNameSnapshot = product.getName();
        this.skuSnapshot = product.getSku();
        this.costSnapshot = product.getCost();
        this.descriptionSnapshot = product.getDescription();
        this.formFactorSnapshot = product.getFormFactor().name();
        this.quantityPerBag = 1;
        this.displayOrder = displayOrder;
    }

    public Long getId()                        { return id; }
    public GeneratedBundle getGeneratedBundle() { return generatedBundle; }
    public String getSlotCode()                { return slotCode; }
    public Long getProductId()                 { return productId; }
    public String getProductNameSnapshot()     { return productNameSnapshot; }
    public String getSkuSnapshot()             { return skuSnapshot; }
    public BigDecimal getCostSnapshot()        { return costSnapshot; }
    public String getDescriptionSnapshot()     { return descriptionSnapshot; }
    public String getFormFactorSnapshot()      { return formFactorSnapshot; }
    public short getQuantityPerBag()           { return quantityPerBag; }
    public short getDisplayOrder()             { return displayOrder; }
}
