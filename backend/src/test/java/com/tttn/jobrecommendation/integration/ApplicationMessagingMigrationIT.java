package com.tttn.jobrecommendation.integration;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import java.util.*;
import java.util.stream.IntStream;
import static org.assertj.core.api.Assertions.*;

class ApplicationMessagingMigrationIT extends AbstractPostgresIntegrationTest {
    private Flyway migrate(String schema, String target) {
        var flyway = Flyway.configure().dataSource(POSTGRESQL.getJdbcUrl(), POSTGRESQL.getUsername(), POSTGRESQL.getPassword())
                .schemas(schema).defaultSchema(schema).createSchemas(true).target(target).load();
        flyway.migrate();
        return flyway;
    }

    @Test void upgradesPopulatedV24ToV25WithoutChangingExistingBusinessRows() {
        String schema = "messaging_v25_" + UUID.randomUUID().toString().replace("-", "");
        try {
            var old = migrate(schema, "24");
            assertThat(old.info().current().getVersion().getVersion()).isEqualTo("24");
            jdbcTemplate.update("insert into " + schema + ".users(id,email,password_hash,full_name,role,status) values (1,'owner@migration.test','hash','Owner','COMPANY','ACTIVE'),(2,'student@migration.test','hash','Student','STUDENT','ACTIVE')");
            jdbcTemplate.update("insert into " + schema + ".companies(id,user_id,company_name,status,account_revision,verification_document_url) values (1,1,'Preserved','VERIFIED',8,'private-internal-key')");
            jdbcTemplate.update("insert into " + schema + ".students(id,user_id,profile_revision) values (1,2,7)");
            jdbcTemplate.update("insert into " + schema + ".jobs(id,company_id,title,description,job_type,working_model,status) values (1,1,'Preserved role','Synthetic','INTERNSHIP','REMOTE','ACTIVE')");
            jdbcTemplate.update("insert into " + schema + ".cv_files(id,student_id,file_name,file_url,processed_text) values (1,1,'private.pdf','private-storage','preserved analysis')");
            jdbcTemplate.update("insert into " + schema + ".applications(id,student_id,job_id,cv_file_id,status,cover_letter) values (1,1,1,1,'WITHDRAWN','Historical letter')");
            jdbcTemplate.update("insert into " + schema + ".interviews(application_id,company_id,student_id,job_id,title,scheduled_at,duration_minutes,meeting_type,location_or_link,status) values (1,1,1,1,'Existing interview',current_timestamp,60,'ONSITE','Room','CANCELLED')");
            jdbcTemplate.update("insert into " + schema + ".job_invitations(company_id,student_id,job_id,message,status) values (1,1,1,'Historical offer','DECLINED')");
            var before = new LinkedHashMap<String, String>();
            for (String table : List.of("users", "students", "companies", "jobs", "cv_files", "applications", "interviews", "job_invitations"))
                before.put(table, rows(schema, table));
            var latest = migrate(schema, "25");
            assertThat(latest.info().current().getVersion().getVersion()).isEqualTo("25");
            assertThat(Arrays.stream(latest.info().applied()).filter(MigrationInfo::isVersioned)
                    .map(item -> item.getVersion().getVersion()).toList())
                    .containsExactlyElementsOf(IntStream.rangeClosed(1, 25).mapToObj(Integer::toString).toList());
            assertThat(latest.validateWithResult().validationSuccessful).isTrue();
            assertThat(latest.migrate().migrationsExecuted).isZero();
            before.forEach((table, value) -> assertThat(rows(schema, table)).as(table).isEqualTo(value));
            for (String table : List.of("conversations", "messages")) {
                assertThat(jdbcTemplate.queryForObject("select count(*) from " + schema + "." + table, Long.class)).isZero();
                assertThat(jdbcTemplate.queryForObject("select data_type from information_schema.columns where table_schema=? and table_name=? and column_name='id'", String.class, schema, table)).isEqualTo("bigint");
            }
            assertThat(jdbcTemplate.queryForList("select column_name from information_schema.columns where table_schema=? and table_name='conversations' and is_nullable='NO'", String.class, schema))
                    .containsExactlyInAnyOrder("id", "application_id", "company_id", "student_id", "created_at", "updated_at");
            assertThat(jdbcTemplate.queryForList("select column_name from information_schema.columns where table_schema=? and table_name='messages' and is_nullable='NO'", String.class, schema))
                    .containsExactlyInAnyOrder("id", "conversation_id", "sender_user_id", "sender_role", "content", "is_read", "created_at");
            assertThat(jdbcTemplate.queryForObject("select count(*) from information_schema.referential_constraints where constraint_schema=? and delete_rule='RESTRICT' and constraint_name like 'conversations_%'", Long.class, schema)).isEqualTo(3);
            assertThat(jdbcTemplate.queryForObject("select count(*) from information_schema.referential_constraints where constraint_schema=? and delete_rule='RESTRICT' and constraint_name like 'messages_%'", Long.class, schema)).isEqualTo(2);
        } finally {
            // Only this generated schema in the disposable PostgreSQL 17 container.
            jdbcTemplate.execute("drop schema if exists " + schema + " cascade");
        }
    }

    private String rows(String schema, String table) {
        return jdbcTemplate.queryForObject("select jsonb_agg(to_jsonb(r) order by id)::text from " + schema + "." + table + " r", String.class);
    }

    @Test void databaseConstraintsIndexesAndUnreadDefaultsProtectPrivateHistory() {
        var student = createStudent("student@constraints.test");
        var company = createCompany("owner@constraints.test", "Owner", com.tttn.jobrecommendation.common.enums.CompanyStatus.VERIFIED);
        var job = createJob(company, "Role", com.tttn.jobrecommendation.common.enums.JobStatus.ACTIVE);
        jdbcTemplate.update("insert into applications(id,student_id,job_id,status) values (100,?,?,'PENDING')", student.getId(), job.getId());
        String insert = "insert into conversations(application_id,company_id,student_id) values (100,?,?) returning id";
        Long id = jdbcTemplate.queryForObject(insert, Long.class, company.getId(), student.getId());
        assertThatThrownBy(() -> jdbcTemplate.queryForObject(insert, Long.class, company.getId(), student.getId())).isInstanceOf(DataIntegrityViolationException.class);
        assertThat(jdbcTemplate.queryForObject("select last_message_at from conversations where id=?", java.sql.Timestamp.class, id)).isNull();
        Long message = jdbcTemplate.queryForObject("insert into messages(conversation_id,sender_user_id,sender_role,content) values (?,?,'STUDENT','hello') returning id", Long.class, id, student.getUser().getId());
        assertThat(jdbcTemplate.queryForObject("select is_read from messages where id=?", Boolean.class, message)).isFalse();
        for (String assignment : List.of("sender_role='ADMIN'", "content=''", "content='   '", "content=repeat('x',5001)", "sender_user_id=999999", "conversation_id=999999", "is_read=null", "created_at=null"))
            assertThatThrownBy(() -> jdbcTemplate.update("update messages set " + assignment + " where id=?", message)).as(assignment).isInstanceOf(DataIntegrityViolationException.class);
        for (String assignment : List.of("application_id=999999", "student_id=999999", "company_id=999999"))
            assertThatThrownBy(() -> jdbcTemplate.update("update conversations set " + assignment + " where id=?", id)).as(assignment).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbcTemplate.update("delete from applications where id=100")).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbcTemplate.update("delete from conversations where id=?", id)).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbcTemplate.update("delete from users where id=?", student.getUser().getId())).isInstanceOf(DataIntegrityViolationException.class);
        assertThat(jdbcTemplate.queryForList("select indexname from pg_indexes where schemaname=current_schema() and tablename in ('conversations','messages')", String.class))
                .contains("idx_conversations_company_activity", "idx_conversations_student_activity", "idx_messages_conversation_chronological", "idx_messages_unread_sender");
    }
}
