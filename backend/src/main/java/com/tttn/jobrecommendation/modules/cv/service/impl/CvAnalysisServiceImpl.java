package com.tttn.jobrecommendation.modules.cv.service.impl;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.client.AiServiceClient;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCvParseResponse;
import com.tttn.jobrecommendation.modules.cv.dto.request.UpdateCvExtractedDataRequest;
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
    public CvAnalysisResponse updateExtractedData(
            Long userId,
            Long cvId,
            UpdateCvExtractedDataRequest request
    ) {
        return persistenceService.updateExtractedData(userId, cvId, request);
    }

    @Override
    public CvAnalysisResponse reanalyze(Long userId, Long cvId) {
        CvFile cvFile = persistenceService.getFileForReanalysis(userId, cvId);
        CvFileDownload download = cvStorageService.load(cvFile);

        try {
            AiCvParseResponse response = aiServiceClient.parseCv(
                    download.resource(),
                    download.originalFileName(),
                    download.contentType()
            );
            AiCvParseResponse validatedResponse = responseValidator.validate(response);
            return persistenceService.saveParsedAnalysis(userId, cvId, validatedResponse);
        } catch (AppException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new AppException(ErrorCode.CV_ANALYSIS_FAILED);
        }
    }
}
