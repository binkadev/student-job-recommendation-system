package com.tttn.jobrecommendation.modules.job.mapper;

import com.tttn.jobrecommendation.modules.job.dto.response.SavedJobResponse;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.entity.SavedJob;
import org.springframework.stereotype.Component;

@Component
public class SavedJobMapper {

    public SavedJobResponse toSavedJobResponse(SavedJob savedJob) {
        Job job = savedJob.getJob();
        return SavedJobResponse.builder()
                .savedJobId(savedJob.getId())
                .jobId(job.getId())
                .title(job.getTitle())
                .companyName(job.getCompany().getCompanyName())
                .location(job.getLocation())
                .jobType(job.getJobType())
                .workingModel(job.getWorkingModel())
                .status(job.getStatus())
                .savedAt(savedJob.getCreatedAt())
                .build();
    }
}
