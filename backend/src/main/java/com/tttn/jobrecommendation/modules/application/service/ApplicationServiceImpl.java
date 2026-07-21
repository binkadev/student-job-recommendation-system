package com.tttn.jobrecommendation.modules.application.service;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.common.utils.PageableUtils;
import com.tttn.jobrecommendation.modules.application.dto.request.ApplyJobRequest;
import com.tttn.jobrecommendation.modules.application.dto.request.CompanyApplicationFilterRequest;
import com.tttn.jobrecommendation.modules.application.dto.request.UpdateApplicationStatusRequest;
import com.tttn.jobrecommendation.modules.application.dto.response.ApplicationResponse;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.application.mapper.ApplicationMapper;
import com.tttn.jobrecommendation.modules.application.repository.JobApplicationRepository;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.company.repository.CompanyRepository;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.cv.repository.CvFileRepository;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.notification.service.NotificationService;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ApplicationServiceImpl implements ApplicationService {

    private static final Map<String, String> COMPANY_APPLICATION_ALLOWED_SORTS = Map.of(
            "id", "id",
            "status", "status",
            "appliedAt", "appliedAt",
            "reviewedAt", "reviewedAt",
            "createdAt", "createdAt",
            "updatedAt", "updatedAt"
    );

    private final JobApplicationRepository applicationRepository;
    private final JobRepository jobRepository;
    private final StudentRepository studentRepository;
    private final CompanyRepository companyRepository;
    private final CvFileRepository cvFileRepository;
    private final ApplicationMapper applicationMapper;
    private final NotificationService notificationService;

    @Override
    @Transactional
    public ApplicationResponse apply(Long jobId, ApplyJobRequest request, Long userId) {
        Student student = getStudentByUserId(userId);
        Job job = getJobById(jobId);

        if (job.getStatus() != JobStatus.ACTIVE) {
            throw new AppException(ErrorCode.BAD_REQUEST, "Only active jobs can receive applications");
        }

        if (job.getDeadline() != null && job.getDeadline().isBefore(LocalDate.now())) {
            throw new AppException(ErrorCode.BAD_REQUEST, "Job application deadline has passed");
        }

        if (applicationRepository.existsByStudentIdAndJobId(student.getId(), job.getId())) {
            throw new AppException(ErrorCode.BAD_REQUEST, "Student already applied to this job");
        }

        CvFile cvFile = resolveCvFile(request.getCvFileId(), student);
        JobApplication application = JobApplication.builder()
                .student(student)
                .job(job)
                .cvFile(cvFile)
                .status(ApplicationStatus.PENDING)
                .coverLetter(trimToNull(request.getCoverLetter()))
                .build();

        try {
            return applicationMapper.toApplicationResponse(applicationRepository.save(application));
        } catch (DataIntegrityViolationException exception) {
            throw new AppException(ErrorCode.BAD_REQUEST, "Student already applied to this job");
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<ApplicationResponse> getMyApplications(Long userId) {
        Student student = getStudentByUserId(userId);
        return applicationRepository.findByStudentIdOrderByAppliedAtDesc(student.getId())
                .stream()
                .map(applicationMapper::toApplicationResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ApplicationResponse> getCompanyJobApplications(Long jobId, Long userId) {
        Company company = getCompanyByUserId(userId);
        Job job = getJobById(jobId);
        assertCompanyOwnsJob(company, job);

        return applicationRepository.findByJobIdOrderByAppliedAtDesc(job.getId())
                .stream()
                .map(applicationMapper::toApplicationResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ApplicationResponse> getMyCompanyApplications(
            Long userId,
            CompanyApplicationFilterRequest request
    ) {
        Company company = getCompanyByUserId(userId);
        Pageable pageable = PageableUtils.createPageable(
                request.getPage(),
                request.getSize(),
                request.getSort(),
                "appliedAt",
                Sort.Direction.DESC,
                COMPANY_APPLICATION_ALLOWED_SORTS
        );

        Page<JobApplication> applications = applicationRepository.findAll(
                buildCompanyApplicationSpecification(company, request),
                pageable
        );
        List<ApplicationResponse> items = applications.getContent()
                .stream()
                .map(applicationMapper::toApplicationResponse)
                .toList();

        return new PageResponse<>(
                items,
                applications.getNumber() + 1,
                applications.getSize(),
                applications.getTotalElements(),
                applications.getTotalPages()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public ApplicationResponse getMyCompanyApplication(Long id, Long userId) {
        Company company = getCompanyByUserId(userId);
        JobApplication application = getApplicationById(id);
        assertCompanyOwnsJob(company, application.getJob());
        return applicationMapper.toApplicationResponse(application);
    }

    @Override
    @Transactional(readOnly = true)
    public ApplicationResponse getMyApplication(Long id, Long userId) {
        Student student = getStudentByUserId(userId);
        JobApplication application = applicationRepository.findByIdAndStudentId(id, student.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Application not found"));
        return applicationMapper.toApplicationResponse(application);
    }

    @Override
    @Transactional
    public ApplicationResponse updateStatus(Long id, UpdateApplicationStatusRequest request, Long userId, UserRole role) {
        JobApplication application = getApplicationById(id);

        if (role == UserRole.ADMIN) {
            assertValidEmployerTransition(application.getStatus(), request.getStatus());
        } else if (role == UserRole.COMPANY) {
            Company company = getCompanyByUserId(userId);
            assertCompanyOwnsJob(company, application.getJob());
            assertValidEmployerTransition(application.getStatus(), request.getStatus());
        } else if (role == UserRole.STUDENT) {
            assertStudentOwnsApplication(application, userId);
            assertValidStudentTransition(application.getStatus(), request.getStatus());
        } else {
            throw new AppException(ErrorCode.ACCESS_DENIED);
        }

        application.setStatus(request.getStatus());
        if (request.getStatus() == ApplicationStatus.REVIEWED
                || request.getStatus() == ApplicationStatus.ACCEPTED
                || request.getStatus() == ApplicationStatus.REJECTED) {
            application.setReviewedAt(LocalDateTime.now());
        }

        JobApplication savedApplication = applicationRepository.save(application);
        if (role == UserRole.COMPANY || role == UserRole.ADMIN) {
            notificationService.createApplicationStatusChangedNotification(savedApplication);
        }

        return applicationMapper.toApplicationResponse(savedApplication);
    }

    private Specification<JobApplication> buildCompanyApplicationSpecification(
            Company company,
            CompanyApplicationFilterRequest request
    ) {
        return (root, query, criteriaBuilder) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            predicates.add(criteriaBuilder.equal(root.get("job").get("company").get("id"), company.getId()));

            if (request.getStatus() != null) {
                predicates.add(criteriaBuilder.equal(root.get("status"), request.getStatus()));
            }

            if (request.getJobId() != null) {
                predicates.add(criteriaBuilder.equal(root.get("job").get("id"), request.getJobId()));
            }

            if (StringUtils.hasText(request.getKeyword())) {
                String keyword = likeValue(request.getKeyword());
                predicates.add(criteriaBuilder.or(
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("student").get("user").get("fullName")), keyword),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("student").get("user").get("email")), keyword),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("job").get("title")), keyword)
                ));
            }

            return criteriaBuilder.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }

    private void assertValidEmployerTransition(ApplicationStatus currentStatus, ApplicationStatus targetStatus) {
        if (currentStatus == ApplicationStatus.PENDING && targetStatus == ApplicationStatus.REVIEWED) {
            return;
        }

        if ((currentStatus == ApplicationStatus.PENDING || currentStatus == ApplicationStatus.REVIEWED)
                && (targetStatus == ApplicationStatus.ACCEPTED || targetStatus == ApplicationStatus.REJECTED)) {
            return;
        }

        throw new AppException(ErrorCode.BAD_REQUEST, "Invalid application status transition");
    }

    private void assertValidStudentTransition(ApplicationStatus currentStatus, ApplicationStatus targetStatus) {
        if (currentStatus == ApplicationStatus.PENDING && targetStatus == ApplicationStatus.WITHDRAWN) {
            return;
        }

        if (targetStatus == ApplicationStatus.ACCEPTED || targetStatus == ApplicationStatus.REJECTED) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Student cannot set accepted or rejected status");
        }

        throw new AppException(ErrorCode.BAD_REQUEST, "Invalid application status transition");
    }

    private void assertCompanyOwnsJob(Company company, Job job) {
        if (!job.getCompany().getId().equals(company.getId())) {
            throw new AppException(ErrorCode.ACCESS_DENIED);
        }
    }

    private void assertStudentOwnsApplication(JobApplication application, Long userId) {
        if (!application.getStudent().getUser().getId().equals(userId)) {
            throw new AppException(ErrorCode.ACCESS_DENIED);
        }
    }

    private Student getStudentByUserId(Long userId) {
        return studentRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Student profile not found"));
    }

    private Company getCompanyByUserId(Long userId) {
        return companyRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Company profile not found"));
    }

    private Job getJobById(Long jobId) {
        return jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found"));
    }

    private JobApplication getApplicationById(Long id) {
        return applicationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Application not found"));
    }

    private CvFile resolveCvFile(Long cvFileId, Student student) {
        if (cvFileId == null) {
            return null;
        }

        CvFile cvFile = cvFileRepository.findById(cvFileId)
                .orElseThrow(() -> new ResourceNotFoundException("CV file not found"));

        if (!cvFile.getStudent().getId().equals(student.getId())) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "CV file does not belong to current student");
        }

        return cvFile;
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }

    private String likeValue(String value) {
        return "%" + value.trim().toLowerCase(Locale.ROOT) + "%";
    }
}
