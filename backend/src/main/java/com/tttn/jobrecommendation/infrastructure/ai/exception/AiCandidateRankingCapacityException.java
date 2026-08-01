package com.tttn.jobrecommendation.infrastructure.ai.exception;

public class AiCandidateRankingCapacityException extends RuntimeException {

    private static final String SANITIZED_MESSAGE =
            "Candidate ranking request exceeds synchronous transport capacity";

    public AiCandidateRankingCapacityException() {
        super(SANITIZED_MESSAGE);
    }
}
