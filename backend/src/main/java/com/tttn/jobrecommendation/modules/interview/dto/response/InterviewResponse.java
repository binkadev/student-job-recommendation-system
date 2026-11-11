package com.tttn.jobrecommendation.modules.interview.dto.response;

import com.tttn.jobrecommendation.common.enums.InterviewStatus;
import com.tttn.jobrecommendation.common.enums.MeetingType;
import com.tttn.jobrecommendation.modules.interview.entity.Interview;
import java.time.LocalDateTime;

public record InterviewResponse(Long id, Long applicationId, Long companyId, Long studentId, Long jobId,
        String title, LocalDateTime scheduledAt, Integer durationMinutes, MeetingType meetingType,
        String locationOrLink, String notes, InterviewStatus status, LocalDateTime createdAt, LocalDateTime updatedAt) {
    public static InterviewResponse from(Interview i) {
        return new InterviewResponse(i.getId(), i.getApplication().getId(), i.getCompany().getId(),
                i.getStudent().getId(), i.getJob().getId(), i.getTitle(), i.getScheduledAt(),
                i.getDurationMinutes(), i.getMeetingType(), i.getLocationOrLink(), i.getNotes(),
                i.getStatus(), i.getCreatedAt(), i.getUpdatedAt());
    }
    @Override public String toString() { return "InterviewResponse[redacted]"; }
}
