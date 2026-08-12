package com.tttn.jobrecommendation.modules.candidateranking.dto.request;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class CreateCandidateRankingRunRequest {

    @NotNull
    @DecimalMin("0.0")
    @DecimalMax("1.0")
    private BigDecimal threshold = new BigDecimal("0.1");

    @NotNull
    @Min(0)
    @Max(100)
    private Integer primaryLimit = 20;

    @NotNull
    @Min(0)
    @Max(100)
    private Integer fallbackLimit = 20;

    @JsonAnySetter
    public void rejectUnknownField(String fieldName, Object value) {
        throw new IllegalArgumentException("Unsupported field: " + fieldName);
    }

    @jakarta.validation.constraints.AssertTrue(message = "primaryLimit and fallbackLimit must total between 1 and 100")
    @com.fasterxml.jackson.annotation.JsonIgnore
    public boolean isTierLimitTotalValid() {
        return primaryLimit != null && fallbackLimit != null
                && primaryLimit + fallbackLimit >= 1 && primaryLimit + fallbackLimit <= 100;
    }
}
