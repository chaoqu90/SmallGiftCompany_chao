package org.example.backend.catalog;

import java.io.Serializable;
import java.util.Objects;

public class ProductInterestAffinityId implements Serializable {

    private Long productId;
    private String interest;

    public ProductInterestAffinityId() {}

    public ProductInterestAffinityId(Long productId, String interest) {
        this.productId = productId;
        this.interest = interest;
    }

    public Long getProductId() { return productId; }
    public String getInterest() { return interest; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ProductInterestAffinityId that)) return false;
        return Objects.equals(productId, that.productId) && Objects.equals(interest, that.interest);
    }

    @Override
    public int hashCode() {
        return Objects.hash(productId, interest);
    }
}
