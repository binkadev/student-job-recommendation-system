package com.tttn.jobrecommendation.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tttn.jobrecommendation.common.enums.*;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import java.sql.Connection;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

class ApplicationMessagingApiIT extends AbstractPostgresWebIntegrationTest {
    @Autowired ObjectMapper mapper;
    private Student student, foreignStudent;
    private Company company, foreignCompany;
    private User admin;
    private Job job;
    private JobApplication application;

    @BeforeEach void fixtures() {
        student = createStudent("student@messaging.test");
        foreignStudent = createStudent("foreign@messaging.test");
        company = createCompany("owner@messaging.test", "Owner", CompanyStatus.VERIFIED);
        foreignCompany = createCompany("foreign-company@messaging.test", "Foreign", CompanyStatus.VERIFIED);
        admin = createUser("admin@messaging.test", UserRole.ADMIN);
        job = createJob(company, "Messaging role", JobStatus.ACTIVE);
        application = createApplication(student, job, createCv(student, "private.pdf", true), ApplicationStatus.PENDING);
    }

    private MvcResult request(MockHttpServletRequestBuilder builder, User user) throws Exception {
        if (user != null) builder.header("Authorization", bearerToken(user));
        return mockMvc.perform(builder).andReturn();
    }
    private MvcResult json(MockHttpServletRequestBuilder builder, User user, Object body) throws Exception {
        return request(builder.contentType("application/json").content(mapper.writeValueAsString(body)), user);
    }
    private JsonNode data(MvcResult result) throws Exception {
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        var body = mapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.path("success").asBoolean()).isTrue();
        return body.path("data");
    }
    private void error(MvcResult result, int code) throws Exception {
        assertThat(result.getResponse().getStatus()).isEqualTo(code);
        var body = mapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.path("success").asBoolean()).isFalse();
        assertThat(body.path("data").isNull()).isTrue();
        assertThat(result.getResponse().getContentAsString()).doesNotContain("passwordHash", "private.pdf", "filePath", "secret-content");
    }
    private MvcResult create(User user, long applicationId) throws Exception {
        return json(post("/api/conversations"), user, Map.of("applicationId", applicationId));
    }
    private long conversation() throws Exception {
        return data(create(student.getUser(), application.getId())).path("id").asLong();
    }
    private MvcResult send(User user, long id, String content) throws Exception {
        return json(post("/api/conversations/{id}/messages", id), user, Map.of("content", content));
    }
    private MvcResult history(User user, long id, String query) throws Exception {
        return request(get("/api/conversations/" + id + "/messages" + query), user);
    }
    private MvcResult read(User user, long id) throws Exception {
        return request(patch("/api/conversations/{id}/read", id), user);
    }

    @Test void participantsCreateAndReuseTheSamePersistedApplicationConversation() throws Exception {
        var first = data(create(student.getUser(), application.getId()));
        var second = data(create(company.getUser(), application.getId()));
        assertThat(second).isEqualTo(first);
        assertThat(first.path("applicationId").asLong()).isEqualTo(application.getId());
        assertThat(first.path("studentId").asLong()).isEqualTo(student.getId());
        assertThat(first.path("companyId").asLong()).isEqualTo(company.getId());
        assertThat(first.path("jobId").asLong()).isEqualTo(job.getId());
        assertThat(first.path("lastMessageAt").isNull()).isTrue();
        assertThat(jdbcTemplate.queryForObject("select count(*) from conversations", Long.class)).isEqualTo(1);
        assertThat(jobApplicationRepository.count()).isEqualTo(1);
    }

    @Test void differentApplicationsForTheSamePairHaveSeparateHistoriesIncludingReapplication() throws Exception {
        long old = conversation();
        data(send(student.getUser(), old, "old-history"));
        jdbcTemplate.update("update applications set status='REJECTED' where id=?", application.getId());
        var reapplied = createApplication(student, job, null, ApplicationStatus.PENDING);
        long newer = data(create(company.getUser(), reapplied.getId())).path("id").asLong();
        assertThat(newer).isNotEqualTo(old);
        data(send(company.getUser(), newer, "new-history"));
        assertThat(data(history(student.getUser(), old, "")).path("items").get(0).path("content").asText()).isEqualTo("old-history");
        assertThat(data(history(company.getUser(), newer, "")).path("items").get(0).path("content").asText()).isEqualTo("new-history");
        assertThat(data(request(get("/api/conversations"), student.getUser())).path("totalItems").asLong()).isEqualTo(2);
    }

    @Test void everyEndpointRequiresJwtAndForbidsAdminAndForeignParticipants() throws Exception {
        long id = conversation();
        data(send(student.getUser(), id, "secret-content"));
        for (User actor : Arrays.asList(null, admin, foreignStudent.getUser(), foreignCompany.getUser())) {
            int expected = actor == null ? 401 : 403;
            error(create(actor, application.getId()), expected);
            error(history(actor, id, ""), expected);
            error(send(actor, id, "forbidden"), expected);
            error(read(actor, id), expected);
            if (actor == null || actor == admin) error(request(get("/api/conversations"), actor), expected);
            else {
                var listing = data(request(get("/api/conversations?page=1&size=1"), actor));
                assertThat(listing.path("items")).isEmpty();
                assertThat(listing.path("totalItems").asLong()).isZero();
                assertThat(listing.path("totalPages").asInt()).isZero();
            }
        }
        assertThat(jdbcTemplate.queryForObject("select count(*) from messages", Long.class)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("select is_read from messages", Boolean.class)).isFalse();
    }

    @Test void missingResourcesReturn404WithoutPrivateDetails() throws Exception {
        error(create(student.getUser(), 999999), 404);
        error(history(student.getUser(), 999999, ""), 404);
        error(send(company.getUser(), 999999, "hello"), 404);
        error(read(student.getUser(), 999999), 404);
    }

    @Test void invalidBodiesAndForgedParticipantFieldsAreRejectedWithoutWrites() throws Exception {
        long id = conversation();
        for (Object body : List.of(Map.of(), Map.of("applicationId", 0), Map.of("applicationId", -1), Map.of("applicationId", "invalid")))
            error(json(post("/api/conversations"), student.getUser(), body), 400);
        for (String field : List.of("senderUserId", "senderRole", "companyId", "studentId")) {
            error(json(post("/api/conversations"), student.getUser(), Map.of("applicationId", application.getId(), field, 999)), 400);
            error(json(post("/api/conversations/{id}/messages", id), company.getUser(), Map.of("content", "spoof", field, 999)), 400);
        }
        for (Object body : List.of(Map.of(), Map.of("content", ""), Map.of("content", " \t\n"), Map.of("content", "x".repeat(5001)), Map.of("content", "invalid" + (char) 0), Map.of("content", List.of("invalid"))))
            error(json(post("/api/conversations/{id}/messages", id), student.getUser(), body), 400);
        error(request(post("/api/conversations/{id}/messages", id).contentType("application/json").content("{broken"), student.getUser()), 400);
        error(request(post("/api/conversations/{id}/messages", id).contentType("application/json").content("{\"content\":null}"), student.getUser()), 400);
        assertThat(jdbcTemplate.queryForObject("select count(*) from messages", Long.class)).isZero();
        assertThat(jdbcTemplate.queryForObject("select last_message_at from conversations where id=?", java.sql.Timestamp.class, id)).isNull();
        var saved = data(send(student.getUser(), id, "x".repeat(5000)));
        assertThat(saved.path("content").asText()).hasSize(5000);
        assertThat(saved.path("senderUserId").asLong()).isEqualTo(student.getUser().getId());
        assertThat(saved.path("senderRole").asText()).isEqualTo("STUDENT");
    }

    @Test void unicodeContentUsesTheDocumentedUtf16LimitAndPrivateRecordsDoNotLogBodies() throws Exception {
        long id = conversation();
        String symbol = new String(Character.toChars(0x1F600));
        String content = symbol.repeat(2500);
        assertThat(data(send(company.getUser(), id, content)).path("content").asText()).isEqualTo(content);
        error(send(company.getUser(), id, content + "x"), 400);
        var request = new com.tttn.jobrecommendation.modules.message.dto.request.SendMessageRequest("secret-content");
        assertThat(request.toString()).doesNotContain("secret-content");
        var response = new com.tttn.jobrecommendation.modules.message.dto.response.MessageResponse(1L, id,
                company.getUser().getId(), UserRole.COMPANY, "secret-content", false, java.time.LocalDateTime.now());
        assertThat(response.toString()).doesNotContain("secret-content");
    }

    @Test void bothParticipantsReadChronologicalDatabasePagesWithStableTieBreakingAndNoReadSideEffect() throws Exception {
        long id = conversation();
        var a = data(send(company.getUser(), id, "first"));
        var b = data(send(student.getUser(), id, "second"));
        var c = data(send(company.getUser(), id, "third"));
        jdbcTemplate.update("update messages set created_at='2026-01-01 10:00:00' where conversation_id=?", id);
        for (User actor : List.of(student.getUser(), company.getUser())) {
            var page = data(history(actor, id, "?page=1&size=2"));
            assertThat(page.path("totalItems").asInt()).isEqualTo(3);
            assertThat(page.path("totalPages").asInt()).isEqualTo(2);
            assertThat(page.path("items").get(0).path("id")).isEqualTo(a.path("id"));
            assertThat(page.path("items").get(1).path("id")).isEqualTo(b.path("id"));
            assertThat(page.path("page").asInt()).isEqualTo(1);
            var next = data(history(actor, id, "?page=2&size=2"));
            assertThat(next.path("items")).hasSize(1);
            assertThat(next.path("items").get(0).path("id")).isEqualTo(c.path("id"));
            assertThat(data(history(actor, id, "?page=9&size=2")).path("items")).isEmpty();
        }
        assertThat(jdbcTemplate.queryForObject("select count(*) from messages where is_read", Long.class)).isZero();
        String serialized = history(student.getUser(), id, "").getResponse().getContentAsString();
        assertThat(serialized).doesNotContain("passwordHash", "filePath", "cvFile", "email", "private.pdf", "storedFileName");
    }

    @Test void paginationRejectsOutOfBoundsAndConversationCountsAreOwnerScopedAndOrdered() throws Exception {
        long first = conversation();
        long second = data(create(company.getUser(), createApplication(student,
                createJob(company, "Second", JobStatus.ACTIVE), null, ApplicationStatus.PENDING).getId())).path("id").asLong();
        var foreignJob = createJob(foreignCompany, "Foreign", JobStatus.ACTIVE);
        data(create(foreignStudent.getUser(), createApplication(foreignStudent, foreignJob, null, ApplicationStatus.PENDING).getId()));
        jdbcTemplate.update("update conversations set created_at='2026-01-01' where id in (?,?)", first, second);
        for (User actor : List.of(student.getUser(), company.getUser())) {
            var listing = data(request(get("/api/conversations?page=1&size=1"), actor));
            assertThat(listing.path("totalItems").asInt()).isEqualTo(2);
            assertThat(listing.path("totalPages").asInt()).isEqualTo(2);
            assertThat(listing.path("items").get(0).path("id").asLong()).isEqualTo(second);
            assertThat(data(request(get("/api/conversations?page=2&size=1"), actor)).path("items").get(0).path("id").asLong()).isEqualTo(first);
            for (String query : List.of("?page=0", "?page=-1", "?size=0", "?size=101", "?size=-1", "?page=invalid")) {
                error(request(get("/api/conversations" + query), actor), 400);
                error(history(actor, first, query), 400);
            }
            assertThat(data(history(actor, first, "?size=100")).path("size").asInt()).isEqualTo(100);
        }
        data(send(student.getUser(), first, "latest activity"));
        assertThat(data(request(get("/api/conversations?size=1"), student.getUser())).path("items").get(0).path("id").asLong()).isEqualTo(first);
    }

    @Test void markReadAffectsOnlyIncomingMessagesInTheSelectedConversationAndIsIdempotent() throws Exception {
        long id = conversation();
        long other = data(create(student.getUser(), createApplication(student,
                createJob(company, "Other", JobStatus.ACTIVE), null, ApplicationStatus.PENDING).getId())).path("id").asLong();
        long incoming = data(send(company.getUser(), id, "incoming")).path("id").asLong();
        long outbound = data(send(student.getUser(), id, "outbound")).path("id").asLong();
        data(send(company.getUser(), other, "other-conversation"));
        var result = data(read(student.getUser(), id));
        assertThat(result.path("conversationId").asLong()).isEqualTo(id);
        assertThat(result.path("markedCount").asInt()).isEqualTo(1);
        assertThat(data(read(student.getUser(), id)).path("markedCount").asInt()).isZero();
        assertThat(jdbcTemplate.queryForObject("select is_read from messages where id=?", Boolean.class, incoming)).isTrue();
        assertThat(jdbcTemplate.queryForObject("select is_read from messages where id=?", Boolean.class, outbound)).isFalse();
        assertThat(jdbcTemplate.queryForObject("select count(*) from messages where conversation_id=? and is_read", Long.class, other)).isZero();
        assertThat(data(read(company.getUser(), id)).path("markedCount").asInt()).isEqualTo(1);
        data(send(company.getUser(), id, "arrived after read"));
        assertThat(jdbcTemplate.queryForObject("select count(*) from messages where conversation_id=? and not is_read", Long.class, id)).isEqualTo(1);
        assertThat(data(read(student.getUser(), id)).path("markedCount").asInt()).isEqualTo(1);
    }

    @Test void everyApplicationStatusRetainsAccessWithoutMutatingAnyOtherBusinessData() throws Exception {
        jdbcTemplate.update("insert into interviews(application_id,company_id,student_id,job_id,title,scheduled_at,duration_minutes,meeting_type,location_or_link,status) values (?,?,?,?,'Private interview',current_timestamp,60,'ONSITE','Room','SCHEDULED')",
                application.getId(), company.getId(), student.getId(), job.getId());
        jdbcTemplate.update("insert into job_invitations(company_id,student_id,job_id,status) values (?,?,?,'PENDING')", company.getId(), student.getId(), job.getId());
        for (ApplicationStatus state : ApplicationStatus.values()) {
            jdbcTemplate.update("update applications set status=? where id=?", state.name(), application.getId());
            var snapshot = businessRows();
            long id = data(create(company.getUser(), application.getId())).path("id").asLong();
            data(send(student.getUser(), id, "history " + state));
            data(send(company.getUser(), id, "reply"));
            data(history(student.getUser(), id, ""));
            data(read(student.getUser(), id));
            assertThat(businessRows()).isEqualTo(snapshot);
        }
        jdbcTemplate.update("update companies set status='BLOCKED' where id=?", company.getId());
        jdbcTemplate.update("update jobs set status='CLOSED' where id=?", job.getId());
        var snapshot = businessRows();
        long id = conversation();
        data(send(company.getUser(), id, "private history remains available"));
        data(history(student.getUser(), id, ""));
        assertThat(businessRows()).isEqualTo(snapshot);
    }

    private Map<String, String> businessRows() {
        var result = new LinkedHashMap<String, String>();
        for (String table : List.of("users", "students", "companies", "jobs", "applications", "cv_files", "interviews", "job_invitations", "notifications"))
            result.put(table, jdbcTemplate.queryForObject("select coalesce(jsonb_agg(to_jsonb(r) order by id)::text,'[]') from " + table + " r", String.class));
        return result;
    }

    @Test void inconsistentStoredParticipantTupleFailsClosedAndCannotLeakThroughListCounts() throws Exception {
        long id = conversation();
        jdbcTemplate.update("update conversations set student_id=? where id=?", foreignStudent.getId(), id);
        for (User actor : List.of(student.getUser(), foreignStudent.getUser(), company.getUser())) {
            error(history(actor, id, ""), 403);
            error(send(actor, id, "secret-content"), 403);
            error(read(actor, id), 403);
            assertThat(data(request(get("/api/conversations"), actor)).path("totalItems").asInt()).isZero();
        }
        error(create(company.getUser(), application.getId()), 403);
        assertThat(jdbcTemplate.queryForObject("select count(*) from messages", Long.class)).isZero();
    }

    @Test void concurrentCreatorsSerializeAndReturnOneConversation() throws Exception {
        var results = race("applications", application.getId(), () -> create(student.getUser(), application.getId()),
                () -> create(company.getUser(), application.getId()));
        assertThat(data(results.get(0))).isEqualTo(data(results.get(1)));
        assertThat(jdbcTemplate.queryForObject("select count(*) from conversations", Long.class)).isEqualTo(1);
    }

    @Test void concurrentSendsSerializeAndMetadataMatchesTheLastPersistedMessage() throws Exception {
        long id = conversation();
        var results = race("conversations", id, () -> send(student.getUser(), id, "student concurrent"),
                () -> send(company.getUser(), id, "company concurrent"));
        for (var result : results) assertThat(data(result).path("isRead").asBoolean()).isFalse();
        assertThat(jdbcTemplate.queryForObject("select count(*) from messages where conversation_id=?", Long.class, id)).isEqualTo(2);
        assertThat(jdbcTemplate.queryForObject("select last_message_at = (select max(created_at) from messages where conversation_id=?) from conversations where id=?", Boolean.class, id, id)).isTrue();
        var history = data(history(student.getUser(), id, "")).path("items");
        assertThat(history.get(0).path("createdAt").asText()).isLessThanOrEqualTo(history.get(1).path("createdAt").asText());
        assertThat(history.get(0).path("id").asLong()).isLessThan(history.get(1).path("id").asLong());
    }

    @Test void metadataDoesNotRegressWhenTheServerClockIsBehindTheLastPersistedTimestamp() throws Exception {
        long id = conversation();
        jdbcTemplate.update("update conversations set last_message_at='2099-01-01' where id=?", id);
        data(send(company.getUser(), id, "clock rollback"));
        assertThat(jdbcTemplate.queryForObject("select last_message_at = (select max(created_at) from messages where conversation_id=?) from conversations where id=?", Boolean.class, id, id)).isTrue();
        assertThat(jdbcTemplate.queryForObject("select extract(year from last_message_at)::int from conversations where id=?", Integer.class, id)).isEqualTo(2099);
    }

    @Test void concurrentReadAndSendAreLinearizedWithoutReadingOwnOutboundMessages() throws Exception {
        long id = conversation();
        data(send(student.getUser(), id, "own outbound"));
        var results = race("conversations", id, () -> send(company.getUser(), id, "incoming concurrently"),
                () -> read(student.getUser(), id));
        data(results.get(0));
        int marked = data(results.get(1)).path("markedCount").asInt();
        assertThat(marked).isBetween(0, 1);
        assertThat(jdbcTemplate.queryForObject("select count(*) from messages where conversation_id=? and is_read", Long.class, id)).isEqualTo((long) marked);
        assertThat(jdbcTemplate.queryForObject("select is_read from messages where conversation_id=? and sender_role='STUDENT'", Boolean.class, id)).isFalse();
        assertThat(data(read(student.getUser(), id)).path("markedCount").asInt()).isEqualTo(1 - marked);
    }

    private List<MvcResult> race(String table, long id, Callable<MvcResult> first, Callable<MvcResult> second) throws Exception {
        // This is the isolated Testcontainers datasource, not any configured/manual PostgreSQL.
        try (var pool = Executors.newFixedThreadPool(2); var blocker = jdbcTemplate.getDataSource().getConnection()) {
            blocker.setAutoCommit(false);
            try {
                try (var lock = blocker.prepareStatement("select id from " + table + " where id=? for update")) {
                    lock.setLong(1, id);
                    try (var rows = lock.executeQuery()) { assertThat(rows.next()).isTrue(); }
                }
                var a = pool.submit(first);
                var b = pool.submit(second);
                await().atMost(Duration.ofSeconds(15)).untilAsserted(() -> assertThat(waiting(blocker, table)).isEqualTo(2));
                blocker.commit();
                return List.of(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS));
            } finally { blocker.rollback(); }
        }
    }
    private long waiting(Connection connection, String table) throws Exception {
        try (var clear = connection.createStatement()) { clear.execute("select pg_stat_clear_snapshot()"); }
        try (var query = connection.prepareStatement("select count(*) from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query ilike ?")) {
            query.setString(1, "%" + table + "%");
            try (var rows = query.executeQuery()) { rows.next(); return rows.getLong(1); }
        }
    }
}
