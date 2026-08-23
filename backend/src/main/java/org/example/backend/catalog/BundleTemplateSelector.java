package org.example.backend.catalog;

import org.springframework.stereotype.Service;

@Service
public class BundleTemplateSelector {

    private final BundleTemplateRepository templateRepository;

    public BundleTemplateSelector(BundleTemplateRepository templateRepository) {
        this.templateRepository = templateRepository;
    }

    /**
     * Selects the appropriate BundleTemplate based on age and interest.
     *
     * Logic:
     * - age <= 5 → PRESCHOOL_4_ITEM
     * - age > 5 AND interest == READING_PUZZLE → READING_PUZZLE_4_ITEM (if active), else GENERAL_4_ITEM
     * - else → GENERAL_4_ITEM
     */
    public BundleTemplate selectTemplate(int age, Interest interest) {
        if (age <= 5) {
            return templateRepository.findByCodeAndActiveTrue("PRESCHOOL_4_ITEM")
                    .orElseThrow(() -> new BundleGenerationException(
                            BundleGenerationException.FailureCode.TEMPLATE_NOT_FOUND,
                            "PRESCHOOL_4_ITEM template not found or inactive"));
        }

        if (interest == Interest.READING_PUZZLE) {
            return templateRepository.findByCodeAndActiveTrue("READING_PUZZLE_4_ITEM")
                    .orElseGet(() -> templateRepository.findByCodeAndActiveTrue("GENERAL_4_ITEM")
                            .orElseThrow(() -> new BundleGenerationException(
                                    BundleGenerationException.FailureCode.TEMPLATE_NOT_FOUND,
                                    "GENERAL_4_ITEM template not found or inactive")));
        }

        return templateRepository.findByCodeAndActiveTrue("GENERAL_4_ITEM")
                .orElseThrow(() -> new BundleGenerationException(
                        BundleGenerationException.FailureCode.TEMPLATE_NOT_FOUND,
                        "GENERAL_4_ITEM template not found or inactive"));
    }
}
