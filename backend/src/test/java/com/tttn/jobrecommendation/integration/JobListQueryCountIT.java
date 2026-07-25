package com.tttn.jobrecommendation.integration;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.SkillImportance;
import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.job.dto.request.JobFilterRequest;
import com.tttn.jobrecommendation.modules.job.dto.response.JobResponse;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.entity.JobSkill;
import com.tttn.jobrecommendation.modules.job.repository.JobSkillRepository;
import com.tttn.jobrecommendation.modules.job.service.JobService;
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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class JobListQueryCountIT extends AbstractPostgresIntegrationTest {

    private static final int PAGE_SIZE = 20;
    private static final long EXPECTED_PAGE_STATEMENTS = 3L;

    @Autowired
    private JobService jobService;

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
    void jobListQueryCountIsConstantAcrossOneAndTwentyResults() {
        Student student = createStudent("job-list-query-count-student@example.test");
        Company firstCompany = createCompany(
                "job-list-query-count-company-1@example.test",
                "First Query Count Company",
                CompanyStatus.VERIFIED
        );
        Company secondCompany = createCompany(
                "job-list-query-count-company-2@example.test",
                "Second Query Count Company",
                CompanyStatus.VERIFIED
        );
        List<Skill> sharedSkills = createSharedSkills();
        Map<Long, String> expectedCompanyNames = new HashMap<>();
        Map<Long, List<String>> expectedSkillNames = new HashMap<>();

        for (int index = 1; index <= PAGE_SIZE; index++) {
            Company company = index <= 11
                    ? firstCompany
                    : (index % 2 == 0 ? firstCompany : secondCompany);
            Job job = createJob(company, "Active job " + index, JobStatus.ACTIVE);
            expectedCompanyNames.put(job.getId(), company.getCompanyName());
            expectedSkillNames.put(job.getId(), addSkills(job, sharedSkills, index));
        }

        Job jobWithoutSkills = createJob(secondCompany, "Active job without skills", JobStatus.ACTIVE);
        expectedCompanyNames.put(jobWithoutSkills.getId(), secondCompany.getCompanyName());
        expectedSkillNames.put(jobWithoutSkills.getId(), List.of());

        Measurement oneResult = measureGetJobs(PAGE_SIZE + 1, 1, student.getUser().getId());
        Measurement twentyResults = measureGetJobs(1, PAGE_SIZE, student.getUser().getId());
        Measurement emptyPage = measureGetJobs(3, PAGE_SIZE, student.getUser().getId());

        assertThat(oneResult.preparedStatements()).isEqualTo(EXPECTED_PAGE_STATEMENTS);
        assertThat(twentyResults.preparedStatements())
                .isEqualTo(oneResult.preparedStatements())
                .isLessThanOrEqualTo(EXPECTED_PAGE_STATEMENTS);
        assertThat(emptyPage.preparedStatements()).isEqualTo(2L);

        assertPage(oneResult.response(), PAGE_SIZE + 1, 1, 1, PAGE_SIZE + 1);
        assertPage(twentyResults.response(), 1, PAGE_SIZE, PAGE_SIZE, 2);
        assertPage(emptyPage.response(), 3, PAGE_SIZE, 0, 2);

        List<JobResponse> returnedJobs = new ArrayList<>(twentyResults.response().getItems());
        returnedJobs.addAll(oneResult.response().getItems());

        assertThat(returnedJobs)
                .extracting(JobResponse::getId)
                .doesNotHaveDuplicates()
                .hasSize(PAGE_SIZE + 1);
        assertThat(returnedJobs)
                .filteredOn(response -> response.getId().equals(jobWithoutSkills.getId()))
                .singleElement()
                .satisfies(response -> assertThat(response.getSkills()).isEmpty());

        returnedJobs.forEach(response -> {
            assertThat(response.getCompanyName())
                    .isEqualTo(expectedCompanyNames.get(response.getId()));
            assertThat(response.getSkills())
                    .extracting(skill -> skill.getId())
                    .doesNotHaveDuplicates();
            assertThat(response.getSkills())
                    .extracting(skill -> skill.getSkillName())
                    .containsExactlyElementsOf(expectedSkillNames.get(response.getId()));
        });
    }

    private List<Skill> createSharedSkills() {
        return skillRepository.saveAllAndFlush(List.of(
                Skill.builder()
                        .name("Java Query Count")
                        .normalizedName("java query count")
                        .category("Backend")
                        .build(),
                Skill.builder()
                        .name("Spring Query Count")
                        .normalizedName("spring query count")
                        .category("Backend")
                        .build(),
                Skill.builder()
                        .name("PostgreSQL Query Count")
                        .normalizedName("postgresql query count")
                        .category("Database")
                        .build()
        ));
    }

    private List<String> addSkills(Job job, List<Skill> sharedSkills, int jobIndex) {
        Skill firstSkill = sharedSkills.get(0);
        Skill secondSkill = sharedSkills.get(jobIndex % 2 == 0 ? 1 : 2);
        List<JobSkill> savedSkills = jobSkillRepository.saveAllAndFlush(List.of(
                JobSkill.builder()
                        .job(job)
                        .skill(firstSkill)
                        .importance(SkillImportance.REQUIRED)
                        .build(),
                JobSkill.builder()
                        .job(job)
                        .skill(secondSkill)
                        .importance(SkillImportance.PREFERRED)
                        .build()
        ));
        return savedSkills.stream()
                .map(jobSkill -> jobSkill.getSkill().getName())
                .toList();
    }

    private Measurement measureGetJobs(int pageNumber, int pageSize, Long userId) {
        JobFilterRequest request = new JobFilterRequest();
        request.setPage(pageNumber);
        request.setSize(pageSize);

        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        PageResponse<JobResponse> response = jobService.getJobs(request, userId, UserRole.STUDENT);
        return new Measurement(response, statistics.getPrepareStatementCount());
    }

    private void assertPage(
            PageResponse<JobResponse> response,
            int expectedPage,
            int expectedSize,
            int expectedItems,
            int expectedTotalPages
    ) {
        assertThat(response.getItems()).hasSize(expectedItems);
        assertThat(response.getPage()).isEqualTo(expectedPage);
        assertThat(response.getSize()).isEqualTo(expectedSize);
        assertThat(response.getTotalItems()).isEqualTo(PAGE_SIZE + 1L);
        assertThat(response.getTotalPages()).isEqualTo(expectedTotalPages);
    }

    private record Measurement(PageResponse<JobResponse> response, long preparedStatements) {
    }
}
