package com.tttn.jobrecommendation.modules.job.service;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.SkillImportance;
import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiJobPreprocessResponse;
import com.tttn.jobrecommendation.infrastructure.ai.job.JobTextContentHasher;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.company.repository.CompanyRepository;
import com.tttn.jobrecommendation.modules.job.dto.request.CreateJobRequest;
import com.tttn.jobrecommendation.modules.job.dto.request.JobSkillRequest;
import com.tttn.jobrecommendation.modules.job.dto.request.UpdateJobRequest;
import com.tttn.jobrecommendation.modules.job.dto.request.UpdateJobStatusRequest;
import com.tttn.jobrecommendation.modules.job.dto.response.JobDetailResponse;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.entity.JobSkill;
import com.tttn.jobrecommendation.modules.job.mapper.JobMapper;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.job.repository.JobSkillRepository;
import com.tttn.jobrecommendation.modules.notification.service.NotificationService;
import com.tttn.jobrecommendation.modules.skill.entity.Skill;
import com.tttn.jobrecommendation.modules.skill.repository.SkillRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
class JobPersistenceService {

    private final JobRepository jobRepository;
    private final JobSkillRepository jobSkillRepository;
    private final SkillRepository skillRepository;
    private final CompanyRepository companyRepository;
    private final JobMapper jobMapper;
    private final JobModerationPolicy moderationPolicy;
    private final NotificationService notificationService;

    record SnapshotTarget(
            Long jobId,
            JobStatus status,
            String title,
            String description,
            String requirements,
            String contentHash,
            boolean needsPreprocess
    ) {
    }

    record MutationResult(JobDetailResponse response, SnapshotTarget snapshotTarget) {
    }

    @Transactional
    public MutationResult createJob(CreateJobRequest request, Long userId, UserRole role) {
        assertCompanyOrAdmin(role);
        validateSalaryRange(request.getSalaryMin(), request.getSalaryMax());

        Company company = resolveCompanyForCreate(request, userId, role);
        JobStatus status = request.getStatus() == null ? JobStatus.DRAFT : request.getStatus();

        moderationPolicy.assertCreation(role, company.getStatus(), status);

        LocalDateTime now = LocalDateTime.now();
        Job job = Job.builder()
                .company(company)
                .title(request.getTitle().trim())
                .description(request.getDescription().trim())
                .requirements(trimToNull(request.getRequirements()))
                .benefits(trimToNull(request.getBenefits()))
                .location(trimToNull(request.getLocation()))
                .jobType(request.getJobType())
                .workingModel(request.getWorkingModel())
                .status(status)
                .salaryMin(request.getSalaryMin())
                .salaryMax(request.getSalaryMax())
                .currency(trimToNull(request.getCurrency()))
                .deadline(request.getDeadline())
                .publishedAt(status == JobStatus.ACTIVE ? now : null)
                .closedAt(status == JobStatus.CLOSED ? now : null)
                .build();

        Job savedJob = jobRepository.save(job);
        List<JobSkill> jobSkills = syncJobSkills(savedJob, request.getSkills());
        return new MutationResult(
                jobMapper.toJobDetailResponse(savedJob, jobSkills),
                buildSnapshotTarget(savedJob)
        );
    }

    @Transactional
    public JobDetailResponse updateJob(Long id, UpdateJobRequest request, Long userId, UserRole role) {
        assertCompanyOrAdmin(role);
        Job job = getJobForMutation(id);
        assertCanManage(job, userId, role);
        moderationPolicy.assertEditable(job.getStatus());

        BigDecimal salaryMin = request.getSalaryMin() == null ? job.getSalaryMin() : request.getSalaryMin();
        BigDecimal salaryMax = request.getSalaryMax() == null ? job.getSalaryMax() : request.getSalaryMax();
        validateSalaryRange(salaryMin, salaryMax);

        if (StringUtils.hasText(request.getTitle())) {
            job.setTitle(request.getTitle().trim());
        }
        if (StringUtils.hasText(request.getDescription())) {
            job.setDescription(request.getDescription().trim());
        }
        if (request.getRequirements() != null) {
            job.setRequirements(trimToNull(request.getRequirements()));
        }
        if (request.getBenefits() != null) {
            job.setBenefits(trimToNull(request.getBenefits()));
        }
        if (request.getLocation() != null) {
            job.setLocation(trimToNull(request.getLocation()));
        }
        if (request.getJobType() != null) {
            job.setJobType(request.getJobType());
        }
        if (request.getWorkingModel() != null) {
            job.setWorkingModel(request.getWorkingModel());
        }
        if (request.getSalaryMin() != null) {
            job.setSalaryMin(request.getSalaryMin());
        }
        if (request.getSalaryMax() != null) {
            job.setSalaryMax(request.getSalaryMax());
        }
        if (request.getCurrency() != null) {
            job.setCurrency(trimToNull(request.getCurrency()));
        }
        if (request.getDeadline() != null) {
            job.setDeadline(request.getDeadline());
        }

        String updatedHash = JobTextContentHasher.sha256(
                job.getTitle(), job.getDescription(), job.getRequirements()
        );
        if (job.getContentHash() != null && !updatedHash.equals(job.getContentHash())) {
            clearSnapshot(job);
        }

        Job savedJob = jobRepository.save(job);
        List<JobSkill> jobSkills = syncJobSkills(savedJob, request.getSkills());
        return jobMapper.toJobDetailResponse(savedJob, jobSkills);
    }

    @Transactional
    public MutationResult updateJobStatus(Long id, UpdateJobStatusRequest request, Long userId, UserRole role) {
        assertCompanyOrAdmin(role);
        Job job = getJobForMutation(id);
        assertCanManage(job, userId, role);
        moderationPolicy.assertTransition(role, job.getCompany().getStatus(), job.getStatus(), request.getStatus());
        if (job.getStatus() == request.getStatus()) {
            return new MutationResult(
                    jobMapper.toJobDetailResponse(job, getJobSkills(job)),
                    buildSnapshotTarget(job)
            );
        }
        JobStatus previousStatus = job.getStatus();
        applyStatus(job, request.getStatus());
        Job savedJob = jobRepository.save(job);
        if (role == UserRole.ADMIN && previousStatus == JobStatus.PENDING_APPROVAL
                && (request.getStatus() == JobStatus.ACTIVE || request.getStatus() == JobStatus.REJECTED)) {
            notificationService.createJobModerationNotification(savedJob, request.getStatus());
        }
        return new MutationResult(
                jobMapper.toJobDetailResponse(savedJob, getJobSkills(savedJob)),
                buildSnapshotTarget(savedJob)
        );
    }

    @Transactional
    public JobDetailResponse closeJob(Long id, Long userId, UserRole role) {
        assertCompanyOrAdmin(role);
        Job job = getJobForMutation(id);
        assertCanManage(job, userId, role);
        moderationPolicy.assertTransition(role, job.getCompany().getStatus(), job.getStatus(), JobStatus.CLOSED);
        if (job.getStatus() == JobStatus.CLOSED) {
            return jobMapper.toJobDetailResponse(job, getJobSkills(job));
        }
        applyStatus(job, JobStatus.CLOSED);
        Job savedJob = jobRepository.save(job);
        return jobMapper.toJobDetailResponse(savedJob, getJobSkills(savedJob));
    }

    @Transactional
    public void savePreprocessedSnapshotIfHashMatches(
            Long jobId,
            String expectedContentHash,
            AiJobPreprocessResponse.JobResult result
    ) {
        if (jobId == null || expectedContentHash == null || result == null
                || !StringUtils.hasText(result.languageCode())
                || result.languageConfidence() == null
                || !StringUtils.hasText(result.processingVersion())) {
            return;
        }
        Job job = jobRepository.findById(jobId).orElse(null);
        if (job == null || job.getStatus() != JobStatus.ACTIVE) {
            return;
        }
        String currentHash = JobTextContentHasher.sha256(
                job.getTitle(), job.getDescription(), job.getRequirements()
        );
        if (!Objects.equals(expectedContentHash, currentHash)) {
            return;
        }
        job.setProcessedText(result.processedText());
        job.setLanguageCode(result.languageCode());
        job.setLanguageConfidence(result.languageConfidence());
        job.setProcessingVersion(result.processingVersion());
        job.setContentHash(currentHash);
        job.setAnalyzedAt(LocalDateTime.now());
        jobRepository.save(job);
    }

    private SnapshotTarget buildSnapshotTarget(Job job) {
        String contentHash = JobTextContentHasher.sha256(
                job.getTitle(), job.getDescription(), job.getRequirements()
        );
        boolean needsPreprocess = job.getStatus() == JobStatus.ACTIVE
                && !JobTextContentHasher.hasFreshSnapshot(job);
        return new SnapshotTarget(
                job.getId(),
                job.getStatus(),
                job.getTitle(),
                job.getDescription(),
                job.getRequirements(),
                contentHash,
                needsPreprocess
        );
    }

    private void clearSnapshot(Job job) {
        job.setProcessedText(null);
        job.setLanguageCode(null);
        job.setLanguageConfidence(null);
        job.setProcessingVersion(null);
        job.setContentHash(null);
        job.setAnalyzedAt(null);
    }

    private List<JobSkill> syncJobSkills(Job job, List<JobSkillRequest> skillRequests) {
        if (skillRequests == null) {
            return getJobSkills(job);
        }

        validateUniqueSkillIds(skillRequests);
        jobSkillRepository.deleteByJobId(job.getId());
        jobSkillRepository.flush();

        if (skillRequests.isEmpty()) {
            return List.of();
        }

        List<JobSkill> jobSkills = skillRequests.stream()
                .map(request -> toJobSkill(job, request))
                .toList();
        return jobSkillRepository.saveAll(jobSkills);
    }

    private JobSkill toJobSkill(Job job, JobSkillRequest request) {
        Skill skill = skillRepository.findById(request.getSkillId())
                .orElseThrow(() -> new ResourceNotFoundException("Skill not found"));

        return JobSkill.builder()
                .job(job)
                .skill(skill)
                .importance(request.getImportance() == null ? SkillImportance.REQUIRED : request.getImportance())
                .minLevel(request.getMinLevel())
                .build();
    }

    private void validateUniqueSkillIds(List<JobSkillRequest> skillRequests) {
        Set<Long> skillIds = new HashSet<>();
        for (JobSkillRequest request : skillRequests) {
            if (request.getSkillId() == null) {
                throw new AppException(ErrorCode.BAD_REQUEST, "skillId is required");
            }
            if (!skillIds.add(request.getSkillId())) {
                throw new AppException(ErrorCode.BAD_REQUEST, "Duplicate job skill is not allowed");
            }
        }
    }

    private List<JobSkill> getJobSkills(Job job) {
        return jobSkillRepository.findByJobIdOrderByIdAsc(job.getId());
    }

    private void applyStatus(Job job, JobStatus status) {
        job.setStatus(status);
        LocalDateTime now = LocalDateTime.now();
        if (status == JobStatus.ACTIVE && job.getPublishedAt() == null) {
            job.setPublishedAt(now);
        }
        if (status == JobStatus.CLOSED) {
            job.setClosedAt(now);
        }
        if (status != JobStatus.CLOSED) {
            job.setClosedAt(null);
        }
    }

    private Company resolveCompanyForCreate(CreateJobRequest request, Long userId, UserRole role) {
        if (role == UserRole.COMPANY) {
            return companyRepository.findByUserIdForUpdate(userId)
                    .orElseThrow(() -> new ResourceNotFoundException("Company profile not found"));
        }

        if (request.getCompanyId() == null) {
            throw new AppException(ErrorCode.BAD_REQUEST, "companyId is required for admin job creation");
        }

        return companyRepository.findByIdForUpdate(request.getCompanyId())
                .orElseThrow(() -> new ResourceNotFoundException("Company not found"));
    }

    private Job getJobForMutation(Long id) {
        Long companyId = jobRepository.findCompanyIdById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found"));
        companyRepository.findByIdForUpdate(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Company not found"));
        return jobRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found"));
    }

    private void assertCanManage(Job job, Long userId, UserRole role) {
        if (role == UserRole.ADMIN) {
            return;
        }
        if (role == UserRole.COMPANY && isOwnJob(job, userId)) {
            return;
        }
        throw new AppException(ErrorCode.ACCESS_DENIED);
    }

    private void assertCompanyOrAdmin(UserRole role) {
        if (role != UserRole.COMPANY && role != UserRole.ADMIN) {
            throw new AppException(ErrorCode.ACCESS_DENIED);
        }
    }

    private boolean isOwnJob(Job job, Long userId) {
        return job.getCompany().getUser().getId().equals(userId);
    }

    private void validateSalaryRange(BigDecimal salaryMin, BigDecimal salaryMax) {
        if (salaryMin != null && salaryMax != null && salaryMin.compareTo(salaryMax) > 0) {
            throw new AppException(ErrorCode.BAD_REQUEST, "salaryMin must be less than or equal to salaryMax");
        }
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }
}
