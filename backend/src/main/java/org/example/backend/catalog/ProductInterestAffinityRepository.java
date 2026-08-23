package org.example.backend.catalog;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Collection;
import java.util.List;

public interface ProductInterestAffinityRepository
        extends JpaRepository<ProductInterestAffinity, ProductInterestAffinityId> {

    List<ProductInterestAffinity> findAllByProductIdIn(Collection<Long> productIds);

    List<ProductInterestAffinity> findAllByProductId(Long productId);

    void deleteAllByProductId(Long productId);
}
