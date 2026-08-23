package org.example.backend.analytics;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final AnalyticsEventService analyticsEventService;

    public AnalyticsController(AnalyticsEventService analyticsEventService) {
        this.analyticsEventService = analyticsEventService;
    }

    record EventCaptureRequest(
        @NotBlank String eventType,
        String bundleId,
        String sessionId,
        String metadataJson
    ) {}

    @PostMapping("/events")
    public ResponseEntity<Void> captureEvent(@RequestBody @Valid EventCaptureRequest request) {
        analyticsEventService.record(
            request.eventType(),
            request.sessionId(),
            request.bundleId(),
            request.metadataJson()
        );
        return ResponseEntity.status(201).build();
    }
}
