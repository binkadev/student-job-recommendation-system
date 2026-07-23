package com.tttn.jobrecommendation.modules.job.mapper;

import com.tttn.jobrecommendation.modules.job.dto.response.PublicJobDetailResponse;
import com.tttn.jobrecommendation.modules.job.dto.response.PublicJobResponse;
import com.tttn.jobrecommendation.modules.job.dto.response.PublicJobSkillResponse;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.entity.JobSkill;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class PublicJobMapper {

    public PublicJobResponse toPublicJobResponse(Job job, List<JobSkill> jobSkills) {
        return PublicJobResponse.builder()
                .id(job.getId())
                .companyId(job.getCompany().getId())
                .companyName(job.getCompany().getCompanyName())
                .title(job.getTitle())
                .location(job.getLocation())
                .jobType(job.getJobType())
                .workingModel(job.getWorkingModel())
                .salaryMin(job.getSalaryMin())
                .salaryMax(job.getSalaryMax())
                .currency(job.getCurrency())
                .deadline(job.getDeadline())
                .skills(toPublicJobSkillResponses(jobSkills))
                .publishedAt(job.getPublishedAt())
                .build();
    }

    public PublicJobDetailResponse toPublicJobDetailResponse(Job job, List<JobSkill> jobSkills) {
        return PublicJobDetailResponse.builder()
                .id(job.getId())
                .companyId(job.getCompany().getId())
                .companyName(job.getCompany().getCompanyName())
                .title(job.getTitle())
                .description(job.getDescription())
                .requirements(job.getRequirements())
                .benefits(job.getBenefits())
                .location(job.getLocation())
                .jobType(job.getJobType())
                .workingModel(job.getWorkingModel())
                .salaryMin(job.getSalaryMin())
                .salaryMax(job.getSalaryMax())
                .currency(job.getCurrency())
                .deadline(job.getDeadline())
                .skills(toPublicJobSkillResponses(jobSkills))
                .publishedAt(job.getPublishedAt())
                .build();
    }

    private List<PublicJobSkillResponse> toPublicJobSkillResponses(List<JobSkill> jobSkills) {
        if (jobSkills == null || jobSkills.isEmpty()) {
            return List.of();
        }

        return jobSkills.stream()
                .map(jobSkill -> PublicJobSkillResponse.builder()
                        .skillId(jobSkill.getSkill().getId())
                        .skillName(jobSkill.getSkill().getName())
                        .category(jobSkill.getSkill().getCategory())
                        .importance(jobSkill.getImportance())
                        .minLevel(jobSkill.getMinLevel())
                        .build())
                .toList();
    }
}
