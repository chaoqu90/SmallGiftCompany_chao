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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@Sql(scripts = {
        "/generation-test-cleanup.sql",
        "/generation-test-seed.sql"
}, executionPhase = Sql.ExecutionPhase.BEFORE_TEST_METHOD)
class AdminProductAffinityControllerIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private Long firstProductId() {
        return jdbcTemplate.queryForObject("SELECT id FROM product LIMIT 1", Long.class);
    }

    private String affinitiesUrl(Long id) {
        return "/admin/api/products/" + id + "/affinities";
    }

    @Test
    void get_withoutCredentials_returns401() throws Exception {
        Long id = firstProductId();
        mockMvc.perform(get(affinitiesUrl(id)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void get_validProduct_returnsAffinities() throws Exception {
        Long id = firstProductId();
        mockMvc.perform(get(affinitiesUrl(id))
                .with(SecurityMockMvcRequestPostProcessors.httpBasic("admin", "changeme")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.interestWeights").exists())
                .andExpect(jsonPath("$.audienceWeights").exists())
                .andExpect(jsonPath("$.roleWeights").exists())
                .andExpect(jsonPath("$.occasions").exists());
    }

    @Test
    void put_updatesInterestWeight() throws Exception {
        Long id = firstProductId();

        // GET current affinities and derive a PUT body with SPORTS=75
        String putBody = """
                {
                  "interestWeights": { "SPORTS": 75 },
                  "audienceWeights": {},
                  "roleWeights": {},
                  "occasions": []
                }
                """;

        mockMvc.perform(put(affinitiesUrl(id))
                .with(SecurityMockMvcRequestPostProcessors.httpBasic("admin", "changeme"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(putBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.interestWeights.SPORTS").value(75));
    }

    @Test
    void put_addsNewInterestEntry() throws Exception {
        Long id = firstProductId();

        String putBody = """
                {
                  "interestWeights": { "RARE_HOBBY": 42 },
                  "audienceWeights": {},
                  "roleWeights": {},
                  "occasions": []
                }
                """;

        mockMvc.perform(put(affinitiesUrl(id))
                .with(SecurityMockMvcRequestPostProcessors.httpBasic("admin", "changeme"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(putBody))
                .andExpect(status().isOk());

        // GET again to confirm persistence
        mockMvc.perform(get(affinitiesUrl(id))
                .with(SecurityMockMvcRequestPostProcessors.httpBasic("admin", "changeme")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.interestWeights.RARE_HOBBY").value(42));
    }

    @Test
    void put_withoutCredentials_returns401() throws Exception {
        Long id = firstProductId();

        String putBody = """
                {
                  "interestWeights": {},
                  "audienceWeights": {},
                  "roleWeights": {},
                  "occasions": []
                }
                """;

        mockMvc.perform(put(affinitiesUrl(id))
                .contentType(MediaType.APPLICATION_JSON)
                .content(putBody))
                .andExpect(status().isUnauthorized());
    }
}
