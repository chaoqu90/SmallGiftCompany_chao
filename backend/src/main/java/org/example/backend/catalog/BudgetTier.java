package org.example.backend.catalog;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "budget_tier")
public class BudgetTier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 10)
    private String code;

    @Column(name = "retail_min", nullable = false, precision = 10, scale = 2)
    private BigDecimal retailMin;

    @Column(name = "retail_max", nullable = false, precision = 10, scale = 2)
    private BigDecimal retailMax;

    @Column(name = "max_item_cogs", nullable = false, precision = 10, scale = 2)
    private BigDecimal maxItemCogs;

    @Column(name = "target_retail_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal targetRetailPrice;

    @Column(nullable = false)
    private boolean active = true;

    protected BudgetTier() {}

    public Long getId()                        { return id; }
    public String getCode()                    { return code; }
    public BigDecimal getRetailMin()           { return retailMin; }
    public BigDecimal getRetailMax()           { return retailMax; }
    public BigDecimal getMaxItemCogs()         { return maxItemCogs; }
    public BigDecimal getTargetRetailPrice()   { return targetRetailPrice; }
    public boolean isActive()                  { return active; }
}
