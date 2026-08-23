package org.example.backend.admin;

import org.example.backend.catalog.GeneratedBundle;
import org.example.backend.catalog.GeneratedBundleItem;
import org.example.backend.catalog.GeneratedBundleRepository;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/admin/api/bundles")
public class AdminBundleController {

    private final GeneratedBundleRepository generatedBundleRepository;

    public AdminBundleController(GeneratedBundleRepository generatedBundleRepository) {
        this.generatedBundleRepository = generatedBundleRepository;
    }

    record AdminBundleListDto(
        Long id, String publicId, int requestedAge,
        String audiencePreference, String interest, String partyType,
        String templateCode, BigDecimal baseRetailPrice,
        String status, Instant createdAt
    ) {}

    record AdminBundleItemDto(
        String slotCode, String productName, String sku, String formFactor
    ) {}

    record AdminBundleDetailDto(
        Long id, String publicId, int requestedAge,
        String audiencePreference, String interest, String partyType,
        String templateCode, BigDecimal baseRetailPrice,
        String status, Instant createdAt,
        List<AdminBundleItemDto> items
    ) {}

    private AdminBundleListDto toListDto(GeneratedBundle bundle) {
        return new AdminBundleListDto(
            bundle.getId(),
            bundle.getPublicId(),
            bundle.getRequestedAge(),
            bundle.getAudiencePreference().name(),
            bundle.getInterest().name(),
            bundle.getPartyType().name(),
            bundle.getBundleTemplate().getCode(),
            bundle.getBaseRetailPrice(),
            bundle.getStatus(),
            bundle.getCreatedAt()
        );
    }

    private AdminBundleItemDto toItemDto(GeneratedBundleItem item) {
        return new AdminBundleItemDto(
            item.getSlotCode(),
            item.getProductNameSnapshot(),
            item.getSkuSnapshot(),
            item.getFormFactorSnapshot()
        );
    }

    @GetMapping("/")
    @Transactional(readOnly = true)
    public List<AdminBundleListDto> listBundles() {
        return generatedBundleRepository.findAllByOrderByCreatedAtDesc()
            .stream()
            .limit(200)
            .map(this::toListDto)
            .toList();
    }

    @GetMapping("/{publicId}")
    @Transactional(readOnly = true)
    public AdminBundleDetailDto getBundle(@PathVariable String publicId) {
        GeneratedBundle bundle = generatedBundleRepository.findByPublicId(publicId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        List<AdminBundleItemDto> items = bundle.getItems().stream()
            .map(this::toItemDto)
            .toList();

        return new AdminBundleDetailDto(
            bundle.getId(),
            bundle.getPublicId(),
            bundle.getRequestedAge(),
            bundle.getAudiencePreference().name(),
            bundle.getInterest().name(),
            bundle.getPartyType().name(),
            bundle.getBundleTemplate().getCode(),
            bundle.getBaseRetailPrice(),
            bundle.getStatus(),
            bundle.getCreatedAt(),
            items
        );
    }
}
