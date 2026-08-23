package org.example.backend.analytics;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class AnalyticsControllerIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private static final String BASE_URL = "/api/analytics/events";

    @Test
    void post_validEvent_returns201() throws Exception {
        mockMvc.perform(post(BASE_URL)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "eventType": "FINDER_COMPLETED",
                          "bundleId": "gb_test123",
                          "sessionId": "sess_abc"
                        }
                        """))
                .andExpect(status().isCreated());
    }

    @Test
    void post_unknownEventType_returns201() throws Exception {
        mockMvc.perform(post(BASE_URL)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "eventType": "CUSTOM_TYPE",
                          "bundleId": "gb_test456",
                          "sessionId": "sess_xyz"
                        }
                        """))
                .andExpect(status().isCreated());
    }

    @Test
    void post_missingEventType_returns400() throws Exception {
        mockMvc.perform(post(BASE_URL)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "eventType": "",
                          "bundleId": "gb_test789"
                        }
                        """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void post_event_persistedInDatabase() throws Exception {
        mockMvc.perform(post(BASE_URL)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "eventType": "FINDER_COMPLETED",
                          "bundleId": "gb_persist_test",
                          "sessionId": "sess_persist"
                        }
                        """))
                .andExpect(status().isCreated());

        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM analytics_event WHERE event_type = 'FINDER_COMPLETED' AND bundle_id = 'gb_persist_test'",
                Integer.class);
        assertThat(count).isEqualTo(1);
    }
}
