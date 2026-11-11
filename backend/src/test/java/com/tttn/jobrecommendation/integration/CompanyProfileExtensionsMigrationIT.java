package com.tttn.jobrecommendation.integration;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CompanyProfileExtensionsMigrationIT extends AbstractPostgresIntegrationTest {
    @Test
    void upgradesPopulatedV22WithNullable500CharacterColumnsAndPreservesExistingData() {
        String schema = "company_profile_upgrade_" + UUID.randomUUID().toString().replace("-", "");
        try {
            migrate(schema, "22");
            jdbcTemplate.update("INSERT INTO " + schema + ".users(id,email,password_hash,full_name,role,status) VALUES (1,'cover-upgrade@example.test','synthetic-hash','Upgrade','COMPANY','ACTIVE')");
            jdbcTemplate.update("INSERT INTO " + schema + ".companies(id,user_id,company_name,company_size,logo_url,status,account_revision) VALUES (1,1,'Preserved company','51-200','https://example.test/logo.png','BLOCKED',7)");
            String companyBefore = rowData(schema, "companies", "");
            String userBefore = rowData(schema, "users", "");
            var migrated = migrate(schema, "23");
            assertThat(migrated.info().current().getVersion().getVersion()).isEqualTo("23");
            assertThat(rowData(schema, "companies", " - 'cover_image_url' - 'verification_document_url'")).isEqualTo(companyBefore);
            assertThat(rowData(schema, "users", "")).isEqualTo(userBefore);
            for (String column : new String[]{"cover_image_url", "verification_document_url"}) {
                var metadata = jdbcTemplate.queryForMap("select data_type, character_maximum_length, is_nullable, column_default from information_schema.columns where table_schema = ? and table_name = 'companies' and column_name = ?", schema, column);
                assertThat(metadata).containsEntry("data_type", "character varying")
                        .containsEntry("character_maximum_length", 500).containsEntry("is_nullable", "YES")
                        .containsEntry("column_default", null);
                assertThat(jdbcTemplate.queryForObject("select " + column + " from " + schema + ".companies where id = 1", String.class)).isNull();
            }
            // New rows also receive NULL without any application-provided values.
            jdbcTemplate.update("INSERT INTO " + schema + ".users(id,email,password_hash,full_name,role,status) VALUES (2,'new-cover@example.test','synthetic-hash','New Company','COMPANY','ACTIVE')");
            jdbcTemplate.update("INSERT INTO " + schema + ".companies(id,user_id,company_name) VALUES (2,2,'New company')");
            assertThat(jdbcTemplate.queryForObject("select cover_image_url is null and verification_document_url is null from " + schema + ".companies where id = 2", Boolean.class)).isTrue();
            jdbcTemplate.update("update " + schema + ".companies set cover_image_url = ?, verification_document_url = ? where id = 1", "a".repeat(500), "b".repeat(500));
            for (String column : new String[]{"cover_image_url", "verification_document_url"}) {
                assertThatThrownBy(() -> jdbcTemplate.update("update " + schema + ".companies set " + column + " = ? where id = 1", "a".repeat(501)))
                        .isInstanceOf(DataIntegrityViolationException.class);
            }
            migrated.validate();
            assertThat(migrated.migrate().migrationsExecuted).isZero();
        } finally {
            jdbcTemplate.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
        }
    }
    private String rowData(String schema, String table, String subtract) {
        return jdbcTemplate.queryForObject("select (to_jsonb(r)" + subtract + ")::text from " + schema + "." + table + " r where id = 1", String.class);
    }
    private Flyway migrate(String schema, String version) {
        var flyway = Flyway.configure().dataSource(POSTGRESQL.getJdbcUrl(), POSTGRESQL.getUsername(), POSTGRESQL.getPassword())
                .schemas(schema).defaultSchema(schema).createSchemas(true).target(version).load();
        flyway.migrate(); return flyway;
    }
}
