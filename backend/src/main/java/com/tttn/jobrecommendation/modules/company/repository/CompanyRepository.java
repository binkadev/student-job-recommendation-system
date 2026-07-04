package com.tttn.jobrecommendation.modules.company.repository;

import com.tttn.jobrecommendation.modules.company.entity.Company;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CompanyRepository extends JpaRepository<Company, Long> {
}
