package com.tttn.jobrecommendation.integration;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.CvAnalysisStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.SkillImportance;
import com.tttn.jobrecommendation.common.enums.SkillLevel;
import com.tttn.jobrecommendation.common.enums.SkillSource;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.application.repository.JobApplicationRepository;
import com.tttn.jobrecommendation.modules.candidateranking.service.CandidateRankingCorpusPreparationService;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingPreparationResult;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.entity.JobSkill;
import com.tttn.jobrecommendation.modules.job.repository.JobSkillRepository;
import com.tttn.jobrecommendation.modules.skill.entity.Skill;
import com.tttn.jobrecommendation.modules.skill.entity.StudentSkill;
import com.tttn.jobrecommendation.modules.skill.repository.SkillRepository;
import com.tttn.jobrecommendation.modules.skill.repository.StudentSkillRepository;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CandidateRankingCorpusPreparationIT extends AbstractPostgresIntegrationTest {

    private static final long EXPECTED_PREPARATION_STATEMENTS = 3L;

    @Autowired
    private CandidateRankingCorpusPreparationService preparationService;

    @Autowired
    private JobApplicationRepository applicationRepository;

    @Autowired
    private JobSkillRepository jobSkillRepository;

    @Autowired
    private SkillRepository skillRepository;

    @Autowired
    private StudentSkillRepository studentSkillRepository;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @DynamicPropertySource
    static void enableHibernateStatistics(DynamicPropertyRegistry registry) {
        registry.add("spring.jpa.properties.hibernate.generate_statistics", () -> "true");
    }

    @Test
    void ownedAndClosedJobsPrepareWhileForeignAndAbsentJobsAreIndistinguishable() {
        Company owner = createCompany("corpus-owner@example.test", "Corpus Owner", CompanyStatus.VERIFIED);
        Company foreignCompany = createCompany("corpus-foreign@example.test", "Foreign", CompanyStatus.VERIFIED);
        Job closedJob = createJob(owner, "Closed Backend Intern", JobStatus.CLOSED);
        closedJob.setDeadline(LocalDate.now().minusDays(30));
        closedJob = jobRepository.saveAndFlush(closedJob);

        CandidateRankingPreparationResult result = preparationService.prepare(owner.getId(), closedJob.getId());

        assertThat(result.jobSnapshot().id()).isEqualTo(closedJob.getId());
        assertThat(result.eligibleCandidateSnapshots()).isEmpty();
        assertThat(result.counters().totalApplicationsScanned()).isZero();

        Long selectedJobId = closedJob.getId();
        assertThatThrownBy(() -> preparationService.prepare(foreignCompany.getId(), selectedJobId))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Job not found");
        assertThatThrownBy(() -> preparationService.prepare(owner.getId(), 999_999L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Job not found");
    }

    @Test
    void usesInactiveSubmittedCvWithoutFallbackOrStudentSkills() {
        Company company = createCompany("submitted-cv-company@example.test", "Submitted CV", CompanyStatus.VERIFIED);
        Job job = createJob(company, "Backend Intern", JobStatus.ACTIVE);

        Student eligibleStudent = createStudent("submitted-cv-student@example.test");
        CvFile inactiveSubmittedCv = readyCv(
                eligibleStudent,
                "submitted-inactive.pdf",
                false,
                "Submitted CV extracted text",
                List.of(" JAVA ", "Spring   Boot", "java")
        );
        readyCv(eligibleStudent, "new-active.pdf", true, "Active CV must not be used", List.of("docker"));
        Skill manualSkill = skillRepository.saveAndFlush(Skill.builder()
                .name("Kubernetes")
                .normalizedName("kubernetes")
                .build());
        studentSkillRepository.saveAndFlush(StudentSkill.builder()
                .student(eligibleStudent)
                .skill(manualSkill)
                .level(SkillLevel.BEGINNER)
                .source(SkillSource.MANUAL)
                .build());
        applicationRepository.saveAndFlush(JobApplication.builder()
                .student(eligibleStudent)
                .job(job)
                .cvFile(inactiveSubmittedCv)
                .status(ApplicationStatus.PENDING)
                .build());

        Student noSubmittedCvStudent = createStudent("no-submitted-cv-student@example.test");
        readyCv(noSubmittedCvStudent, "fallback-active.pdf", true, "Fallback forbidden", List.of("python"));
        applicationRepository.saveAndFlush(JobApplication.builder()
                .student(noSubmittedCvStudent)
                .job(job)
                .cvFile(null)
                .status(ApplicationStatus.REVIEWED)
                .build());

        CandidateRankingPreparationResult result = preparationService.prepare(company.getId(), job.getId());

        assertThat(result.counters().totalApplicationsScanned()).isEqualTo(2);
        assertThat(result.counters().eligibleCandidates()).isEqualTo(1);
        assertThat(result.counters().skippedNoCv()).isEqualTo(1);
        assertThat(result.eligibleCandidateSnapshots()).singleElement().satisfies(candidate -> {
            assertThat(candidate.cvId()).isEqualTo(inactiveSubmittedCv.getId());
            assertThat(candidate.extractedText()).isEqualTo("Submitted CV extracted text");
            assertThat(candidate.canonicalExtractedSkills()).containsExactly("java", "spring boot");
            assertThat(candidate.canonicalExtractedSkills()).doesNotContain("docker", "kubernetes", "python");
        });
    }

    @Test
    void cvApplicationStudentMismatchFailsWholePreparation() {
        Company company = createCompany("mismatch-company@example.test", "Mismatch", CompanyStatus.VERIFIED);
        Job job = createJob(company, "Mismatch Job", JobStatus.ACTIVE);
        Student applicant = createStudent("mismatch-applicant@example.test");
        Student cvOwner = createStudent("mismatch-cv-owner@example.test");
        CvFile foreignCv = readyCv(cvOwner, "foreign.pdf", false, "Foreign CV", List.of("java"));
        applicationRepository.saveAndFlush(JobApplication.builder()
                .student(applicant)
                .job(job)
                .cvFile(foreignCv)
                .status(ApplicationStatus.PENDING)
                .build());

        assertThatThrownBy(() -> preparationService.prepare(company.getId(), job.getId()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Submitted CV does not belong to the application student");
    }

    @Test
    void queryCountIsFixedAsCandidateCountGrows() {
        Company company = createCompany("query-count-ranking@example.test", "Query Count", CompanyStatus.VERIFIED);
        Job job = createJob(company, "Query Count Job", JobStatus.ACTIVE);
        Skill java = skillRepository.saveAndFlush(Skill.builder()
                .name("Java")
                .normalizedName("java")
                .build());
        jobSkillRepository.saveAndFlush(JobSkill.builder()
                .job(job)
                .skill(java)
                .importance(SkillImportance.REQUIRED)
                .build());
        addEligibleApplication(job, 1);

        Measurement oneCandidate = measure(company.getId(), job.getId());

        for (int index = 2; index <= 20; index++) {
            addEligibleApplication(job, index);
        }
        Measurement twentyCandidates = measure(company.getId(), job.getId());

        assertThat(oneCandidate.result().eligibleCandidateSnapshots()).hasSize(1);
        assertThat(twentyCandidates.result().eligibleCandidateSnapshots()).hasSize(20);
        assertThat(oneCandidate.preparedStatements())
                .isEqualTo(EXPECTED_PREPARATION_STATEMENTS)
                .isEqualTo(twentyCandidates.preparedStatements());
        assertThat(oneCandidate.entityFetches()).isZero();
        assertThat(twentyCandidates.entityFetches()).isZero();
    }

    private void addEligibleApplication(Job job, int index) {
        Student student = createStudent("ranking-query-student-" + index + "@example.test");
        CvFile cv = readyCv(student, "ranking-query-" + index + ".pdf", false,
                "Java CV " + index, List.of("java"));
        applicationRepository.saveAndFlush(JobApplication.builder()
                .student(student)
                .job(job)
                .cvFile(cv)
                .status(index % 2 == 0 ? ApplicationStatus.REVIEWED : ApplicationStatus.PENDING)
                .build());
    }

    private CvFile readyCv(
            Student student,
            String fileName,
            boolean active,
            String extractedText,
            List<String> extractedSkills
    ) {
        CvFile cv = createCv(student, fileName, active);
        cv.setExtractedText(extractedText);
        cv.setProcessedText(extractedText.toLowerCase());
        cv.setExtractedSkills(extractedSkills);
        cv.setAnalysisStatus(CvAnalysisStatus.READY);
        cv.setProcessingVersion("bilingual-nlp-v2-skills-v1");
        cv.setAnalyzedAt(LocalDateTime.of(2026, 8, 1, 10, 0).plusMinutes(cv.getId()));
        return cvFileRepository.saveAndFlush(cv);
    }

    private Measurement measure(Long companyId, Long jobId) {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        CandidateRankingPreparationResult result = preparationService.prepare(companyId, jobId);
        return new Measurement(
                result,
                statistics.getPrepareStatementCount(),
                statistics.getEntityFetchCount()
        );
    }

    private record Measurement(
            CandidateRankingPreparationResult result,
            long preparedStatements,
            long entityFetches
    ) {
    }
}
