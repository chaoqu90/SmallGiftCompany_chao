package org.example.backend.catalog;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Collection;
import java.util.List;

public interface ProductOccasionRepository
        extends JpaRepository<ProductOccasion, ProductOccasionId> {

    List<ProductOccasion> findAllByProductIdIn(Collection<Long> productIds);

    List<ProductOccasion> findAllByProductId(Long productId);

    void deleteAllByProductId(Long productId);
}
