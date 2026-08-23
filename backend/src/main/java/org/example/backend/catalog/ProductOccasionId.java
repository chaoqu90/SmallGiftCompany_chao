package org.example.backend.catalog;

import java.io.Serializable;
import java.util.Objects;

public class ProductOccasionId implements Serializable {

    private Long productId;
    private String occasion;

    public ProductOccasionId() {}

    public ProductOccasionId(Long productId, String occasion) {
        this.productId = productId;
        this.occasion = occasion;
    }

    public Long getProductId() { return productId; }
    public String getOccasion() { return occasion; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ProductOccasionId that)) return false;
        return Objects.equals(productId, that.productId) && Objects.equals(occasion, that.occasion);
    }

    @Override
    public int hashCode() {
        return Objects.hash(productId, occasion);
    }
}
