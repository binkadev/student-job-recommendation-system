package com.tttn.jobrecommendation.modules.candidateranking.dto.request;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CreateCandidateRankingRunRequestTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static Validator validator;

    @BeforeAll
    static void createValidator() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    void emptyJsonUsesContractDefaults() throws Exception {
        CreateCandidateRankingRunRequest request = read("{}");

        assertThat(request.getThreshold()).isEqualByComparingTo("0.1");
        assertThat(request.getPrimaryLimit()).isEqualTo(20);
        assertThat(request.getFallbackLimit()).isEqualTo(20);
        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void explicitValidControlsAreBound() throws Exception {
        CreateCandidateRankingRunRequest request = read("{\"threshold\":0.25,\"primaryLimit\":42,\"fallbackLimit\":10}");

        assertThat(request.getThreshold()).isEqualByComparingTo("0.25");
        assertThat(request.getPrimaryLimit()).isEqualTo(42);
        assertThat(request.getFallbackLimit()).isEqualTo(10);
        assertThat(validator.validate(request)).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "1", "0.12345", "0.100000"})
    void validThresholdBoundariesAndRepresentationsAreAccepted(String threshold) throws Exception {
        CreateCandidateRankingRunRequest request = read("{\"threshold\":" + threshold + "}");

        assertThat(request.getThreshold()).isEqualByComparingTo(new BigDecimal(threshold));
        assertThat(validator.validate(request)).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 100})
    void tierLimitBoundariesAreAccepted(int limit) throws Exception {
        CreateCandidateRankingRunRequest request = read("{\"primaryLimit\":" + limit
                + ",\"fallbackLimit\":" + (limit == 100 ? 0 : 1) + "}");

        assertThat(validator.validate(request)).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"threshold\":null}",
            "{\"primaryLimit\":null}",
            "{\"threshold\":-0.00001}",
            "{\"threshold\":1.00001}",
            "{\"primaryLimit\":101}",
            "{\"primaryLimit\":0,\"fallbackLimit\":0}"
    })
    void nullAndOutOfRangeControlsAreRejectedByValidation(String json) throws Exception {
        assertThat(validator.validate(read(json))).isNotEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "unknown",
            "companyId",
            "applicationIds",
            "cvIds",
            "limit"
    })
    void everyUnknownOrForbiddenFieldIsRejected(String field) {
        assertThatThrownBy(() -> read("{\"" + field + "\":1}"))
                .hasRootCauseInstanceOf(IllegalArgumentException.class)
                .hasRootCauseMessage("Unsupported field: " + field);
    }

    private CreateCandidateRankingRunRequest read(String json) throws Exception {
        return OBJECT_MAPPER.readValue(json, CreateCandidateRankingRunRequest.class);
    }
}
