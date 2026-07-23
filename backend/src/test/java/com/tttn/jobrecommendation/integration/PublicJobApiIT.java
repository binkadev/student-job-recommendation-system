package com.tttn.jobrecommendation.integration;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.JobType;
import com.tttn.jobrecommendation.common.enums.SkillImportance;
import com.tttn.jobrecommendation.common.enums.SkillLevel;
import com.tttn.jobrecommendation.common.enums.WorkingModel;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.entity.JobSkill;
import com.tttn.jobrecommendation.modules.job.repository.JobSkillRepository;
import com.tttn.jobrecommendation.modules.skill.entity.Skill;
import com.tttn.jobrecommendation.modules.skill.repository.SkillRepository;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PublicJobApiIT extends AbstractPostgresWebIntegrationTest {

    @Autowired
    private JobSkillRepository jobSkillRepository;

    @Autowired
    private SkillRepository skillRepository;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    private Company verifiedCompany;
    private Job visibleJob;

    @BeforeEach
    void createFixtures() {
        verifiedCompany = createCompany("public-jobs@example.test", "Public Jobs Co", CompanyStatus.VERIFIED);
        visibleJob = createPublicJob(
                verifiedCompany,
                "Java Platform Internship",
                "Build secure Java services",
                "Ho Chi Minh City",
                JobType.INTERNSHIP,
                WorkingModel.ONSITE,
                JobStatus.ACTIVE,
                LocalDate.now().plusDays(10)
        );
        addSkill(visibleJob, "Java");
    }

    @Test
    void anonymousListAndDetailReturnSafePublicData() throws Exception {
        String listResponse = mockMvc.perform(get("/api/public/jobs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(1))
                .andExpect(jsonPath("$.data.page").value(1))
                .andExpect(jsonPath("$.data.items[0].id").value(visibleJob.getId()))
                .andExpect(jsonPath("$.data.items[0].companyName").value("Public Jobs Co"))
                .andExpect(jsonPath("$.data.items[0].skills[0].skillName").value("Java"))
                .andReturn().getResponse().getContentAsString();

        String detailResponse = mockMvc.perform(get("/api/public/jobs/{jobId}", visibleJob.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(visibleJob.getId()))
                .andExpect(jsonPath("$.data.description").value("Build secure Java services"))
                .andExpect(jsonPath("$.data.skills[0].skillName").value("Java"))
                .andReturn().getResponse().getContentAsString();

        assertThat(listResponse + detailResponse)
                .doesNotContain("passwordHash")
                .doesNotContain("normalizedName")
                .doesNotContain("createdAt")
                .doesNotContain("updatedAt")
                .doesNotContain("closedAt");
    }

    @Test
    void listAndDetailHideEveryNonPublicJob() throws Exception {
        Company pending = createCompany("pending-public@example.test", "Pending Co", CompanyStatus.PENDING);
        Job draft = createPublicJob(verifiedCompany, "Draft", "Draft", "Hanoi", JobType.FULL_TIME,
                WorkingModel.REMOTE, JobStatus.DRAFT, null);
        Job closed = createPublicJob(verifiedCompany, "Closed", "Closed", "Hanoi", JobType.FULL_TIME,
                WorkingModel.REMOTE, JobStatus.CLOSED, null);
        Job unverified = createPublicJob(pending, "Unverified", "Unverified", "Hanoi", JobType.FULL_TIME,
                WorkingModel.REMOTE, JobStatus.ACTIVE, null);
        Job expired = createPublicJob(verifiedCompany, "Expired", "Expired", "Hanoi", JobType.FULL_TIME,
                WorkingModel.REMOTE, JobStatus.ACTIVE, LocalDate.now().minusDays(1));

        mockMvc.perform(get("/api/public/jobs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(1))
                .andExpect(jsonPath("$.data.items[0].id").value(visibleJob.getId()));

        for (Job hidden : new Job[]{draft, closed, unverified, expired}) {
            mockMvc.perform(get("/api/public/jobs/{jobId}", hidden.getId()))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));
        }
        mockMvc.perform(get("/api/public/jobs/{jobId}", Long.MAX_VALUE))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));
    }

    @Test
    void filtersAndOneBasedPaginationWorkAndStatusFilterIsRejected() throws Exception {
        createPublicJob(
                verifiedCompany,
                "Python Data Engineer",
                "Data pipelines",
                "Hanoi",
                JobType.FULL_TIME,
                WorkingModel.REMOTE,
                JobStatus.ACTIVE,
                null
        );

        mockMvc.perform(get("/api/public/jobs")
                        .param("keyword", "java")
                        .param("location", "ho chi minh")
                        .param("jobType", "INTERNSHIP")
                        .param("workingModel", "ONSITE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(1))
                .andExpect(jsonPath("$.data.items[0].id").value(visibleJob.getId()));

        mockMvc.perform(get("/api/public/jobs").param("page", "2").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.page").value(2))
                .andExpect(jsonPath("$.data.size").value(1))
                .andExpect(jsonPath("$.data.totalItems").value(2));

        mockMvc.perform(get("/api/public/jobs").param("size", "101"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_ERROR"));

        mockMvc.perform(get("/api/public/jobs").param("status", "ACTIVE"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("BAD_REQUEST"));
    }

    @Test
    void pageSkillLoadingDoesNotFanOutPerJob() throws Exception {
        for (int i = 0; i < 8; i++) {
            Job job = createPublicJob(
                    verifiedCompany,
                    "Batch Job " + i,
                    "Batch loading",
                    "Hanoi",
                    JobType.PART_TIME,
                    WorkingModel.HYBRID,
                    JobStatus.ACTIVE,
                    null
            );
            addSkill(job, "Skill-" + i);
        }

        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);

        statistics.clear();
        mockMvc.perform(get("/api/public/jobs").param("size", "1"))
                .andExpect(status().isOk());
        long singleItemQueries = statistics.getPrepareStatementCount();

        statistics.clear();
        mockMvc.perform(get("/api/public/jobs").param("size", "9"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(9));
        long nineItemQueries = statistics.getPrepareStatementCount();

        assertThat(nineItemQueries).isEqualTo(singleItemQueries);
        assertThat(nineItemQueries).isLessThanOrEqualTo(3);
    }

    private Job createPublicJob(
            Company company,
            String title,
            String description,
            String location,
            JobType jobType,
            WorkingModel workingModel,
            JobStatus status,
            LocalDate deadline
    ) {
        return jobRepository.saveAndFlush(Job.builder()
                .company(company)
                .title(title)
                .description(description)
                .requirements("Technical requirements")
                .benefits("Learning budget")
                .location(location)
                .jobType(jobType)
                .workingModel(workingModel)
                .status(status)
                .deadline(deadline)
                .publishedAt(LocalDateTime.now())
                .build());
    }

    private void addSkill(Job job, String name) {
        Skill skill = skillRepository.saveAndFlush(Skill.builder()
                .name(name)
                .normalizedName(name.toLowerCase())
                .category("TECHNICAL")
                .description("Internal skill description")
                .build());
        jobSkillRepository.saveAndFlush(JobSkill.builder()
                .job(job)
                .skill(skill)
                .importance(SkillImportance.REQUIRED)
                .minLevel(SkillLevel.BEGINNER)
                .build());
    }
}
