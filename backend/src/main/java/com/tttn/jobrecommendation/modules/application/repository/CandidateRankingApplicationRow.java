package com.tttn.jobrecommendation.modules.application.repository;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CvAnalysisStatus;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Detached candidate-ranking input row. The projection deliberately excludes
 * candidate identity, cover letters, active-CV state, and file storage metadata.
 */
public record CandidateRankingApplicationRow(
        Long applicationId,
        ApplicationStatus applicationStatus,
        Long applicationStudentId,
        Long jobId,
        Long cvId,
        Long cvStudentId,
        String cvExtractedText,
        String cvProcessedText,
        List<String> cvExtractedSkills,
        CvAnalysisStatus cvAnalysisStatus,
        String cvProcessingVersion,
        LocalDateTime cvAnalyzedAt
) {
}
