package com.tttn.jobrecommendation.common.utils;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;

public final class SettingsRevision {
    private SettingsRevision() {}
    public static String etag(long revision) { return "\"" + revision + "\""; }
    public static Long parse(String value) {
        if (value == null) throw new AppException(ErrorCode.SETTINGS_REVISION_REQUIRED);
        if (!value.matches("\"(0|[1-9][0-9]*)\""))
            throw new AppException(ErrorCode.BAD_REQUEST, "If-Match must contain one strong numeric settings revision ETag");
        try { return Long.parseLong(value.substring(1, value.length() - 1)); }
        catch (NumberFormatException exception) { throw new AppException(ErrorCode.BAD_REQUEST, "Invalid settings revision"); }
    }
    public static void require(Long revision) {
        if (revision == null) throw new AppException(ErrorCode.SETTINGS_REVISION_REQUIRED);
        if (revision < 0) throw new AppException(ErrorCode.BAD_REQUEST, "Invalid settings revision");
    }
    public static void match(long current, Long revision) {
        require(revision);
        if (current != revision) throw new AppException(ErrorCode.SETTINGS_REVISION_CONFLICT);
    }
}
