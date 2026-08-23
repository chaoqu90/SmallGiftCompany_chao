package org.example.backend.catalog;

import jakarta.persistence.*;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "product")
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String sku;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(name = "cost", nullable = false, precision = 10, scale = 2)
    private BigDecimal cost;

    @Column(name = "cog_overhead", nullable = false, precision = 10, scale = 2)
    private BigDecimal cogOverhead;

    @Column(name = "cog_adjusted", nullable = false, precision = 10, scale = 2)
    private BigDecimal cogAdjusted;

    @Column(name = "retail_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal retailPrice;

    @Column(name = "inventory_quantity", nullable = false)
    private int inventoryQuantity;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "min_age", nullable = false)
    private short minAge;

    @Column(name = "max_age", nullable = false)
    private short maxAge;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ProductCategory category;

    @Enumerated(EnumType.STRING)
    @Column(name = "form_factor", nullable = false, length = 30)
    private FormFactor formFactor;

    @Enumerated(EnumType.STRING)
    @Column(name = "upgrade_tier", nullable = false, length = 20)
    private UpgradeTier upgradeTier;

    @Column(name = "theme_code", length = 50)
    private String themeCode;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public Product() {}

    public Long getId()                    { return id; }
    public String getSku()                 { return sku; }
    public String getName()                { return name; }
    public String getDescription()         { return description; }
    public String getImageUrl()            { return imageUrl; }
    public BigDecimal getCost()            { return cost; }
    public BigDecimal getCogOverhead()     { return cogOverhead; }
    public BigDecimal getCogAdjusted()     { return cogAdjusted; }
    public BigDecimal getRetailPrice()     { return retailPrice; }
    public int getInventoryQuantity()      { return inventoryQuantity; }
    public boolean isActive()              { return active; }
    public short getMinAge()               { return minAge; }
    public short getMaxAge()               { return maxAge; }
    public ProductCategory getCategory()   { return category; }
    public FormFactor getFormFactor()      { return formFactor; }
    public UpgradeTier getUpgradeTier()    { return upgradeTier; }
    public String getThemeCode()           { return themeCode; }
    public Instant getCreatedAt()          { return createdAt; }
    public Instant getUpdatedAt()          { return updatedAt; }

    public void setInventoryQuantity(int inventoryQuantity) { this.inventoryQuantity = inventoryQuantity; }
    public void setActive(boolean active) { this.active = active; }

    public void setSku(String sku)                       { this.sku = sku; }
    public void setName(String name)                     { this.name = name; }
    public void setDescription(String description)       { this.description = description; }
    public void setImageUrl(String imageUrl)             { this.imageUrl = imageUrl; }
    public void setCost(BigDecimal cost)                 { this.cost = cost; }
    public void setCogOverhead(BigDecimal cogOverhead)   { this.cogOverhead = cogOverhead; }
    public void setCogAdjusted(BigDecimal cogAdjusted)   { this.cogAdjusted = cogAdjusted; }
    public void setRetailPrice(BigDecimal retailPrice)   { this.retailPrice = retailPrice; }
    public void setMinAge(short minAge)                  { this.minAge = minAge; }
    public void setMaxAge(short maxAge)                  { this.maxAge = maxAge; }
    public void setCategory(ProductCategory category)    { this.category = category; }
    public void setFormFactor(FormFactor formFactor)     { this.formFactor = formFactor; }
    public void setUpgradeTier(UpgradeTier upgradeTier)  { this.upgradeTier = upgradeTier; }
    public void setThemeCode(String themeCode)           { this.themeCode = themeCode; }

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
        updatedAt = Instant.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
