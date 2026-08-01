package com.tttn.jobrecommendation.modules.candidateranking.service;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CvAnalysisStatus;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.observability.RequestIdSupport;
import com.tttn.jobrecommendation.infrastructure.ai.client.AiServiceClient;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingRequest;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingResponse;
import com.tttn.jobrecommendation.infrastructure.ai.exception.AiCandidateRankingCapacityException;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingCandidateSnapshot;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingCorpusCounters;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingGenerationContext;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingJobSnapshot;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingPreparationResult;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.ValidatedCandidateRankingResponse;
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
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CandidateRankingGenerationServiceTest {

    private static final Long COMPANY_ID = 11L;
    private static final Long JOB_ID = 22L;
    private static final Long RUN_ID = 33L;
    private static final BigDecimal THRESHOLD = new BigDecimal("0.10000");
    private static final int LIMIT = 20;

    @Mock
    private CandidateRankingTransactionService transactionService;

    @Mock
    private AiServiceClient aiServiceClient;

    @Mock
    private AiCandidateRankingResponseValidator responseValidator;

    private CandidateRankingGenerationService service;

    @BeforeEach
    void setUp() {
        service = new CandidateRankingGenerationService(
                transactionService,
                aiServiceClient,
                responseValidator
        );
    }

    @AfterEach
    void clearMdc() {
        MDC.clear();
    }

    @Test
    void nonEmptyCorpusMakesExactlyOneAiCallValidatesOnceAndCompletesOnce() {
        CandidateRankingGenerationContext context = context(false);
        AiCandidateRankingResponse aiResponse = response(context.requestId());
        ValidatedCandidateRankingResponse validated = validated();
        when(transactionService.createProcessingRun(COMPANY_ID, JOB_ID, THRESHOLD, LIMIT))
                .thenReturn(context);
        when(aiServiceClient.rankCandidates(context.aiRequest(), "trace-123"))
                .thenReturn(aiResponse);
        when(responseValidator.validate(
                context.requestId(),
                THRESHOLD,
                LIMIT,
                context.preparationResult(),
                aiResponse
        )).thenReturn(validated);
        MDC.put(RequestIdSupport.MDC_KEY, "trace-123");

        Long result = service.generate(COMPANY_ID, JOB_ID, THRESHOLD, LIMIT);

        assertThat(result).isEqualTo(RUN_ID);
        verify(aiServiceClient).rankCandidates(context.aiRequest(), "trace-123");
        verify(responseValidator).validate(
                context.requestId(),
                THRESHOLD,
                LIMIT,
                context.preparationResult(),
                aiResponse
        );
        verify(transactionService).completeSuccess(
                RUN_ID,
                COMPANY_ID,
                JOB_ID,
                validated
        );
        verify(transactionService, never()).markFailed(any(), any());
    }

    @Test
    void emptyCorpusSkipsAiAndValidatorButStillCompletesSuccess() {
        CandidateRankingGenerationContext context = context(true);
        when(transactionService.createProcessingRun(COMPANY_ID, JOB_ID, THRESHOLD, LIMIT))
                .thenReturn(context);

        assertThat(service.generate(COMPANY_ID, JOB_ID, THRESHOLD, LIMIT)).isEqualTo(RUN_ID);

        verifyNoInteractions(aiServiceClient, responseValidator);
        ArgumentCaptor<ValidatedCandidateRankingResponse> responseCaptor =
                ArgumentCaptor.forClass(ValidatedCandidateRankingResponse.class);
        verify(transactionService).completeSuccess(
                org.mockito.ArgumentMatchers.eq(RUN_ID),
                org.mockito.ArgumentMatchers.eq(COMPANY_ID),
                org.mockito.ArgumentMatchers.eq(JOB_ID),
                responseCaptor.capture()
        );
        assertThat(responseCaptor.getValue().algorithm()).isEqualTo("tfidf-cosine-hybrid");
        assertThat(responseCaptor.getValue().algorithmVersion()).isEqualTo("bilingual-candidate-ranking-v2");
        assertThat(responseCaptor.getValue().results()).isEmpty();
    }

    @Test
    void capacityFailureMapsAndMarksFailedWithoutCompletingSuccess() {
        assertMappedAiFailure(
                new AiCandidateRankingCapacityException(),
                ErrorCode.CANDIDATE_RANKING_CAPACITY_EXCEEDED
        );
    }

    @Test
    void aiTimeoutIsPreservedAndMarksFailed() {
        assertMappedAiFailure(
                new AppException(ErrorCode.AI_SERVICE_TIMEOUT),
                ErrorCode.AI_SERVICE_TIMEOUT
        );
    }

    @Test
    void aiUnavailableIsPreservedAndMarksFailed() {
        assertMappedAiFailure(
                new AppException(ErrorCode.AI_SERVICE_UNAVAILABLE),
                ErrorCode.AI_SERVICE_UNAVAILABLE
        );
    }

    @Test
    void invalidResponseIsPreservedAndMarksFailed() {
        CandidateRankingGenerationContext context = context(false);
        AiCandidateRankingResponse aiResponse = response(context.requestId());
        when(transactionService.createProcessingRun(COMPANY_ID, JOB_ID, THRESHOLD, LIMIT))
                .thenReturn(context);
        when(aiServiceClient.rankCandidates(any(), anyString())).thenReturn(aiResponse);
        when(responseValidator.validate(any(), any(), anyInt(), any(), any()))
                .thenThrow(new AppException(ErrorCode.AI_SERVICE_INVALID_RESPONSE));

        assertPublicFailure(ErrorCode.AI_SERVICE_INVALID_RESPONSE);
    }

    @Test
    void unexpectedRuntimeFailureMapsToGenerationFailedAndMarksFailed() {
        assertMappedAiFailure(
                new IllegalStateException("database URL and raw CV content"),
                ErrorCode.CANDIDATE_RANKING_GENERATION_FAILED
        );
    }

    @Test
    void markFailedFailureIsNotSilentlyIgnored() {
        CandidateRankingGenerationContext context = context(false);
        AppException timeout = new AppException(ErrorCode.AI_SERVICE_TIMEOUT);
        when(transactionService.createProcessingRun(COMPANY_ID, JOB_ID, THRESHOLD, LIMIT))
                .thenReturn(context);
        when(aiServiceClient.rankCandidates(any(), anyString())).thenThrow(timeout);
        doThrow(new IllegalStateException("jdbc constraint and raw CV content"))
                .when(transactionService)
                .markFailed(RUN_ID, timeout);

        assertThatThrownBy(() -> service.generate(COMPANY_ID, JOB_ID, THRESHOLD, LIMIT))
                .isInstanceOfSatisfying(AppException.class, exception -> {
                    assertThat(exception.getErrorCode())
                            .isEqualTo(ErrorCode.CANDIDATE_RANKING_GENERATION_FAILED);
                    assertThat(exception.getMessage())
                            .isEqualTo(ErrorCode.CANDIDATE_RANKING_GENERATION_FAILED.getDefaultMessage())
                            .doesNotContain("jdbc", "constraint", "raw CV content");
                });

        verify(transactionService).createProcessingRun(COMPANY_ID, JOB_ID, THRESHOLD, LIMIT);
        verify(transactionService).markFailed(RUN_ID, timeout);
        verify(transactionService, never()).completeSuccess(any(), any(), any(), any());
    }

    @Test
    void failureBeforeRunContextExistsDoesNotAttemptFailureUpdate() {
        when(transactionService.createProcessingRun(COMPANY_ID, JOB_ID, THRESHOLD, LIMIT))
                .thenThrow(new IllegalStateException("preparation failed"));

        assertPublicFailure(ErrorCode.CANDIDATE_RANKING_GENERATION_FAILED);

        verify(transactionService, never()).markFailed(any(), any());
        verifyNoInteractions(aiServiceClient, responseValidator);
    }

    @Test
    void transportRequestIdIsAlwaysPresentAndSanitized() {
        CandidateRankingGenerationContext context = context(false);
        AiCandidateRankingResponse aiResponse = response(context.requestId());
        when(transactionService.createProcessingRun(COMPANY_ID, JOB_ID, THRESHOLD, LIMIT))
                .thenReturn(context);
        when(aiServiceClient.rankCandidates(any(), anyString())).thenReturn(aiResponse);
        when(responseValidator.validate(any(), any(), anyInt(), any(), any()))
                .thenReturn(validated());
        MDC.put(RequestIdSupport.MDC_KEY, "Bearer secret JWT\nraw CV body");

        service.generate(COMPANY_ID, JOB_ID, THRESHOLD, LIMIT);

        ArgumentCaptor<String> requestIdCaptor = ArgumentCaptor.forClass(String.class);
        verify(aiServiceClient).rankCandidates(any(), requestIdCaptor.capture());
        assertThat(requestIdCaptor.getValue())
                .isNotBlank()
                .matches("[A-Za-z0-9._:-]{1,128}")
                .doesNotContain("Bearer", "secret", "JWT", "raw CV body");
    }

    private void assertMappedAiFailure(RuntimeException failure, ErrorCode expectedErrorCode) {
        CandidateRankingGenerationContext context = context(false);
        when(transactionService.createProcessingRun(COMPANY_ID, JOB_ID, THRESHOLD, LIMIT))
                .thenReturn(context);
        when(aiServiceClient.rankCandidates(any(), anyString())).thenThrow(failure);

        assertPublicFailure(expectedErrorCode);
    }

    private void assertPublicFailure(ErrorCode expectedErrorCode) {
        assertThatThrownBy(() -> service.generate(COMPANY_ID, JOB_ID, THRESHOLD, LIMIT))
                .isInstanceOfSatisfying(AppException.class, exception -> {
                    assertThat(exception.getErrorCode()).isEqualTo(expectedErrorCode);
                    assertThat(exception.getMessage()).isEqualTo(expectedErrorCode.getDefaultMessage());
                });
        if (expectedErrorCode != ErrorCode.CANDIDATE_RANKING_GENERATION_FAILED
                || org.mockito.Mockito.mockingDetails(transactionService).getInvocations().stream()
                .anyMatch(invocation -> invocation.getMethod().getName().equals("createProcessingRun")
                        && invocation.getLocation() != null)) {
            verify(transactionService, never()).completeSuccess(any(), any(), any(), any());
        }
        if (org.mockito.Mockito.mockingDetails(transactionService).getInvocations().stream()
                .anyMatch(invocation -> invocation.getMethod().getName().equals("createProcessingRun"))) {
            // The pre-context test verifies the stricter no-update behavior itself.
            if (org.mockito.Mockito.mockingDetails(aiServiceClient).getInvocations().size() > 0) {
                ArgumentCaptor<Throwable> failureCaptor = ArgumentCaptor.forClass(Throwable.class);
                verify(transactionService).markFailed(
                        org.mockito.ArgumentMatchers.eq(RUN_ID),
                        failureCaptor.capture()
                );
                assertThat(failureCaptor.getValue()).isInstanceOfSatisfying(
                        AppException.class,
                        exception -> assertThat(exception.getErrorCode()).isEqualTo(expectedErrorCode)
                );
            }
        }
    }

    private CandidateRankingGenerationContext context(boolean empty) {
        UUID requestId = UUID.randomUUID();
        CandidateRankingJobSnapshot job = new CandidateRankingJobSnapshot(
                JOB_ID,
                "Backend Intern",
                "Build APIs",
                "Java",
                List.of("java"),
                LocalDateTime.of(2026, 8, 1, 10, 0)
        );
        List<CandidateRankingCandidateSnapshot> candidates = empty
                ? List.of()
                : List.of(new CandidateRankingCandidateSnapshot(
                        44L,
                        ApplicationStatus.PENDING,
                        55L,
                        "Java CV",
                        List.of("java"),
                        CvAnalysisStatus.READY,
                        "bilingual-nlp-v2-skills-v1",
                        LocalDateTime.of(2026, 8, 1, 9, 0)
                ));
        List<AiCandidateRankingRequest.CandidateInput> inputs = candidates.stream()
                .map(candidate -> new AiCandidateRankingRequest.CandidateInput(
                        candidate.applicationId(),
                        candidate.cvId(),
                        candidate.extractedText(),
                        candidate.canonicalExtractedSkills()
                ))
                .toList();
        CandidateRankingPreparationResult preparation = new CandidateRankingPreparationResult(
                job,
                new AiCandidateRankingRequest.JobInput(JOB_ID, "Job text", List.of("java")),
                candidates,
                inputs,
                new CandidateRankingCorpusCounters(candidates.size(), candidates.size(), 0, 0, 0),
                "a".repeat(64)
        );
        AiCandidateRankingRequest request = new AiCandidateRankingRequest(
                requestId,
                preparation.aiJobInput(),
                inputs,
                THRESHOLD,
                LIMIT
        );
        return new CandidateRankingGenerationContext(
                RUN_ID,
                COMPANY_ID,
                JOB_ID,
                requestId,
                request,
                preparation
        );
    }

    private AiCandidateRankingResponse response(UUID requestId) {
        return new AiCandidateRankingResponse(
                requestId,
                "tfidf-cosine-hybrid",
                "bilingual-candidate-ranking-v2",
                List.of()
        );
    }

    private ValidatedCandidateRankingResponse validated() {
        return new ValidatedCandidateRankingResponse(
                "tfidf-cosine-hybrid",
                "bilingual-candidate-ranking-v2",
                List.of()
        );
    }
}
