-- V23: Add analytics_event table for Phase 7 event capture.
-- bundle_id is VARCHAR (not FK) so events survive bundle deletion.

CREATE TABLE analytics_event (
    id            BIGSERIAL     PRIMARY KEY,
    event_type    VARCHAR(50)   NOT NULL,
    session_id    VARCHAR(100),
    bundle_id     VARCHAR(30),
    metadata_json TEXT,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_analytics_event_type       ON analytics_event (event_type);
CREATE INDEX idx_analytics_event_created_at ON analytics_event (created_at);
