package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationV3Request;
import com.tttn.jobrecommendation.infrastructure.ai.skill.SkillCatalogCanonicalizer;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.entity.JobSkill;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.job.repository.JobSkillRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
class EligibleJobCorpusV3Builder {

    private static final int MAX_JOB_SKILLS = 100;

    private final JobRepository jobRepository;
    private final JobSkillRepository jobSkillRepository;
    private final SkillCatalogCanonicalizer skillCatalogCanonicalizer;

    List<AiRecommendationV3Request.JobInput> build(LocalDate today) {
        List<Job> jobs = jobRepository.findEligibleForRecommendation(
                JobStatus.ACTIVE, CompanyStatus.VERIFIED, today
        );
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
            return new AiRecommendationV3Request.JobInput(job.getId(), buildJobText(job, skills), skills);
        }).toList();
    }

    private String buildJobText(Job job, List<String> skills) {
        return """
                TITLE:
                %s

                DESCRIPTION:
                %s

                REQUIREMENTS:
                %s

                SKILLS:
                %s""".formatted(section(job.getTitle()), section(job.getDescription()),
                section(job.getRequirements()), String.join(", ", skills));
    }

    private String section(String value) {
        return value == null ? "" : value.strip();
    }
}
