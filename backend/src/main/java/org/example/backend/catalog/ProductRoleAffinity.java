package org.example.backend.catalog;

import jakarta.persistence.*;

@Entity
@Table(name = "product_role_affinity")
@IdClass(ProductRoleAffinityId.class)
public class ProductRoleAffinity {

    @Id
    @Column(name = "product_id")
    private Long productId;

    @Id
    @Column(name = "role", length = 20)
    private String role;

    @Column(nullable = false)
    private short weight;

    protected ProductRoleAffinity() {}

    public ProductRoleAffinity(Long productId, String role, short weight) {
        this.productId = productId;
        this.role = role;
        this.weight = weight;
    }

    public Long getProductId() { return productId; }
    public String getRole() { return role; }
    public short getWeight() { return weight; }
}
