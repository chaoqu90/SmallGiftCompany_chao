package org.example.backend.catalog;

import jakarta.persistence.*;

@Entity
@Table(name = "product_interest_affinity")
@IdClass(ProductInterestAffinityId.class)
public class ProductInterestAffinity {

    @Id
    @Column(name = "product_id")
    private Long productId;

    @Id
    @Column(name = "interest", length = 30)
    private String interest;

    @Column(nullable = false)
    private short weight;

    protected ProductInterestAffinity() {}

    public ProductInterestAffinity(Long productId, String interest, short weight) {
        this.productId = productId;
        this.interest = interest;
        this.weight = weight;
    }

    public Long getProductId() { return productId; }
    public String getInterest() { return interest; }
    public short getWeight() { return weight; }
}
