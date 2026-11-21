package com.tttn.jobrecommendation.modules.job.service;

import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.infrastructure.ai.client.AiServiceClient;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiJobPreprocessRequest;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiJobPreprocessResponse;
import com.tttn.jobrecommendation.infrastructure.ai.job.JobTextContentHasher;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.company.repository.CompanyRepository;
import com.tttn.jobrecommendation.modules.job.dto.request.CreateJobRequest;
import com.tttn.jobrecommendation.modules.job.dto.request.JobFilterRequest;
import com.tttn.jobrecommendation.modules.job.dto.request.UpdateJobRequest;
import com.tttn.jobrecommendation.modules.job.dto.request.UpdateJobStatusRequest;
import com.tttn.jobrecommendation.modules.job.dto.response.JobDetailResponse;
import com.tttn.jobrecommendation.modules.job.dto.response.JobResponse;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.entity.JobSkill;
import com.tttn.jobrecommendation.modules.job.mapper.JobMapper;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.job.repository.JobSkillRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class JobServiceImpl implements JobService {

    private final JobRepository jobRepository;
    private final JobSkillRepository jobSkillRepository;
    private final CompanyRepository companyRepository;
    private final JobMapper jobMapper;
    private final JobPersistenceService jobPersistenceService;
    private final AiServiceClient aiServiceClient;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<JobResponse> getJobs(JobFilterRequest request, Long userId, UserRole role) {
        return getJobsPage(request, userId, role, false);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<JobResponse> getMyJobs(JobFilterRequest request, Long userId) {
        return getJobsPage(request, userId, UserRole.COMPANY, true);
    }

    private PageResponse<JobResponse> getJobsPage(JobFilterRequest request, Long userId, UserRole role, boolean ownCompanyOnly) {
        int pageNumber = request.getPage() == null ? 1 : request.getPage();
        int pageSize = request.getSize() == null ? 10 : request.getSize();
        Pageable pageable = PageRequest.of(
                Math.max(pageNumber, 1) - 1,
                Math.min(Math.max(pageSize, 1), 100),
                ownCompanyOnly ? Sort.by(Sort.Direction.DESC, "createdAt", "id") : Sort.by(Sort.Direction.DESC, "createdAt")
        );

        Company currentCompany = role == UserRole.COMPANY ? getCompanyByUserId(userId) : null;
        Page<Job> page = jobRepository.findAll(buildJobSpecification(request, role, currentCompany, ownCompanyOnly), pageable);
        Map<Long, List<JobSkill>> skillsByJobId = getSkillsByJobId(page.getContent());
        List<JobResponse> items = page.getContent().stream()
                .map(job -> jobMapper.toJobResponse(
                        job,
                        skillsByJobId.getOrDefault(job.getId(), List.of())
                ))
                .toList();

        return new PageResponse<>(
                items,
                page.getNumber() + 1,
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public JobDetailResponse getJob(Long id, Long userId, UserRole role) {
        Job job = getJobById(id);
        assertCanView(job, userId, role);
        return jobMapper.toJobDetailResponse(job, getJobSkills(job));
    }

    @Override
    public JobDetailResponse createJob(CreateJobRequest request, Long userId, UserRole role) {
        JobPersistenceService.MutationResult result = jobPersistenceService.createJob(request, userId, role);
        preprocessIfActiveAndNeeded(result.snapshotTarget());
        return result.response();
    }

    @Override
    public JobDetailResponse updateJob(Long id, UpdateJobRequest request, Long userId, UserRole role) {
        return jobPersistenceService.updateJob(id, request, userId, role);
    }

    @Override
    public JobDetailResponse updateJobStatus(Long id, UpdateJobStatusRequest request, Long userId, UserRole role) {
        JobPersistenceService.MutationResult result = jobPersistenceService.updateJobStatus(id, request, userId, role);
        preprocessIfActiveAndNeeded(result.snapshotTarget());
        return result.response();
    }

    @Override
    public JobDetailResponse closeJob(Long id, Long userId, UserRole role) {
        return jobPersistenceService.closeJob(id, userId, role);
    }

    private void preprocessIfActiveAndNeeded(JobPersistenceService.SnapshotTarget target) {
        if (target == null || target.status() != JobStatus.ACTIVE || !target.needsPreprocess()) {
            return;
        }
        try {
            String sourceText = JobTextContentHasher.formatSourceText(
                    target.title(), target.description(), target.requirements()
            );
            AiJobPreprocessResponse response = aiServiceClient.preprocessJobs(
                    new AiJobPreprocessRequest(List.of(new AiJobPreprocessRequest.JobItem(target.jobId(), sourceText)))
            );
            if (response != null && response.results() != null) {
                response.results().stream()
                        .filter(item -> target.jobId().equals(item.id()))
                        .findFirst()
                        .ifPresent(item -> jobPersistenceService.savePreprocessedSnapshotIfHashMatches(
                                target.jobId(), target.contentHash(), item
                        ));
            }
        } catch (RuntimeException exception) {
            log.warn("Post-commit AI job preprocessing failed open for job {}: {}",
                    target.jobId(), exception.getMessage());
        }
    }

    private List<JobSkill> getJobSkills(Job job) {
        return jobSkillRepository.findByJobIdOrderByIdAsc(job.getId());
    }

    private Map<Long, List<JobSkill>> getSkillsByJobId(List<Job> jobs) {
        if (jobs.isEmpty()) {
            return Map.of();
        }

        List<Long> jobIds = jobs.stream()
                .map(Job::getId)
                .toList();
        return jobSkillRepository.findByJobIdInOrderByJobIdAscIdAsc(jobIds)
                .stream()
                .collect(Collectors.groupingBy(
                        jobSkill -> jobSkill.getJob().getId(),
                        LinkedHashMap::new,
                        Collectors.toList()
                ));
    }

    private Specification<Job> buildJobSpecification(JobFilterRequest request, UserRole role, Company currentCompany, boolean ownCompanyOnly) {
        return (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (ownCompanyOnly) {
                predicates.add(criteriaBuilder.equal(root.get("company").get("id"), currentCompany.getId()));
            } else if (role == UserRole.STUDENT) {
                predicates.add(criteriaBuilder.equal(root.get("status"), JobStatus.ACTIVE));
                predicates.add(criteriaBuilder.equal(root.get("company").get("status"), CompanyStatus.VERIFIED));
            } else if (role == UserRole.COMPANY) {
                Predicate activeJobs = criteriaBuilder.and(
                        criteriaBuilder.equal(root.get("status"), JobStatus.ACTIVE),
                        criteriaBuilder.equal(root.get("company").get("status"), CompanyStatus.VERIFIED));
                Predicate ownJobs = criteriaBuilder.equal(root.get("company").get("id"), currentCompany.getId());
                predicates.add(criteriaBuilder.or(activeJobs, ownJobs));
            } else if (role == UserRole.ADMIN && request.getStatus() == null) {
                predicates.add(criteriaBuilder.equal(root.get("status"), JobStatus.ACTIVE));
            }

            if (StringUtils.hasText(request.getKeyword())) {
                String keyword = "%" + request.getKeyword().trim().toLowerCase() + "%";
                predicates.add(criteriaBuilder.or(
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("title")), keyword),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("description")), keyword),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("requirements")), keyword)
                ));
            }

            if (StringUtils.hasText(request.getLocation())) {
                predicates.add(criteriaBuilder.like(
                        criteriaBuilder.lower(root.get("location")),
                        "%" + request.getLocation().trim().toLowerCase() + "%"
                ));
            }

            if (request.getJobType() != null) {
                predicates.add(criteriaBuilder.equal(root.get("jobType"), request.getJobType()));
            }

            if (request.getWorkingModel() != null) {
                predicates.add(criteriaBuilder.equal(root.get("workingModel"), request.getWorkingModel()));
            }

            if (request.getStatus() != null) {
                predicates.add(criteriaBuilder.equal(root.get("status"), request.getStatus()));
            }

            return criteriaBuilder.and(predicates.toArray(new Predicate[0]));
        };
    }

    private Job getJobById(Long id) {
        return jobRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found"));
    }

    private Company getCompanyByUserId(Long userId) {
        return companyRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Company profile not found"));
    }

    private void assertCanView(Job job, Long userId, UserRole role) {
        if (role == UserRole.ADMIN || (job.getStatus() == JobStatus.ACTIVE && job.getCompany().getStatus() == CompanyStatus.VERIFIED)) {
            return;
        }

        if (role == UserRole.COMPANY && isOwnJob(job, userId)) {
            return;
        }

        throw new AppException(ErrorCode.ACCESS_DENIED);
    }

    private boolean isOwnJob(Job job, Long userId) {
        return job.getCompany().getUser().getId().equals(userId);
    }
}
