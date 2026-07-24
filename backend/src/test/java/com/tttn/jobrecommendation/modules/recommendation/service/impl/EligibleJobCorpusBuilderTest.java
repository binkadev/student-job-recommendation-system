package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.entity.JobSkill;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.job.repository.JobSkillRepository;
import com.tttn.jobrecommendation.modules.skill.entity.Skill;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EligibleJobCorpusBuilderTest {

    @Test
    void buildsDeterministicTextAndBatchLoadsSkills() {
        JobRepository jobRepository = mock(JobRepository.class);
        JobSkillRepository jobSkillRepository = mock(JobSkillRepository.class);
        EligibleJobCorpusBuilder builder = new EligibleJobCorpusBuilder(jobRepository, jobSkillRepository);
        LocalDate today = LocalDate.of(2026, 7, 24);

        Job first = Job.builder()
                .id(10L)
                .title(" Backend Engineer ")
                .description("Build\nSpring services")
                .requirements("PostgreSQL")
                .build();
        Job second = Job.builder()
                .id(20L)
                .title("Platform Engineer")
                .description("Docker")
                .build();
        Skill java = Skill.builder().id(1L).name("Java").normalizedName("java").build();
        Skill spring = Skill.builder().id(2L).name("Spring Boot").normalizedName("spring boot").build();
        when(jobRepository.findEligibleForRecommendation(JobStatus.ACTIVE, CompanyStatus.VERIFIED, today))
                .thenReturn(List.of(first, second));
        when(jobSkillRepository.findByJobIdInOrderByJobIdAscIdAsc(List.of(10L, 20L)))
                .thenReturn(List.of(
                        JobSkill.builder().job(first).skill(spring).build(),
                        JobSkill.builder().job(first).skill(java).build()
                ));

        var corpus = builder.build(today);

        assertThat(corpus).extracting(input -> input.id()).containsExactly(10L, 20L);
        assertThat(corpus.getFirst().skills()).containsExactly("java", "spring boot");
        assertThat(corpus.getFirst().processedText())
                .isEqualTo("Backend Engineer Build Spring services PostgreSQL java spring boot");
        assertThat(corpus.get(1).processedText()).isEqualTo("Platform Engineer Docker");
        verify(jobSkillRepository).findByJobIdInOrderByJobIdAscIdAsc(List.of(10L, 20L));
    }
}
