package com.tttn.jobrecommendation.modules.skill.service;

import com.tttn.jobrecommendation.modules.skill.entity.Skill;
import com.tttn.jobrecommendation.modules.skill.repository.SkillRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * PostgreSQL upsert joins the profile transaction. Concurrent custom-skill names
 * reuse the winner without poisoning the transaction or leaving catalog orphans on rollback.
 */
@Service
@RequiredArgsConstructor
public class SkillCatalogService {

    private final SkillRepository skillRepository;

    public Optional<Skill> findByNormalizedName(String normalizedName) {
        return skillRepository.findByNormalizedName(normalizedName);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public Skill create(String name, String normalizedName, String category) {
        skillRepository.insertIfAbsent(name, normalizedName, category);
        return skillRepository.findByNormalizedName(normalizedName).orElseThrow();
    }
}
