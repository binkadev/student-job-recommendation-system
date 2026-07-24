package com.tttn.jobrecommendation.integration;

import jakarta.persistence.EntityManagerFactory;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.flywaydb.core.api.MigrationInfoService;
import org.flywaydb.core.api.MigrationState;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ConfigurableApplicationContext;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DatabaseMigrationIT extends AbstractPostgresIntegrationTest {

    private static final List<String> EXPECTED_MIGRATION_VERSIONS = List.of(
            "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14"
    );

    private static final List<String> CORE_TABLES = List.of(
            "users",
            "students",
            "student_profiles",
            "companies",
            "skills",
            "student_skills",
            "jobs",
            "job_skills",
            "saved_jobs",
            "cv_files",
            "applications",
            "recommendation_runs",
            "recommendation_results",
            "notifications",
            "saved_candidates",
            "user_notification_settings",
            "saved_searches"
    );

    @Autowired
    private ConfigurableApplicationContext applicationContext;

    @Autowired
    private Flyway flyway;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Test
    void appliesEveryMigrationAndValidatesTheHibernateSchema() {
        assertThat(POSTGRESQL.isRunning()).isTrue();
        assertThat(applicationContext.isActive()).isTrue();
        assertThat(jdbcTemplate.queryForObject(
                "select current_setting('server_version_num')::int / 10000",
                Integer.class
        )).isEqualTo(17);

        MigrationInfoService migrationInfo = flyway.info();
        List<MigrationInfo> appliedVersionedMigrations = Arrays.stream(migrationInfo.applied())
                .filter(MigrationInfo::isVersioned)
                .toList();

        assertThat(flyway.validateWithResult().validationSuccessful).isTrue();
        assertThat(migrationInfo.current()).isNotNull();
        assertThat(migrationInfo.current().getVersion().getVersion()).isEqualTo("14");
        assertThat(migrationInfo.pending()).isEmpty();
        assertThat(appliedVersionedMigrations)
                .hasSize(14)
                .allSatisfy(migration -> assertThat(migration.getState()).isEqualTo(MigrationState.SUCCESS));
        assertThat(appliedVersionedMigrations)
                .extracting(migration -> migration.getVersion().getVersion())
                .containsExactlyElementsOf(EXPECTED_MIGRATION_VERSIONS);

        assertThat(entityManagerFactory.isOpen()).isTrue();
        assertThat(entityManagerFactory.getMetamodel().getEntities()).isNotEmpty();

        List<String> applicationTables = jdbcTemplate.queryForList("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = current_schema()
                  AND table_type = 'BASE TABLE'
                  AND table_name <> 'flyway_schema_history'
                """, String.class);

        assertThat(applicationTables).containsExactlyInAnyOrderElementsOf(CORE_TABLES);
    }
}
