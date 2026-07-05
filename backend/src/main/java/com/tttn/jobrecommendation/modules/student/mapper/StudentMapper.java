package com.tttn.jobrecommendation.modules.student.mapper;

import com.tttn.jobrecommendation.modules.student.dto.response.StudentProfileResponse;
import com.tttn.jobrecommendation.modules.student.dto.response.StudentResponse;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.entity.StudentProfile;
import org.springframework.stereotype.Component;

@Component
public class StudentMapper {

    public StudentResponse toStudentResponse(Student student, StudentProfile profile) {
        return StudentResponse.builder()
                .id(student.getId())
                .userId(student.getUser().getId())
                .email(student.getUser().getEmail())
                .fullName(student.getUser().getFullName())
                .phone(student.getUser().getPhone())
                .studentCode(student.getStudentCode())
                .major(student.getMajor())
                .university(student.getUniversity())
                .graduationYear(student.getGraduationYear())
                .location(student.getLocation())
                .headline(profile.getHeadline())
                .createdAt(student.getCreatedAt())
                .updatedAt(student.getUpdatedAt())
                .build();
    }

    public StudentProfileResponse toStudentProfileResponse(StudentProfile profile) {
        return StudentProfileResponse.builder()
                .id(profile.getId())
                .studentId(profile.getStudent().getId())
                .headline(profile.getHeadline())
                .summary(profile.getSummary())
                .education(profile.getEducation())
                .experience(profile.getExperience())
                .projects(profile.getProjects())
                .targetPosition(profile.getTargetPosition())
                .preferredLocation(profile.getPreferredLocation())
                .preferredJobType(profile.getPreferredJobType())
                .rawText(profile.getRawText())
                .processedText(profile.getProcessedText())
                .profileCompleteness(profile.getProfileCompleteness())
                .updatedAt(profile.getUpdatedAt())
                .build();
    }
}
