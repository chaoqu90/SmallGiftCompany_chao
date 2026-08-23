package org.example.backend.catalog;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import java.net.URI;

@RestController
@RequestMapping("/api/generated-bundles")
public class GeneratedBundleController {

    private final GeneratedBundleService generatedBundleService;

    public GeneratedBundleController(GeneratedBundleService generatedBundleService) {
        this.generatedBundleService = generatedBundleService;
    }

    @PostMapping
    public ResponseEntity<GeneratedBundleResponse> generate(
            @RequestBody @Valid BundleGenerationRequest request) {
        GeneratedBundleResponse response = generatedBundleService.generate(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{publicId}")
                .buildAndExpand(response.generatedBundleId())
                .toUri();
        return ResponseEntity.created(location).body(response);
    }

    @GetMapping("/{publicId}")
    public ResponseEntity<GeneratedBundleResponse> getByPublicId(@PathVariable String publicId) {
        return ResponseEntity.ok(generatedBundleService.getByPublicId(publicId));
    }
}
