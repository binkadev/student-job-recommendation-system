package com.tttn.jobrecommendation.modules.candidateranking.service;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CvAnalysisStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingRequest;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingResponse;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingCandidateSnapshot;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingCorpusCounters;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingJobSnapshot;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingPreparationResult;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.ValidatedCandidateRankingResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AiCandidateRankingResponseValidatorTest {

    private static final UUID REQUEST_ID = UUID.fromString("f8dd2777-3457-4515-8829-a63599e74775");
    private static final BigDecimal DEFAULT_THRESHOLD = new BigDecimal("0.1");
    private static final LocalDateTime ANALYZED_AT =
            LocalDateTime.of(2026, 8, 1, 10, 30, 15, 123_000_000);
    private static final List<String> JOB_SKILLS = List.of("docker", "java", "spring boot");
    private static final List<String> CANDIDATE_SKILLS = List.of("java", "spring boot");

    private final AiCandidateRankingResponseValidator validator =
            new AiCandidateRankingResponseValidator();

    @Test
    void acceptsAllFourStrategyAndDeclaredSkillBranches() {
        ValidatedCandidateRankingResponse sameWithSkills = validate(
                defaultPreparation(),
                response(partialSameLanguageResult(101L, 201L, "0.75333333"))
        );
        assertThat(sameWithSkills.results()).singleElement().satisfies(result -> {
            assertThat(result.score().toPlainString()).isEqualTo("0.75333");
            assertThat(result.textScore().toPlainString()).isEqualTo("0.80000");
            assertThat(result.skillScore().toPlainString()).isEqualTo("0.66667");
            assertThat(result.reason()).isEqualTo(
                    "Matched 2 of 3 declared job skills: java, spring boot. Missing: docker."
            );
            assertThat(result.cvProcessingVersion()).isEqualTo("bilingual-nlp-v2-skills-v1");
            assertThat(result.cvAnalyzedAt()).isEqualTo(ANALYZED_AT);
        });

        ValidatedCandidateRankingResponse sameWithoutSkills = validate(
                preparation(List.of(), candidate(101L, 201L, CANDIDATE_SKILLS)),
                response(noSkillSameLanguageResult(101L, 201L, "0.456789"))
        );
        assertThat(sameWithoutSkills.results().getFirst().reason())
                .isEqualTo("Match score is based on the submitted CV and Job text.");

        ValidatedCandidateRankingResponse crossWithSkills = validate(
                defaultPreparation(),
                response(result(
                        101L, 201L, "0.66666667", null, "0.66666667",
                        RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED,
                        List.of("java", "spring boot"), List.of("docker")
                ))
        );
        assertThat(crossWithSkills.results().getFirst().textScore()).isNull();
        assertThat(crossWithSkills.results().getFirst().reason()).isEqualTo(
                "Cross-language match is based on canonical skill overlap. "
                        + "Matched 2 of 3: java, spring boot. Missing: docker."
        );

        ValidatedCandidateRankingResponse crossWithoutSkills = validate(
                preparation(List.of(), candidate(101L, 201L, CANDIDATE_SKILLS)),
                response(result(
                        101L, 201L, "0", null, "0",
                        RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED,
                        List.of(), List.of()
                )),
                BigDecimal.ZERO,
                20
        );
        assertThat(crossWithoutSkills.results().getFirst().reason())
                .isEqualTo("Cross-language match is based on canonical skill overlap.");
    }

    @Test
    void appliesLockedWeightedProjectionAndOneQuantumAllowance() {
        validate(defaultPreparation(), response(partialSameLanguageResult(101L, 201L, "0.75333333")));
        validate(defaultPreparation(), response(partialSameLanguageResult(101L, 201L, "0.75333334")));

        CandidateRankingPreparationResult doubleRoundingPreparation = preparation(
                List.of("java"),
                candidate(101L, 201L, List.of())
        );
        validate(doubleRoundingPreparation, response(result(
                101L, 201L, "0.43596900", "0.67072155", "0.00000000",
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,
                List.of(), List.of("java")
        )));

        assertInvalid(
                defaultPreparation(),
                response(partialSameLanguageResult(101L, 201L, "0.75333335")),
                DEFAULT_THRESHOLD,
                20
        );
    }

    @Test
    void acceptsSameCvAcrossApplicationsAndSortsByRawScoreBeforeScaleFiveRounding() {
        CandidateRankingPreparationResult preparation = preparation(
                List.of(),
                candidate(104L, 201L, List.of()),
                candidate(103L, 203L, List.of()),
                candidate(102L, 201L, List.of()),
                candidate(101L, 202L, List.of())
        );

        ValidatedCandidateRankingResponse validated = validate(preparation, response(
                noSkillSameLanguageResult(104L, 201L, "0.50000448"),
                noSkillSameLanguageResult(103L, 203L, "0.70000000"),
                noSkillSameLanguageResult(102L, 201L, "0.50000449"),
                noSkillSameLanguageResult(101L, 202L, "0.70000000")
        ));

        assertThat(validated.results())
                .extracting(ValidatedCandidateRankingResponse.Result::applicationId)
                .containsExactly(101L, 103L, 102L, 104L);
        assertThat(validated.results())
                .extracting(ValidatedCandidateRankingResponse.Result::rankPosition)
                .containsExactly(1, 2, 3, 4);
        assertThat(validated.results()).extracting(ValidatedCandidateRankingResponse.Result::cvId)
                .contains(201L, 201L);
        assertThat(validated.results().get(2).score().toPlainString()).isEqualTo("0.50000");
        assertThat(validated.results().get(3).score().toPlainString()).isEqualTo("0.50000");
    }

    @Test
    void checksThresholdBeforeRoundingAndUsesFiveDecimalHalfUpForPersistence() {
        assertInvalid(
                preparation(List.of(), candidate(101L, 201L, List.of())),
                response(noSkillSameLanguageResult(101L, 201L, "0.09999999")),
                DEFAULT_THRESHOLD,
                20
        );

        ValidatedCandidateRankingResponse validated = validate(
                preparation(List.of(), candidate(101L, 201L, List.of())),
                response(noSkillSameLanguageResult(101L, 201L, "0.12345500"))
        );
        assertThat(validated.results().getFirst().score().toPlainString()).isEqualTo("0.12346");
        assertThat(validated.results().getFirst().textScore().toPlainString()).isEqualTo("0.12346");
        assertThat(validated.results().getFirst().skillScore().toPlainString()).isEqualTo("0.00000");
    }

    @Test
    void outputCollectionsAreDefensiveAndImmutable() {
        List<String> mutableMatched = new ArrayList<>(List.of("java", "spring boot"));
        List<AiCandidateRankingResponse.Result> mutableResults = new ArrayList<>(List.of(result(
                101L, 201L, "0.75333333", "0.8", "0.66666667",
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,
                mutableMatched, List.of("docker")
        )));
        ValidatedCandidateRankingResponse validated = validate(
                defaultPreparation(),
                new AiCandidateRankingResponse(
                        REQUEST_ID,
                        "tfidf-cosine-hybrid",
                        "bilingual-candidate-ranking-v2",
                        mutableResults
                )
        );
        mutableMatched.clear();
        mutableResults.clear();

        assertThat(validated.results()).hasSize(1);
        assertThat(validated.results().getFirst().matchedSkills())
                .containsExactly("java", "spring boot");
        assertThatThrownBy(() -> validated.results().clear())
                .isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> validated.results().getFirst().matchedSkills().add("go"))
                .isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> validated.results().getFirst().missingSkills().clear())
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("invalidRootCases")
    void rejectsInvalidRootResponse(String description, AiCandidateRankingResponse response, int limit) {
        assertInvalid(defaultPreparation(), response, DEFAULT_THRESHOLD, limit);
    }

    private static Stream<Arguments> invalidRootCases() {
        AiCandidateRankingResponse.Result valid = partialSameLanguageResultStatic(101L, 201L, "0.75333333");
        return Stream.of(
                Arguments.of("null response", null, 20),
                Arguments.of("null request id", rawResponse(null, "tfidf-cosine-hybrid",
                        "bilingual-candidate-ranking-v2", List.of(valid)), 20),
                Arguments.of("mismatched request id", rawResponse(UUID.randomUUID(), "tfidf-cosine-hybrid",
                        "bilingual-candidate-ranking-v2", List.of(valid)), 20),
                Arguments.of("wrong algorithm", rawResponse(REQUEST_ID, "other",
                        "bilingual-candidate-ranking-v2", List.of(valid)), 20),
                Arguments.of("wrong algorithm version", rawResponse(REQUEST_ID, "tfidf-cosine-hybrid",
                        "other", List.of(valid)), 20),
                Arguments.of("null results", rawResponse(REQUEST_ID, "tfidf-cosine-hybrid",
                        "bilingual-candidate-ranking-v2", null), 20),
                Arguments.of("over requested limit", rawResponse(REQUEST_ID, "tfidf-cosine-hybrid",
                        "bilingual-candidate-ranking-v2", List.of(valid, valid)), 1),
                Arguments.of("null result element", rawResponse(REQUEST_ID, "tfidf-cosine-hybrid",
                        "bilingual-candidate-ranking-v2", Arrays.asList((AiCandidateRankingResponse.Result) null)), 20)
        );
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("invalidControlCases")
    void rejectsInvalidRequestedControls(String description, BigDecimal threshold, int limit) {
        assertInvalid(
                defaultPreparation(),
                response(partialSameLanguageResult(101L, 201L, "0.75333333")),
                threshold,
                limit
        );
    }

    private static Stream<Arguments> invalidControlCases() {
        return Stream.of(
                Arguments.of("null threshold", null, 20),
                Arguments.of("threshold below zero", new BigDecimal("-0.1"), 20),
                Arguments.of("threshold above one", new BigDecimal("1.1"), 20),
                Arguments.of("limit below one", DEFAULT_THRESHOLD, 0),
                Arguments.of("limit above one hundred", DEFAULT_THRESHOLD, 101)
        );
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("invalidIdentityCases")
    void rejectsInvalidResultIdentity(String description, AiCandidateRankingResponse response) {
        assertInvalid(defaultPreparation(), response, DEFAULT_THRESHOLD, 20);
    }

    private static Stream<Arguments> invalidIdentityCases() {
        return Stream.of(
                Arguments.of("duplicate application", responseStatic(
                        partialSameLanguageResultStatic(101L, 201L, "0.75333333"),
                        partialSameLanguageResultStatic(101L, 201L, "0.75333333"))),
                Arguments.of("unknown application", responseStatic(
                        partialSameLanguageResultStatic(999L, 201L, "0.75333333"))),
                Arguments.of("wrong cv", responseStatic(
                        partialSameLanguageResultStatic(101L, 999L, "0.75333333"))),
                Arguments.of("foreign application", responseStatic(
                        partialSameLanguageResultStatic(777L, 777L, "0.75333333"))),
                Arguments.of("skipped application", responseStatic(
                        partialSameLanguageResultStatic(888L, 888L, "0.75333333"))),
                Arguments.of("nonpositive application", responseStatic(
                        partialSameLanguageResultStatic(0L, 201L, "0.75333333"))),
                Arguments.of("nonpositive cv", responseStatic(
                        partialSameLanguageResultStatic(101L, 0L, "0.75333333")))
        );
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("invalidDeclaredSkillScoreCases")
    void rejectsInvalidDeclaredSkillScores(
            String description,
            AiCandidateRankingResponse.Result result
    ) {
        assertInvalid(defaultPreparation(), response(result), DEFAULT_THRESHOLD, 20);
    }

    private static Stream<Arguments> invalidDeclaredSkillScoreCases() {
        return Stream.of(
                Arguments.of("null score", partialSameLanguageResultStatic(101L, 201L, null)),
                Arguments.of("score below zero", partialSameLanguageResultStatic(101L, 201L, "-0.1")),
                Arguments.of("score above one", partialSameLanguageResultStatic(101L, 201L, "1.1")),
                Arguments.of("score below threshold", partialSameLanguageResultStatic(101L, 201L, "0.09")),
                Arguments.of("score exceeds scale eight", partialSameLanguageResultStatic(
                        101L, 201L, "0.753333331")),
                Arguments.of("null skill score", resultStatic(
                        101L, 201L, "0.75333333", "0.8", null,
                        RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,
                        List.of("java", "spring boot"), List.of("docker"))),
                Arguments.of("skill below zero", resultStatic(
                        101L, 201L, "0.75333333", "0.8", "-0.1",
                        RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,
                        List.of("java", "spring boot"), List.of("docker"))),
                Arguments.of("skill above one", resultStatic(
                        101L, 201L, "0.75333333", "0.8", "1.1",
                        RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,
                        List.of("java", "spring boot"), List.of("docker"))),
                Arguments.of("same language null text", resultStatic(
                        101L, 201L, "0.75333333", null, "0.66666667",
                        RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,
                        List.of("java", "spring boot"), List.of("docker"))),
                Arguments.of("text outside range", resultStatic(
                        101L, 201L, "0.75333333", "1.1", "0.66666667",
                        RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,
                        List.of("java", "spring boot"), List.of("docker"))),
                Arguments.of("cross language nonnull text", resultStatic(
                        101L, 201L, "0.66666667", "0", "0.66666667",
                        RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED,
                        List.of("java", "spring boot"), List.of("docker"))),
                Arguments.of("weighted discrepancy above allowance", partialSameLanguageResultStatic(
                        101L, 201L, "0.75333335")),
                Arguments.of("cross score differs from skill", resultStatic(
                        101L, 201L, "0.66666666", null, "0.66666667",
                        RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED,
                        List.of("java", "spring boot"), List.of("docker"))),
                Arguments.of("skill overlap score rounded incorrectly", resultStatic(
                        101L, 201L, "0.75449999", "0.8", "0.67",
                        RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,
                        List.of("java", "spring boot"), List.of("docker")))
        );
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("invalidNoSkillScoreCases")
    void rejectsInvalidNoJobSkillScores(
            String description,
            AiCandidateRankingResponse.Result result
    ) {
        assertInvalid(
                preparation(List.of(), candidate(101L, 201L, CANDIDATE_SKILLS)),
                response(result),
                BigDecimal.ZERO,
                20
        );
    }

    private static Stream<Arguments> invalidNoSkillScoreCases() {
        return Stream.of(
                Arguments.of("same language nonzero skill", resultStatic(
                        101L, 201L, "0.5", "0.5", "0.1",
                        RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, List.of(), List.of())),
                Arguments.of("same language score not exactly text", resultStatic(
                        101L, 201L, "0.50000001", "0.5", "0",
                        RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, List.of(), List.of())),
                Arguments.of("cross language nonzero score and skill", resultStatic(
                        101L, 201L, "0.1", null, "0.1",
                        RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED, List.of(), List.of())),
                Arguments.of("cross language score not exactly skill", resultStatic(
                        101L, 201L, "0.00000001", null, "0",
                        RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED, List.of(), List.of()))
        );
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("invalidSkillListCases")
    void rejectsInvalidSkillLists(
            String description,
            List<String> matchedSkills,
            List<String> missingSkills
    ) {
        assertInvalid(defaultPreparation(), response(result(
                101L, 201L, "0.75333333", "0.8", "0.66666667",
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,
                matchedSkills, missingSkills
        )), DEFAULT_THRESHOLD, 20);
    }

    private static Stream<Arguments> invalidSkillListCases() {
        return Stream.of(
                Arguments.of("null matched", null, List.of("docker")),
                Arguments.of("null missing", List.of("java", "spring boot"), null),
                Arguments.of("blank", List.of("", "spring boot"), List.of("docker")),
                Arguments.of("overlong", List.of("x".repeat(151)), List.of("docker")),
                Arguments.of("noncanonical", List.of("Java", "spring boot"), List.of("docker")),
                Arguments.of("unsorted", List.of("spring boot", "java"), List.of("docker")),
                Arguments.of("duplicate", List.of("java", "java", "spring boot"), List.of("docker")),
                Arguments.of("overlap", List.of("java", "spring boot"), List.of("docker", "java")),
                Arguments.of("outside job", List.of("go", "java", "spring boot"), List.of("docker")),
                Arguments.of("missing expected matched", List.of("java"), List.of("docker")),
                Arguments.of("missing expected missing", List.of("java", "spring boot"), List.of()),
                Arguments.of("unexpected missing", List.of("java", "spring boot"), List.of("docker", "go")),
                Arguments.of("null element", Arrays.asList("java", null), List.of("docker"))
        );
    }

    @Test
    void validatesSkillsAgainstCandidateSnapshotAndEnforcesResponseBounds() {
        assertInvalid(
                preparation(JOB_SKILLS, candidate(101L, 201L, List.of("java"))),
                response(partialSameLanguageResult(101L, 201L, "0.75333333")),
                DEFAULT_THRESHOLD,
                20
        );

        assertInvalid(
                preparation(List.of(), candidate(101L, 201L, CANDIDATE_SKILLS)),
                response(result(
                        101L, 201L, "0", null, "0",
                        RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED,
                        List.of("java"), List.of()
                )),
                BigDecimal.ZERO,
                20
        );

        List<String> skills = IntStream.range(0, 101)
                .mapToObj(index -> "skill-%03d".formatted(index))
                .toList();
        assertInvalid(
                preparation(skills, candidate(101L, 201L, skills)),
                response(result(
                        101L, 201L, "1", null, "1",
                        RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED,
                        skills, List.of()
                )),
                DEFAULT_THRESHOLD,
                20
        );
    }

    @Test
    void generatesExactPartialFullZeroAndNoSkillReasonsWithoutPrivateData() {
        String privateText = "Candidate Secret Name private@example.test /private/cv.pdf";
        CandidateRankingCandidateSnapshot partialCandidate = new CandidateRankingCandidateSnapshot(
                101L, ApplicationStatus.PENDING, 201L, privateText, CANDIDATE_SKILLS,
                CvAnalysisStatus.READY, "bilingual-nlp-v2-skills-v1", ANALYZED_AT
        );
        String partial = validate(
                preparation(JOB_SKILLS, partialCandidate),
                response(partialSameLanguageResult(101L, 201L, "0.75333333"))
        ).results().getFirst().reason();
        String full = validate(
                preparation(JOB_SKILLS, candidate(101L, 201L, JOB_SKILLS)),
                response(result(
                        101L, 201L, "0.87", "0.8", "1",
                        RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,
                        JOB_SKILLS, List.of()
                ))
        ).results().getFirst().reason();
        String zero = validate(
                preparation(JOB_SKILLS, candidate(101L, 201L, List.of("go"))),
                response(result(
                        101L, 201L, "0.52", "0.8", "0",
                        RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,
                        List.of(), JOB_SKILLS
                ))
        ).results().getFirst().reason();
        String noSkills = validate(
                preparation(List.of(), candidate(101L, 201L, List.of())),
                response(noSkillSameLanguageResult(101L, 201L, "0.5"))
        ).results().getFirst().reason();

        assertThat(partial).isEqualTo(
                "Matched 2 of 3 declared job skills: java, spring boot. Missing: docker."
        ).doesNotContain(privateText, "Candidate Secret Name", "private@example.test", "/private/cv.pdf");
        assertThat(full).isEqualTo(
                "Matched 3 of 3 declared job skills: docker, java, spring boot. Missing: none."
        );
        assertThat(zero).isEqualTo(
                "Matched 0 of 3 declared job skills: none. Missing: docker, java, spring boot."
        );
        assertThat(noSkills).isEqualTo("Match score is based on the submitted CV and Job text.");
    }

    @Test
    void oneInvalidItemRejectsWholeResponseWithSanitizedErrorAndNoPartialOutput() {
        CandidateRankingPreparationResult preparation = preparation(
                List.of(),
                candidate(101L, 201L, List.of()),
                candidate(102L, 202L, List.of())
        );

        assertThatThrownBy(() -> validate(preparation, response(
                noSkillSameLanguageResult(101L, 201L, "0.8"),
                noSkillSameLanguageResult(102L, 999L, "0.7")
        ))).isInstanceOfSatisfying(AppException.class, exception -> {
            assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.AI_SERVICE_INVALID_RESPONSE);
            assertThat(exception.getMessage()).isEqualTo("AI service returned an invalid response");
        });
    }

    private ValidatedCandidateRankingResponse validate(
            CandidateRankingPreparationResult preparation,
            AiCandidateRankingResponse response
    ) {
        return validate(preparation, response, DEFAULT_THRESHOLD, 20);
    }

    private ValidatedCandidateRankingResponse validate(
            CandidateRankingPreparationResult preparation,
            AiCandidateRankingResponse response,
            BigDecimal threshold,
            int limit
    ) {
        return validator.validate(REQUEST_ID, threshold, limit, preparation, response);
    }

    private void assertInvalid(
            CandidateRankingPreparationResult preparation,
            AiCandidateRankingResponse response,
            BigDecimal threshold,
            int limit
    ) {
        assertThatThrownBy(() -> validate(preparation, response, threshold, limit))
                .isInstanceOfSatisfying(AppException.class, exception -> {
                    assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.AI_SERVICE_INVALID_RESPONSE);
                    assertThat(exception.getMessage())
                            .isEqualTo(ErrorCode.AI_SERVICE_INVALID_RESPONSE.getDefaultMessage());
                });
    }

    private CandidateRankingPreparationResult defaultPreparation() {
        return preparation(JOB_SKILLS, candidate(101L, 201L, CANDIDATE_SKILLS));
    }

    private static CandidateRankingPreparationResult preparation(
            List<String> jobSkills,
            CandidateRankingCandidateSnapshot... candidates
    ) {
        List<CandidateRankingCandidateSnapshot> candidateList = List.of(candidates);
        List<AiCandidateRankingRequest.CandidateInput> aiCandidates = candidateList.stream()
                .map(candidate -> new AiCandidateRankingRequest.CandidateInput(
                        candidate.applicationId(), candidate.cvId(), candidate.extractedText(),
                        candidate.canonicalExtractedSkills()
                ))
                .toList();
        CandidateRankingJobSnapshot job = new CandidateRankingJobSnapshot(
                10L, "Backend Intern", "Build APIs", "Java experience", jobSkills,
                LocalDateTime.of(2026, 8, 1, 9, 0)
        );
        return new CandidateRankingPreparationResult(
                job,
                new AiCandidateRankingRequest.JobInput(10L, "Job text", jobSkills),
                candidateList,
                aiCandidates,
                new CandidateRankingCorpusCounters(candidateList.size(), candidateList.size(), 0, 0, 0),
                "a".repeat(64)
        );
    }

    private static CandidateRankingCandidateSnapshot candidate(
            Long applicationId,
            Long cvId,
            List<String> skills
    ) {
        return new CandidateRankingCandidateSnapshot(
                applicationId, ApplicationStatus.PENDING, cvId, "Persisted extracted CV text",
                skills, CvAnalysisStatus.READY, "bilingual-nlp-v2-skills-v1", ANALYZED_AT
        );
    }

    private AiCandidateRankingResponse response(AiCandidateRankingResponse.Result... results) {
        return responseStatic(results);
    }

    private static AiCandidateRankingResponse responseStatic(AiCandidateRankingResponse.Result... results) {
        return rawResponse(
                REQUEST_ID,
                "tfidf-cosine-hybrid",
                "bilingual-candidate-ranking-v2",
                List.of(results)
        );
    }

    private static AiCandidateRankingResponse rawResponse(
            UUID requestId,
            String algorithm,
            String algorithmVersion,
            List<AiCandidateRankingResponse.Result> results
    ) {
        return new AiCandidateRankingResponse(requestId, algorithm, algorithmVersion, results);
    }

    private AiCandidateRankingResponse.Result partialSameLanguageResult(
            Long applicationId,
            Long cvId,
            String score
    ) {
        return partialSameLanguageResultStatic(applicationId, cvId, score);
    }

    private static AiCandidateRankingResponse.Result partialSameLanguageResultStatic(
            Long applicationId,
            Long cvId,
            String score
    ) {
        return resultStatic(
                applicationId, cvId, score, "0.80000000", "0.66666667",
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,
                List.of("java", "spring boot"), List.of("docker")
        );
    }

    private AiCandidateRankingResponse.Result noSkillSameLanguageResult(
            Long applicationId,
            Long cvId,
            String score
    ) {
        return result(
                applicationId, cvId, score, score, "0",
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, List.of(), List.of()
        );
    }

    private AiCandidateRankingResponse.Result result(
            Long applicationId,
            Long cvId,
            String score,
            String textScore,
            String skillScore,
            RecommendationScoringStrategy strategy,
            List<String> matchedSkills,
            List<String> missingSkills
    ) {
        return resultStatic(
                applicationId, cvId, score, textScore, skillScore,
                strategy, matchedSkills, missingSkills
        );
    }

    private static AiCandidateRankingResponse.Result resultStatic(
            Long applicationId,
            Long cvId,
            String score,
            String textScore,
            String skillScore,
            RecommendationScoringStrategy strategy,
            List<String> matchedSkills,
            List<String> missingSkills
    ) {
        return new AiCandidateRankingResponse.Result(
                applicationId, cvId, decimal(score), decimal(textScore), decimal(skillScore),
                strategy, matchedSkills, missingSkills
        );
    }

    private static BigDecimal decimal(String value) {
        return value == null ? null : new BigDecimal(value);
    }
}
