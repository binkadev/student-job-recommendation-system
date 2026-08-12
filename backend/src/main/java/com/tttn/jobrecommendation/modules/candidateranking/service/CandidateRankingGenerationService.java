package com.tttn.jobrecommendation.modules.candidateranking.service;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.observability.RequestIdSupport;
import com.tttn.jobrecommendation.infrastructure.ai.client.AiServiceClient;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingV3Response;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingResponse;
import com.tttn.jobrecommendation.infrastructure.ai.exception.AiCandidateRankingCapacityException;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingV3GenerationContext;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.ValidatedCandidateRankingV3Response;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingGenerationContext;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.ValidatedCandidateRankingResponse;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.util.List;

@Service
public class CandidateRankingGenerationService {

    private final CandidateRankingTransactionService transactionService;
    private final AiServiceClient aiServiceClient;
    private final AiCandidateRankingV3ResponseValidator responseValidator;
    private final AiCandidateRankingResponseValidator v2ResponseValidator;

    @org.springframework.beans.factory.annotation.Autowired
    public CandidateRankingGenerationService(CandidateRankingTransactionService transactionService, AiServiceClient aiServiceClient,
                                             AiCandidateRankingV3ResponseValidator responseValidator,
                                             AiCandidateRankingResponseValidator v2ResponseValidator) {
        this.transactionService=transactionService;this.aiServiceClient=aiServiceClient;this.responseValidator=responseValidator;this.v2ResponseValidator=v2ResponseValidator;
    }

    CandidateRankingGenerationService(CandidateRankingTransactionService transactionService, AiServiceClient aiServiceClient,
                                      AiCandidateRankingResponseValidator v2ResponseValidator) {
        this.transactionService=transactionService;this.aiServiceClient=aiServiceClient;this.responseValidator=null;this.v2ResponseValidator=v2ResponseValidator;
    }

    /** Isolated V2 compatibility path retained for existing callers/tests. */
    public Long generate(Long companyId, Long jobId, BigDecimal threshold, int requestedLimit) {
        CandidateRankingGenerationContext context;
        try { context=transactionService.createProcessingRun(companyId,jobId,threshold,requestedLimit); }
        catch(RuntimeException exception){throw mapPreparationFailure(exception);}
        try { requireNoActiveTransaction(); ValidatedCandidateRankingResponse validated=rankAndValidateV2(context);
            transactionService.completeSuccess(context.runId(),context.companyId(),context.jobId(),validated); return context.runId();
        } catch(RuntimeException exception){AppException mapped=mapGenerationFailure(exception);try{transactionService.markFailed(context.runId(),mapped);}catch(RuntimeException e){throw new AppException(ErrorCode.CANDIDATE_RANKING_GENERATION_FAILED);}throw mapped;}
    }

    public Long generate(
            Long companyId,
            Long jobId,
            BigDecimal threshold,
            int primaryLimit,
            int fallbackLimit
    ) {
        CandidateRankingV3GenerationContext context;
        try {
            context = transactionService.createProcessingRunV3(
                    companyId,
                    jobId,
                    threshold,
                    primaryLimit, fallbackLimit
            );
        } catch (RuntimeException exception) {
            throw mapPreparationFailure(exception);
        }

        try {
            requireNoActiveTransaction();
            ValidatedCandidateRankingV3Response validatedResponse = rankAndValidate(context);
            transactionService.completeSuccessV3(
                    context.runId(),
                    context.companyId(),
                    context.jobId(),
                    validatedResponse
            );
            return context.runId();
        } catch (RuntimeException exception) {
            AppException mapped = mapGenerationFailure(exception);
            try {
                transactionService.markFailed(context.runId(), mapped);
            } catch (RuntimeException failurePersistenceException) {
                throw new AppException(ErrorCode.CANDIDATE_RANKING_GENERATION_FAILED);
            }
            throw mapped;
        }
    }

    private ValidatedCandidateRankingV3Response rankAndValidate(
            CandidateRankingV3GenerationContext context
    ) {
        if (context.preparationResult().eligibleCandidateSnapshots().isEmpty()) {
            return new ValidatedCandidateRankingV3Response(
                    AiCandidateRankingV3ResponseValidator.ALGORITHM,
                    AiCandidateRankingV3ResponseValidator.VERSION,
                    List.of()
            );
        }

        String transportRequestId = RequestIdSupport.resolveOrGenerate(
                MDC.get(RequestIdSupport.MDC_KEY)
        );
        AiCandidateRankingV3Response response = aiServiceClient.rankCandidatesV3(
                context.aiRequest(),
                transportRequestId
        );
        return responseValidator.validate(
                context.requestId(),
                context.aiRequest().threshold(),
                context.aiRequest().primaryLimit(),
                context.aiRequest().fallbackLimit(),
                context.preparationResult(),
                response
        );
    }

    private ValidatedCandidateRankingResponse rankAndValidateV2(CandidateRankingGenerationContext context) {
        if(context.preparationResult().eligibleCandidateSnapshots().isEmpty()) return new ValidatedCandidateRankingResponse(
                AiCandidateRankingResponseValidator.EXPECTED_ALGORITHM,AiCandidateRankingResponseValidator.EXPECTED_ALGORITHM_VERSION,List.of());
        String transport=RequestIdSupport.resolveOrGenerate(MDC.get(RequestIdSupport.MDC_KEY));
        AiCandidateRankingResponse response=aiServiceClient.rankCandidates(context.aiRequest(),transport);
        return v2ResponseValidator.validate(context.requestId(),context.aiRequest().threshold(),context.aiRequest().limit(),context.preparationResult(),response);
    }

    private void requireNoActiveTransaction() {
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("Candidate ranking AI phase must run without a database transaction");
        }
    }

    private AppException mapPreparationFailure(RuntimeException exception) {
        if (exception instanceof AppException appException
                && (appException.getErrorCode() == ErrorCode.RESOURCE_NOT_FOUND
                || appException.getErrorCode() == ErrorCode.CANDIDATE_RANKING_ALREADY_PROCESSING)) {
            return appException;
        }
        return new AppException(ErrorCode.CANDIDATE_RANKING_GENERATION_FAILED);
    }

    private AppException mapGenerationFailure(RuntimeException exception) {
        if (exception instanceof AiCandidateRankingCapacityException) {
            return new AppException(ErrorCode.CANDIDATE_RANKING_CAPACITY_EXCEEDED);
        }
        if (exception instanceof AppException appException) {
            return switch (appException.getErrorCode()) {
                case AI_SERVICE_TIMEOUT,
                     AI_SERVICE_UNAVAILABLE,
                     AI_SERVICE_INVALID_RESPONSE,
                     CANDIDATE_RANKING_CAPACITY_EXCEEDED,
                     CANDIDATE_RANKING_GENERATION_FAILED -> appException;
                default -> new AppException(ErrorCode.CANDIDATE_RANKING_GENERATION_FAILED);
            };
        }
        return new AppException(ErrorCode.CANDIDATE_RANKING_GENERATION_FAILED);
    }
}
