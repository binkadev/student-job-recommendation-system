package com.tttn.jobrecommendation.modules.student.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class StudentUpdateRequest {

    @Size(max = 255)
    private String fullName;

    @Size(max = 255)
    private String major;

    @Size(max = 255)
    private String university;

    @Size(max = 50)
    private String phone;

    @Min(1900)
    @Max(2100)
    private Integer graduationYear;

    @Size(max = 255)
    private String location;

    @Size(max = 255)
    private String headline;
}
