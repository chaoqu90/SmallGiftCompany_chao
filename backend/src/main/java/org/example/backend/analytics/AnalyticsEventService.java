package org.example.backend.analytics;

import org.springframework.stereotype.Service;

@Service
public class AnalyticsEventService {

    private final AnalyticsEventRepository analyticsEventRepository;

    public AnalyticsEventService(AnalyticsEventRepository analyticsEventRepository) {
        this.analyticsEventRepository = analyticsEventRepository;
    }

    public void record(String eventType, String sessionId, String bundleId, String metadataJson) {
        analyticsEventRepository.save(new AnalyticsEvent(eventType, sessionId, bundleId, metadataJson));
    }

    public long countByType(String eventType) {
        return analyticsEventRepository.countByEventType(eventType);
    }
}
