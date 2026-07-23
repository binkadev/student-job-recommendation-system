package com.tttn.jobrecommendation.modules.job.service;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.job.dto.request.PublicJobFilterRequest;
import com.tttn.jobrecommendation.modules.job.dto.response.PublicJobDetailResponse;
import com.tttn.jobrecommendation.modules.job.dto.response.PublicJobResponse;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.entity.JobSkill;
import com.tttn.jobrecommendation.modules.job.mapper.PublicJobMapper;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.job.repository.JobSkillRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PublicJobServiceImpl implements PublicJobService {

    private final JobRepository jobRepository;
    private final JobSkillRepository jobSkillRepository;
    private final PublicJobMapper publicJobMapper;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<PublicJobResponse> getJobs(PublicJobFilterRequest request) {
        Pageable pageable = PageRequest.of(
                request.getPage() - 1,
                request.getSize(),
                Sort.by(
                        Sort.Order.desc("publishedAt"),
                        Sort.Order.desc("createdAt")
                )
        );
        Page<Job> jobs = jobRepository.findAll(buildPublicSpecification(request, LocalDate.now()), pageable);
        Map<Long, List<JobSkill>> skillsByJobId = getSkillsByJobId(jobs.getContent());
        List<PublicJobResponse> items = jobs.getContent()
                .stream()
                .map(job -> publicJobMapper.toPublicJobResponse(
                        job,
                        skillsByJobId.getOrDefault(job.getId(), List.of())
                ))
                .toList();

        return new PageResponse<>(
                items,
                jobs.getNumber() + 1,
                jobs.getSize(),
                jobs.getTotalElements(),
                jobs.getTotalPages()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public PublicJobDetailResponse getJob(Long jobId) {
        Job job = jobRepository.findPublicById(
                        jobId,
                        JobStatus.ACTIVE,
                        CompanyStatus.VERIFIED,
                        LocalDate.now()
                )
                .orElseThrow(() -> new ResourceNotFoundException("Job not found"));
        List<JobSkill> jobSkills = jobSkillRepository.findByJobIdOrderByIdAsc(job.getId());
        return publicJobMapper.toPublicJobDetailResponse(job, jobSkills);
    }

    private Specification<Job> buildPublicSpecification(PublicJobFilterRequest request, LocalDate today) {
        return (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(criteriaBuilder.equal(root.get("status"), JobStatus.ACTIVE));
            predicates.add(criteriaBuilder.equal(root.get("company").get("status"), CompanyStatus.VERIFIED));
            predicates.add(criteriaBuilder.or(
                    criteriaBuilder.isNull(root.get("deadline")),
                    criteriaBuilder.greaterThanOrEqualTo(root.get("deadline"), today)
            ));

            if (StringUtils.hasText(request.getKeyword())) {
                String keyword = likeValue(request.getKeyword());
                predicates.add(criteriaBuilder.or(
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("title")), keyword),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("description")), keyword),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("requirements")), keyword)
                ));
            }

            if (StringUtils.hasText(request.getLocation())) {
                predicates.add(criteriaBuilder.like(
                        criteriaBuilder.lower(root.get("location")),
                        likeValue(request.getLocation())
                ));
            }

            if (request.getJobType() != null) {
                predicates.add(criteriaBuilder.equal(root.get("jobType"), request.getJobType()));
            }

            if (request.getWorkingModel() != null) {
                predicates.add(criteriaBuilder.equal(root.get("workingModel"), request.getWorkingModel()));
            }

            return criteriaBuilder.and(predicates.toArray(new Predicate[0]));
        };
    }

    private Map<Long, List<JobSkill>> getSkillsByJobId(List<Job> jobs) {
        if (jobs.isEmpty()) {
            return Map.of();
        }

        List<Long> jobIds = jobs.stream().map(Job::getId).toList();
        return jobSkillRepository.findByJobIdInOrderByJobIdAscIdAsc(jobIds)
                .stream()
                .collect(Collectors.groupingBy(jobSkill -> jobSkill.getJob().getId()));
    }

    private String likeValue(String value) {
        return "%" + value.trim().toLowerCase(Locale.ROOT) + "%";
    }
}
