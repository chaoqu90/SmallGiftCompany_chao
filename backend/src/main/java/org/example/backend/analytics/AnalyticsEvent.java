package org.example.backend.analytics;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "analytics_event")
public class AnalyticsEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_type", nullable = false, length = 50)
    private String eventType;

    @Column(name = "session_id", length = 100)
    private String sessionId;

    @Column(name = "bundle_id", length = 30)
    private String bundleId;

    @Column(name = "metadata_json", columnDefinition = "TEXT")
    private String metadataJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected AnalyticsEvent() {}

    public AnalyticsEvent(String eventType, String sessionId, String bundleId, String metadataJson) {
        this.eventType = eventType;
        this.sessionId = sessionId;
        this.bundleId = bundleId;
        this.metadataJson = metadataJson;
        this.createdAt = Instant.now();
    }

    public Long getId()           { return id; }
    public String getEventType()  { return eventType; }
    public String getSessionId()  { return sessionId; }
    public String getBundleId()   { return bundleId; }
    public String getMetadataJson() { return metadataJson; }
    public Instant getCreatedAt() { return createdAt; }
}
