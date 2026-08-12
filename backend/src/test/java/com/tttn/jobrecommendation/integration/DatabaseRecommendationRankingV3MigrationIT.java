package com.tttn.jobrecommendation.integration;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DatabaseRecommendationRankingV3MigrationIT extends AbstractPostgresIntegrationTest {

    @Test
    void backfillsRecognizedRowsWithoutChangingGlobalRanksOrInventingLegacySemantics() {
        String schema = newSchema();
        try {
            migrate(schema, MigrationVersion.fromVersion("16"));
            Fixture fixture = insertV16Fixture(schema);

            Flyway flyway = migrate(schema, null);

            assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("18");
            assertThat(flyway.validateWithResult().validationSuccessful).isTrue();

            assertStudentBackfill(schema, fixture);
            assertCandidateBackfill(schema, fixture);
            assertLegacyCandidateRunShape(schema, fixture);
        } finally {
            dropSchema(schema);
        }
    }

    @Test
    void enforcesTierResultConstraintsAndPartialTierRankUniqueness() {
        String schema = newSchema();
        try {
            migrate(schema, MigrationVersion.fromVersion("16"));
            Fixture fixture = insertV16Fixture(schema);
            migrate(schema, null);

            assertThatThrownBy(() -> jdbcTemplate.update("""
                    UPDATE %s.recommendation_results
                    SET ranking_tier = 'INVALID'
                    WHERE id = ?
                    """.formatted(schema), fixture.studentPrimaryFirstResultId()))
                    .isInstanceOf(DataIntegrityViolationException.class);
            assertThatThrownBy(() -> jdbcTemplate.update("""
                    UPDATE %s.recommendation_results
                    SET overall_score = 1.00001
                    WHERE id = ?
                    """.formatted(schema), fixture.studentPrimaryFirstResultId()))
                    .isInstanceOf(DataIntegrityViolationException.class);
            assertThatThrownBy(() -> jdbcTemplate.update("""
                    UPDATE %s.recommendation_results
                    SET tier_rank_position = 0
                    WHERE id = ?
                    """.formatted(schema), fixture.studentPrimaryFirstResultId()))
                    .isInstanceOf(DataIntegrityViolationException.class);
            assertThatThrownBy(() -> jdbcTemplate.update("""
                    UPDATE %s.recommendation_results
                    SET overall_score = NULL
                    WHERE id = ?
                    """.formatted(schema), fixture.studentPrimaryFirstResultId()))
                    .isInstanceOf(DataIntegrityViolationException.class);
            assertThatThrownBy(() -> jdbcTemplate.update("""
                    UPDATE %s.recommendation_results
                    SET overall_score = 0.10000
                    WHERE id = ?
                    """.formatted(schema), fixture.studentFallbackResultId()))
                    .isInstanceOf(DataIntegrityViolationException.class);
            assertThatThrownBy(() -> jdbcTemplate.update("""
                    UPDATE %s.recommendation_results
                    SET tier_rank_position = 1
                    WHERE id = ?
                    """.formatted(schema), fixture.studentPrimarySecondResultId()))
                    .isInstanceOf(DataIntegrityViolationException.class);

            assertThatThrownBy(() -> jdbcTemplate.update("""
                    UPDATE %s.candidate_ranking_results
                    SET tier_rank_position = 1
                    WHERE id = ?
                    """.formatted(schema), fixture.candidatePrimarySecondResultId()))
                    .isInstanceOf(DataIntegrityViolationException.class);
        } finally {
            dropSchema(schema);
        }
    }

    @Test
    void preservesLegacyLimitHistoryAndAcceptsOnlyCompleteV3LimitShapes() {
        String schema = newSchema();
        try {
            migrate(schema, MigrationVersion.fromVersion("16"));
            Fixture fixture = insertV16Fixture(schema);
            migrate(schema, null);

            Long v3RunId = jdbcTemplate.queryForObject("""
                    INSERT INTO %s.candidate_ranking_runs (
                        job_id, request_id, status, threshold,
                        requested_limit, requested_primary_limit, requested_fallback_limit,
                        total_applications_scanned, eligible_candidates, skipped_no_cv,
                        skipped_not_ready, skipped_terminal_status, input_fingerprint,
                        job_updated_at_snapshot
                    )
                    VALUES (?, ?, 'SUCCESS', 0.10000, NULL, 20, 20, 0, 0, 0, 0, 0, ?, CURRENT_TIMESTAMP)
                    RETURNING id
                    """.formatted(schema), Long.class,
                    fixture.candidateJobId(), UUID.randomUUID(), "b".repeat(64));
            Map<String, Object> v3Run = jdbcTemplate.queryForMap("""
                    SELECT requested_limit, requested_primary_limit, requested_fallback_limit
                    FROM %s.candidate_ranking_runs
                    WHERE id = ?
                    """.formatted(schema), v3RunId);
            assertThat(v3Run.get("requested_limit")).isNull();
            assertThat(v3Run.get("requested_primary_limit")).isEqualTo(20);
            assertThat(v3Run.get("requested_fallback_limit")).isEqualTo(20);

            assertThatThrownBy(() -> jdbcTemplate.update("""
                    UPDATE %s.candidate_ranking_runs
                    SET requested_primary_limit = 20
                    WHERE id = ?
                    """.formatted(schema), fixture.candidateRunId()))
                    .isInstanceOf(DataIntegrityViolationException.class);
            assertThatThrownBy(() -> jdbcTemplate.update("""
                    UPDATE %s.candidate_ranking_runs
                    SET requested_primary_limit = -1
                    WHERE id = ?
                    """.formatted(schema), v3RunId))
                    .isInstanceOf(DataIntegrityViolationException.class);
            assertThatThrownBy(() -> jdbcTemplate.update("""
                    UPDATE %s.candidate_ranking_runs
                    SET requested_primary_limit = 101
                    WHERE id = ?
                    """.formatted(schema), v3RunId))
                    .isInstanceOf(DataIntegrityViolationException.class);
            assertThatThrownBy(() -> jdbcTemplate.update("""
                    UPDATE %s.candidate_ranking_runs
                    SET requested_primary_limit = 60, requested_fallback_limit = 41
                    WHERE id = ?
                    """.formatted(schema), v3RunId))
                    .isInstanceOf(DataIntegrityViolationException.class);
        } finally {
            dropSchema(schema);
        }
    }

    private void assertStudentBackfill(String schema, Fixture fixture) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT id, job_id, score, overall_score, ranking_tier, tier_rank_position, rank_position
                FROM %s.recommendation_results
                WHERE run_id = ?
                ORDER BY id
                """.formatted(schema), fixture.studentRunId());

        assertThat(rows).extracting(row -> row.get("ranking_tier"))
                .containsExactly("PRIMARY", "PRIMARY", "FALLBACK", null);
        assertThat(rows).extracting(row -> row.get("tier_rank_position"))
                .containsExactly(1, 2, 1, null);
        assertThat(rows).extracting(row -> row.get("rank_position"))
                .containsExactly(40, 41, 42, 43);
        assertThat((BigDecimal) rows.get(0).get("overall_score")).isEqualByComparingTo("0.70000");
        assertThat((BigDecimal) rows.get(1).get("overall_score")).isEqualByComparingTo("0.70000");
        assertThat(rows.get(2).get("overall_score")).isNull();
        assertThat(rows.get(3).get("overall_score")).isNull();
    }

    private void assertCandidateBackfill(String schema, Fixture fixture) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT id, application_id, score, overall_score, ranking_tier, tier_rank_position, rank_position
                FROM %s.candidate_ranking_results
                WHERE run_id = ?
                ORDER BY id
                """.formatted(schema), fixture.candidateRunId());

        assertThat(rows).extracting(row -> row.get("ranking_tier"))
                .containsExactly("PRIMARY", "PRIMARY", "FALLBACK");
        assertThat(rows).extracting(row -> row.get("tier_rank_position"))
                .containsExactly(1, 2, 1);
        assertThat(rows).extracting(row -> row.get("rank_position"))
                .containsExactly(10, 11, 12);
        assertThat((BigDecimal) rows.get(0).get("overall_score")).isEqualByComparingTo("0.80000");
        assertThat((BigDecimal) rows.get(1).get("overall_score")).isEqualByComparingTo("0.80000");
        assertThat(rows.get(2).get("overall_score")).isNull();
    }

    private void assertLegacyCandidateRunShape(String schema, Fixture fixture) {
        Map<String, Object> run = jdbcTemplate.queryForMap("""
                SELECT requested_limit, requested_primary_limit, requested_fallback_limit
                FROM %s.candidate_ranking_runs
                WHERE id = ?
                """.formatted(schema), fixture.candidateRunId());
        assertThat(run.get("requested_limit")).isEqualTo(20);
        assertThat(run.get("requested_primary_limit")).isNull();
        assertThat(run.get("requested_fallback_limit")).isNull();
    }

    private Fixture insertV16Fixture(String schema) {
        Long studentId = insertStudent(schema, "student@example.test");
        Long studentCvId = insertCv(schema, studentId, "student.pdf");
        Long companyId = insertCompany(schema);
        Long firstJobId = insertJob(schema, companyId, "First Job");
        Long secondJobId = insertJob(schema, companyId, "Second Job");
        Long thirdJobId = insertJob(schema, companyId, "Third Job");
        Long fourthJobId = insertJob(schema, companyId, "Fourth Job");
        Long studentRunId = jdbcTemplate.queryForObject("""
                INSERT INTO %s.recommendation_runs (student_id, cv_file_id, source_type, status)
                VALUES (?, ?, 'CV', 'SUCCESS')
                RETURNING id
                """.formatted(schema), Long.class, studentId, studentCvId);

        Long studentPrimaryFirstResultId = insertRecommendationResult(
                schema, studentRunId, firstJobId, "0.70000", "0.60000", "0.80000",
                "SAME_LANGUAGE_HYBRID", 40
        );
        Long studentPrimarySecondResultId = insertRecommendationResult(
                schema, studentRunId, secondJobId, "0.70000", "0.60000", "0.80000",
                "SAME_LANGUAGE_HYBRID", 41
        );
        Long studentFallbackResultId = insertRecommendationResult(
                schema, studentRunId, thirdJobId, "0.90000", null, "0.90000",
                "CROSS_LANGUAGE_SKILL_BASED", 42
        );
        insertRecommendationResult(schema, studentRunId, fourthJobId, "0.50000", null, null, null, 43);

        Long candidateRunId = jdbcTemplate.queryForObject("""
                INSERT INTO %s.candidate_ranking_runs (
                    job_id, request_id, status, threshold, requested_limit,
                    total_applications_scanned, eligible_candidates, skipped_no_cv,
                    skipped_not_ready, skipped_terminal_status, input_fingerprint,
                    job_updated_at_snapshot
                )
                VALUES (?, ?, 'SUCCESS', 0.10000, 20, 3, 3, 0, 0, 0, ?, CURRENT_TIMESTAMP)
                RETURNING id
                """.formatted(schema), Long.class, firstJobId, UUID.randomUUID(), "a".repeat(64));

        Long firstApplicationId = insertApplication(schema, firstJobId, "candidate-one@example.test", "one.pdf");
        Long secondApplicationId = insertApplication(schema, firstJobId, "candidate-two@example.test", "two.pdf");
        Long thirdApplicationId = insertApplication(schema, firstJobId, "candidate-three@example.test", "three.pdf");
        Long firstCandidateCvId = cvIdForApplication(schema, firstApplicationId);
        Long secondCandidateCvId = cvIdForApplication(schema, secondApplicationId);
        Long thirdCandidateCvId = cvIdForApplication(schema, thirdApplicationId);

        insertCandidateResult(schema, candidateRunId, firstApplicationId, firstCandidateCvId,
                "0.80000", "0.60000", "0.80000", "SAME_LANGUAGE_HYBRID", 10);
        Long candidatePrimarySecondResultId = insertCandidateResult(schema, candidateRunId, secondApplicationId,
                secondCandidateCvId, "0.80000", "0.60000", "0.80000", "SAME_LANGUAGE_HYBRID", 11);
        insertCandidateResult(schema, candidateRunId, thirdApplicationId, thirdCandidateCvId,
                "0.90000", null, "0.90000", "CROSS_LANGUAGE_SKILL_BASED", 12);

        return new Fixture(
                studentRunId,
                studentPrimaryFirstResultId,
                studentPrimarySecondResultId,
                studentFallbackResultId,
                candidateRunId,
                candidatePrimarySecondResultId,
                firstJobId
        );
    }

    private Long insertStudent(String schema, String email) {
        Long userId = jdbcTemplate.queryForObject("""
                INSERT INTO %s.users (email, password_hash, full_name, role, status)
                VALUES (?, 'hash', 'Student', 'STUDENT', 'ACTIVE')
                RETURNING id
                """.formatted(schema), Long.class, email);
        return jdbcTemplate.queryForObject("""
                INSERT INTO %s.students (user_id, student_code)
                VALUES (?, ?)
                RETURNING id
                """.formatted(schema), Long.class, userId, "STUDENT-" + userId);
    }

    private Long insertCv(String schema, Long studentId, String fileName) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO %s.cv_files (
                    student_id, file_name, file_url, original_file_name, stored_file_name, file_path
                )
                VALUES (?, ?, ?, ?, ?, ?)
                RETURNING id
                """.formatted(schema), Long.class, studentId, fileName,
                "uploads/" + fileName, fileName, fileName, "uploads/" + fileName);
    }

    private Long insertCompany(String schema) {
        Long userId = jdbcTemplate.queryForObject("""
                INSERT INTO %s.users (email, password_hash, full_name, role, status)
                VALUES ('company@example.test', 'hash', 'Company', 'COMPANY', 'ACTIVE')
                RETURNING id
                """.formatted(schema), Long.class);
        return jdbcTemplate.queryForObject("""
                INSERT INTO %s.companies (user_id, company_name, status)
                VALUES (?, 'Company', 'VERIFIED')
                RETURNING id
                """.formatted(schema), Long.class, userId);
    }

    private Long insertJob(String schema, Long companyId, String title) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO %s.jobs (company_id, title, description, job_type, working_model, status)
                VALUES (?, ?, 'Description', 'INTERNSHIP', 'REMOTE', 'ACTIVE')
                RETURNING id
                """.formatted(schema), Long.class, companyId, title);
    }

    private Long insertRecommendationResult(
            String schema,
            Long runId,
            Long jobId,
            String score,
            String textScore,
            String skillScore,
            String strategy,
            int rankPosition
    ) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO %s.recommendation_results (
                    run_id, job_id, score, matched_keywords, rank_position,
                    text_score, skill_score, scoring_strategy
                )
                VALUES (?, ?, CAST(? AS NUMERIC), '[]'::jsonb, ?, CAST(? AS NUMERIC), CAST(? AS NUMERIC), ?)
                RETURNING id
                """.formatted(schema), Long.class,
                runId, jobId, score, rankPosition, textScore, skillScore, strategy);
    }

    private Long insertApplication(String schema, Long jobId, String email, String fileName) {
        Long studentId = insertStudent(schema, email);
        Long cvId = insertCv(schema, studentId, fileName);
        return jdbcTemplate.queryForObject("""
                INSERT INTO %s.applications (student_id, job_id, cv_file_id, status)
                VALUES (?, ?, ?, 'PENDING')
                RETURNING id
                """.formatted(schema), Long.class, studentId, jobId, cvId);
    }

    private Long cvIdForApplication(String schema, Long applicationId) {
        return jdbcTemplate.queryForObject("""
                SELECT cv_file_id FROM %s.applications WHERE id = ?
                """.formatted(schema), Long.class, applicationId);
    }

    private Long insertCandidateResult(
            String schema,
            Long runId,
            Long applicationId,
            Long cvId,
            String score,
            String textScore,
            String skillScore,
            String strategy,
            int rankPosition
    ) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO %s.candidate_ranking_results (
                    run_id, application_id, cv_file_id, score, text_score, skill_score,
                    scoring_strategy, matched_skills, missing_skills, rank_position
                )
                VALUES (?, ?, ?, CAST(? AS NUMERIC), CAST(? AS NUMERIC), CAST(? AS NUMERIC),
                        ?, '[]'::jsonb, '[]'::jsonb, ?)
                RETURNING id
                """.formatted(schema), Long.class,
                runId, applicationId, cvId, score, textScore, skillScore, strategy, rankPosition);
    }

    private Flyway migrate(String schema, MigrationVersion target) {
        var configuration = Flyway.configure()
                .dataSource(POSTGRESQL.getJdbcUrl(), POSTGRESQL.getUsername(), POSTGRESQL.getPassword())
                .schemas(schema)
                .defaultSchema(schema)
                .createSchemas(true);
        if (target != null) {
            configuration.target(target);
        }
        Flyway flyway = configuration.load();
        flyway.migrate();
        return flyway;
    }

    private String newSchema() {
        return "recommendation_ranking_v3_" + UUID.randomUUID().toString().replace("-", "");
    }

    private void dropSchema(String schema) {
        jdbcTemplate.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
    }

    private record Fixture(
            Long studentRunId,
            Long studentPrimaryFirstResultId,
            Long studentPrimarySecondResultId,
            Long studentFallbackResultId,
            Long candidateRunId,
            Long candidatePrimarySecondResultId,
            Long candidateJobId
    ) {
    }
}
