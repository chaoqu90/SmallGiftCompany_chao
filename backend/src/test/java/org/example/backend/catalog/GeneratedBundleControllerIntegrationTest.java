package org.example.backend.catalog;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@Sql(scripts = {
        "/generation-test-cleanup.sql",
        "/generation-test-seed.sql"
}, executionPhase = Sql.ExecutionPhase.BEFORE_TEST_METHOD)
class GeneratedBundleControllerIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private static final String BASE_URL = "/api/generated-bundles";

    /** Unconstrained request — no retail price ceiling (slider at max). */
    private String validGeneralRequest() {
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

    /** Constrained request — retail price ceiling of $5.00. */
    private String constrainedRequest() {
        return """
                {
                  "age": 8,
                  "audiencePreference": "NO_PREFERENCE",
                  "interest": "POP_MUSIC",
                  "partyType": "CELEBRATION",
                  "budgetTierCode": "LOW",
                  "maxRetailPrice": 5.00
                }
                """;
    }

    /** Extracts the value of a JSON path from an MvcResult response body. */
    private String extractJsonPath(MvcResult result, String path) throws Exception {
        String body = result.getResponse().getContentAsString();
        // Simple extraction for "generatedBundleId" field
        com.jayway.jsonpath.DocumentContext ctx = com.jayway.jsonpath.JsonPath.parse(body);
        return ctx.read(path, String.class);
    }

    // ── POST: happy path ───────────────────────────────────────────────────────

    @Test
    void post_validRequest_returns201WithGeneratedBundleId() throws Exception {
        mockMvc.perform(post(BASE_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validGeneralRequest()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.generatedBundleId").value(startsWith("gb_")))
                .andExpect(jsonPath("$.templateCode").value("GENERAL_4_ITEM"))
                .andExpect(jsonPath("$.bundleRetailPrice").isNotEmpty());
    }

    @Test
    void post_validRequest_responseContains4Items() throws Exception {
        mockMvc.perform(post(BASE_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validGeneralRequest()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.items", hasSize(4)));
    }

    @Test
    void post_validRequest_itemsCoverAllRequiredSlots() throws Exception {
        MvcResult result = mockMvc.perform(post(BASE_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validGeneralRequest()))
                .andExpect(status().isCreated())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        com.jayway.jsonpath.DocumentContext ctx = com.jayway.jsonpath.JsonPath.parse(body);
        java.util.List<String> slotCodes = ctx.read("$.items[*].slotCode");

        // All 4 slots must be present and no duplicates
        assertThat(slotCodes).hasSize(4);
        assertThat(new java.util.HashSet<>(slotCodes)).hasSize(4);
    }

    @Test
    void post_constrainedRequest_retailPriceWithinCeiling() throws Exception {
        // PATH 2: when maxRetailPrice is set, slot item retail total must stay within the ceiling
        // (upgrade reserve is subtracted first, then slot items are chosen within remaining budget).
        MvcResult result = mockMvc.perform(post(BASE_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(constrainedRequest()))
                .andExpect(status().isCreated())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        com.jayway.jsonpath.DocumentContext ctx = com.jayway.jsonpath.JsonPath.parse(body);
        double bundleRetailPrice = ctx.read("$.bundleRetailPrice", Double.class);

        // bundleRetailPrice is the sum of slot item retail prices.
        // Combined with the standard upgrade (if any) it must not exceed the 5.00 ceiling.
        assertThat(bundleRetailPrice).isLessThanOrEqualTo(5.00);
    }

    // ── GET: happy path ────────────────────────────────────────────────────────

    @Test
    void get_existingPublicId_returns200WithSameData() throws Exception {
        // POST first
        MvcResult postResult = mockMvc.perform(post(BASE_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validGeneralRequest()))
                .andExpect(status().isCreated())
                .andReturn();

        String publicId = extractJsonPath(postResult, "$.generatedBundleId");

        // GET should return same data
        mockMvc.perform(get(BASE_URL + "/" + publicId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.generatedBundleId").value(publicId))
                .andExpect(jsonPath("$.templateCode").value("GENERAL_4_ITEM"))
                .andExpect(jsonPath("$.items", hasSize(4)));
    }

    // ── Snapshot immutability ──────────────────────────────────────────────────

    @Test
    void get_afterProductNameChange_snapshotUnchanged() throws Exception {
        // POST to generate bundle
        MvcResult postResult = mockMvc.perform(post(BASE_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validGeneralRequest()))
                .andExpect(status().isCreated())
                .andReturn();

        String publicId = extractJsonPath(postResult, "$.generatedBundleId");
        String originalItemName = com.jayway.jsonpath.JsonPath.parse(
                postResult.getResponse().getContentAsString()).read("$.items[0].productName");

        // Change the product name directly in DB (bypass entity layer)
        jdbcTemplate.update(
                "UPDATE product SET name = 'MODIFIED_NAME_FOR_TEST' WHERE name = ?",
                originalItemName);

        // GET bundle — snapshot should still show original name
        mockMvc.perform(get(BASE_URL + "/" + publicId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].productName").value(originalItemName));
    }

    // ── GET: not found ────────────────────────────────────────────────────────

    @Test
    void get_nonExistentPublicId_returns404() throws Exception {
        mockMvc.perform(get(BASE_URL + "/gb_nonexistent"))
                .andExpect(status().isNotFound());
    }

    // ── POST: validation errors ────────────────────────────────────────────────

    @Test
    void post_ageTooLow_returns400() throws Exception {
        String body = """
                {
                  "age": 2,
                  "audiencePreference": "NO_PREFERENCE",
                  "interest": "POP_MUSIC",
                  "partyType": "CELEBRATION",
                  "budgetTierCode": "LOW"
                }
                """;
        mockMvc.perform(post(BASE_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void post_unknownBudgetTierCode_returns422() throws Exception {
        String body = """
                {
                  "age": 8,
                  "audiencePreference": "NO_PREFERENCE",
                  "interest": "POP_MUSIC",
                  "partyType": "CELEBRATION",
                  "budgetTierCode": "UNKNOWN"
                }
                """;
        mockMvc.perform(post(BASE_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.failureCode")
                        .value("BUDGET_TIER_NOT_FOUND"));
    }

    // ── Preschool template ────────────────────────────────────────────────────

    @Test
    void post_age4_returnsPreschooolTemplate() throws Exception {
        String body = """
                {
                  "age": 4,
                  "audiencePreference": "NO_PREFERENCE",
                  "interest": "TOYS_PLAY",
                  "partyType": "CELEBRATION",
                  "budgetTierCode": "LOW"
                }
                """;
        mockMvc.perform(post(BASE_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.templateCode").value("PRESCHOOL_4_ITEM"));
    }

    // ── Halloween: celebration-only products excluded ─────────────────────────

    @Test
    void post_halloweenRequest_celebrationOnlyProductNotInItems() throws Exception {
        String body = """
                {
                  "age": 8,
                  "audiencePreference": "NO_PREFERENCE",
                  "interest": "POP_MUSIC",
                  "partyType": "HALLOWEEN",
                  "budgetTierCode": "LOW"
                }
                """;
        MvcResult result = mockMvc.perform(post(BASE_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();

        String responseBody = result.getResponse().getContentAsString();
        // The celebration-only product SKU should not appear in any item snapshot
        assertThat(responseBody).doesNotContain("T-CELE-001");
    }

    // ── Snapshot does not regenerate ─────────────────────────────────────────

    @Test
    void get_calledTwice_returnsSameData() throws Exception {
        MvcResult postResult = mockMvc.perform(post(BASE_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validGeneralRequest()))
                .andExpect(status().isCreated())
                .andReturn();

        String publicId = extractJsonPath(postResult, "$.generatedBundleId");

        String firstGet = mockMvc.perform(get(BASE_URL + "/" + publicId))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        String secondGet = mockMvc.perform(get(BASE_URL + "/" + publicId))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(firstGet).isEqualTo(secondGet);
    }

    // ── Interest dominates audience ───────────────────────────────────────────

    @Test
    void post_masculineAudience_cutemagicalInterest_itemsHaveHighCuteMagicalAffinity() throws Exception {
        // Even for MASCULINE audience preference, CUTE_MAGICAL interest should dominate.
        // Items should be selected from CUTE_MAGICAL-affinity products, not masculine-leaning ones.
        String body = """
                {
                  "age": 8,
                  "audiencePreference": "MASCULINE",
                  "interest": "CUTE_MAGICAL",
                  "partyType": "CELEBRATION",
                  "budgetTierCode": "LOW"
                }
                """;
        MvcResult result = mockMvc.perform(post(BASE_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();

        String responseBody = result.getResponse().getContentAsString();
        // Items should include CUTE_MAGICAL themed products (T-MAGIC-* SKUs have 95 affinity)
        // At least one item should match a T-MAGIC SKU
        assertThat(responseBody).contains("T-MAGIC");
    }
}
