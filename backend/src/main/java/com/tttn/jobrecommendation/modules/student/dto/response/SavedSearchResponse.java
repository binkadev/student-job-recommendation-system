package com.tttn.jobrecommendation.modules.student.dto.response;

import com.tttn.jobrecommendation.common.enums.JobType;
import com.tttn.jobrecommendation.common.enums.WorkingModel;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class SavedSearchResponse {

    private Long id;
    private String name;
    private String keyword;
    private String location;
    private JobType jobType;
    private WorkingModel workingModel;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
