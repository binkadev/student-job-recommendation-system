package com.tttn.jobrecommendation.modules.company.service.impl;

import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.common.utils.PageableUtils;
import com.tttn.jobrecommendation.modules.company.dto.request.AdminCompanyFilterRequest;
import com.tttn.jobrecommendation.modules.company.dto.request.AdminCompanyStatusUpdateRequest;
import com.tttn.jobrecommendation.modules.company.dto.response.AdminCompanyResponse;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.company.mapper.CompanyMapper;
import com.tttn.jobrecommendation.modules.company.repository.CompanyRepository;
import com.tttn.jobrecommendation.modules.company.service.AdminCompanyService;
import com.tttn.jobrecommendation.modules.job.repository.CompanyOpenJobsCount;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminCompanyServiceImpl implements AdminCompanyService {

    private static final Map<String, String> ALLOWED_SORTS = Map.of(
            "id", "id",
            "companyName", "companyName",
            "taxCode", "taxCode",
            "industry", "industry",
            "status", "status",
            "createdAt", "createdAt",
            "updatedAt", "updatedAt"
    );

    private final CompanyRepository companyRepository;
    private final JobRepository jobRepository;
    private final CompanyMapper companyMapper;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<AdminCompanyResponse> getCompanies(AdminCompanyFilterRequest request) {
        Pageable pageable = PageableUtils.createPageable(
                request.getPage(),
                request.getSize(),
                request.getSort(),
                "createdAt",
                Sort.Direction.DESC,
                ALLOWED_SORTS
        );

        Page<Company> companies = companyRepository.findAll(buildAdminSpecification(request), pageable);
        Map<Long, Long> openJobCounts = getOpenJobCounts(companies.getContent());
        List<AdminCompanyResponse> items = companies.getContent()
                .stream()
                .map(company -> companyMapper.toAdminCompanyResponse(
                        company,
                        openJobCounts.getOrDefault(company.getId(), 0L)
                ))
                .toList();

        return new PageResponse<>(
                items,
                companies.getNumber() + 1,
                companies.getSize(),
                companies.getTotalElements(),
                companies.getTotalPages()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public AdminCompanyResponse getCompany(Long id) {
        Company company = getCompanyById(id);
        return companyMapper.toAdminCompanyResponse(company, countOpenJobs(company));
    }

    @Override
    @Transactional
    public AdminCompanyResponse updateStatus(Long id, AdminCompanyStatusUpdateRequest request) {
        Company company = getCompanyById(id);
        company.setStatus(request.getStatus());
        Company savedCompany = companyRepository.save(company);
        return companyMapper.toAdminCompanyResponse(savedCompany, countOpenJobs(savedCompany));
    }

    private Specification<Company> buildAdminSpecification(AdminCompanyFilterRequest request) {
        return (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (StringUtils.hasText(request.getKeyword())) {
                String keyword = likeValue(request.getKeyword());
                predicates.add(criteriaBuilder.or(
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("companyName")), keyword),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("taxCode")), keyword),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("industry")), keyword),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("description")), keyword),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("address")), keyword),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("phone")), keyword),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("user").get("email")), keyword)
                ));
            }

            if (StringUtils.hasText(request.getCompanyName())) {
                predicates.add(criteriaBuilder.like(
                        criteriaBuilder.lower(root.get("companyName")),
                        likeValue(request.getCompanyName())
                ));
            }

            if (StringUtils.hasText(request.getTaxCode())) {
                predicates.add(criteriaBuilder.like(
                        criteriaBuilder.lower(root.get("taxCode")),
                        likeValue(request.getTaxCode())
                ));
            }

            if (StringUtils.hasText(request.getIndustry())) {
                predicates.add(criteriaBuilder.like(
                        criteriaBuilder.lower(root.get("industry")),
                        likeValue(request.getIndustry())
                ));
            }

            if (request.getStatus() != null) {
                predicates.add(criteriaBuilder.equal(root.get("status"), request.getStatus()));
            }

            return criteriaBuilder.and(predicates.toArray(new Predicate[0]));
        };
    }

    private Map<Long, Long> getOpenJobCounts(List<Company> companies) {
        List<Long> companyIds = companies.stream()
                .map(Company::getId)
                .toList();
        if (companyIds.isEmpty()) {
            return Map.of();
        }

        return jobRepository.countOpenJobsByCompanyIds(companyIds, JobStatus.ACTIVE)
                .stream()
                .collect(Collectors.toMap(CompanyOpenJobsCount::getCompanyId, CompanyOpenJobsCount::getOpenJobs));
    }

    private Long countOpenJobs(Company company) {
        return jobRepository.countByCompanyIdAndStatus(company.getId(), JobStatus.ACTIVE);
    }

    private Company getCompanyById(Long id) {
        return companyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Company not found"));
    }

    private String likeValue(String value) {
        return "%" + value.trim().toLowerCase(Locale.ROOT) + "%";
    }
}
