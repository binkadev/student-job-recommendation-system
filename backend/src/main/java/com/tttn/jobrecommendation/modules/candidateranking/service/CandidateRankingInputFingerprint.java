package com.tttn.jobrecommendation.modules.candidateranking.service;

import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingCandidateSnapshot;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingJobSnapshot;

import java.io.DataOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.DigestOutputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;

/**
 * Computes the candidate-ranking input fingerprint using a versioned binary encoding.
 *
 * <p>Every field is written in a fixed order with its UTF-8 field name. Nullable
 * values have an explicit presence byte; strings use a signed byte-length prefix;
 * lists use an item count; ids use signed 64-bit integers; and LocalDateTime values
 * use numeric date/time components including nanoseconds. Applications and skill
 * lists are sorted before encoding. This makes null, empty, and field boundaries
 * unambiguous without depending on JSON settings, Object.toString(), delimiters,
 * platform charset, or repository return order.</p>
 */
public final class CandidateRankingInputFingerprint {

    private static final String ENCODING_VERSION = "candidate-ranking-input-v1";

    private CandidateRankingInputFingerprint() {
    }

    public static String compute(
            CandidateRankingJobSnapshot job,
            List<CandidateRankingCandidateSnapshot> candidates
    ) {
        MessageDigest digest = newSha256Digest();
        try {
            try (DataOutputStream output = new DataOutputStream(new DigestOutputStream(
                    OutputStream.nullOutputStream(),
                    digest
            ))) {
                writeString(output, "encodingVersion", ENCODING_VERSION);
                writeJob(output, job);

                List<CandidateRankingCandidateSnapshot> sortedCandidates = candidates.stream()
                        .sorted(Comparator.comparing(CandidateRankingCandidateSnapshot::applicationId))
                        .toList();
                writeFieldName(output, "applications");
                output.writeInt(sortedCandidates.size());
                for (CandidateRankingCandidateSnapshot candidate : sortedCandidates) {
                    writeCandidate(output, candidate);
                }
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to encode candidate ranking fingerprint", exception);
        }
    }

    private static void writeJob(DataOutputStream output, CandidateRankingJobSnapshot job) throws IOException {
        writeLong(output, "job.id", job.id());
        writeString(output, "job.title", job.title());
        writeString(output, "job.description", job.description());
        writeString(output, "job.requirements", job.requirements());
        writeStrings(output, "job.skills", job.canonicalSkills());
    }

    private static void writeCandidate(
            DataOutputStream output,
            CandidateRankingCandidateSnapshot candidate
    ) throws IOException {
        writeLong(output, "application.id", candidate.applicationId());
        writeString(output, "application.status",
                candidate.applicationStatus() == null ? null : candidate.applicationStatus().name());
        writeLong(output, "application.cvId", candidate.cvId());
        writeString(output, "cv.extractedText", candidate.extractedText());
        writeStrings(output, "cv.skills", candidate.canonicalExtractedSkills());
        writeString(output, "cv.analysisStatus",
                candidate.analysisStatus() == null ? null : candidate.analysisStatus().name());
        writeString(output, "cv.processingVersion", candidate.processingVersion());
        writeDateTime(output, "cv.analyzedAt", candidate.analyzedAt());
    }

    private static void writeStrings(DataOutputStream output, String fieldName, List<String> values)
            throws IOException {
        writeFieldName(output, fieldName);
        if (values == null) {
            output.writeByte(0);
            return;
        }
        output.writeByte(1);
        List<String> sortedValues = values.stream().sorted().toList();
        output.writeInt(sortedValues.size());
        for (String value : sortedValues) {
            writeNullableUtf8(output, value);
        }
    }

    private static void writeLong(DataOutputStream output, String fieldName, Long value) throws IOException {
        writeFieldName(output, fieldName);
        if (value == null) {
            output.writeByte(0);
            return;
        }
        output.writeByte(1);
        output.writeLong(value);
    }

    private static void writeString(DataOutputStream output, String fieldName, String value) throws IOException {
        writeFieldName(output, fieldName);
        writeNullableUtf8(output, value);
    }

    private static void writeDateTime(DataOutputStream output, String fieldName, LocalDateTime value)
            throws IOException {
        writeFieldName(output, fieldName);
        if (value == null) {
            output.writeByte(0);
            return;
        }
        output.writeByte(1);
        output.writeInt(value.getYear());
        output.writeByte(value.getMonthValue());
        output.writeByte(value.getDayOfMonth());
        output.writeByte(value.getHour());
        output.writeByte(value.getMinute());
        output.writeByte(value.getSecond());
        output.writeInt(value.getNano());
    }

    private static void writeFieldName(DataOutputStream output, String fieldName) throws IOException {
        byte[] encoded = fieldName.getBytes(StandardCharsets.UTF_8);
        output.writeInt(encoded.length);
        output.write(encoded);
    }

    private static void writeNullableUtf8(DataOutputStream output, String value) throws IOException {
        if (value == null) {
            output.writeByte(0);
            return;
        }
        output.writeByte(1);
        byte[] encoded = value.getBytes(StandardCharsets.UTF_8);
        output.writeInt(encoded.length);
        output.write(encoded);
    }

    private static MessageDigest newSha256Digest() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }
}
