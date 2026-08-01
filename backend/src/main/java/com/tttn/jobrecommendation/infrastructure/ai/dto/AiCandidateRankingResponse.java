package com.tttn.jobrecommendation.infrastructure.ai.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record AiCandidateRankingResponse(
        @NotNull UUID requestId,
        @NotBlank @Size(max = 100) String algorithm,
        @NotBlank @Size(max = 100) String algorithmVersion,
        @NotNull @Size(max = 100) List<@Valid Result> results
) {

    @JsonAnySetter
    public void rejectUnknownField(String fieldName, Object value) {
        throw new IllegalArgumentException("Unsupported field: " + fieldName);
    }

    public record Result(
            @NotNull @Positive Long applicationId,
            @NotNull @Positive Long cvId,
            @NotNull BigDecimal score,
            BigDecimal textScore,
            @NotNull BigDecimal skillScore,
            @NotNull RecommendationScoringStrategy scoringStrategy,
            @NotNull @Size(max = 100) List<@NotBlank @Size(max = 150) String> matchedSkills,
            @NotNull @Size(max = 100) List<@NotBlank @Size(max = 150) String> missingSkills
    ) {

        @JsonAnySetter
        public void rejectUnknownField(String fieldName, Object value) {
            throw new IllegalArgumentException("Unsupported field: " + fieldName);
        }
    }
}
