package com.tttn.jobrecommendation.modules.student.dto.request;

import com.tttn.jobrecommendation.common.enums.JobType;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class StudentProfileUpdateRequest {

    @Size(max = 5000)
    private String summary;

    @Size(max = 5000)
    private String education;

    @Size(max = 5000)
    private String experience;

    @Size(max = 5000)
    private String projects;

    @Size(max = 255)
    private String targetPosition;

    @Size(max = 255)
    private String preferredLocation;

    private JobType preferredJobType;
}
