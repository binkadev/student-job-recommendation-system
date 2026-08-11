package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.skill.SkillCatalogCanonicalizer;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.entity.JobSkill;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.job.repository.JobSkillRepository;
import com.tttn.jobrecommendation.modules.skill.entity.Skill;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class EligibleJobCorpusV3BuilderTest {

    @Test
    void canonicalizesAliasesWithoutTruncatingTheV3RequestSnapshot() {
        JobRepository jobs = mock(JobRepository.class);
        JobSkillRepository skills = mock(JobSkillRepository.class);
        LocalDate today = LocalDate.of(2026, 8, 12);
        Job job = Job.builder().id(10L).title("Backend").build();
        when(jobs.findEligibleForRecommendation(JobStatus.ACTIVE, CompanyStatus.VERIFIED, today)).thenReturn(List.of(job));
        when(skills.findByJobIdInOrderByJobIdAscIdAsc(List.of(10L))).thenReturn(List.of(
                jobSkill(job, "JS"), jobSkill(job, "javascript"), jobSkill(job, "Spring Boot")
        ));

        var corpus = new EligibleJobCorpusV3Builder(jobs, skills, new SkillCatalogCanonicalizer()).build(today);

        assertThat(corpus.getFirst().skills()).containsExactly("javascript", "spring boot");
        assertThat(corpus.getFirst().text()).contains("SKILLS:\njavascript, spring boot");
    }

    @Test
    void rejectsMoreThanOneHundredCanonicalJobSkillsRatherThanTruncating() {
        JobRepository jobs = mock(JobRepository.class);
        JobSkillRepository skills = mock(JobSkillRepository.class);
        LocalDate today = LocalDate.of(2026, 8, 12);
        Job job = Job.builder().id(10L).build();
        List<JobSkill> declared = new ArrayList<>();
        for (int index = 0; index < 101; index++) {
            declared.add(jobSkill(job, "unknown-v3-skill-" + index));
        }
        when(jobs.findEligibleForRecommendation(JobStatus.ACTIVE, CompanyStatus.VERIFIED, today)).thenReturn(List.of(job));
        when(skills.findByJobIdInOrderByJobIdAscIdAsc(List.of(10L))).thenReturn(declared);

        assertThatThrownBy(() -> new EligibleJobCorpusV3Builder(jobs, skills, new SkillCatalogCanonicalizer()).build(today))
                .isInstanceOfSatisfying(AppException.class,
                        exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.RECOMMENDATION_GENERATION_FAILED));
    }

    private JobSkill jobSkill(Job job, String name) {
        return JobSkill.builder().job(job).skill(Skill.builder().name(name).normalizedName(name).build()).build();
    }
}
