package com.tttn.jobrecommendation.modules.company.dto.request;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
import org.springframework.format.annotation.DateTimeFormat;
import java.time.LocalDate;

@Getter @Setter
public class RecruitmentReportFilter {
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) private LocalDate from;
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) private LocalDate to;
    @Positive private Long jobId;
    private ApplicationStatus status;
    @Size(max = 255) private String keyword;
    @Min(1) private int page = 1;
    @Min(1) @Max(100) private int size = 10;

    @AssertTrue(message = "Dates must be ordered and within years 1 through 9998")
    public boolean isDateRangeValid() {
        return (from == null || from.getYear() >= 1 && from.getYear() <= 9998)
                && (to == null || to.getYear() >= 1 && to.getYear() <= 9998)
                && (from == null || to == null || !from.isAfter(to));
    }
}
