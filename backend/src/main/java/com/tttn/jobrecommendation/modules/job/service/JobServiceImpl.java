package com.tttn.jobrecommendation.modules.job.service;

import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.company.repository.CompanyRepository;
import com.tttn.jobrecommendation.modules.job.dto.request.CreateJobRequest;
import com.tttn.jobrecommendation.modules.job.dto.request.JobFilterRequest;
import com.tttn.jobrecommendation.modules.job.dto.request.UpdateJobRequest;
import com.tttn.jobrecommendation.modules.job.dto.request.UpdateJobStatusRequest;
import com.tttn.jobrecommendation.modules.job.dto.response.JobDetailResponse;
import com.tttn.jobrecommendation.modules.job.dto.response.JobResponse;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.mapper.JobMapper;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
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

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class JobServiceImpl implements JobService {

    private final JobRepository jobRepository;
    private final CompanyRepository companyRepository;
    private final JobMapper jobMapper;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<JobResponse> getJobs(JobFilterRequest request, Long userId, UserRole role) {
        int pageNumber = request.getPage() == null ? 1 : request.getPage();
        int pageSize = request.getSize() == null ? 10 : request.getSize();
        Pageable pageable = PageRequest.of(
                Math.max(pageNumber, 1) - 1,
                Math.min(Math.max(pageSize, 1), 100),
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        Company currentCompany = role == UserRole.COMPANY ? getCompanyByUserId(userId) : null;
        Page<Job> page = jobRepository.findAll(buildJobSpecification(request, role, currentCompany), pageable);
        List<JobResponse> items = page.getContent().stream()
                .map(jobMapper::toJobResponse)
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
        return jobMapper.toJobDetailResponse(job);
    }

    @Override
    @Transactional
    public JobDetailResponse createJob(CreateJobRequest request, Long userId, UserRole role) {
        assertCompanyOrAdmin(role);
        validateSalaryRange(request.getSalaryMin(), request.getSalaryMax());

        Company company = resolveCompanyForCreate(request, userId, role);
        JobStatus status = request.getStatus() == null ? JobStatus.DRAFT : request.getStatus();

        if (role == UserRole.COMPANY && status == JobStatus.ACTIVE && !StringUtils.hasText(company.getCompanyName())) {
            throw new AppException(ErrorCode.BAD_REQUEST, "Company name is required to create an active job");
        }

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

        return jobMapper.toJobDetailResponse(jobRepository.save(job));
    }

    @Override
    @Transactional
    public JobDetailResponse updateJob(Long id, UpdateJobRequest request, Long userId, UserRole role) {
        assertCompanyOrAdmin(role);
        Job job = getJobById(id);
        assertCanManage(job, userId, role);

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

        return jobMapper.toJobDetailResponse(jobRepository.save(job));
    }

    @Override
    @Transactional
    public JobDetailResponse updateJobStatus(Long id, UpdateJobStatusRequest request, Long userId, UserRole role) {
        assertCompanyOrAdmin(role);
        Job job = getJobById(id);
        assertCanManage(job, userId, role);
        applyStatus(job, request.getStatus());
        return jobMapper.toJobDetailResponse(jobRepository.save(job));
    }

    @Override
    @Transactional
    public JobDetailResponse closeJob(Long id, Long userId, UserRole role) {
        assertCompanyOrAdmin(role);
        Job job = getJobById(id);
        assertCanManage(job, userId, role);
        applyStatus(job, JobStatus.CLOSED);
        return jobMapper.toJobDetailResponse(jobRepository.save(job));
    }

    private Specification<Job> buildJobSpecification(JobFilterRequest request, UserRole role, Company currentCompany) {
        return (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (role == UserRole.STUDENT) {
                predicates.add(criteriaBuilder.equal(root.get("status"), JobStatus.ACTIVE));
            } else if (role == UserRole.COMPANY) {
                Predicate activeJobs = criteriaBuilder.equal(root.get("status"), JobStatus.ACTIVE);
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
            return getCompanyByUserId(userId);
        }

        if (request.getCompanyId() == null) {
            throw new AppException(ErrorCode.BAD_REQUEST, "companyId is required for admin job creation");
        }

        return companyRepository.findById(request.getCompanyId())
                .orElseThrow(() -> new ResourceNotFoundException("Company not found"));
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
        if (role == UserRole.ADMIN || job.getStatus() == JobStatus.ACTIVE) {
            return;
        }

        if (role == UserRole.COMPANY && isOwnJob(job, userId)) {
            return;
        }

        throw new AppException(ErrorCode.ACCESS_DENIED);
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
