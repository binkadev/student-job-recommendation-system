package com.tttn.jobrecommendation.modules.candidateranking.service;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CvAnalysisStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.WorkingModel;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingRequest;
import com.tttn.jobrecommendation.modules.application.repository.CandidateRankingApplicationRow;
import com.tttn.jobrecommendation.modules.application.repository.JobApplicationRepository;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingPreparationResult;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.entity.JobSkill;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.job.repository.JobSkillRepository;
import com.tttn.jobrecommendation.modules.skill.entity.Skill;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.RecordComponent;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CandidateRankingCorpusPreparationServiceTest {

    private static final Long COMPANY_ID = 11L;
    private static final Long JOB_ID = 22L;
    private static final LocalDateTime ANALYZED_AT = LocalDateTime.of(2026, 8, 1, 10, 30, 15, 123_000_000);

    @Mock
    private JobRepository jobRepository;

    @Mock
    private JobSkillRepository jobSkillRepository;

    @Mock
    private JobApplicationRepository applicationRepository;

    private CandidateRankingCorpusPreparationService service;

    @BeforeEach
    void setUp() {
        service = new CandidateRankingCorpusPreparationService(
                jobRepository,
                jobSkillRepository,
                applicationRepository
        );
    }

    @Test
    void preparesOwnedClosedJobWithExactPrivacySafeInputsAndCanonicalSkills() {
        Job job = job(JobStatus.CLOSED);
        when(jobRepository.findByIdAndCompanyId(JOB_ID, COMPANY_ID)).thenReturn(Optional.of(job));
        when(jobSkillRepository.findByJobIdOrderByIdAsc(JOB_ID)).thenReturn(List.of(
                jobSkill(" Spring   Boot ", "  "),
                jobSkill("JAVA", " java "),
                jobSkill("Spring Boot", null),
                jobSkill("Ignored", "   ")
        ));
        when(applicationRepository.findCandidateRankingRowsByJobId(JOB_ID)).thenReturn(List.of(
                readyRow(30L, ApplicationStatus.REVIEWED, 130L, List.of(" Docker ", "JAVA", "java", " ")),
                readyRow(10L, ApplicationStatus.PENDING, 110L, List.of("Spring   Boot", "java"))
        ));

        CandidateRankingPreparationResult result = service.prepare(COMPANY_ID, JOB_ID);

        assertThat(result.jobSnapshot().id()).isEqualTo(JOB_ID);
        assertThat(result.jobSnapshot().canonicalSkills()).containsExactly("ignored", "java", "spring boot");
        assertThat(result.aiJobInput().skills()).containsExactly("ignored", "java", "spring boot");
        assertThat(result.aiJobInput().text()).isEqualTo("""
                TITLE:
                Backend Intern

                DESCRIPTION:
                Build secure APIs.

                REQUIREMENTS:
                Java experience.

                SKILLS:
                ignored, java, spring boot""");
        assertThat(result.aiJobInput().text())
                .doesNotContain(
                        "Benefits", "1000", "Hidden Location", "Secret Company",
                        "CLOSED", "2030-01-01", "REMOTE"
                );
        assertThat(result.eligibleCandidateSnapshots())
                .extracting(candidate -> candidate.applicationId())
                .containsExactly(10L, 30L);
        assertThat(result.eligibleCandidateSnapshots().get(0).canonicalExtractedSkills())
                .containsExactly("java", "spring boot");
        assertThat(result.aiCandidateInputs().get(1).skills()).containsExactly("docker", "java");
        assertThat(result.inputFingerprint()).matches("[0-9a-f]{64}");
    }

    @Test
    void classifiesEveryApplicationOnceInRequiredPriorityOrder() {
        stubJobAndSkills(job(JobStatus.ACTIVE), List.of());
        when(applicationRepository.findCandidateRankingRowsByJobId(JOB_ID)).thenReturn(List.of(
                readyRow(1L, ApplicationStatus.PENDING, 101L, List.of("java")),
                readyRow(2L, ApplicationStatus.REVIEWED, 102L, List.of("java")),
                row(3L, ApplicationStatus.ACCEPTED, null, null, null, null, null, null, null),
                readyRow(4L, ApplicationStatus.REJECTED, 104L, List.of("java")),
                row(5L, ApplicationStatus.WITHDRAWN, null, null, null, null, null, null, null),
                row(6L, ApplicationStatus.PENDING, null, null, null, null, null, null, null),
                row(7L, ApplicationStatus.PENDING, 107L, CvAnalysisStatus.PROCESSING,
                        "text", "processed", List.of(), "v2", ANALYZED_AT),
                row(8L, ApplicationStatus.PENDING, 108L, CvAnalysisStatus.READY,
                        "  ", "processed", List.of(), "v2", ANALYZED_AT),
                row(9L, ApplicationStatus.REVIEWED, 109L, CvAnalysisStatus.READY,
                        "text", "\n", List.of(), "v2", ANALYZED_AT)
        ));

        CandidateRankingPreparationResult result = service.prepare(COMPANY_ID, JOB_ID);

        assertThat(result.counters().totalApplicationsScanned()).isEqualTo(9);
        assertThat(result.counters().eligibleCandidates()).isEqualTo(2);
        assertThat(result.counters().skippedNoCv()).isEqualTo(1);
        assertThat(result.counters().skippedNotReady()).isEqualTo(3);
        assertThat(result.counters().skippedTerminalStatus()).isEqualTo(3);
        assertThat(result.counters().totalApplicationsScanned()).isEqualTo(
                result.counters().eligibleCandidates()
                        + result.counters().skippedNoCv()
                        + result.counters().skippedNotReady()
                        + result.counters().skippedTerminalStatus()
        );
    }

    @Test
    void emptyApplicationCorpusIsValid() {
        stubJobAndSkills(job(JobStatus.ACTIVE), List.of());
        when(applicationRepository.findCandidateRankingRowsByJobId(JOB_ID)).thenReturn(List.of());

        CandidateRankingPreparationResult result = service.prepare(COMPANY_ID, JOB_ID);

        assertThat(result.eligibleCandidateSnapshots()).isEmpty();
        assertThat(result.aiCandidateInputs()).isEmpty();
        assertThat(result.counters().totalApplicationsScanned()).isZero();
        assertThat(result.inputFingerprint()).matches("[0-9a-f]{64}");
    }

    @Test
    void emptyEligibleCorpusWithScannedApplicationsKeepsEverySkipCounterAccurate() {
        stubJobAndSkills(job(JobStatus.ACTIVE), List.of());
        when(applicationRepository.findCandidateRankingRowsByJobId(JOB_ID)).thenReturn(List.of(
                row(1L, ApplicationStatus.ACCEPTED, null, null, null, null, null, null, null),
                row(2L, ApplicationStatus.PENDING, null, null, null, null, null, null, null),
                row(3L, ApplicationStatus.REVIEWED, 103L, CvAnalysisStatus.PROCESSING,
                        "text", "processed", List.of("java"), "v2", ANALYZED_AT)
        ));

        CandidateRankingPreparationResult result = service.prepare(COMPANY_ID, JOB_ID);

        assertThat(result.counters().totalApplicationsScanned()).isEqualTo(3);
        assertThat(result.counters().eligibleCandidates()).isZero();
        assertThat(result.counters().skippedTerminalStatus()).isEqualTo(1);
        assertThat(result.counters().skippedNoCv()).isEqualTo(1);
        assertThat(result.counters().skippedNotReady()).isEqualTo(1);
        assertThat(result.eligibleCandidateSnapshots()).isEmpty();
        assertThat(result.aiCandidateInputs()).isEmpty();
        assertThat(result.counters().totalApplicationsScanned()).isEqualTo(
                result.counters().eligibleCandidates()
                        + result.counters().skippedNoCv()
                        + result.counters().skippedNotReady()
                        + result.counters().skippedTerminalStatus()
        );
    }

    @Test
    void foreignAndAbsentJobsHaveSameServiceBoundary() {
        when(jobRepository.findByIdAndCompanyId(JOB_ID, COMPANY_ID)).thenReturn(Optional.empty());
        when(jobRepository.findByIdAndCompanyId(999L, COMPANY_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.prepare(COMPANY_ID, JOB_ID))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Job not found");
        assertThatThrownBy(() -> service.prepare(COMPANY_ID, 999L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Job not found");
    }

    @Test
    void pendingSubmittedCvStudentMismatchFailsWholePreparation() {
        stubJobAndSkills(job(JobStatus.ACTIVE), List.of());
        CandidateRankingApplicationRow mismatch = new CandidateRankingApplicationRow(
                1L,
                ApplicationStatus.PENDING,
                51L,
                JOB_ID,
                71L,
                52L,
                "CV text",
                "cv text",
                List.of("java"),
                CvAnalysisStatus.READY,
                "v2",
                ANALYZED_AT
        );
        when(applicationRepository.findCandidateRankingRowsByJobId(JOB_ID)).thenReturn(List.of(mismatch));

        assertThatThrownBy(() -> service.prepare(COMPANY_ID, JOB_ID))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Submitted CV does not belong to the application student");
    }

    @Test
    void terminalSubmittedCvStudentMismatchFailsBeforeTerminalStatusSkipping() {
        stubJobAndSkills(job(JobStatus.ACTIVE), List.of());
        CandidateRankingApplicationRow mismatch = new CandidateRankingApplicationRow(
                1L,
                ApplicationStatus.REJECTED,
                51L,
                JOB_ID,
                71L,
                52L,
                "CV text",
                "cv text",
                List.of("java"),
                CvAnalysisStatus.READY,
                "v2",
                ANALYZED_AT
        );
        when(applicationRepository.findCandidateRankingRowsByJobId(JOB_ID)).thenReturn(List.of(mismatch));

        assertThatThrownBy(() -> service.prepare(COMPANY_ID, JOB_ID))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Submitted CV does not belong to the application student");
    }

    @Test
    void terminalApplicationWithoutCvRemainsSkippedTerminalStatus() {
        stubJobAndSkills(job(JobStatus.ACTIVE), List.of());
        when(applicationRepository.findCandidateRankingRowsByJobId(JOB_ID)).thenReturn(List.of(
                row(1L, ApplicationStatus.WITHDRAWN, null, null, null, null, null, null, null)
        ));

        CandidateRankingPreparationResult result = service.prepare(COMPANY_ID, JOB_ID);

        assertThat(result.counters().totalApplicationsScanned()).isEqualTo(1);
        assertThat(result.counters().eligibleCandidates()).isZero();
        assertThat(result.counters().skippedTerminalStatus()).isEqualTo(1);
        assertThat(result.counters().skippedNoCv()).isZero();
        assertThat(result.counters().skippedNotReady()).isZero();
    }

    @Test
    void aiCandidateInputHasOnlyApprovedCorrelationAndCvFields() {
        assertThat(Arrays.stream(AiCandidateRankingRequest.CandidateInput.class.getRecordComponents())
                .map(RecordComponent::getName))
                .containsExactly("applicationId", "cvId", "text", "skills")
                .doesNotContain(
                        "studentId", "name", "email", "phone", "fileName", "storedFileName",
                        "path", "url", "coverLetter"
                );
    }

    private void stubJobAndSkills(Job job, List<JobSkill> skills) {
        when(jobRepository.findByIdAndCompanyId(JOB_ID, COMPANY_ID)).thenReturn(Optional.of(job));
        when(jobSkillRepository.findByJobIdOrderByIdAsc(JOB_ID)).thenReturn(skills);
    }

    private Job job(JobStatus status) {
        return Job.builder()
                .id(JOB_ID)
                .company(Company.builder().companyName("Secret Company").build())
                .title(" Backend Intern ")
                .description(" Build secure APIs. ")
                .requirements(" Java experience. ")
                .benefits("Benefits must stay private")
                .location("Hidden Location")
                .salaryMin(new BigDecimal("1000"))
                .workingModel(WorkingModel.REMOTE)
                .deadline(LocalDate.of(2030, 1, 1))
                .status(status)
                .updatedAt(LocalDateTime.of(2026, 8, 1, 9, 0))
                .build();
    }

    private JobSkill jobSkill(String name, String normalizedName) {
        return JobSkill.builder()
                .skill(Skill.builder().name(name).normalizedName(normalizedName).build())
                .build();
    }

    private CandidateRankingApplicationRow readyRow(
            Long applicationId,
            ApplicationStatus status,
            Long cvId,
            List<String> skills
    ) {
        return row(applicationId, status, cvId, CvAnalysisStatus.READY,
                "Extracted CV " + applicationId, "processed cv", skills, "v2", ANALYZED_AT);
    }

    private CandidateRankingApplicationRow row(
            Long applicationId,
            ApplicationStatus status,
            Long cvId,
            CvAnalysisStatus analysisStatus,
            String extractedText,
            String processedText,
            List<String> skills,
            String processingVersion,
            LocalDateTime analyzedAt
    ) {
        return new CandidateRankingApplicationRow(
                applicationId,
                status,
                51L,
                JOB_ID,
                cvId,
                cvId == null ? null : 51L,
                extractedText,
                processedText,
                skills,
                analysisStatus,
                processingVersion,
                analyzedAt
        );
    }
}
