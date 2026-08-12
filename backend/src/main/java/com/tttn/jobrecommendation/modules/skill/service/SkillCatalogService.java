package com.tttn.jobrecommendation.modules.skill.service;

import com.tttn.jobrecommendation.modules.skill.entity.Skill;
import com.tttn.jobrecommendation.modules.skill.repository.SkillRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Persists user-entered catalog skills in an isolated transaction so a unique-index
 * race can be recovered by reading the winner instead of poisoning the caller's
 * replacement transaction.
 */
@Service
@RequiredArgsConstructor
public class SkillCatalogService {

    private final SkillRepository skillRepository;

    public Optional<Skill> findByNormalizedName(String normalizedName) {
        return skillRepository.findByNormalizedName(normalizedName);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Skill create(String name, String normalizedName, String category) {
        return skillRepository.saveAndFlush(Skill.builder()
                .name(name)
                .normalizedName(normalizedName)
                .category(category)
                .build());
    }
}
