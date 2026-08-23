package org.example.backend.catalog;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface GiftBagOptionRepository extends JpaRepository<GiftBagOption, Long> {

    Optional<GiftBagOption> findByIsDefaultTrue();
}
