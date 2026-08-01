package com.tttn.jobrecommendation.integration;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

class DatabaseAiContractV2MigrationIT extends AbstractPostgresIntegrationTest {

    @Test
    void migratesLegacyCvAndRecommendationRowsWithoutInventingMetadata() {
        String schema = "ai_contract_v2_" + UUID.randomUUID().toString().replace("-", "");

        try {
            migrate(schema, MigrationVersion.fromVersion("14"));
            LegacyFixture fixture = insertLegacyFixture(schema);

            Flyway flyway = migrate(schema, null);

            assertThat(flyway.info().current()).isNotNull();
            assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("16");
            assertThat(flyway.validateWithResult().validationSuccessful).isTrue();

            assertCvBackfill(schema);
            assertLegacyRecommendationMetadata(schema, fixture);
        } finally {
            jdbcTemplate.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
        }
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

    private LegacyFixture insertLegacyFixture(String schema) {
        Long studentUserId = jdbcTemplate.queryForObject("""
                INSERT INTO %s.users (email, password_hash, full_name, role, status)
                VALUES ('legacy-student@example.test', 'hash', 'Legacy Student', 'STUDENT', 'ACTIVE')
                RETURNING id
                """.formatted(schema), Long.class);
        Long studentId = jdbcTemplate.queryForObject("""
                INSERT INTO %s.students (user_id, student_code)
                VALUES (?, 'LEGACY-STUDENT')
                RETURNING id
                """.formatted(schema), Long.class, studentUserId);

        Long skillId = jdbcTemplate.queryForObject("""
                INSERT INTO %s.skills (name, normalized_name)
                VALUES ('Java', 'java')
                RETURNING id
                """.formatted(schema), Long.class);
        jdbcTemplate.update("""
                INSERT INTO %s.student_skills (student_id, skill_id, level, source)
                VALUES (?, ?, 'INTERMEDIATE', 'MANUAL')
                """.formatted(schema), studentId, skillId);

        Long readyCvId = insertLegacyCv(schema, studentId, "complete.pdf", "legacy raw", "legacy processed");
        insertLegacyCv(schema, studentId, "missing-extracted.pdf", null, "legacy processed");
        insertLegacyCv(schema, studentId, "missing-processed.pdf", "legacy raw", null);
        insertLegacyCv(schema, studentId, "blank-extracted.pdf", "   ", "legacy processed");
        insertLegacyCv(schema, studentId, "blank-processed.pdf", "legacy raw", "   ");

        Long companyUserId = jdbcTemplate.queryForObject("""
                INSERT INTO %s.users (email, password_hash, full_name, role, status)
                VALUES ('legacy-company@example.test', 'hash', 'Legacy Company User', 'COMPANY', 'ACTIVE')
                RETURNING id
                """.formatted(schema), Long.class);
        Long companyId = jdbcTemplate.queryForObject("""
                INSERT INTO %s.companies (user_id, company_name, status)
                VALUES (?, 'Legacy Company', 'VERIFIED')
                RETURNING id
                """.formatted(schema), Long.class, companyUserId);
        Long jobId = jdbcTemplate.queryForObject("""
                INSERT INTO %s.jobs (
                    company_id, title, description, job_type, working_model, status
                )
                VALUES (?, 'Legacy Job', 'Legacy description', 'INTERNSHIP', 'REMOTE', 'ACTIVE')
                RETURNING id
                """.formatted(schema), Long.class, companyId);
        Long runId = jdbcTemplate.queryForObject("""
                INSERT INTO %s.recommendation_runs (
                    student_id, cv_file_id, source_type, status
                )
                VALUES (?, ?, 'CV', 'SUCCESS')
                RETURNING id
                """.formatted(schema), Long.class, studentId, readyCvId);
        Long resultId = jdbcTemplate.queryForObject("""
                INSERT INTO %s.recommendation_results (
                    run_id, job_id, score, matched_keywords, rank_position
                )
                VALUES (?, ?, 0.75000, '["java"]'::jsonb, 1)
                RETURNING id
                """.formatted(schema), Long.class, runId, jobId);

        return new LegacyFixture(runId, resultId);
    }

    private Long insertLegacyCv(
            String schema,
            Long studentId,
            String fileName,
            String extractedText,
            String processedText
    ) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO %s.cv_files (
                    student_id, file_name, file_url, original_file_name, stored_file_name,
                    file_path, processed_text, extracted_text
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id
                """.formatted(schema), Long.class,
                studentId,
                fileName,
                "uploads/cvs/" + fileName,
                fileName,
                fileName,
                "uploads/cvs/" + fileName,
                processedText,
                extractedText);
    }

    private void assertCvBackfill(String schema) {
        Map<String, Map<String, Object>> rowsByFileName = jdbcTemplate.queryForList("""
                        SELECT
                            file_name,
                            analysis_status,
                            extracted_skills::text AS extracted_skills,
                            analysis_warnings::text AS analysis_warnings,
                            analysis_error,
                            language_code,
                            language_confidence,
                            processing_version,
                            analyzed_at
                        FROM %s.cv_files
                        """.formatted(schema))
                .stream()
                .collect(Collectors.toMap(
                        row -> (String) row.get("file_name"),
                        Function.identity()
                ));

        assertThat(rowsByFileName.get("complete.pdf").get("analysis_status")).isEqualTo("READY");
        assertThat(rowsByFileName.get("missing-extracted.pdf").get("analysis_status")).isEqualTo("NOT_READY");
        assertThat(rowsByFileName.get("missing-processed.pdf").get("analysis_status")).isEqualTo("NOT_READY");
        assertThat(rowsByFileName.get("blank-extracted.pdf").get("analysis_status")).isEqualTo("NOT_READY");
        assertThat(rowsByFileName.get("blank-processed.pdf").get("analysis_status")).isEqualTo("NOT_READY");

        assertThat(rowsByFileName.values()).allSatisfy(row -> {
            assertThat(row.get("extracted_skills")).isEqualTo("[]");
            assertThat(row.get("analysis_warnings")).isEqualTo("[]");
            assertThat(row.get("analysis_error")).isNull();
            assertThat(row.get("language_code")).isNull();
            assertThat(row.get("language_confidence")).isNull();
            assertThat(row.get("processing_version")).isNull();
            assertThat(row.get("analyzed_at")).isNull();
        });
    }

    private void assertLegacyRecommendationMetadata(String schema, LegacyFixture fixture) {
        Map<String, Object> run = jdbcTemplate.queryForMap("""
                SELECT algorithm, algorithm_version, total_jobs_scanned
                FROM %s.recommendation_runs
                WHERE id = ?
                """.formatted(schema), fixture.runId());
        assertThat(run.get("algorithm")).isNull();
        assertThat(run.get("algorithm_version")).isNull();
        assertThat(run.get("total_jobs_scanned")).isEqualTo(0);

        Map<String, Object> result = jdbcTemplate.queryForMap("""
                SELECT
                    score,
                    matched_keywords::text AS matched_keywords,
                    text_score,
                    skill_score,
                    scoring_strategy,
                    missing_skills::text AS missing_skills,
                    reason
                FROM %s.recommendation_results
                WHERE id = ?
                """.formatted(schema), fixture.resultId());
        assertThat((BigDecimal) result.get("score")).isEqualByComparingTo("0.75000");
        assertThat(result.get("matched_keywords")).isEqualTo("[\"java\"]");
        assertThat(result.get("text_score")).isNull();
        assertThat(result.get("skill_score")).isNull();
        assertThat(result.get("scoring_strategy")).isNull();
        assertThat(result.get("missing_skills")).isEqualTo("[]");
        assertThat(result.get("reason")).isNull();
    }

    private record LegacyFixture(Long runId, Long resultId) {
    }
}
