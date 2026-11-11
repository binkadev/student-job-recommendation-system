package com.tttn.jobrecommendation.modules.student.mapper;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tttn.jobrecommendation.modules.student.dto.request.StudentCertificateItem;
import com.tttn.jobrecommendation.modules.student.dto.request.StudentLanguageItem;
import com.tttn.jobrecommendation.modules.student.dto.response.StudentProfileResponse;
import com.tttn.jobrecommendation.modules.student.dto.response.StudentResponse;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.entity.StudentProfile;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.List;

@Component
public class StudentMapper {

    private static final TypeReference<List<StudentCertificateItem>> CERTIFICATE_LIST_TYPE = new TypeReference<>() {};
    private static final TypeReference<List<StudentLanguageItem>> LANGUAGE_LIST_TYPE = new TypeReference<>() {};

    private final ObjectMapper objectMapper;

    public StudentMapper() {
        this(new ObjectMapper());
    }

    @Autowired
    public StudentMapper(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

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
                .educationLevel(profile.getEducationLevel())
                .gpa(profile.getGpa())
                .preferredLocation(profile.getPreferredLocation())
                .preferredJobType(profile.getPreferredJobType())
                .preferredWorkingModel(profile.getPreferredWorkingModel())
                .githubUrl(profile.getGithubUrl())
                .linkedinUrl(profile.getLinkedinUrl())
                .portfolioUrl(profile.getPortfolioUrl())
                .certificates(parseCertificates(profile.getCertificatesJson()))
                .languages(parseLanguages(profile.getLanguagesJson()))
                .rawText(profile.getRawText())
                .processedText(profile.getProcessedText())
                .profileCompleteness(profile.getProfileCompleteness())
                .updatedAt(profile.getUpdatedAt())
                .build();
    }

    public String serializeCertificates(List<StudentCertificateItem> items) {
        List<StudentCertificateItem> normalized = items.stream()
                .map(item -> StudentCertificateItem.builder()
                        .name(item.getName().trim())
                        .issuer(trimToNull(item.getIssuer()))
                        .issuedAt(trimToNull(item.getIssuedAt()))
                        .expiresAt(trimToNull(item.getExpiresAt()))
                        .code(trimToNull(item.getCode()))
                        .url(trimToNull(item.getUrl()))
                        .build())
                .toList();
        return writeJson(normalized);
    }

    public String serializeLanguages(List<StudentLanguageItem> items) {
        List<StudentLanguageItem> normalized = items.stream()
                .map(item -> StudentLanguageItem.builder()
                        .name(item.getName().trim())
                        .level(item.getLevel().trim())
                        .build())
                .toList();
        return writeJson(normalized);
    }

    private List<StudentCertificateItem> parseCertificates(String json) {
        if (!StringUtils.hasText(json)) {
            return List.of();
        }
        try {
            List<StudentCertificateItem> parsed = objectMapper.readValue(json, CERTIFICATE_LIST_TYPE);
            return parsed == null ? List.of() : List.copyOf(parsed);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to deserialize student certificates JSON", ex);
        }
    }

    private List<StudentLanguageItem> parseLanguages(String json) {
        if (!StringUtils.hasText(json)) {
            return List.of();
        }
        try {
            List<StudentLanguageItem> parsed = objectMapper.readValue(json, LANGUAGE_LIST_TYPE);
            return parsed == null ? List.of() : List.copyOf(parsed);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to deserialize student languages JSON", ex);
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to serialize student profile structured JSON", ex);
        }
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }
}
