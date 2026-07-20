package com.tttn.jobrecommendation.modules.company.service.impl;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.common.utils.PageableUtils;
import com.tttn.jobrecommendation.modules.company.dto.request.PublicCompanyFilterRequest;
import com.tttn.jobrecommendation.modules.company.dto.response.CompanyJobSummaryResponse;
import com.tttn.jobrecommendation.modules.company.dto.response.PublicCompanyDetailResponse;
import com.tttn.jobrecommendation.modules.company.dto.response.PublicCompanyResponse;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.company.mapper.CompanyMapper;
import com.tttn.jobrecommendation.modules.company.repository.CompanyRepository;
import com.tttn.jobrecommendation.modules.company.service.PublicCompanyService;
import com.tttn.jobrecommendation.modules.job.entity.Job;
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
public class PublicCompanyServiceImpl implements PublicCompanyService {

    private static final Map<String, String> ALLOWED_SORTS = Map.of(
            "id", "id",
            "companyName", "companyName",
            "industry", "industry",
            "address", "address",
            "createdAt", "createdAt",
            "updatedAt", "updatedAt"
    );

    private final CompanyRepository companyRepository;
    private final JobRepository jobRepository;
    private final CompanyMapper companyMapper;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<PublicCompanyResponse> getCompanies(PublicCompanyFilterRequest request) {
        Pageable pageable = PageableUtils.createPageable(
                request.getPage(),
                request.getSize(),
                request.getSort(),
                "createdAt",
                Sort.Direction.DESC,
                ALLOWED_SORTS
        );

        Page<Company> companies = companyRepository.findAll(buildPublicSpecification(request), pageable);
        Map<Long, Long> openJobCounts = getOpenJobCounts(companies.getContent());
        List<PublicCompanyResponse> items = companies.getContent()
                .stream()
                .map(company -> companyMapper.toPublicCompanyResponse(
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
    public PublicCompanyDetailResponse getCompany(Long id) {
        Company company = companyRepository.findById(id)
                .filter(item -> item.getStatus() == CompanyStatus.VERIFIED)
                .orElseThrow(() -> new ResourceNotFoundException("Company not found"));

        List<Job> jobs = jobRepository.findByCompanyIdAndStatusOrderByPublishedAtDescIdDesc(id, JobStatus.ACTIVE);
        List<CompanyJobSummaryResponse> jobResponses = jobs.stream()
                .map(companyMapper::toCompanyJobSummaryResponse)
                .toList();

        return companyMapper.toPublicCompanyDetailResponse(company, (long) jobResponses.size(), jobResponses);
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

    private Specification<Company> buildPublicSpecification(PublicCompanyFilterRequest request) {
        return (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(criteriaBuilder.equal(root.get("status"), CompanyStatus.VERIFIED));

            if (StringUtils.hasText(request.getKeyword())) {
                String keyword = likeValue(request.getKeyword());
                predicates.add(criteriaBuilder.or(
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("companyName")), keyword),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("industry")), keyword),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("description")), keyword),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("address")), keyword),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("websiteUrl")), keyword)
                ));
            }

            if (StringUtils.hasText(request.getLocation())) {
                predicates.add(criteriaBuilder.like(
                        criteriaBuilder.lower(root.get("address")),
                        likeValue(request.getLocation())
                ));
            }

            if (StringUtils.hasText(request.getIndustry())) {
                predicates.add(criteriaBuilder.like(
                        criteriaBuilder.lower(root.get("industry")),
                        likeValue(request.getIndustry())
                ));
            }

            return criteriaBuilder.and(predicates.toArray(new Predicate[0]));
        };
    }

    private String likeValue(String value) {
        return "%" + value.trim().toLowerCase(Locale.ROOT) + "%";
    }
}
