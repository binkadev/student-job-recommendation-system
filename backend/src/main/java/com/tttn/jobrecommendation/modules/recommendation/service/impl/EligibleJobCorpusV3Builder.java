package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.config.RecommendationCorpusProperties;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationV3Request;
import com.tttn.jobrecommendation.infrastructure.ai.job.JobTextContentHasher;
import com.tttn.jobrecommendation.infrastructure.ai.skill.SkillCatalogCanonicalizer;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.entity.JobSkill;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.job.repository.JobSkillRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Component
class EligibleJobCorpusV3Builder {

    private static final int MAX_JOB_SKILLS = 100;
    private static final int MAX_FTS_QUERY_TOKENS = 64;
    private static final String EMPTY_SKILL_SENTINEL = "__sjrs_no_skill__";

    private final JobRepository jobRepository;
    private final JobSkillRepository jobSkillRepository;
    private final SkillCatalogCanonicalizer skillCatalogCanonicalizer;
    private final RecommendationCorpusProperties recommendationCorpusProperties;

    @Autowired
    EligibleJobCorpusV3Builder(
            JobRepository jobRepository,
            JobSkillRepository jobSkillRepository,
            SkillCatalogCanonicalizer skillCatalogCanonicalizer,
            RecommendationCorpusProperties recommendationCorpusProperties
    ) {
        this.jobRepository = jobRepository;
        this.jobSkillRepository = jobSkillRepository;
        this.skillCatalogCanonicalizer = skillCatalogCanonicalizer;
        this.recommendationCorpusProperties = recommendationCorpusProperties;
    }

    EligibleJobCorpusV3Builder(
            JobRepository jobRepository,
            JobSkillRepository jobSkillRepository,
            SkillCatalogCanonicalizer skillCatalogCanonicalizer
    ) {
        this(jobRepository, jobSkillRepository, skillCatalogCanonicalizer, new RecommendationCorpusProperties());
    }

    record EligibleJobCorpus(List<AiRecommendationV3Request.JobInput> jobs, int totalEligibleJobs) {
    }

    List<AiRecommendationV3Request.JobInput> build(LocalDate today) {
        List<Job> jobs = jobRepository.findEligibleForRecommendation(
                JobStatus.ACTIVE, CompanyStatus.VERIFIED, today
        );
        return toJobInputs(jobs);
    }

    EligibleJobCorpus buildForCv(LocalDate today, CvFile cvFile) {
        int totalEligible = Math.toIntExact(jobRepository.countEligibleForRecommendation(
                JobStatus.ACTIVE, CompanyStatus.VERIFIED, today
        ));
        if (totalEligible == 0) {
            return new EligibleJobCorpus(List.of(), 0);
        }

        List<String> cvSkills = skillCatalogCanonicalizer.canonicalizeAllSorted(
                cvFile.getExtractedSkills() == null ? List.of() : cvFile.getExtractedSkills()
        );
        List<String> querySkills = cvSkills.isEmpty() ? List.of(EMPTY_SKILL_SENTINEL) : cvSkills;
        String ftsQuery = buildSanitizedFtsOrQuery(cvFile.getProcessedText());
        int maxCandidates = Math.max(1, recommendationCorpusProperties.getMaxCandidateJobs());

        List<Long> candidateIds = jobRepository.findTopCandidateJobIdsForRecommendation(
                today, querySkills, ftsQuery, maxCandidates
        );
        if (candidateIds.isEmpty()) {
            return new EligibleJobCorpus(List.of(), totalEligible);
        }

        Map<Long, Job> jobsById = new HashMap<>(candidateIds.size());
        for (Job job : jobRepository.findWithCompanyByIdIn(candidateIds)) {
            jobsById.put(job.getId(), job);
        }
        List<Job> orderedJobs = candidateIds.stream()
                .map(jobsById::get)
                .filter(Objects::nonNull)
                .toList();
        return new EligibleJobCorpus(toJobInputs(orderedJobs), totalEligible);
    }

    private List<AiRecommendationV3Request.JobInput> toJobInputs(List<Job> jobs) {
        if (jobs.isEmpty()) {
            return List.of();
        }
        List<Long> ids = jobs.stream().map(Job::getId).toList();
        Map<Long, List<String>> rawSkillsByJob = new HashMap<>();
        for (JobSkill jobSkill : jobSkillRepository.findByJobIdInOrderByJobIdAscIdAsc(ids)) {
            String skill = StringUtils.hasText(jobSkill.getSkill().getNormalizedName())
                    ? jobSkill.getSkill().getNormalizedName() : jobSkill.getSkill().getName();
            if (StringUtils.hasText(skill)) {
                rawSkillsByJob.computeIfAbsent(jobSkill.getJob().getId(), ignored -> new ArrayList<>()).add(skill);
            }
        }
        return jobs.stream().map(job -> {
            List<String> skills = skillCatalogCanonicalizer.canonicalizeAllSorted(
                    rawSkillsByJob.getOrDefault(job.getId(), List.of())
            );
            if (skills.size() > MAX_JOB_SKILLS) {
                throw new AppException(ErrorCode.RECOMMENDATION_GENERATION_FAILED);
            }
            if (JobTextContentHasher.hasFreshSnapshot(job)) {
                return new AiRecommendationV3Request.JobInput(
                        job.getId(),
                        null,
                        skills,
                        job.getProcessedText(),
                        job.getLanguageCode(),
                        job.getLanguageConfidence(),
                        job.getProcessingVersion()
                );
            }
            return new AiRecommendationV3Request.JobInput(
                    job.getId(),
                    JobTextContentHasher.formatJobTextWithSkills(
                            job.getTitle(),
                            job.getDescription(),
                            job.getRequirements(),
                            skills
                    ),
                    skills
            );
        }).toList();
    }

    static String buildSanitizedFtsOrQuery(String processedText) {
        if (!StringUtils.hasText(processedText)) {
            return "";
        }
        String[] rawTokens = processedText.toLowerCase(Locale.ROOT).split("[^a-z0-9]+");
        Set<String> sanitized = new LinkedHashSet<>();
        for (String token : rawTokens) {
            if (token.length() >= 2) {
                sanitized.add(token);
                if (sanitized.size() >= MAX_FTS_QUERY_TOKENS) {
                    break;
                }
            }
        }
        return String.join("|", sanitized);
    }
}
