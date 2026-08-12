package com.tttn.jobrecommendation.modules.candidateranking.service;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CvAnalysisStatus;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.observability.RequestIdSupport;
import com.tttn.jobrecommendation.infrastructure.ai.client.AiServiceClient;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingV3Request;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingV3Response;
import com.tttn.jobrecommendation.infrastructure.ai.exception.AiCandidateRankingCapacityException;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingCandidateSnapshot;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingCorpusCounters;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingJobSnapshot;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingV3GenerationContext;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingV3PreparationResult;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.ValidatedCandidateRankingV3Response;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.MDC;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CandidateRankingGenerationServiceV3Test {
    private static final long COMPANY = 11L, JOB = 22L, RUN = 33L;
    private static final BigDecimal THRESHOLD = new BigDecimal("0.10");
    @Mock private CandidateRankingTransactionService transactions;
    @Mock private AiServiceClient client;
    @Mock private AiCandidateRankingV3ResponseValidator validator;
    private CandidateRankingGenerationService service;

    @BeforeEach void setUp() {
        service = new CandidateRankingGenerationService(transactions, client, validator,
                org.mockito.Mockito.mock(AiCandidateRankingResponseValidator.class));
    }
    @AfterEach void clearMdc() { MDC.clear(); }

    @Test
    void nonEmptyV3CorpusCallsOnlyV3ThenPersistsValidatedSuccess() {
        CandidateRankingV3GenerationContext context = context(false);
        AiCandidateRankingV3Response response = new AiCandidateRankingV3Response(context.requestId(), "tfidf-cosine-hybrid", "bilingual-candidate-ranking-v3", List.of());
        ValidatedCandidateRankingV3Response validated = new ValidatedCandidateRankingV3Response("tfidf-cosine-hybrid", "bilingual-candidate-ranking-v3", List.of());
        when(transactions.createProcessingRunV3(COMPANY, JOB, THRESHOLD, 2, 3)).thenReturn(context);
        when(client.rankCandidatesV3(context.aiRequest(), "trace-v3")).thenReturn(response);
        when(validator.validate(context.requestId(), THRESHOLD, 2, 3, context.preparationResult(), response)).thenReturn(validated);
        MDC.put(RequestIdSupport.MDC_KEY, "trace-v3");

        assertThat(service.generate(COMPANY, JOB, THRESHOLD, 2, 3)).isEqualTo(RUN);

        verify(client).rankCandidatesV3(context.aiRequest(), "trace-v3");
        verify(client, never()).rankCandidates(any(), anyString());
        verify(validator).validate(context.requestId(), THRESHOLD, 2, 3, context.preparationResult(), response);
        verify(transactions).completeSuccessV3(RUN, COMPANY, JOB, validated);
        verify(transactions, never()).markFailed(any(), any());
    }

    @Test
    void emptyV3CorpusCallsNeitherAiEndpointAndRecordsV3Success() {
        CandidateRankingV3GenerationContext context = context(true);
        when(transactions.createProcessingRunV3(COMPANY, JOB, THRESHOLD, 2, 3)).thenReturn(context);

        assertThat(service.generate(COMPANY, JOB, THRESHOLD, 2, 3)).isEqualTo(RUN);

        verifyNoInteractions(client, validator);
        ArgumentCaptor<ValidatedCandidateRankingV3Response> result = ArgumentCaptor.forClass(ValidatedCandidateRankingV3Response.class);
        verify(transactions).completeSuccessV3(org.mockito.ArgumentMatchers.eq(RUN), org.mockito.ArgumentMatchers.eq(COMPANY), org.mockito.ArgumentMatchers.eq(JOB), result.capture());
        assertThat(result.getValue().algorithmVersion()).isEqualTo("bilingual-candidate-ranking-v3");
        assertThat(result.getValue().results()).isEmpty();
    }

    @Test
    void timeoutUnavailableCapacityAndInvalidResponsesFailWithoutPartialSuccess() {
        assertFailure(new AppException(ErrorCode.AI_SERVICE_TIMEOUT), ErrorCode.AI_SERVICE_TIMEOUT);
        assertFailure(new AppException(ErrorCode.AI_SERVICE_UNAVAILABLE), ErrorCode.AI_SERVICE_UNAVAILABLE);
        assertFailure(new AiCandidateRankingCapacityException(), ErrorCode.CANDIDATE_RANKING_CAPACITY_EXCEEDED);
        CandidateRankingV3GenerationContext context = context(false);
        when(transactions.createProcessingRunV3(COMPANY, JOB, THRESHOLD, 2, 3)).thenReturn(context);
        when(client.rankCandidatesV3(any(), anyString())).thenReturn(new AiCandidateRankingV3Response(context.requestId(), "tfidf-cosine-hybrid", "bilingual-candidate-ranking-v3", List.of()));
        when(validator.validate(any(), any(), anyInt(), anyInt(), any(), any())).thenThrow(new AppException(ErrorCode.AI_SERVICE_INVALID_RESPONSE));
        assertPublicFailure(ErrorCode.AI_SERVICE_INVALID_RESPONSE);
        verify(transactions, never()).completeSuccessV3(any(), any(), any(), any());
    }

    private void assertFailure(RuntimeException failure, ErrorCode expected) {
        CandidateRankingV3GenerationContext context = context(false);
        when(transactions.createProcessingRunV3(COMPANY, JOB, THRESHOLD, 2, 3)).thenReturn(context);
        when(client.rankCandidatesV3(any(), anyString())).thenThrow(failure);
        assertPublicFailure(expected);
        verify(transactions).markFailed(org.mockito.ArgumentMatchers.eq(RUN), any(AppException.class));
        verify(transactions, never()).completeSuccessV3(any(), any(), any(), any());
        org.mockito.Mockito.reset(transactions, client, validator);
    }

    private void assertPublicFailure(ErrorCode expected) {
        assertThatThrownBy(() -> service.generate(COMPANY, JOB, THRESHOLD, 2, 3))
                .isInstanceOfSatisfying(AppException.class, e -> assertThat(e.getErrorCode()).isEqualTo(expected));
    }

    private CandidateRankingV3GenerationContext context(boolean empty) {
        UUID requestId = UUID.randomUUID();
        CandidateRankingJobSnapshot job = new CandidateRankingJobSnapshot(JOB, "Backend", "Build", "Java", List.of("java"), LocalDateTime.of(2026, 1, 1, 1, 0));
        List<CandidateRankingCandidateSnapshot> snapshots = empty ? List.of() : List.of(new CandidateRankingCandidateSnapshot(44L, ApplicationStatus.PENDING, 55L, "ignored", "processed", List.of("java"), CvAnalysisStatus.READY, "en", BigDecimal.ONE, "bilingual-nlp-v2-skills-v1", LocalDateTime.of(2026, 1, 1, 0, 0)));
        List<AiCandidateRankingV3Request.CandidateInput> candidates = snapshots.stream().map(c -> new AiCandidateRankingV3Request.CandidateInput(c.applicationId(), c.cvId(), c.processedText(), c.canonicalExtractedSkills(), c.languageCode(), c.languageConfidence(), c.processingVersion())).toList();
        CandidateRankingV3PreparationResult preparation = new CandidateRankingV3PreparationResult(job, new AiCandidateRankingV3Request.JobInput(JOB, "Backend Build Java", List.of("java")), snapshots, candidates, new CandidateRankingCorpusCounters(snapshots.size(), snapshots.size(), 0, 0, 0), "a".repeat(64));
        return new CandidateRankingV3GenerationContext(RUN, COMPANY, JOB, requestId, new AiCandidateRankingV3Request(requestId, preparation.aiJobInput(), candidates, THRESHOLD, 2, 3), preparation);
    }
}
