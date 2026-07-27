package com.tttn.jobrecommendation.modules.cv.service.impl;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import org.springframework.stereotype.Component;

@Component
public class CvAnalysisFailureMessageSanitizer {

    public String sanitize(Throwable throwable) {
        if (throwable instanceof AppException appException) {
            ErrorCode errorCode = appException.getErrorCode();
            return switch (errorCode) {
                case AI_SERVICE_TIMEOUT -> "AI service request timed out";
                case AI_SERVICE_UNAVAILABLE -> "AI service is unavailable";
                case AI_SERVICE_INVALID_RESPONSE -> "AI service returned an invalid response";
                case RESOURCE_NOT_FOUND -> "CV source file is unavailable";
                default -> "CV analysis failed";
            };
        }
        return "CV analysis failed";
    }
}
