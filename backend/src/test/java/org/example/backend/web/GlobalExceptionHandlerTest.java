package org.example.backend.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests for GlobalExceptionHandler using standaloneSetup — no Spring context,
 * no database. Each test verifies a security or correctness property of the
 * error-handling layer that future endpoints will rely on.
 */
class GlobalExceptionHandlerTest {

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(new StubController())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    // ── Stub controller ────────────────────────────────────────────────────

    @RestController
    static class StubController {

        /** Single required field — exercises @NotBlank edge cases. */
        record StubDto(@NotBlank String name) {}

        /** Two required fields — exercises multi-error aggregation. */
        record StubDtoMulti(@NotBlank String name, @NotBlank String email) {}

        /** Size-bounded field — used to verify user input is not echoed in errors. */
        record StubDtoSized(@Size(max = 5) String tag) {}

        @PostMapping("/stub/validate")
        String validate(@Valid @RequestBody StubDto dto) { return dto.name(); }

        @PostMapping("/stub/validate-multi")
        String validateMulti(@Valid @RequestBody StubDtoMulti dto) { return dto.name(); }

        @PostMapping("/stub/validate-sized")
        String validateSized(@Valid @RequestBody StubDtoSized dto) { return dto.tag(); }

        @GetMapping("/stub/runtime")
        String throwRuntime() { throw new RuntimeException("boom"); }
    }

    // ── Existing tests ─────────────────────────────────────────────────────

    @Test
    void validationError_returns400_withProblemDetailBody() throws Exception {
        mockMvc.perform(post("/stub/validate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.detail").value(Matchers.containsString("name")));
    }

    @Test
    void unknownException_returns500_withSafeMessageAndNoStackTrace() throws Exception {
        mockMvc.perform(get("/stub/runtime"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.title").value("Internal server error"))
                .andExpect(jsonPath("$.detail").value("An unexpected error occurred"));
    }

    @Test
    void methodNotAllowed_returns405_notMaskedAs500() throws Exception {
        mockMvc.perform(get("/stub/validate"))
                .andExpect(status().isMethodNotAllowed());
    }

    // ── Malformed input ────────────────────────────────────────────────────

    @Test
    void malformedJson_returns400_notInternalError() throws Exception {
        // A buggy or malicious client sending syntactically broken JSON must
        // get 400, not 500 — the exception handler must not leak server internals.
        mockMvc.perform(post("/stub/validate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{not valid json"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void emptyBody_returns400_notInternalError() throws Exception {
        // Content-Type: application/json with no body is a client error, not server.
        mockMvc.perform(post("/stub/validate")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest());
    }

    @Test
    void wrongContentType_returns415_notInternalError() throws Exception {
        // Sending text/plain to a JSON-only endpoint must yield 415,
        // not a 500 from a failed cast inside the handler.
        mockMvc.perform(post("/stub/validate")
                        .contentType(MediaType.TEXT_PLAIN)
                        .content("name=hello"))
                .andExpect(status().isUnsupportedMediaType());
    }

    // ── Boundary values ────────────────────────────────────────────────────

    @Test
    void whitespaceOnlyString_failsNotBlankConstraint() throws Exception {
        // @NotBlank rejects strings that are blank after trimming, not just empty.
        mockMvc.perform(post("/stub/validate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"   \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation failed"));
    }

    @Test
    void nullFieldValue_failsNotBlankConstraint() throws Exception {
        // An explicit JSON null must also fail @NotBlank.
        mockMvc.perform(post("/stub/validate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":null}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation failed"));
    }

    // ── Multiple errors ────────────────────────────────────────────────────

    @Test
    void multipleFieldErrors_allReportedInSingleDetail() throws Exception {
        // All field violations must be aggregated; the client should not need
        // to re-submit once per error.
        mockMvc.perform(post("/stub/validate-multi")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\",\"email\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(Matchers.containsString("name")))
                .andExpect(jsonPath("$.detail").value(Matchers.containsString("email")));
    }

    // ── Security: no information leakage ──────────────────────────────────

    @Test
    void errorResponse_neverContainsStackTrace() throws Exception {
        // A server-side RuntimeException must not expose class names, package
        // names, or line numbers to the client — these are reconnaissance data.
        MvcResult result = mockMvc.perform(get("/stub/runtime"))
                .andExpect(status().isInternalServerError())
                .andReturn();
        String body = result.getResponse().getContentAsString();
        assertThat(body)
                .doesNotContain("at org.")
                .doesNotContain("java.lang.RuntimeException")
                .doesNotContain("StubController");
    }

    @Test
    void errorResponse_doesNotEchoUserInput() throws Exception {
        // Constraint violation messages must contain the field name and rule,
        // never the user-supplied value — preventing reflected-XSS via error bodies.
        String injection = "<script>alert(document.cookie)</script>";
        MvcResult result = mockMvc.perform(post("/stub/validate-sized")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tag\":\"" + injection + "\"}"))
                .andExpect(status().isBadRequest())
                .andReturn();
        assertThat(result.getResponse().getContentAsString())
                .doesNotContain(injection)
                .doesNotContain("<script>");
    }
}
