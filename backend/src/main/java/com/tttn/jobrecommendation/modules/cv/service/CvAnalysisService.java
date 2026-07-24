package com.tttn.jobrecommendation.modules.cv.service;

import com.tttn.jobrecommendation.modules.cv.dto.request.UpdateCvExtractedDataRequest;
import com.tttn.jobrecommendation.modules.cv.dto.response.CvAnalysisResponse;

public interface CvAnalysisService {

    CvAnalysisResponse getAnalysis(Long userId, Long cvId);

    CvAnalysisResponse updateExtractedData(Long userId, Long cvId, UpdateCvExtractedDataRequest request);

    CvAnalysisResponse reanalyze(Long userId, Long cvId);
}
