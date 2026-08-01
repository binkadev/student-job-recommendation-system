package com.tttn.jobrecommendation.modules.candidateranking.service;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CvAnalysisStatus;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingCandidateSnapshot;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingJobSnapshot;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
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

    private void assertDifferent(
            String baseline,
            CandidateRankingJobSnapshot job,
            List<CandidateRankingCandidateSnapshot> candidates
    ) {
        assertThat(CandidateRankingInputFingerprint.compute(job, candidates)).isNotEqualTo(baseline);
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
