package com.tttn.jobrecommendation.modules.cv.service;

import com.tttn.jobrecommendation.modules.cv.dto.response.CvAnalysisResponse;

public interface CvAnalysisService {

    CvAnalysisResponse getAnalysis(Long userId, Long cvId);

    void updateExtractedData(Long userId, Long cvId);

    CvAnalysisResponse reanalyze(Long userId, Long cvId);
}
