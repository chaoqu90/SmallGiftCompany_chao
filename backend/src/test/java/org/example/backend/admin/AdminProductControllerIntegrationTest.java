package org.example.backend.admin;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@Sql(scripts = {
        "/generation-test-cleanup.sql",
        "/generation-test-seed.sql"
}, executionPhase = Sql.ExecutionPhase.BEFORE_TEST_METHOD)
class AdminProductControllerIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private static final String BASE_URL = "/admin/api/products";

    @Test
    void get_withoutCredentials_returns401() throws Exception {
        mockMvc.perform(get(BASE_URL + "/"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void get_withCredentials_returns200() throws Exception {
        mockMvc.perform(get(BASE_URL + "/")
                .with(SecurityMockMvcRequestPostProcessors.httpBasic("admin", "changeme")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void patch_inventory_updates_quantity() throws Exception {
        Long productId = jdbcTemplate.queryForObject("SELECT id FROM product LIMIT 1", Long.class);

        mockMvc.perform(patch(BASE_URL + "/" + productId + "/inventory")
                .with(SecurityMockMvcRequestPostProcessors.httpBasic("admin", "changeme"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"quantity\": 42}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.inventoryQuantity").value(42));
    }

    @Test
    void patch_active_deactivates_product() throws Exception {
        Long productId = jdbcTemplate.queryForObject("SELECT id FROM product LIMIT 1", Long.class);

        mockMvc.perform(patch(BASE_URL + "/" + productId + "/active")
                .with(SecurityMockMvcRequestPostProcessors.httpBasic("admin", "changeme"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\": false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
    }

    @Test
    void patch_inventory_negativeQuantity_returns400() throws Exception {
        Long productId = jdbcTemplate.queryForObject("SELECT id FROM product LIMIT 1", Long.class);

        mockMvc.perform(patch(BASE_URL + "/" + productId + "/inventory")
                .with(SecurityMockMvcRequestPostProcessors.httpBasic("admin", "changeme"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"quantity\": -1}"))
                .andExpect(status().isBadRequest());
    }
}
