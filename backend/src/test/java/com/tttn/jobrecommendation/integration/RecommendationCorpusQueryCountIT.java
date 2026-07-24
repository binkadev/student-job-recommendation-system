package com.tttn.jobrecommendation.integration;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.SkillImportance;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.entity.JobSkill;
import com.tttn.jobrecommendation.modules.job.repository.JobSkillRepository;
import com.tttn.jobrecommendation.modules.recommendation.dto.request.GenerateRecommendationRequest;
import com.tttn.jobrecommendation.modules.recommendation.service.impl.RecommendationTransactionService;
import com.tttn.jobrecommendation.modules.skill.entity.Skill;
import com.tttn.jobrecommendation.modules.skill.repository.SkillRepository;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class RecommendationCorpusQueryCountIT extends AbstractPostgresIntegrationTest {

    @Autowired
    private RecommendationTransactionService transactionService;

    @Autowired
    private JobSkillRepository jobSkillRepository;

    @Autowired
    private SkillRepository skillRepository;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @DynamicPropertySource
    static void enableHibernateStatistics(DynamicPropertyRegistry registry) {
        registry.add("spring.jpa.properties.hibernate.generate_statistics", () -> "true");
    }

    @Test
    void increasingEligibleJobsDoesNotAddOneSkillQueryPerJob() {
        Student student = createStudent("query-count-student@example.test");
        CvFile cvFile = createCv(student, "query-count.pdf", true);
        cvFile.setProcessedText("java spring");
        cvFileRepository.saveAndFlush(cvFile);
        Company company = createCompany(
                "query-count-company@example.test",
                "Query Count",
                CompanyStatus.VERIFIED
        );
        Skill skill = skillRepository.saveAndFlush(Skill.builder()
                .name("Java")
                .normalizedName("java")
                .build());
        addJobWithSkill(company, skill, "Job 1");

        long oneJobStatements = prepareAndCountStatements(student, cvFile);

        for (int index = 2; index <= 6; index++) {
            addJobWithSkill(company, skill, "Job " + index);
        }
        long sixJobStatements = prepareAndCountStatements(student, cvFile);

        assertThat(oneJobStatements).isPositive();
        assertThat(sixJobStatements).isEqualTo(oneJobStatements);
    }

    private long prepareAndCountStatements(Student student, CvFile cvFile) {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();

        GenerateRecommendationRequest request = new GenerateRecommendationRequest();
        request.setCvId(cvFile.getId());
        request.setThreshold(new BigDecimal("0.1"));
        request.setLimit(20);
        transactionService.createProcessingRun(student.getUser().getId(), request);

        return statistics.getPrepareStatementCount();
    }

    private void addJobWithSkill(Company company, Skill skill, String title) {
        Job job = createJob(company, title, JobStatus.ACTIVE);
        jobSkillRepository.saveAndFlush(JobSkill.builder()
                .job(job)
                .skill(skill)
                .importance(SkillImportance.REQUIRED)
                .build());
    }
}
