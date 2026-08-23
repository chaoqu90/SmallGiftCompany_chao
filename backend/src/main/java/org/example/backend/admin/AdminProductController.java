package org.example.backend.admin;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.example.backend.catalog.FormFactor;
import org.example.backend.catalog.Product;
import org.example.backend.catalog.ProductCategory;
import org.example.backend.catalog.ProductRepository;
import org.example.backend.catalog.UpgradeTier;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/admin/api/products")
public class AdminProductController {

    private final ProductRepository productRepository;

    public AdminProductController(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    record AdminProductDto(
        Long id, String sku, String name, boolean active,
        int inventoryQuantity, BigDecimal cost,
        BigDecimal cogAdjusted, BigDecimal retailPrice,
        String upgradeTier, String category,
        String formFactor, short minAge, short maxAge
    ) {}

    record InventoryUpdateRequest(@Min(0) int quantity) {}

    record ActiveUpdateRequest(boolean active) {}

    record PricingUpdateRequest(
        @NotNull @DecimalMin("0.00") BigDecimal cost,
        @NotNull @DecimalMin("0.00") BigDecimal cogOverhead
    ) {}

    record CategoryUpdateRequest(@NotBlank String category) {}

    record UpgradeTierUpdateRequest(@NotBlank String upgradeTier) {}

    record AgeRangeUpdateRequest(
        @Min(3) @Max(12) short minAge,
        @Min(3) @Max(12) short maxAge
    ) {}

    record DetailsUpdateRequest(
        @NotBlank String name,
        @NotBlank String category,
        @NotBlank String formFactor
    ) {}

    record CreateProductRequest(
        @NotBlank String sku,
        @NotBlank String name,
        String description,
        @NotNull @DecimalMin("0.00") BigDecimal cost,
        @NotNull @DecimalMin("0.00") BigDecimal cogOverhead,
        @NotBlank String category,
        @NotBlank String upgradeTier,
        @NotBlank String formFactor,
        @Min(3) @Max(12) short minAge,
        @Min(3) @Max(12) short maxAge
    ) {}

    record ProductMetaDto(
        List<String> categories,
        List<String> upgradeTiers,
        List<String> formFactors
    ) {}

    private AdminProductDto toDto(Product p) {
        return new AdminProductDto(
            p.getId(), p.getSku(), p.getName(), p.isActive(),
            p.getInventoryQuantity(), p.getCost(),
            p.getCogAdjusted(), p.getRetailPrice(),
            p.getUpgradeTier().name(), p.getCategory().name(),
            p.getFormFactor().name(), p.getMinAge(), p.getMaxAge()
        );
    }

    @GetMapping("/")
    public List<AdminProductDto> listAll() {
        return productRepository.findAll(
                org.springframework.data.domain.Sort.by("name"))
            .stream()
            .map(this::toDto)
            .toList();
    }

    @PatchMapping("/{id}/inventory")
    public ResponseEntity<AdminProductDto> updateInventory(
            @PathVariable Long id,
            @RequestBody @Valid InventoryUpdateRequest request) {
        Product product = productRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        product.setInventoryQuantity(request.quantity());
        productRepository.save(product);
        return ResponseEntity.ok(toDto(product));
    }

    @PatchMapping("/{id}/active")
    public ResponseEntity<AdminProductDto> updateActive(
            @PathVariable Long id,
            @RequestBody ActiveUpdateRequest request) {
        Product product = productRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        product.setActive(request.active());
        productRepository.save(product);
        return ResponseEntity.ok(toDto(product));
    }

    private static final java.math.BigDecimal C1  = new java.math.BigDecimal("1");
    private static final java.math.BigDecimal C4  = new java.math.BigDecimal("4");
    private static final java.math.BigDecimal C10 = new java.math.BigDecimal("10");

    private static BigDecimal computeRetailPrice(BigDecimal cogAdjusted) {
        if (cogAdjusted.compareTo(C1) < 0) {
            return new BigDecimal("0.50");
        } else if (cogAdjusted.compareTo(C4) < 0) {
            return cogAdjusted.divide(new BigDecimal("2"), 2, java.math.RoundingMode.HALF_UP);
        } else if (cogAdjusted.compareTo(C10) < 0) {
            BigDecimal part = cogAdjusted.divide(new BigDecimal("3"), 10, java.math.RoundingMode.HALF_UP);
            return part.add(new BigDecimal("2").divide(new BigDecimal("3"), 10, java.math.RoundingMode.HALF_UP))
                       .setScale(2, java.math.RoundingMode.HALF_UP);
        } else {
            return cogAdjusted.multiply(new BigDecimal("0.4")).setScale(2, java.math.RoundingMode.HALF_UP);
        }
    }

    @PatchMapping("/{id}/pricing")
    public ResponseEntity<AdminProductDto> updatePricing(
            @PathVariable Long id,
            @RequestBody @Valid PricingUpdateRequest request) {
        Product product = productRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        BigDecimal cogAdjusted = request.cost().add(request.cogOverhead());
        product.setCost(request.cost());
        product.setCogOverhead(request.cogOverhead());
        product.setCogAdjusted(cogAdjusted);
        product.setRetailPrice(computeRetailPrice(cogAdjusted));
        productRepository.save(product);
        return ResponseEntity.ok(toDto(product));
    }

    @PatchMapping("/{id}/category")
    public ResponseEntity<AdminProductDto> updateCategory(
            @PathVariable Long id,
            @RequestBody @Valid CategoryUpdateRequest request) {
        Product product = productRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        ProductCategory category;
        try {
            category = ProductCategory.valueOf(request.category());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown category: " + request.category());
        }
        product.setCategory(category);
        productRepository.save(product);
        return ResponseEntity.ok(toDto(product));
    }

    @PatchMapping("/{id}/upgrade-tier")
    public ResponseEntity<AdminProductDto> updateUpgradeTier(
            @PathVariable Long id,
            @RequestBody @Valid UpgradeTierUpdateRequest request) {
        Product product = productRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        UpgradeTier tier;
        try {
            tier = UpgradeTier.valueOf(request.upgradeTier());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown upgrade tier: " + request.upgradeTier());
        }
        product.setUpgradeTier(tier);
        productRepository.save(product);
        return ResponseEntity.ok(toDto(product));
    }

    @PatchMapping("/{id}/age-range")
    public ResponseEntity<AdminProductDto> updateAgeRange(
            @PathVariable Long id,
            @RequestBody @Valid AgeRangeUpdateRequest request) {
        Product product = productRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        product.setMinAge(request.minAge());
        product.setMaxAge(request.maxAge());
        productRepository.save(product);
        return ResponseEntity.ok(toDto(product));
    }

    @PatchMapping("/{id}/details")
    public ResponseEntity<AdminProductDto> updateDetails(
            @PathVariable Long id,
            @RequestBody @Valid DetailsUpdateRequest request) {
        Product product = productRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        product.setName(request.name());
        try {
            product.setCategory(ProductCategory.valueOf(request.category()));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown category: " + request.category());
        }
        try {
            product.setFormFactor(FormFactor.valueOf(request.formFactor()));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown form factor: " + request.formFactor());
        }
        productRepository.save(product);
        return ResponseEntity.ok(toDto(product));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!productRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        try {
            productRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Product has existing bundle references and cannot be deleted. Deactivate it instead.");
        }
    }

    @PostMapping("/")
    public ResponseEntity<AdminProductDto> create(@RequestBody @Valid CreateProductRequest request) {
        ProductCategory category;
        try { category = ProductCategory.valueOf(request.category()); }
        catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown category: " + request.category());
        }
        UpgradeTier tier;
        try { tier = UpgradeTier.valueOf(request.upgradeTier()); }
        catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown upgrade tier: " + request.upgradeTier());
        }
        FormFactor formFactor;
        try { formFactor = FormFactor.valueOf(request.formFactor()); }
        catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown form factor: " + request.formFactor());
        }

        BigDecimal cogAdjusted = request.cost().add(request.cogOverhead());
        Product product = new Product();
        product.setSku(request.sku());
        product.setName(request.name());
        product.setDescription(request.description());
        product.setCost(request.cost());
        product.setCogOverhead(request.cogOverhead());
        product.setCogAdjusted(cogAdjusted);
        product.setRetailPrice(computeRetailPrice(cogAdjusted));
        product.setCategory(category);
        product.setUpgradeTier(tier);
        product.setFormFactor(formFactor);
        product.setMinAge(request.minAge());
        product.setMaxAge(request.maxAge());
        product.setInventoryQuantity(0);
        product.setActive(true);
        productRepository.save(product);
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(product));
    }

    @GetMapping("/meta")
    public ProductMetaDto meta() {
        return new ProductMetaDto(
            java.util.Arrays.stream(ProductCategory.values()).map(Enum::name).toList(),
            java.util.Arrays.stream(UpgradeTier.values()).map(Enum::name).toList(),
            java.util.Arrays.stream(FormFactor.values()).map(Enum::name).toList()
        );
    }
}
