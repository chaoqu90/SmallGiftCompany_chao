package org.example.backend.catalog;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Collection;
import java.util.List;

public interface ProductAudienceAffinityRepository
        extends JpaRepository<ProductAudienceAffinity, ProductAudienceAffinityId> {

    List<ProductAudienceAffinity> findAllByProductIdIn(Collection<Long> productIds);

    List<ProductAudienceAffinity> findAllByProductId(Long productId);

    void deleteAllByProductId(Long productId);
}
