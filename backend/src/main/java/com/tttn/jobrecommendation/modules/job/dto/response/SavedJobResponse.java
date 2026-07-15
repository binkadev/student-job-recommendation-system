package com.tttn.jobrecommendation.modules.job.dto.response;

import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.JobType;
import com.tttn.jobrecommendation.common.enums.WorkingModel;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class SavedJobResponse {

    private Long savedJobId;
    private Long jobId;
    private String title;
    private String companyName;
    private String location;
    private JobType jobType;
    private WorkingModel workingModel;
    private JobStatus status;
    private LocalDateTime savedAt;
}
