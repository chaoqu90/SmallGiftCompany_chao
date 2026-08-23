package org.example.backend.catalog;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface GeneratedBundleRepository extends JpaRepository<GeneratedBundle, Long> {

    Optional<GeneratedBundle> findByPublicId(String publicId);

    List<GeneratedBundle> findAllByOrderByCreatedAtDesc();
}
