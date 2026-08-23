package org.example.backend.catalog;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "gift_bag_option")
public class GiftBagOption {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 30)
    private String code;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal cost;

    @Column(name = "retail_price_adjustment", nullable = false, precision = 10, scale = 2)
    private BigDecimal retailPriceAdjustment;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "is_default", nullable = false)
    private boolean isDefault = false;

    protected GiftBagOption() {}

    public Long getId()                            { return id; }
    public String getCode()                        { return code; }
    public String getName()                        { return name; }
    public String getDescription()                 { return description; }
    public BigDecimal getCost()                    { return cost; }
    public BigDecimal getRetailPriceAdjustment()   { return retailPriceAdjustment; }
    public boolean isActive()                      { return active; }
    public boolean isDefault()                     { return isDefault; }
}
