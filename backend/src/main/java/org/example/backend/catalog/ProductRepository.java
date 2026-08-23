package org.example.backend.catalog;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Collection;
import java.util.List;

public interface ProductRepository extends JpaRepository<Product, Long> {

    List<Product> findAllByActiveTrue();

    List<Product> findByIdIn(Collection<Long> ids);
}
