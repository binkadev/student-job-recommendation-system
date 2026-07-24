package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationRequest;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AiRecommendationRequestMapperTest {

    @Test
    void mapsTypedAiRequestWithoutOwnershipOrJwtFields() {
        UUID requestId = UUID.randomUUID();
        AiRecommendationRequest.JobInput job = new AiRecommendationRequest.JobInput(
                101L,
                "Backend Java PostgreSQL",
                List.of("java", "postgresql")
        );

        AiRecommendationRequest request = new AiRecommendationRequestMapper().toRequest(
                requestId,
                12L,
                "java spring boot",
                List.of("java", "spring boot"),
                List.of(job),
                new BigDecimal("0.1"),
                20
        );

        assertThat(request.requestId()).isEqualTo(requestId);
        assertThat(request.cv().id()).isEqualTo(12L);
        assertThat(request.cv().processedText()).isEqualTo("java spring boot");
        assertThat(request.jobs()).containsExactly(job);
        assertThat(request.threshold()).isEqualByComparingTo("0.1");
        assertThat(request.limit()).isEqualTo(20);
    }
}
