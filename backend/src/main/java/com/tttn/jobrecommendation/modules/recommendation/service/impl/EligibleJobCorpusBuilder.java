package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.utils.SkillNameNormalizer;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationRequest;
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
public class EligibleJobCorpusBuilder {

    private final JobRepository jobRepository;
    private final JobSkillRepository jobSkillRepository;

    public List<AiRecommendationRequest.JobInput> build(LocalDate today) {
        List<Job> jobs = jobRepository.findEligibleForRecommendation(
                JobStatus.ACTIVE,
                CompanyStatus.VERIFIED,
                today
        );
        if (jobs.isEmpty()) {
            return List.of();
        }

        List<Long> jobIds = jobs.stream().map(Job::getId).toList();
        Map<Long, List<String>> skillsByJobId = new HashMap<>();
        for (JobSkill jobSkill : jobSkillRepository.findByJobIdInOrderByJobIdAscIdAsc(jobIds)) {
            String sourceName = StringUtils.hasText(jobSkill.getSkill().getNormalizedName())
                    ? jobSkill.getSkill().getNormalizedName()
                    : jobSkill.getSkill().getName();
            String normalizedName = SkillNameNormalizer.normalize(sourceName);
            if (StringUtils.hasText(normalizedName)) {
                skillsByJobId.computeIfAbsent(jobSkill.getJob().getId(), ignored -> new ArrayList<>())
                        .add(normalizedName);
            }
        }

        return jobs.stream()
                .map(job -> {
                    List<String> skills = skillsByJobId.getOrDefault(job.getId(), List.of())
                            .stream()
                            .distinct()
                            .sorted()
                            .toList();
                    return new AiRecommendationRequest.JobInput(
                            job.getId(),
                            buildProcessedText(job, skills),
                            skills
                    );
                })
                .toList();
    }

    String buildProcessedText(Job job, List<String> normalizedSkills) {
        List<String> parts = new ArrayList<>();
        addPart(parts, job.getTitle());
        addPart(parts, job.getDescription());
        addPart(parts, job.getRequirements());
        addPart(parts, String.join(" ", normalizedSkills));
        return String.join(" ", parts);
    }

    private void addPart(List<String> parts, String value) {
        if (StringUtils.hasText(value)) {
            parts.add(value.strip().replaceAll("\\s+", " "));
        }
    }
}
