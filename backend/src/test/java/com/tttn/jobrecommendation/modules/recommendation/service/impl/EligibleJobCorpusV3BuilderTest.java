package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.config.RecommendationCorpusProperties;
import com.tttn.jobrecommendation.infrastructure.ai.job.JobTextContentHasher;
import com.tttn.jobrecommendation.infrastructure.ai.skill.SkillCatalogCanonicalizer;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.entity.JobSkill;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.job.repository.JobSkillRepository;
import com.tttn.jobrecommendation.modules.skill.entity.Skill;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
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

    @Test
    void acceptsExactlyOneHundredCanonicalSkillsAndCountsAliasesAfterCollapse() {
        JobRepository jobs = mock(JobRepository.class);
        JobSkillRepository skills = mock(JobSkillRepository.class);
        LocalDate today = LocalDate.of(2026, 8, 12);
        Job job = Job.builder().id(10L).build();
        List<JobSkill> declared = new ArrayList<>();
        for (int index = 0; index < 99; index++) {
            declared.add(jobSkill(job, "unknown-v3-skill-" + index));
        }
        declared.add(jobSkill(job, "js"));
        declared.add(jobSkill(job, "javascript"));
        when(jobs.findEligibleForRecommendation(JobStatus.ACTIVE, CompanyStatus.VERIFIED, today)).thenReturn(List.of(job));
        when(skills.findByJobIdInOrderByJobIdAscIdAsc(List.of(10L))).thenReturn(declared);

        var corpus = new EligibleJobCorpusV3Builder(jobs, skills, new SkillCatalogCanonicalizer()).build(today);

        assertThat(corpus.getFirst().skills()).hasSize(100).contains("javascript");
        assertThat(corpus.getFirst().skills()).doesNotContain("js");
    }

    @Test
    void buildForCvPrefiltersTopCandidatesReusesFreshSnapshotsAndPreservesTotalScanned() {
        JobRepository jobs = mock(JobRepository.class);
        JobSkillRepository skills = mock(JobSkillRepository.class);
        RecommendationCorpusProperties props = new RecommendationCorpusProperties();
        props.setMaxCandidateJobs(2);
        LocalDate today = LocalDate.of(2026, 8, 12);

        String freshHash = JobTextContentHasher.sha256("Java Dev", "Build APIs", "Spring Boot");
        Job freshJob = Job.builder()
                .id(20L).title("Java Dev").description("Build APIs").requirements("Spring Boot")
                .processedText("java_dev build api spring_boot")
                .languageCode("en").languageConfidence(new BigDecimal("0.98"))
                .processingVersion(JobTextContentHasher.PROCESSING_VERSION)
                .contentHash(freshHash)
                .build();
        Job staleJob = Job.builder()
                .id(10L).title("Python Dev").description("Data pipelines").requirements("SQL")
                .build();

        CvFile cv = CvFile.builder()
                .id(5L)
                .processedText("java spring_boot c++ .net ci/cd a")
                .extractedSkills(List.of("JS", "Java"))
                .build();

        when(jobs.countEligibleForRecommendation(JobStatus.ACTIVE, CompanyStatus.VERIFIED, today)).thenReturn(14956L);
        when(jobs.findTopCandidateJobIdsForRecommendation(
                eq(today),
                eq(List.of("java", "javascript")),
                eq("java|spring|boot|net|ci|cd"),
                eq(2)
        )).thenReturn(List.of(20L, 10L));
        when(jobs.findWithCompanyByIdIn(List.of(20L, 10L))).thenReturn(List.of(staleJob, freshJob));
        when(skills.findByJobIdInOrderByJobIdAscIdAsc(List.of(20L, 10L))).thenReturn(List.of(
                jobSkill(staleJob, "Python"), jobSkill(freshJob, "Spring Boot")
        ));

        var corpus = new EligibleJobCorpusV3Builder(jobs, skills, new SkillCatalogCanonicalizer(), props)
                .buildForCv(today, cv);

        assertThat(corpus.totalEligibleJobs()).isEqualTo(14956);
        assertThat(corpus.jobs()).extracting(com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationV3Request.JobInput::id)
                .containsExactly(20L, 10L);
        assertThat(corpus.jobs().get(0).text()).isNull();
        assertThat(corpus.jobs().get(0).processedText()).isEqualTo("java_dev build api spring_boot");
        assertThat(corpus.jobs().get(0).languageCode()).isEqualTo("en");
        assertThat(corpus.jobs().get(0).processingVersion()).isEqualTo(JobTextContentHasher.PROCESSING_VERSION);
        assertThat(corpus.jobs().get(1).text()).contains("SKILLS:\npython");
        assertThat(corpus.jobs().get(1).processedText()).isNull();
        verify(jobs, never()).findEligibleForRecommendation(JobStatus.ACTIVE, CompanyStatus.VERIFIED, today);
    }

    @Test
    void sanitizesFtsOrQuerySafelyAcrossSpecialTokensAndEmptyInputs() {
        assertThat(EligibleJobCorpusV3Builder.buildSanitizedFtsOrQuery("c++ .net ci/cd java spring_boot a"))
                .isEqualTo("net|ci|cd|java|spring|boot");
        assertThat(EligibleJobCorpusV3Builder.buildSanitizedFtsOrQuery("c++ ? ! a | & ( )"))
                .isEmpty();
        assertThat(EligibleJobCorpusV3Builder.buildSanitizedFtsOrQuery(null))
                .isEmpty();
    }

    private JobSkill jobSkill(Job job, String name) {
        return JobSkill.builder().job(job).skill(Skill.builder().name(name).normalizedName(name).build()).build();
    }
}
