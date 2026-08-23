package org.example.backend.analytics;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AnalyticsEventRepository extends JpaRepository<AnalyticsEvent, Long> {

    long countByEventType(String eventType);
}
