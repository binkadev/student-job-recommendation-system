package com.tttn.jobrecommendation.common.exception;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
    BAD_REQUEST("BAD_REQUEST", "Bad request", HttpStatus.BAD_REQUEST),
    VALIDATION_ERROR("VALIDATION_ERROR", "Validation error", HttpStatus.BAD_REQUEST),
    UNAUTHORIZED("UNAUTHORIZED", "Authentication is required", HttpStatus.UNAUTHORIZED),
    INVALID_CREDENTIALS("INVALID_CREDENTIALS", "Invalid email or password", HttpStatus.UNAUTHORIZED),
    ACCESS_DENIED("ACCESS_DENIED", "Access denied", HttpStatus.FORBIDDEN),
    ACCOUNT_DISABLED("ACCOUNT_DISABLED", "Account is not active", HttpStatus.FORBIDDEN),
    EMAIL_ALREADY_EXISTS("EMAIL_ALREADY_EXISTS", "Email already exists", HttpStatus.CONFLICT),
    CV_IN_USE("CV_IN_USE", "CV file is in use", HttpStatus.CONFLICT),
    CV_ANALYSIS_NOT_READY(
            "CV_ANALYSIS_NOT_READY",
            "CV analysis is not ready",
            HttpStatus.CONFLICT
    ),
    CV_ANALYSIS_FAILED(
            "CV_ANALYSIS_FAILED",
            "CV analysis failed",
            HttpStatus.BAD_GATEWAY
    ),
    AI_SERVICE_UNAVAILABLE(
            "AI_SERVICE_UNAVAILABLE",
            "AI service is unavailable",
            HttpStatus.SERVICE_UNAVAILABLE
    ),
    AI_SERVICE_TIMEOUT(
            "AI_SERVICE_TIMEOUT",
            "AI service request timed out",
            HttpStatus.GATEWAY_TIMEOUT
    ),
    AI_SERVICE_INVALID_RESPONSE(
            "AI_SERVICE_INVALID_RESPONSE",
            "AI service returned an invalid response",
            HttpStatus.BAD_GATEWAY
    ),
    RECOMMENDATION_RUN_NOT_FOUND(
            "RECOMMENDATION_RUN_NOT_FOUND",
            "Recommendation run not found",
            HttpStatus.NOT_FOUND
    ),
    RECOMMENDATION_GENERATION_FAILED(
            "RECOMMENDATION_GENERATION_FAILED",
            "Recommendation generation failed",
            HttpStatus.BAD_GATEWAY
    ),
    SAVED_CANDIDATE_ALREADY_EXISTS(
            "SAVED_CANDIDATE_ALREADY_EXISTS",
            "Candidate is already saved",
            HttpStatus.CONFLICT
    ),
    SAVED_CANDIDATE_NOT_FOUND(
            "SAVED_CANDIDATE_NOT_FOUND",
            "Saved candidate not found",
            HttpStatus.NOT_FOUND
    ),
    SAVED_SEARCH_ALREADY_EXISTS(
            "SAVED_SEARCH_ALREADY_EXISTS",
            "A saved search with this name already exists",
            HttpStatus.CONFLICT
    ),
    SAVED_SEARCH_NOT_FOUND(
            "SAVED_SEARCH_NOT_FOUND",
            "Saved search not found",
            HttpStatus.NOT_FOUND
    ),
    INVALID_CURRENT_PASSWORD(
            "INVALID_CURRENT_PASSWORD",
            "Current password is incorrect",
            HttpStatus.BAD_REQUEST
    ),
    RESOURCE_NOT_FOUND("RESOURCE_NOT_FOUND", "Resource not found", HttpStatus.NOT_FOUND),
    INTERNAL_SERVER_ERROR("INTERNAL_SERVER_ERROR", "Internal server error", HttpStatus.INTERNAL_SERVER_ERROR);

    private final String code;
    private final String defaultMessage;
    private final HttpStatus httpStatus;

    ErrorCode(String code, String defaultMessage, HttpStatus httpStatus) {
        this.code = code;
        this.defaultMessage = defaultMessage;
        this.httpStatus = httpStatus;
    }

    public String getCode() {
        return code;
    }

    public String getDefaultMessage() {
        return defaultMessage;
    }

    public HttpStatus getHttpStatus() {
        return httpStatus;
    }
}
