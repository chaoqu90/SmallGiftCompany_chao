package org.example.backend.catalog;

import jakarta.persistence.*;

@Entity
@Table(name = "product_occasion")
@IdClass(ProductOccasionId.class)
public class ProductOccasion {

    @Id
    @Column(name = "product_id")
    private Long productId;

    @Id
    @Column(name = "occasion", length = 20)
    private String occasion;

    protected ProductOccasion() {}

    public ProductOccasion(Long productId, String occasion) {
        this.productId = productId;
        this.occasion = occasion;
    }

    public Long getProductId() { return productId; }
    public String getOccasion() { return occasion; }
}
