package org.example.backend.catalog;

import java.io.Serializable;
import java.util.Objects;

public class ProductAudienceAffinityId implements Serializable {

    private Long productId;
    private String audience;

    public ProductAudienceAffinityId() {}

    public ProductAudienceAffinityId(Long productId, String audience) {
        this.productId = productId;
        this.audience = audience;
    }

    public Long getProductId() { return productId; }
    public String getAudience() { return audience; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ProductAudienceAffinityId that)) return false;
        return Objects.equals(productId, that.productId) && Objects.equals(audience, that.audience);
    }

    @Override
    public int hashCode() {
        return Objects.hash(productId, audience);
    }
}
