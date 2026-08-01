package com.tttn.jobrecommendation.modules.candidateranking.dto.response;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record CandidateRankingResultResponse(
        Long id,
        Long applicationId,
        Long studentId,
        String studentName,
        String studentEmail,
        Long cvFileId,
        String cvFileName,
        ApplicationStatus applicationStatus,
        LocalDateTime appliedAt,
        BigDecimal score,
        BigDecimal textScore,
        BigDecimal skillScore,
        RecommendationScoringStrategy scoringStrategy,
        List<String> matchedSkills,
        List<String> missingSkills,
        String reason,
        Integer rankPosition,
        LocalDateTime createdAt
) {
    public CandidateRankingResultResponse {
        matchedSkills = matchedSkills == null ? List.of() : List.copyOf(matchedSkills);
        missingSkills = missingSkills == null ? List.of() : List.copyOf(missingSkills);
    }
}
