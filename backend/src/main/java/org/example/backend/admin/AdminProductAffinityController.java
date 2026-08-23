package org.example.backend.admin;

import org.example.backend.catalog.*;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@RestController
@RequestMapping("/admin/api/products/{id}/affinities")
public class AdminProductAffinityController {

    private final ProductRepository productRepository;
    private final ProductInterestAffinityRepository interestRepo;
    private final ProductAudienceAffinityRepository audienceRepo;
    private final ProductRoleAffinityRepository roleRepo;
    private final ProductOccasionRepository occasionRepo;

    public AdminProductAffinityController(
            ProductRepository productRepository,
            ProductInterestAffinityRepository interestRepo,
            ProductAudienceAffinityRepository audienceRepo,
            ProductRoleAffinityRepository roleRepo,
            ProductOccasionRepository occasionRepo) {
        this.productRepository = productRepository;
        this.interestRepo = interestRepo;
        this.audienceRepo = audienceRepo;
        this.roleRepo = roleRepo;
        this.occasionRepo = occasionRepo;
    }

    record ProductAffinitiesDto(
        Map<String, Integer> interestWeights,
        Map<String, Integer> audienceWeights,
        Map<String, Integer> roleWeights,
        List<String> occasions
    ) {}

    private void requireProduct(Long id) {
        if (!productRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ProductAffinitiesDto get(@PathVariable Long id) {
        requireProduct(id);

        Map<String, Integer> interests = new LinkedHashMap<>();
        for (var a : interestRepo.findAllByProductId(id)) {
            interests.put(a.getInterest(), (int) a.getWeight());
        }

        Map<String, Integer> audiences = new LinkedHashMap<>();
        for (var a : audienceRepo.findAllByProductId(id)) {
            audiences.put(a.getAudience(), (int) a.getWeight());
        }

        Map<String, Integer> roles = new LinkedHashMap<>();
        for (var a : roleRepo.findAllByProductId(id)) {
            roles.put(a.getRole(), (int) a.getWeight());
        }

        List<String> occasions = occasionRepo.findAllByProductId(id)
            .stream().map(ProductOccasion::getOccasion).toList();

        return new ProductAffinitiesDto(interests, audiences, roles, occasions);
    }

    @PutMapping
    @Transactional
    public ProductAffinitiesDto update(@PathVariable Long id,
                                       @RequestBody ProductAffinitiesDto dto) {
        requireProduct(id);

        // Replace interest affinities
        interestRepo.deleteAllByProductId(id);
        if (dto.interestWeights() != null) {
            dto.interestWeights().forEach((interest, weight) ->
                interestRepo.save(new ProductInterestAffinity(id, interest, weight.shortValue())));
        }

        // Replace audience affinities
        audienceRepo.deleteAllByProductId(id);
        if (dto.audienceWeights() != null) {
            dto.audienceWeights().forEach((audience, weight) ->
                audienceRepo.save(new ProductAudienceAffinity(id, audience, weight.shortValue())));
        }

        // Replace role affinities
        roleRepo.deleteAllByProductId(id);
        if (dto.roleWeights() != null) {
            dto.roleWeights().forEach((role, weight) ->
                roleRepo.save(new ProductRoleAffinity(id, role, weight.shortValue())));
        }

        // Replace occasions
        occasionRepo.deleteAllByProductId(id);
        if (dto.occasions() != null) {
            dto.occasions().forEach(occasion ->
                occasionRepo.save(new ProductOccasion(id, occasion)));
        }

        return get(id);
    }
}
