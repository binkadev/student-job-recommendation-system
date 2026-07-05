package com.tttn.jobrecommendation.modules.company.repository;

import com.tttn.jobrecommendation.modules.company.entity.Company;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CompanyRepository extends JpaRepository<Company, Long> {

    Optional<Company> findByUserId(Long userId);
}
