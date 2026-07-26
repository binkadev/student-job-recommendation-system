package com.tttn.jobrecommendation.modules.cv.service.impl;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.client.AiServiceClient;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCvParseResponse;
import com.tttn.jobrecommendation.modules.cv.dto.response.CvAnalysisResponse;
import com.tttn.jobrecommendation.modules.cv.dto.response.CvFileDownload;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.cv.service.CvAnalysisService;
import com.tttn.jobrecommendation.modules.cv.service.CvStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CvAnalysisServiceImpl implements CvAnalysisService {

    private final CvAnalysisPersistenceService persistenceService;
    private final CvStorageService cvStorageService;
    private final AiServiceClient aiServiceClient;
    private final AiCvParseResponseValidator responseValidator;

    @Override
    public CvAnalysisResponse getAnalysis(Long userId, Long cvId) {
        return persistenceService.getAnalysis(userId, cvId);
    }

    @Override
    public void updateExtractedData(Long userId, Long cvId) {
        persistenceService.rejectExtractedDataUpdate(userId, cvId);
    }

    @Override
    public CvAnalysisResponse reanalyze(Long userId, Long cvId) {
        CvFile cvFile = persistenceService.markProcessing(userId, cvId);

        try {
            CvFileDownload download = cvStorageService.load(cvFile);
            AiCvParseResponse response = aiServiceClient.parseCv(
                    download.resource(),
                    download.originalFileName(),
                    download.contentType()
            );
            AiCvParseResponse validatedResponse = responseValidator.validate(response);
            return persistenceService.saveParsedAnalysis(userId, cvId, validatedResponse);
        } catch (RuntimeException exception) {
            persistenceService.markFailed(userId, cvId, exception);
            if (exception instanceof AppException appException) {
                throw appException;
            }
            throw new AppException(ErrorCode.CV_ANALYSIS_FAILED);
        }
    }
}
