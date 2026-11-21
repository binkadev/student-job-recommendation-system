package com.tttn.jobrecommendation.infrastructure.ai.job;

import com.tttn.jobrecommendation.modules.job.entity.Job;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;

/**
 * Canonical Job text formatter and SHA-256 content hasher aligned byte-for-byte
 * with {@code ai-service/nlp/job_document.py}.
 */
public final class JobTextContentHasher {

    public static final String PROCESSING_VERSION = "english-spacy-v1-skills-v1";
    public static final BigDecimal LANGUAGE_CONFIDENCE_THRESHOLD = new BigDecimal("0.65");

    private JobTextContentHasher() {
    }

    public static boolean hasFreshSnapshot(Job job) {
        if (job == null
                || !PROCESSING_VERSION.equals(job.getProcessingVersion())
                || !StringUtils.hasText(job.getLanguageCode())
                || job.getLanguageConfidence() == null
                || !StringUtils.hasText(job.getContentHash())) {
            return false;
        }
        String expectedHash = sha256(job.getTitle(), job.getDescription(), job.getRequirements());
        if (!expectedHash.equals(job.getContentHash())) {
            return false;
        }
        boolean confidentEnglish = "en".equalsIgnoreCase(job.getLanguageCode())
                && job.getLanguageConfidence().compareTo(LANGUAGE_CONFIDENCE_THRESHOLD) >= 0;
        return !confidentEnglish || StringUtils.hasText(job.getProcessedText());
    }

    public static String normalizeField(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\r\n", "\n").replace("\r", "\n").strip();
    }

    public static String formatSourceText(String title, String description, String requirements) {
        String normalizedTitle = normalizeField(title);
        String normalizedDescription = normalizeField(description);
        String normalizedRequirements = normalizeField(requirements);

        StringBuilder builder = new StringBuilder();
        builder.append("TITLE:\n").append(normalizedTitle)
                .append("\nDESCRIPTION:\n").append(normalizedDescription);
        if (!normalizedRequirements.isEmpty()) {
            builder.append("\nREQUIREMENTS:\n").append(normalizedRequirements);
        }
        return builder.toString();
    }

    public static String formatJobTextWithSkills(
            String title,
            String description,
            String requirements,
            List<String> canonicalSkills
    ) {
        String joinedSkills = canonicalSkills == null ? "" : String.join(", ", canonicalSkills);
        return """
                TITLE:
                %s

                DESCRIPTION:
                %s

                REQUIREMENTS:
                %s

                SKILLS:
                %s""".formatted(
                normalizeField(title),
                normalizeField(description),
                normalizeField(requirements),
                joinedSkills
        );
    }

    public static String sha256(String title, String description, String requirements) {
        String canonical = formatSourceText(title, description, requirements);
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(canonical.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 algorithm is unavailable", exception);
        }
    }
}
