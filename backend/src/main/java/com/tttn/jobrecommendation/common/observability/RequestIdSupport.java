package com.tttn.jobrecommendation.common.observability;

import java.util.UUID;
import java.util.regex.Pattern;

public final class RequestIdSupport {

    public static final String HEADER_NAME = "X-Request-Id";
    public static final String MDC_KEY = "requestId";

    private static final Pattern VALID_REQUEST_ID =
            Pattern.compile("^[A-Za-z0-9._:-]{1,128}$");

    private RequestIdSupport() {
    }

    public static String resolveOrGenerate(String candidate) {
        if (candidate != null) {
            String trimmed = candidate.trim();
            if (candidate.equals(trimmed) && VALID_REQUEST_ID.matcher(trimmed).matches()) {
                return trimmed;
            }
        }
        return UUID.randomUUID().toString();
    }

    public static boolean isValid(String candidate) {
        return candidate != null && VALID_REQUEST_ID.matcher(candidate).matches();
    }
}
