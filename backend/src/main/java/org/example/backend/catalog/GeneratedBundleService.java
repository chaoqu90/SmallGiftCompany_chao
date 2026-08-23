package org.example.backend.catalog;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class GeneratedBundleService {

    private final BundleGenerationService bundleGenerationService;
    private final GeneratedBundleRepository generatedBundleRepository;

    public GeneratedBundleService(BundleGenerationService bundleGenerationService,
                                   GeneratedBundleRepository generatedBundleRepository) {
        this.bundleGenerationService = bundleGenerationService;
        this.generatedBundleRepository = generatedBundleRepository;
    }

    /** Delegates to BundleGenerationService to generate and persist a new bundle. */
    public GeneratedBundleResponse generate(BundleGenerationRequest request) {
        GeneratedBundle bundle = bundleGenerationService.generate(request);
        return GeneratedBundleResponse.from(bundle);
    }

    /**
     * Loads an existing bundle snapshot by publicId. Does NOT regenerate.
     * Throws 404 if not found.
     */
    @Transactional(readOnly = true)
    public GeneratedBundleResponse getByPublicId(String publicId) {
        GeneratedBundle bundle = generatedBundleRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Generated bundle not found: " + publicId));

        // Force initialization of lazy associations within transaction
        bundle.getItems().size();
        if (bundle.getUpgrade() != null) {
            bundle.getUpgrade().getId();
        }
        if (bundle.getGiftBag() != null) {
            bundle.getGiftBag().getGiftBagOption().getCode();
        }
        bundle.getBundleTemplate().getCode();

        return GeneratedBundleResponse.from(bundle);
    }
}
