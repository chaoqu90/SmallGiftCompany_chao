package org.example.backend.catalog;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Collection;
import java.util.List;

public interface ProductRoleAffinityRepository
        extends JpaRepository<ProductRoleAffinity, ProductRoleAffinityId> {

    List<ProductRoleAffinity> findAllByProductIdIn(Collection<Long> productIds);

    List<ProductRoleAffinity> findAllByProductId(Long productId);

    void deleteAllByProductId(Long productId);
}
