package com.tttn.jobrecommendation.modules.skill.repository;

import com.tttn.jobrecommendation.modules.skill.entity.Skill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface SkillRepository extends JpaRepository<Skill, Long>, JpaSpecificationExecutor<Skill> {

    Optional<Skill> findByNormalizedName(String normalizedName);

    boolean existsByNormalizedName(String normalizedName);

    @Modifying
    @Query(value = "INSERT INTO skills(name, normalized_name, category) VALUES (:name, :normalizedName, :category) ON CONFLICT DO NOTHING", nativeQuery = true)
    void insertIfAbsent(@Param("name") String name, @Param("normalizedName") String normalizedName, @Param("category") String category);
}
