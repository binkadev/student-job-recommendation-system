package com.tttn.jobrecommendation.modules.candidateranking.service;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CvAnalysisStatus;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingCandidateSnapshot;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingJobSnapshot;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.function.UnaryOperator;

import static org.assertj.core.api.Assertions.assertThat;

class CandidateRankingInputFingerprintTest {

    private static final LocalDateTime JOB_UPDATED_AT = LocalDateTime.of(2026, 8, 1, 9, 0);
    private static final LocalDateTime CV_ANALYZED_AT = LocalDateTime.of(2026, 8, 1, 8, 30, 15, 987_654_321);

    @Test
    void fingerprintIsLowercaseSha256AndIndependentOfInputOrdering() {
        CandidateRankingJobSnapshot job = job(List.of("spring boot", "java"), "Requirements");
        CandidateRankingCandidateSnapshot first = candidate(10L, 110L, List.of("spring boot", "java"));
        CandidateRankingCandidateSnapshot second = candidate(20L, 120L, List.of("docker", "java"));

        String ordered = CandidateRankingInputFingerprint.compute(job, List.of(first, second));
        String reordered = CandidateRankingInputFingerprint.compute(
                job(List.of("java", "spring boot"), "Requirements"),
                List.of(
                        copy(second, value -> value, List.of("java", "docker")),
                        copy(first, value -> value, List.of("java", "spring boot"))
                )
        );

        assertThat(ordered).matches("[0-9a-f]{64}").isEqualTo(reordered);
    }

    @Test
    void canonicalEncodingV1MatchesGoldenVector() {
        CandidateRankingJobSnapshot job = job(List.of("spring boot", "java"), "Requirements");
        CandidateRankingCandidateSnapshot candidate = candidate(
                10L,
                110L,
                List.of("spring boot", "java")
        );

        assertThat(CandidateRankingInputFingerprint.compute(job, List.of(candidate)))
                .isEqualTo("aef957e543f1c5e419f117b81eac3b9228959d5bab573aea56750b1ef19069c4");
    }

    @Test
    void fingerprintChangesForEveryContractInputCategory() {
        CandidateRankingJobSnapshot job = job(List.of("java", "spring boot"), "Requirements");
        CandidateRankingCandidateSnapshot candidate = candidate(10L, 110L, List.of("java"));
        String baseline = CandidateRankingInputFingerprint.compute(job, List.of(candidate));

        assertDifferent(baseline, new CandidateRankingJobSnapshot(
                job.id(), "Changed title", job.description(), job.requirements(), job.canonicalSkills(), job.updatedAt()
        ), List.of(candidate));
        assertDifferent(baseline, job(List.of("docker", "java", "spring boot"), "Requirements"), List.of(candidate));
        assertDifferent(baseline, job, List.of(new CandidateRankingCandidateSnapshot(
                candidate.applicationId(), ApplicationStatus.REVIEWED, candidate.cvId(), candidate.extractedText(),
                candidate.canonicalExtractedSkills(), candidate.analysisStatus(), candidate.processingVersion(),
                candidate.analyzedAt()
        )));
        assertDifferent(baseline, job, List.of());
        assertDifferent(baseline, job, List.of(candidate, candidate(20L, 120L, List.of("java"))));
        assertDifferent(baseline, job, List.of(new CandidateRankingCandidateSnapshot(
                candidate.applicationId(), candidate.applicationStatus(), 999L, candidate.extractedText(),
                candidate.canonicalExtractedSkills(), candidate.analysisStatus(), candidate.processingVersion(),
                candidate.analyzedAt()
        )));
        assertDifferent(baseline, job, List.of(copy(candidate, ignored -> "Changed extracted text", candidate.canonicalExtractedSkills())));
        assertDifferent(baseline, job, List.of(copy(candidate, value -> value, List.of("docker", "java"))));
        assertDifferent(baseline, job, List.of(new CandidateRankingCandidateSnapshot(
                candidate.applicationId(), candidate.applicationStatus(), candidate.cvId(), candidate.extractedText(),
                candidate.canonicalExtractedSkills(), CvAnalysisStatus.PROCESSING, candidate.processingVersion(),
                candidate.analyzedAt()
        )));
        assertDifferent(baseline, job, List.of(new CandidateRankingCandidateSnapshot(
                candidate.applicationId(), candidate.applicationStatus(), candidate.cvId(), candidate.extractedText(),
                candidate.canonicalExtractedSkills(), candidate.analysisStatus(), "v3", candidate.analyzedAt()
        )));
        assertDifferent(baseline, job, List.of(new CandidateRankingCandidateSnapshot(
                candidate.applicationId(), candidate.applicationStatus(), candidate.cvId(), candidate.extractedText(),
                candidate.canonicalExtractedSkills(), candidate.analysisStatus(), candidate.processingVersion(),
                candidate.analyzedAt().plusNanos(1)
        )));
    }

    @Test
    void nullAndEmptyFieldsHaveDifferentCanonicalEncodings() {
        CandidateRankingCandidateSnapshot nullProcessingVersion = new CandidateRankingCandidateSnapshot(
                10L, ApplicationStatus.PENDING, 110L, "CV text", List.of("java"),
                CvAnalysisStatus.READY, null, null
        );
        CandidateRankingCandidateSnapshot emptyProcessingVersion = new CandidateRankingCandidateSnapshot(
                10L, ApplicationStatus.PENDING, 110L, "CV text", List.of("java"),
                CvAnalysisStatus.READY, "", null
        );

        assertThat(CandidateRankingInputFingerprint.compute(job(List.of("java"), null), List.of(nullProcessingVersion)))
                .isNotEqualTo(CandidateRankingInputFingerprint.compute(
                        job(List.of("java"), ""),
                        List.of(nullProcessingVersion)
                ));
        assertThat(CandidateRankingInputFingerprint.compute(job(List.of("java"), ""), List.of(nullProcessingVersion)))
                .isNotEqualTo(CandidateRankingInputFingerprint.compute(
                        job(List.of("java"), ""),
                        List.of(emptyProcessingVersion)
                ));
        assertThat(CandidateRankingInputFingerprint.compute(job(List.of("java"), ""), List.of(nullProcessingVersion)))
                .isNotEqualTo(CandidateRankingInputFingerprint.compute(
                        job(List.of("java"), ""),
                        List.of(new CandidateRankingCandidateSnapshot(
                                10L, ApplicationStatus.PENDING, 110L, "CV text", List.of("java"),
                                CvAnalysisStatus.READY, null, CV_ANALYZED_AT
                        ))
                ));
    }

    @Test
    void lengthPrefixesKeepAmbiguousDelimiterLikeValuesDistinct() {
        CandidateRankingJobSnapshot first = new CandidateRankingJobSnapshot(
                1L, "a|b", "c", null, List.of("x,y"), JOB_UPDATED_AT
        );
        CandidateRankingJobSnapshot second = new CandidateRankingJobSnapshot(
                1L, "a", "b|c", null, List.of("x", "y"), JOB_UPDATED_AT
        );

        assertThat(CandidateRankingInputFingerprint.compute(first, List.of()))
                .isNotEqualTo(CandidateRankingInputFingerprint.compute(second, List.of()));
    }

    @Test
    void v3FingerprintIsDeterministicVersionedAndExcludesExtractedText() {
        CandidateRankingJobSnapshot job = job(List.of("java", "spring boot"), "Requirements");
        CandidateRankingCandidateSnapshot first = v3Candidate(10L, 110L, "processed", "ignored extracted", List.of("java", "spring boot"));
        CandidateRankingCandidateSnapshot second = v3Candidate(20L, 120L, "processed two", "ignored second", List.of("docker", "java"));
        String v3 = CandidateRankingInputFingerprint.computeV3(job, List.of(first, second));
        String reordered = CandidateRankingInputFingerprint.computeV3(
                job(List.of("spring boot", "java"), "Requirements"),
                List.of(v3Candidate(20L, 120L, "processed two", "changed", List.of("java", "docker")),
                        v3Candidate(10L, 110L, "processed", "different extracted", List.of("spring boot", "java")))
        );

        assertThat(v3).matches("[0-9a-f]{64}").isEqualTo(reordered);
        assertThat(v3).isNotEqualTo(CandidateRankingInputFingerprint.compute(job, List.of(first, second)));
        assertThat(CandidateRankingInputFingerprint.computeV3(job, List.of(
                v3Candidate(10L, 110L, "processed", "only extracted changed", List.of("java", "spring boot")), second
        ))).isEqualTo(v3);
    }

    @Test
    void v3FingerprintChangesForEveryScoringSnapshotField() {
        CandidateRankingJobSnapshot job = job(List.of("java", "spring boot"), "Requirements");
        CandidateRankingCandidateSnapshot candidate = v3Candidate(10L, 110L, "processed", "ignored", List.of("java"));
        String baseline = CandidateRankingInputFingerprint.computeV3(job, List.of(candidate));

        assertDifferentV3(baseline, new CandidateRankingJobSnapshot(22L, "changed", job.description(), job.requirements(), job.canonicalSkills(), job.updatedAt()), List.of(candidate));
        assertDifferentV3(baseline, job(List.of("docker", "java"), "Requirements"), List.of(candidate));
        assertDifferentV3(baseline, job, List.of(v3Candidate(11L, 110L, "processed", "ignored", List.of("java"))));
        assertDifferentV3(baseline, job, List.of(v3Candidate(10L, 111L, "processed", "ignored", List.of("java"))));
        assertDifferentV3(baseline, job, List.of(v3Candidate(10L, 110L, "changed", "ignored", List.of("java"))));
        assertDifferentV3(baseline, job, List.of(v3Candidate(10L, 110L, "processed", "ignored", List.of("docker"))));
        assertDifferentV3(baseline, job, List.of(v3Candidate(10L, 110L, "processed", "ignored", List.of("java"), "vi", new BigDecimal("0.9"), CvAnalysisStatus.READY, "bilingual-nlp-v2-skills-v1", CV_ANALYZED_AT, ApplicationStatus.PENDING)));
        assertDifferentV3(baseline, job, List.of(v3Candidate(10L, 110L, "processed", "ignored", List.of("java"), "en", new BigDecimal("0.8"), CvAnalysisStatus.READY, "bilingual-nlp-v2-skills-v1", CV_ANALYZED_AT, ApplicationStatus.PENDING)));
        assertDifferentV3(baseline, job, List.of(v3Candidate(10L, 110L, "processed", "ignored", List.of("java"), "en", new BigDecimal("0.9"), CvAnalysisStatus.PROCESSING, "bilingual-nlp-v2-skills-v1", CV_ANALYZED_AT, ApplicationStatus.PENDING)));
        assertDifferentV3(baseline, job, List.of(v3Candidate(10L, 110L, "processed", "ignored", List.of("java"), "en", new BigDecimal("0.9"), CvAnalysisStatus.READY, "v3", CV_ANALYZED_AT, ApplicationStatus.PENDING)));
        assertDifferentV3(baseline, job, List.of(v3Candidate(10L, 110L, "processed", "ignored", List.of("java"), "en", new BigDecimal("0.9"), CvAnalysisStatus.READY, "bilingual-nlp-v2-skills-v1", CV_ANALYZED_AT.plusNanos(1), ApplicationStatus.PENDING)));
        assertDifferentV3(baseline, job, List.of(v3Candidate(10L, 110L, "processed", "ignored", List.of("java"), "en", new BigDecimal("0.9"), CvAnalysisStatus.READY, "bilingual-nlp-v2-skills-v1", CV_ANALYZED_AT, ApplicationStatus.REVIEWED)));
    }

    private void assertDifferent(
            String baseline,
            CandidateRankingJobSnapshot job,
            List<CandidateRankingCandidateSnapshot> candidates
    ) {
        assertThat(CandidateRankingInputFingerprint.compute(job, candidates)).isNotEqualTo(baseline);
    }

    private void assertDifferentV3(String baseline, CandidateRankingJobSnapshot job, List<CandidateRankingCandidateSnapshot> candidates) {
        assertThat(CandidateRankingInputFingerprint.computeV3(job, candidates)).isNotEqualTo(baseline);
    }

    private CandidateRankingCandidateSnapshot v3Candidate(Long applicationId, Long cvId, String processedText,
                                                           String extractedText, List<String> skills) {
        return v3Candidate(applicationId, cvId, processedText, extractedText, skills, "en", new BigDecimal("0.9"),
                CvAnalysisStatus.READY, "bilingual-nlp-v2-skills-v1", CV_ANALYZED_AT, ApplicationStatus.PENDING);
    }

    private CandidateRankingCandidateSnapshot v3Candidate(Long applicationId, Long cvId, String processedText,
                                                           String extractedText, List<String> skills, String language,
                                                           BigDecimal confidence, CvAnalysisStatus status, String version,
                                                           LocalDateTime analyzedAt, ApplicationStatus applicationStatus) {
        return new CandidateRankingCandidateSnapshot(applicationId, applicationStatus, cvId, extractedText, processedText,
                new ArrayList<>(skills), status, language, confidence, version, analyzedAt);
    }

    private CandidateRankingJobSnapshot job(List<String> skills, String requirements) {
        return new CandidateRankingJobSnapshot(
                22L,
                "Backend Intern",
                "Build APIs",
                requirements,
                new ArrayList<>(skills),
                JOB_UPDATED_AT
        );
    }

    private CandidateRankingCandidateSnapshot candidate(Long applicationId, Long cvId, List<String> skills) {
        return new CandidateRankingCandidateSnapshot(
                applicationId,
                ApplicationStatus.PENDING,
                cvId,
                "CV text " + applicationId,
                new ArrayList<>(skills),
                CvAnalysisStatus.READY,
                "v2",
                CV_ANALYZED_AT
        );
    }

    private CandidateRankingCandidateSnapshot copy(
            CandidateRankingCandidateSnapshot source,
            UnaryOperator<String> textChange,
            List<String> skills
    ) {
        return new CandidateRankingCandidateSnapshot(
                source.applicationId(),
                source.applicationStatus(),
                source.cvId(),
                textChange.apply(source.extractedText()),
                skills,
                source.analysisStatus(),
                source.processingVersion(),
                source.analyzedAt()
        );
    }
}
