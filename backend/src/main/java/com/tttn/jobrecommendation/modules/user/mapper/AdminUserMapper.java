package com.tttn.jobrecommendation.modules.user.mapper;

import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.entity.StudentProfile;
import com.tttn.jobrecommendation.modules.user.dto.response.AdminCompanyProfileSummaryResponse;
import com.tttn.jobrecommendation.modules.user.dto.response.AdminStudentProfileSummaryResponse;
import com.tttn.jobrecommendation.modules.user.dto.response.AdminUserDetailResponse;
import com.tttn.jobrecommendation.modules.user.dto.response.AdminUserResponse;
import com.tttn.jobrecommendation.modules.user.entity.User;
import org.springframework.stereotype.Component;

@Component
public class AdminUserMapper {

    public AdminUserResponse toAdminUserResponse(User user) {
        return AdminUserResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .role(user.getRole())
                .status(user.getStatus())
                .lastLoginAt(user.getLastLoginAt())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }

    public AdminUserDetailResponse toAdminUserDetailResponse(
            User user,
            Student student,
            StudentProfile studentProfile,
            Company company
    ) {
        return AdminUserDetailResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .role(user.getRole())
                .status(user.getStatus())
                .lastLoginAt(user.getLastLoginAt())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .studentProfile(toStudentProfileSummary(student, studentProfile))
                .companyProfile(toCompanyProfileSummary(company))
                .build();
    }

    private AdminStudentProfileSummaryResponse toStudentProfileSummary(Student student, StudentProfile profile) {
        if (student == null) {
            return null;
        }

        return AdminStudentProfileSummaryResponse.builder()
                .studentId(student.getId())
                .studentCode(student.getStudentCode())
                .university(student.getUniversity())
                .major(student.getMajor())
                .graduationYear(student.getGraduationYear())
                .location(student.getLocation())
                .profileId(profile == null ? null : profile.getId())
                .headline(profile == null ? null : profile.getHeadline())
                .targetPosition(profile == null ? null : profile.getTargetPosition())
                .profileCompleteness(profile == null ? null : profile.getProfileCompleteness())
                .createdAt(student.getCreatedAt())
                .updatedAt(student.getUpdatedAt())
                .build();
    }

    private AdminCompanyProfileSummaryResponse toCompanyProfileSummary(Company company) {
        if (company == null) {
            return null;
        }

        return AdminCompanyProfileSummaryResponse.builder()
                .companyId(company.getId())
                .companyName(company.getCompanyName())
                .taxCode(company.getTaxCode())
                .websiteUrl(company.getWebsiteUrl())
                .industry(company.getIndustry())
                .description(company.getDescription())
                .address(company.getAddress())
                .phone(company.getPhone())
                .status(company.getStatus())
                .companySize(null)
                .logoUrl(null)
                .createdAt(company.getCreatedAt())
                .updatedAt(company.getUpdatedAt())
                .build();
    }
}
