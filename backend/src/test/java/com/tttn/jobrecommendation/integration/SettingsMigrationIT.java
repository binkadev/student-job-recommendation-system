package com.tttn.jobrecommendation.integration;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import static org.assertj.core.api.Assertions.*;

class SettingsMigrationIT extends AbstractPostgresIntegrationTest {
    @Test
    void upgradesPopulatedV20WithoutChangingExistingFieldsAndEnforcesNonnegativeRevisions() {
        String schema = "settings_upgrade_" + java.util.UUID.randomUUID().toString().replace("-", "");
        try {
            migrate(schema, "20");
            jdbcTemplate.update("INSERT INTO " + schema + ".users(id,email,password_hash,full_name,role,status) VALUES (1,'upgrade@example.test','synthetic-hash','Upgrade','COMPANY','ACTIVE')");
            jdbcTemplate.update("INSERT INTO " + schema + ".companies(id,user_id,company_name,status,phone) VALUES (1,1,'Preserved company','BLOCKED','synthetic phone')");
            jdbcTemplate.update("INSERT INTO " + schema + ".user_notification_settings(user_id,application_status_enabled,job_status_enabled,recommendation_enabled,system_enabled) VALUES (1,false,true,false,true)");
            String companyBefore = digest(schema, "companies", ""), preferencesBefore = digest(schema, "user_notification_settings", ""), userBefore = digest(schema, "users", "");
            var migrated = migrate(schema, "21");
            assertThat(migrated.info().current().getVersion().getVersion()).isEqualTo("21");
            assertThat(digest(schema, "companies", " - 'account_revision'")).isEqualTo(companyBefore);
            assertThat(digest(schema, "user_notification_settings", " - 'revision'")).isEqualTo(preferencesBefore);
            assertThat(digest(schema, "users", "")).isEqualTo(userBefore);
            assertThat(jdbcTemplate.queryForObject("select account_revision from " + schema + ".companies", Long.class)).isZero();
            assertThat(jdbcTemplate.queryForObject("select revision from " + schema + ".user_notification_settings", Long.class)).isZero();
            assertThatThrownBy(() -> jdbcTemplate.update("update " + schema + ".companies set account_revision=-1")).isInstanceOf(DataIntegrityViolationException.class);
            assertThatThrownBy(() -> jdbcTemplate.update("update " + schema + ".user_notification_settings set revision=-1")).isInstanceOf(DataIntegrityViolationException.class);
            assertThat(migrated.migrate().migrationsExecuted).isZero();
        } finally {
            jdbcTemplate.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
        }
    }
    private String digest(String schema, String table, String subtract) {
        return jdbcTemplate.queryForObject("select md5((to_jsonb(r)" + subtract + ")::text) from " + schema + "." + table + " r", String.class);
    }
    private Flyway migrate(String schema, String version) {
        var flyway = Flyway.configure().dataSource(POSTGRESQL.getJdbcUrl(), POSTGRESQL.getUsername(), POSTGRESQL.getPassword())
                .schemas(schema).defaultSchema(schema).createSchemas(true).target(version).load();
        flyway.migrate(); return flyway;
    }
}
