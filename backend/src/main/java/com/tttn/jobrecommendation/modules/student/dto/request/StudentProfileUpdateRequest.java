package com.tttn.jobrecommendation.modules.student.dto.request;

import com.fasterxml.jackson.annotation.JsonSetter;
import com.fasterxml.jackson.databind.JsonNode;
import com.tttn.jobrecommendation.common.enums.JobType;
import com.tttn.jobrecommendation.common.enums.WorkingModel;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;

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

    @Size(max = 100)
    private String educationLevel;

    @DecimalMin(value = "0.00", message = "GPA must be at least 0.00")
    @DecimalMax(value = "4.00", message = "GPA must be at most 4.00")
    @Digits(integer = 1, fraction = 2, message = "GPA must have at most 1 integer digit and 2 decimal places")
    @Setter(AccessLevel.NONE)
    private BigDecimal gpa;

    @Size(max = 255)
    private String preferredLocation;

    private JobType preferredJobType;

    private WorkingModel preferredWorkingModel;

    @Size(max = 500)
    @ValidHttpUrl
    private String githubUrl;

    @Size(max = 500)
    @ValidHttpUrl
    private String linkedinUrl;

    @Size(max = 500)
    @ValidHttpUrl
    private String portfolioUrl;

    @Size(max = 50)
    private List<@NotNull @Valid StudentCertificateItem> certificates;

    @Size(max = 50)
    private List<@NotNull @Valid StudentLanguageItem> languages;

    @JsonSetter("gpa")
    public void readGpa(JsonNode value) {
        if (value == null || value.isNull()) {
            this.gpa = null;
            return;
        }
        if (!value.isNumber()) {
            throw new IllegalArgumentException("gpa must be a number");
        }
        this.gpa = value.decimalValue();
    }

    public void setGpa(BigDecimal gpa) {
        this.gpa = gpa;
    }
}
