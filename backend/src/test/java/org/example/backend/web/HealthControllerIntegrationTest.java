package org.example.backend.web;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class HealthControllerIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private MockMvc mockMvc;

    // ── Basic reachability ─────────────────────────────────────────────────

    @Test
    void healthEndpointIsReachableWithFullContext() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void healthEndpoint_respondsWithJsonContentType() throws Exception {
        // Clients that inspect Content-Type before parsing must receive JSON,
        // not HTML or plain text.
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON));
    }

    @Test
    void postToHealthEndpoint_returns405_notMaskedAs500() throws Exception {
        // Only GET is registered; POST must yield 405 Method Not Allowed, not 500.
        mockMvc.perform(post("/api/health"))
                .andExpect(status().isMethodNotAllowed());
    }

    // ── CORS: simple requests ──────────────────────────────────────────────

    @Test
    void corsHeader_presentForAllowedOrigin() throws Exception {
        mockMvc.perform(get("/api/health")
                        .header("Origin", "http://localhost:5173"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
    }

    @Test
    void corsHeader_absentForDisallowedOrigin_returns403() throws Exception {
        // Spring's CORS interceptor rejects disallowed origins with 403 Forbidden.
        mockMvc.perform(get("/api/health")
                        .header("Origin", "https://evil.example.com"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    @Test
    void requestWithoutOriginHeader_isNotBlockedByCors() throws Exception {
        // Non-cross-origin requests (server-to-server, curl, same-origin)
        // carry no Origin header and must never be rejected by CORS.
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    // ── CORS: preflight ────────────────────────────────────────────────────

    @Test
    void corsPreflightWithAllowedOrigin_returnsCorrectHeaders() throws Exception {
        // The browser sends a preflight OPTIONS before a cross-origin POST/PUT.
        // Spring must respond with the allowed origin and methods, or the browser
        // will block the actual request before it reaches the server.
        mockMvc.perform(options("/api/health")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().is2xxSuccessful())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
                .andExpect(header().exists("Access-Control-Allow-Methods"));
    }

    @Test
    void corsPreflightWithDisallowedOrigin_returns403() throws Exception {
        mockMvc.perform(options("/api/health")
                        .header("Origin", "https://evil.example.com")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden());
    }
}
