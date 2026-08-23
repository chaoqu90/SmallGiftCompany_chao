package org.example.backend.catalog;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "generated_bundle_gift_bag")
public class GeneratedBundleGiftBag {

    @Id
    @Column(name = "generated_bundle_id")
    private Long generatedBundleId;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId
    @JoinColumn(name = "generated_bundle_id")
    private GeneratedBundle generatedBundle;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "gift_bag_option_id", nullable = false)
    private GiftBagOption giftBagOption;

    @Column(name = "name_snapshot", nullable = false, length = 100)
    private String nameSnapshot;

    @Column(name = "cost_snapshot", nullable = false, precision = 10, scale = 2)
    private BigDecimal costSnapshot;

    @Column(name = "retail_price_adjustment_snapshot", nullable = false, precision = 10, scale = 2)
    private BigDecimal retailPriceAdjustmentSnapshot = BigDecimal.ZERO;

    @Column(name = "is_default", nullable = false)
    private boolean isDefault = true;

    protected GeneratedBundleGiftBag() {}

    public GeneratedBundleGiftBag(GeneratedBundle generatedBundle, GiftBagOption giftBagOption) {
        this.generatedBundle = generatedBundle;
        this.giftBagOption = giftBagOption;
        this.nameSnapshot = giftBagOption.getName();
        this.costSnapshot = giftBagOption.getCost();
        this.retailPriceAdjustmentSnapshot = giftBagOption.getRetailPriceAdjustment();
        this.isDefault = giftBagOption.isDefault();
    }

    public Long getGeneratedBundleId()                         { return generatedBundleId; }
    public GeneratedBundle getGeneratedBundle()                { return generatedBundle; }
    public GiftBagOption getGiftBagOption()                    { return giftBagOption; }
    public String getNameSnapshot()                            { return nameSnapshot; }
    public BigDecimal getCostSnapshot()                        { return costSnapshot; }
    public BigDecimal getRetailPriceAdjustmentSnapshot()       { return retailPriceAdjustmentSnapshot; }
    public boolean isDefault()                                 { return isDefault; }
}
