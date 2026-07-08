package com.tttn.jobrecommendation.modules.job.mapper;

import com.tttn.jobrecommendation.modules.job.dto.response.JobDetailResponse;
import com.tttn.jobrecommendation.modules.job.dto.response.JobResponse;
import com.tttn.jobrecommendation.modules.job.dto.response.JobSkillResponse;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.entity.JobSkill;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class JobMapper {

    public JobResponse toJobResponse(Job job, List<JobSkill> jobSkills) {
        return JobResponse.builder()
                .id(job.getId())
                .companyId(job.getCompany().getId())
                .companyName(job.getCompany().getCompanyName())
                .title(job.getTitle())
                .location(job.getLocation())
                .jobType(job.getJobType())
                .workingModel(job.getWorkingModel())
                .status(job.getStatus())
                .salaryMin(job.getSalaryMin())
                .salaryMax(job.getSalaryMax())
                .currency(job.getCurrency())
                .deadline(job.getDeadline())
                .skills(toJobSkillResponses(jobSkills))
                .publishedAt(job.getPublishedAt())
                .closedAt(job.getClosedAt())
                .createdAt(job.getCreatedAt())
                .updatedAt(job.getUpdatedAt())
                .build();
    }

    public JobDetailResponse toJobDetailResponse(Job job, List<JobSkill> jobSkills) {
        return JobDetailResponse.builder()
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
                .status(job.getStatus())
                .salaryMin(job.getSalaryMin())
                .salaryMax(job.getSalaryMax())
                .currency(job.getCurrency())
                .deadline(job.getDeadline())
                .skills(toJobSkillResponses(jobSkills))
                .publishedAt(job.getPublishedAt())
                .closedAt(job.getClosedAt())
                .createdAt(job.getCreatedAt())
                .updatedAt(job.getUpdatedAt())
                .build();
    }

    private List<JobSkillResponse> toJobSkillResponses(List<JobSkill> jobSkills) {
        if (jobSkills == null) {
            return List.of();
        }

        return jobSkills.stream()
                .map(this::toJobSkillResponse)
                .toList();
    }

    private JobSkillResponse toJobSkillResponse(JobSkill jobSkill) {
        return JobSkillResponse.builder()
                .id(jobSkill.getId())
                .skillId(jobSkill.getSkill().getId())
                .skillName(jobSkill.getSkill().getName())
                .normalizedName(jobSkill.getSkill().getNormalizedName())
                .category(jobSkill.getSkill().getCategory())
                .importance(jobSkill.getImportance())
                .minLevel(jobSkill.getMinLevel())
                .build();
    }
}
