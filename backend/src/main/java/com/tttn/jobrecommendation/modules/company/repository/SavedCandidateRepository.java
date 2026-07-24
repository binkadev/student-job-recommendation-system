package com.tttn.jobrecommendation.modules.company.repository;

import com.tttn.jobrecommendation.modules.company.entity.SavedCandidate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.domain.Specification;

import java.util.Optional;

public interface SavedCandidateRepository
        extends JpaRepository<SavedCandidate, Long>, JpaSpecificationExecutor<SavedCandidate> {

    boolean existsByCompanyIdAndApplicationId(Long companyId, Long applicationId);

    Optional<SavedCandidate> findByIdAndCompanyId(Long id, Long companyId);

    @Override
    @EntityGraph(attributePaths = {"student.user", "application.job", "application.cvFile"})
    Page<SavedCandidate> findAll(Specification<SavedCandidate> specification, Pageable pageable);
}
