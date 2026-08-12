package com.tttn.jobrecommendation.modules.application.service;

import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.modules.application.dto.request.ApplyJobRequest;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.application.mapper.ApplicationMapper;
import com.tttn.jobrecommendation.modules.application.repository.JobApplicationRepository;
import com.tttn.jobrecommendation.modules.company.repository.CompanyRepository;
import com.tttn.jobrecommendation.modules.cv.repository.CvFileRepository;
import com.tttn.jobrecommendation.modules.cv.service.CvStorageService;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.notification.service.NotificationService;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.repository.StudentRepository;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.dao.DataIntegrityViolationException;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.sql.SQLException;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ApplicationServiceImplTest {

    private static final long USER_ID = 10L;
    private static final long STUDENT_ID = 20L;
    private static final long JOB_ID = 30L;

    @Mock
    private JobApplicationRepository applicationRepository;
    @Mock
    private JobRepository jobRepository;
    @Mock
    private StudentRepository studentRepository;
    @Mock
    private CompanyRepository companyRepository;
    @Mock
    private CvFileRepository cvFileRepository;
    @Mock
    private CvStorageService cvStorageService;
    @Mock
    private ApplicationMapper applicationMapper;
    @Mock
    private NotificationService notificationService;

    private ApplicationServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new ApplicationServiceImpl(
                applicationRepository,
                jobRepository,
                studentRepository,
                companyRepository,
                cvFileRepository,
                cvStorageService,
                applicationMapper,
                notificationService
        );
        when(studentRepository.findByUserId(USER_ID)).thenReturn(Optional.of(Student.builder().id(STUDENT_ID).build()));
        when(jobRepository.findById(JOB_ID)).thenReturn(Optional.of(Job.builder().id(JOB_ID).status(JobStatus.ACTIVE).build()));
        when(applicationRepository.existsByStudentIdAndJobIdAndStatusIn(any(), any(), any())).thenReturn(false);
        when(applicationRepository.findFirstByStudentIdAndJobIdOrderByAppliedAtDescIdDesc(STUDENT_ID, JOB_ID))
                .thenReturn(Optional.empty());
    }

    @Test
    void mapsOnlyTheActivePartialUniqueConstraintToApplicationAlreadyActive() {
        DataIntegrityViolationException violation = violation("uk_applications_student_job_active");
        when(applicationRepository.saveAndFlush(any(JobApplication.class))).thenThrow(violation);

        assertThatThrownBy(() -> service.apply(JOB_ID, new ApplyJobRequest(), USER_ID))
                .isInstanceOfSatisfying(AppException.class,
                        exception -> org.assertj.core.api.Assertions.assertThat(exception.getErrorCode())
                                .isEqualTo(ErrorCode.APPLICATION_ALREADY_ACTIVE));
    }

    @Test
    void propagatesAnUnrelatedIntegrityViolationWithoutMisclassifyingItAsAlreadyActive() {
        DataIntegrityViolationException violation = violation("fk_applications_cv_file_id");
        when(applicationRepository.saveAndFlush(any(JobApplication.class))).thenThrow(violation);

        assertThatThrownBy(() -> service.apply(JOB_ID, new ApplyJobRequest(), USER_ID))
                .isSameAs(violation)
                .isNotInstanceOf(AppException.class);
    }

    private DataIntegrityViolationException violation(String constraintName) {
        return new DataIntegrityViolationException(
                "database write failed",
                new ConstraintViolationException("constraint failed", new SQLException(), constraintName)
        );
    }
}
