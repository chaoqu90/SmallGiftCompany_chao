package org.example.backend.catalog;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface BudgetTierRepository extends JpaRepository<BudgetTier, Long> {

    Optional<BudgetTier> findByCode(String code);

    Optional<BudgetTier> findByCodeAndActiveTrue(String code);
}
