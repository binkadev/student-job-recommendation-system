package com.tttn.jobrecommendation.modules.candidateranking.service;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.exception.AiCandidateRankingCapacityException;
import org.springframework.stereotype.Component;

@Component
public class CandidateRankingFailureMessageSanitizer {

    public String sanitize(Throwable throwable) {
        if (throwable instanceof AiCandidateRankingCapacityException) {
            return "Candidate ranking capacity exceeded";
        }
        if (throwable instanceof AppException appException) {
            ErrorCode errorCode = appException.getErrorCode();
            return switch (errorCode) {
                case CANDIDATE_RANKING_CAPACITY_EXCEEDED -> "Candidate ranking capacity exceeded";
                case AI_SERVICE_TIMEOUT -> "AI service request timed out";
                case AI_SERVICE_UNAVAILABLE -> "AI service is unavailable";
                case AI_SERVICE_INVALID_RESPONSE -> "AI service returned an invalid response";
                default -> "Candidate ranking generation failed";
            };
        }
        return "Candidate ranking generation failed";
    }
}
