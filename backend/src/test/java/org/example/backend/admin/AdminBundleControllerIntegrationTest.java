package org.example.backend.admin;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@Sql(scripts = {
        "/generation-test-cleanup.sql",
        "/generation-test-seed.sql"
}, executionPhase = Sql.ExecutionPhase.BEFORE_TEST_METHOD)
class AdminBundleControllerIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private MockMvc mockMvc;

    private static final String ADMIN_BASE_URL = "/admin/api/bundles";
    private static final String BUNDLES_URL = "/api/generated-bundles";

    private String validGenerationRequest() {
        return """
                {
                  "age": 8,
                  "audiencePreference": "NO_PREFERENCE",
                  "interest": "POP_MUSIC",
                  "partyType": "CELEBRATION",
                  "budgetTierCode": "LOW"
                }
                """;
    }

    private String createBundleAndExtractPublicId() throws Exception {
        MvcResult result = mockMvc.perform(post(BUNDLES_URL)
                .contentType(MediaType.APPLICATION_JSON)
                .content(validGenerationRequest()))
                .andExpect(status().isCreated())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        com.jayway.jsonpath.DocumentContext ctx = com.jayway.jsonpath.JsonPath.parse(body);
        return ctx.read("$.generatedBundleId", String.class);
    }

    @Test
    void get_list_withoutCredentials_returns401() throws Exception {
        mockMvc.perform(get(ADMIN_BASE_URL + "/"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void get_list_empty_returns200WithEmptyArray() throws Exception {
        mockMvc.perform(get(ADMIN_BASE_URL + "/")
                .with(SecurityMockMvcRequestPostProcessors.httpBasic("admin", "changeme")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void get_list_afterBundleCreated_returnsBundleEntry() throws Exception {
        mockMvc.perform(post(BUNDLES_URL)
                .contentType(MediaType.APPLICATION_JSON)
                .content(validGenerationRequest()))
                .andExpect(status().isCreated());

        mockMvc.perform(get(ADMIN_BASE_URL + "/")
                .with(SecurityMockMvcRequestPostProcessors.httpBasic("admin", "changeme")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))));
    }

    @Test
    void get_detail_existingBundle_returns200WithItems() throws Exception {
        String publicId = createBundleAndExtractPublicId();

        mockMvc.perform(get(ADMIN_BASE_URL + "/" + publicId)
                .with(SecurityMockMvcRequestPostProcessors.httpBasic("admin", "changeme")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.items", hasSize(greaterThan(0))));
    }

    @Test
    void get_detail_nonexistent_returns404() throws Exception {
        mockMvc.perform(get(ADMIN_BASE_URL + "/gb_nonexistent")
                .with(SecurityMockMvcRequestPostProcessors.httpBasic("admin", "changeme")))
                .andExpect(status().isNotFound());
    }
}
