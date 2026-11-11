package com.tttn.jobrecommendation.integration;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

class RecruitingWorkflowMigrationIT extends AbstractPostgresIntegrationTest {
    private Flyway migrate(String schema,String target) {
        var f=Flyway.configure().dataSource(POSTGRESQL.getJdbcUrl(),POSTGRESQL.getUsername(),POSTGRESQL.getPassword())
                .schemas(schema).defaultSchema(schema).createSchemas(true).target(target).load();
        f.migrate();return f;
    }
    @Test void upgradesPopulatedV23WithoutChangingBusinessRows() {
        String schema="recruiting_v24_"+UUID.randomUUID().toString().replace("-","");
        try {
            var old=migrate(schema,"23");
            assertThat(old.info().current().getVersion().getVersion()).isEqualTo("23");
            jdbcTemplate.update("insert into "+schema+".users(id,email,password_hash,full_name,role,status) values (1,'owner@migration.test','hash','Owner','COMPANY','ACTIVE'),(2,'student@migration.test','hash','Student','STUDENT','ACTIVE')");
            jdbcTemplate.update("insert into "+schema+".companies(id,user_id,company_name,status,account_revision) values (1,1,'Preserved','VERIFIED',8)");
            jdbcTemplate.update("insert into "+schema+".students(id,user_id) values (1,2)");
            jdbcTemplate.update("insert into "+schema+".jobs(id,company_id,title,description,job_type,working_model,status) values (1,1,'Preserved role','Synthetic','INTERNSHIP','REMOTE','ACTIVE')");
            jdbcTemplate.update("insert into "+schema+".applications(id,student_id,job_id,status) values (1,1,1,'WITHDRAWN')");
            var before=new java.util.LinkedHashMap<String,String>();
            for(String table:new String[]{"companies","applications","jobs","students","users"}) before.put(table,row(schema,table));
            var latest=migrate(schema,"24");
            assertThat(latest.info().current().getVersion().getVersion()).isEqualTo("24");
            assertThat(java.util.Arrays.stream(latest.info().applied()).filter(org.flywaydb.core.api.MigrationInfo::isVersioned)
                    .map(item -> item.getVersion().getVersion()).toList())
                    .containsExactlyElementsOf(java.util.stream.IntStream.rangeClosed(1,24).mapToObj(Integer::toString).toList());
            assertThat(latest.validateWithResult().validationSuccessful).isTrue();
            assertThat(latest.migrate().migrationsExecuted).isZero();
            before.forEach((table,value)->assertThat(row(schema,table)).isEqualTo(value));
            for(String table:new String[]{"interviews","job_invitations"}) {
                assertThat(jdbcTemplate.queryForObject("select count(*) from "+schema+"."+table,Long.class)).isZero();
                assertThat(jdbcTemplate.queryForObject("select data_type from information_schema.columns where table_schema=? and table_name=? and column_name='id'",String.class,schema,table)).isEqualTo("bigint");
                for(String column:new String[]{"company_id","student_id","job_id","created_at","updated_at","status"})
                    assertThat(jdbcTemplate.queryForObject("select is_nullable from information_schema.columns where table_schema=? and table_name=? and column_name=?",String.class,schema,table,column)).isEqualTo("NO");
            }
        } finally {jdbcTemplate.execute("drop schema if exists "+schema+" cascade");}
    }
    private String row(String schema,String table) {
        return jdbcTemplate.queryForObject("select jsonb_agg(to_jsonb(r) order by id)::text from "+schema+"."+table+" r",String.class);
    }
    @Test void databaseConstraintsProtectStatusesReferencesBoundsAndPendingUniqueness() {
        var student=createStudent("student@schema.test");
        var company=createCompany("company@schema.test","Owner",com.tttn.jobrecommendation.common.enums.CompanyStatus.VERIFIED);
        var job=createJob(company,"Role",com.tttn.jobrecommendation.common.enums.JobStatus.ACTIVE);
        jdbcTemplate.update("insert into applications(id,student_id,job_id,status) values (100,?,?,'PENDING')",student.getId(),job.getId());
        Long id=jdbcTemplate.queryForObject("insert into interviews(application_id,company_id,student_id,job_id,title,scheduled_at,duration_minutes,meeting_type,location_or_link,status) values (100,?,?,?,'Interview',current_timestamp,60,'ONSITE','Room','SCHEDULED') returning id",Long.class,company.getId(),student.getId(),job.getId());
        for(String assignment:new String[]{"duration_minutes=0","duration_minutes=481","meeting_type='REMOTE'","status='INVALID'","title=' '","location_or_link=''","application_id=999999","company_id=999999","student_id=999999","job_id=999999"})
            assertThatThrownBy(()->jdbcTemplate.update("update interviews set "+assignment+" where id=?",id)).isInstanceOf(DataIntegrityViolationException.class);
        String invitation="insert into job_invitations(company_id,student_id,job_id,status) values (?,?,?,'PENDING')";
        jdbcTemplate.update(invitation,company.getId(),student.getId(),job.getId());
        assertThatThrownBy(()->jdbcTemplate.update(invitation,company.getId(),student.getId(),job.getId())).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(()->jdbcTemplate.update("update job_invitations set status='INVALID'")).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(()->jdbcTemplate.update(invitation,company.getId(),999999L,job.getId())).isInstanceOf(DataIntegrityViolationException.class);
        jdbcTemplate.update("update job_invitations set status='DECLINED'");
        jdbcTemplate.update(invitation,company.getId(),student.getId(),job.getId());
        assertThat(jdbcTemplate.queryForObject("select count(*) from job_invitations",Long.class)).isEqualTo(2);
        assertThat(jdbcTemplate.queryForList("select indexname from pg_indexes where schemaname=current_schema() and tablename in ('interviews','job_invitations')",String.class))
                .contains("uk_job_invitations_pending","idx_interviews_company_created","idx_interviews_student_created","idx_job_invitations_company_created","idx_job_invitations_student_created");
        assertThatThrownBy(()->jdbcTemplate.update("delete from applications where id=100")).isInstanceOf(DataIntegrityViolationException.class);
    }
}
