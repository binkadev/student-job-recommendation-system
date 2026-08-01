package com.tttn.jobrecommendation.infrastructure.ai.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record AiCandidateRankingRequest(
        @NotNull UUID requestId,
        @NotNull @Valid JobInput job,
        @NotEmpty List<@Valid CandidateInput> candidates,
        @NotNull @DecimalMin("0.0") @DecimalMax("1.0") BigDecimal threshold,
        @NotNull @Min(1) @Max(100) Integer limit
) {

    @JsonAnySetter
    public void rejectUnknownField(String fieldName, Object value) {
        throw new IllegalArgumentException("Unsupported field: " + fieldName);
    }

    public record JobInput(
            @NotNull @Positive Long id,
            @NotBlank @Size(max = 1_000_000) String text,
            @NotNull List<@NotBlank @Size(max = 150) String> skills
    ) {

        @JsonAnySetter
        public void rejectUnknownField(String fieldName, Object value) {
            throw new IllegalArgumentException("Unsupported field: " + fieldName);
        }
    }

    public record CandidateInput(
            @NotNull @Positive Long applicationId,
            @NotNull @Positive Long cvId,
            @NotBlank @Size(max = 1_000_000) String text,
            @NotNull List<@NotBlank @Size(max = 150) String> skills
    ) {

        @JsonAnySetter
        public void rejectUnknownField(String fieldName, Object value) {
            throw new IllegalArgumentException("Unsupported field: " + fieldName);
        }
    }
}
