package org.example.backend.catalog;

import java.io.Serializable;
import java.util.Objects;

public class ProductRoleAffinityId implements Serializable {

    private Long productId;
    private String role;

    public ProductRoleAffinityId() {}

    public ProductRoleAffinityId(Long productId, String role) {
        this.productId = productId;
        this.role = role;
    }

    public Long getProductId() { return productId; }
    public String getRole() { return role; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ProductRoleAffinityId that)) return false;
        return Objects.equals(productId, that.productId) && Objects.equals(role, that.role);
    }

    @Override
    public int hashCode() {
        return Objects.hash(productId, role);
    }
}
