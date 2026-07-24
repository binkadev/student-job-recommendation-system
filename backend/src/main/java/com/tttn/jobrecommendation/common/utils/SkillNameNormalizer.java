package com.tttn.jobrecommendation.common.utils;

import org.springframework.util.StringUtils;

import java.util.Locale;

public final class SkillNameNormalizer {

    private SkillNameNormalizer() {
    }

    public static String normalize(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        return value.strip()
                .replaceAll("\\s+", " ")
                .toLowerCase(Locale.ROOT);
    }
}
