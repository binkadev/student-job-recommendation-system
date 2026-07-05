package com.tttn.jobrecommendation.modules.student.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class StudentResponse {

    private Long id;
    private Long userId;
    private String email;
    private String fullName;
    private String phone;
    private String studentCode;
    private String major;
    private String university;
    private Integer graduationYear;
    private String location;
    private String headline;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
