package org.example.backend.catalog;

import jakarta.persistence.*;

@Entity
@Table(name = "product_audience_affinity")
@IdClass(ProductAudienceAffinityId.class)
public class ProductAudienceAffinity {

    @Id
    @Column(name = "product_id")
    private Long productId;

    @Id
    @Column(name = "audience", length = 20)
    private String audience;

    @Column(nullable = false)
    private short weight;

    protected ProductAudienceAffinity() {}

    public ProductAudienceAffinity(Long productId, String audience, short weight) {
        this.productId = productId;
        this.audience = audience;
        this.weight = weight;
    }

    public Long getProductId() { return productId; }
    public String getAudience() { return audience; }
    public short getWeight() { return weight; }
}
