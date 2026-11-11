package com.tttn.jobrecommendation.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tttn.jobrecommendation.JobRecommendationApplication;
import com.tttn.jobrecommendation.common.enums.*;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.application.repository.JobApplicationRepository;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.company.repository.CompanyRepository;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.cv.repository.CvFileRepository;
import com.tttn.jobrecommendation.modules.interview.entity.Interview;
import com.tttn.jobrecommendation.modules.interview.repository.InterviewRepository;
import com.tttn.jobrecommendation.modules.invitation.entity.JobInvitation;
import com.tttn.jobrecommendation.modules.invitation.repository.JobInvitationRepository;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.repository.StudentRepository;
import com.tttn.jobrecommendation.modules.user.entity.User;
import com.tttn.jobrecommendation.modules.user.repository.UserRepository;
import jakarta.persistence.EntityManagerFactory;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.testcontainers.containers.PostgreSQLContainer;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Connection;
import java.time.*;
import java.util.*;
import java.util.stream.IntStream;

/** Disposable test process. Control is file-only, never a production/HTTP bypass. */
public class ApplicationMessagingBrowserFixture {
    public static void main(String[] args) throws Exception {
        Path output = Path.of(args[0]).toAbsolutePath(), local = output.getParent(), stop = Path.of(output + ".stop");
        Path temporary = Files.createTempDirectory("sjrs-messaging-e2e-").toRealPath();
        var mapper = new ObjectMapper();
        Files.deleteIfExists(stop);
        try (var postgres = new PostgreSQLContainer<>("postgres:17-alpine")) {
            postgres.start();
            mapper.writeValue(local.resolve("ownership.json").toFile(), Map.of("containerId", postgres.getContainerId(), "temporaryRoot", temporary.toString()));
            try (var context = new SpringApplicationBuilder(JobRecommendationApplication.class).profiles("integration").run(
                    "--spring.profiles.active=integration", "--server.address=127.0.0.1", "--server.port=0",
                    "--spring.datasource.url=" + postgres.getJdbcUrl(), "--spring.datasource.username=" + postgres.getUsername(),
                    "--spring.datasource.password=" + postgres.getPassword(), "--app.jwt.secret=" + UUID.randomUUID() + UUID.randomUUID(),
                    "--app.upload.cv.storage-dir=" + temporary.resolve("cvs"),
                    "--app.upload.company-verification.storage-dir=" + temporary.resolve("private-documents"),
                    "--spring.jpa.show-sql=false", "--logging.level.org.springframework=INFO",
                    "--logging.level.org.springframework.web=INFO", "--logging.level.org.springframework.jdbc.core=INFO",
                    "--logging.level.com.tttn.jobrecommendation=INFO", "--logging.level.org.hibernate.SQL=INFO")) {
                var users = context.getBean(UserRepository.class); var companies = context.getBean(CompanyRepository.class);
                var students = context.getBean(StudentRepository.class); var jobs = context.getBean(JobRepository.class);
                var applications = context.getBean(JobApplicationRepository.class); var jdbc = context.getBean(JdbcTemplate.class);
                var encoder = context.getBean(PasswordEncoder.class); var flyway = context.getBean(Flyway.class);
                var json = context.getBean(ObjectMapper.class);
                if (!Arrays.equals(context.getEnvironment().getActiveProfiles(), new String[]{"integration"})
                        || users.count() != 0 || companies.count() != 0 || students.count() != 0 || jobs.count() != 0)
                    throw new IllegalStateException("Fresh integration-only database required");
                var versions = Arrays.stream(flyway.info().applied()).filter(MigrationInfo::isVersioned).map(m -> m.getVersion().getVersion()).toList();
                if (!versions.equals(IntStream.rangeClosed(1, 25).mapToObj(Integer::toString).toList())
                        || !"25".equals(flyway.info().current().getVersion().getVersion()) || !flyway.validateWithResult().validationSuccessful
                        || flyway.info().pending().length != 0) throw new IllegalStateException("Exact V1-V25/checksum validation required");
                if (!context.getBean(EntityManagerFactory.class).isOpen() || !"validate".equals(context.getEnvironment().getProperty("spring.jpa.hibernate.ddl-auto")))
                    throw new IllegalStateException("Hibernate validation required");
                var accounts = new LinkedHashMap<String, Object>(); var people = new HashMap<String, User>();
                for (String alias : new String[]{"company", "otherCompany", "student", "otherStudent", "admin"}) {
                    UserRole role = alias.equals("admin") ? UserRole.ADMIN : alias.toLowerCase(Locale.ROOT).contains("company") ? UserRole.COMPANY : UserRole.STUDENT;
                    String password = UUID.randomUUID() + "Aa9!";
                    var user = users.saveAndFlush(User.builder().email(alias.toLowerCase(Locale.ROOT) + "@isolated-w3c2c.invalid")
                            .fullName("Isolated " + alias).passwordHash(encoder.encode(password)).role(role).status(UserStatus.ACTIVE).build());
                    people.put(alias, user); accounts.put(alias, Map.of("email", user.getEmail(), "password", password, "userId", user.getId()));
                }
                var owner = companies.saveAndFlush(Company.builder().user(people.get("company")).companyName("Messaging Owner").status(CompanyStatus.VERIFIED).build());
                var other = companies.saveAndFlush(Company.builder().user(people.get("otherCompany")).companyName("Messaging Other").status(CompanyStatus.VERIFIED).build());
                var student = students.saveAndFlush(Student.builder().user(people.get("student")).studentCode("MSG-A").build());
                var foreign = students.saveAndFlush(Student.builder().user(people.get("otherStudent")).studentCode("MSG-B").build());
                var ids = new LinkedHashMap<String, Long>();
                ids.put("company", owner.getId()); ids.put("otherCompany", other.getId()); ids.put("student", student.getId()); ids.put("otherStudent", foreign.getId());
                Files.createDirectories(temporary.resolve("cvs")); Files.createDirectories(temporary.resolve("private-documents"));
                Path cvPath = Files.writeString(temporary.resolve("cvs/synthetic.pdf"), "%PDF-1.4\nSynthetic isolated document\n%%EOF");
                var cv = context.getBean(CvFileRepository.class).saveAndFlush(CvFile.builder().student(student).fileName("synthetic.pdf")
                        .originalFileName("synthetic.pdf").storedFileName("synthetic.pdf").fileUrl("private-cv-reference")
                        .filePath(cvPath.toString()).fileSize(Files.size(cvPath)).contentType("application/pdf").active(true).build());
                var job = job(jobs, owner, "Messaging active source");
                var main = applications.saveAndFlush(JobApplication.builder().student(student).job(job).cvFile(cv).status(ApplicationStatus.REVIEWED).build());
                var withdrawnJob = job(jobs, owner, "Messaging withdrawn history");
                var withdrawn = applications.saveAndFlush(JobApplication.builder().student(student).job(withdrawnJob).cvFile(cv).status(ApplicationStatus.WITHDRAWN).build());
                var foreignJob = job(jobs, other, "Foreign messaging source");
                var foreignApp = applications.saveAndFlush(JobApplication.builder().student(foreign).job(foreignJob).status(ApplicationStatus.REVIEWED).build());
                ids.put("application", main.getId()); ids.put("withdrawnApplication", withdrawn.getId()); ids.put("foreignApplication", foreignApp.getId()); ids.put("job", job.getId());
                // Each Application has its own Job: no lifetime/partial uniqueness or reapplication rule is bypassed.
                var past = LocalDateTime.now().minusDays(2).withNano(0);
                for (int i = 0; i < 105; i++) {
                    var historicJob = job(jobs, owner, "Synthetic historical role " + i);
                    var app = applications.saveAndFlush(JobApplication.builder().student(student).job(historicJob).cvFile(cv).status(ApplicationStatus.REJECTED).build());
                    long conversation = jdbc.queryForObject("insert into conversations(application_id,company_id,student_id,created_at,updated_at) values (?,?,?,?,?) returning id",
                            Long.class, app.getId(), owner.getId(), student.getId(), past.plusSeconds(i == 0 ? -100 : 100 + i), past.plusSeconds(200 + i));
                    if (i == 0) {
                        ids.put("deepConversation", conversation); ids.put("rejectedApplication", app.getId());
                        for (int n = 0; n < 25; n++) {
                            boolean outgoing = n % 2 == 0;
                            jdbc.update("insert into messages(conversation_id,sender_user_id,sender_role,content,created_at) values (?,?,?,?,?)",
                                    conversation, people.get(outgoing ? "student" : "company").getId(), outgoing ? "STUDENT" : "COMPANY", UUID.randomUUID().toString(), past);
                        }
                        jdbc.update("update conversations set last_message_at=? where id=?", past, conversation);
                    }
                }
                long foreignConversation = jdbc.queryForObject("insert into conversations(application_id,company_id,student_id) values (?,?,?) returning id", Long.class, foreignApp.getId(), other.getId(), foreign.getId());
                jdbc.update("insert into messages(conversation_id,sender_user_id,sender_role,content,created_at) values (?,?, 'COMPANY',?,?)", foreignConversation, people.get("otherCompany").getId(), UUID.randomUUID().toString(), past);
                jdbc.update("update conversations set last_message_at=? where id=?", past, foreignConversation); ids.put("foreignConversation", foreignConversation);
                // Nonempty protected rows make preservation checks meaningful, without exercising unrelated workflows.
                context.getBean(InterviewRepository.class).saveAndFlush(Interview.builder().application(main).company(owner).student(student).job(job)
                        .title("Synthetic preserved interview").scheduledAt(LocalDateTime.now().plusDays(2)).durationMinutes(60).meetingType(MeetingType.ONSITE)
                        .locationOrLink("Synthetic room").status(InterviewStatus.SCHEDULED).build());
                context.getBean(JobInvitationRepository.class).saveAndFlush(JobInvitation.builder().company(owner).student(student).job(withdrawnJob).status(InvitationStatus.DECLINED).build());
                // Initial fixture timeline only, before taking the baseline. No row is reset during browser cases.
                jdbc.update("update users set created_at=current_timestamp-interval '90 days',updated_at=current_timestamp-interval '90 days'");
                jdbc.update("update students set created_at=current_timestamp-interval '80 days',updated_at=current_timestamp-interval '80 days'");
                jdbc.update("update companies set created_at=current_timestamp-interval '80 days',updated_at=current_timestamp-interval '80 days'");
                jdbc.update("update jobs set created_at=current_timestamp-interval '70 days',updated_at=current_timestamp-interval '70 days',published_at=current_timestamp-interval '69 days'");
                jdbc.update("update cv_files set uploaded_at=current_timestamp-interval '60 days',created_at=current_timestamp-interval '60 days',updated_at=current_timestamp-interval '60 days'");
                jdbc.update("update applications set applied_at=current_timestamp-interval '30 days',created_at=current_timestamp-interval '30 days',reviewed_at=case when status='WITHDRAWN' then null else current_timestamp-interval '29 days' end,updated_at=current_timestamp-interval '29 days'");
                var metadata = new LinkedHashMap<String, Object>();
                metadata.put("backendUrl", "http://127.0.0.1:" + ((ServletWebServerApplicationContext) context).getWebServer().getPort());
                metadata.put("accounts", accounts); metadata.put("ids", ids); metadata.put("serverZone", ZoneId.systemDefault().getId());
                metadata.put("temporaryRoot", temporary.toString()); metadata.put("containerId", postgres.getContainerId()); metadata.put("activeProfiles", Arrays.asList(context.getEnvironment().getActiveProfiles()));
                metadata.put("initialDatabase", snapshot(jdbc, flyway)); metadata.put("hibernateSchemaValidation", true);
                write(json, local.resolve("fixture.tmp"), output, metadata);
                System.out.println("Isolated messaging fixture READY.");
                Connection held = null; long lockDeadline = 0, deadline = System.nanoTime() + Duration.ofMinutes(20).toNanos();
                try {
                    while (!Files.exists(stop) && System.nanoTime() < deadline) {
                        if (held != null && System.nanoTime() > lockDeadline) { held.rollback(); held.close(); held = null; }
                        Path command = local.resolve("control.json");
                        if (Files.exists(command)) {
                            var input = json.readTree(command.toFile()); Files.delete(command);
                            String id = UUID.fromString(input.path("id").asText()).toString(), action = input.path("action").asText();
                            Map<String, Object> reply;
                            switch (action) {
                                case "snapshot" -> { if (held != null) throw new IllegalStateException("Release lock before snapshot"); reply = snapshot(jdbc, flyway); }
                                case "hold" -> {
                                    if (held != null) throw new IllegalStateException("Lock already held");
                                    held = java.sql.DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()); held.setAutoCommit(false);
                                    try (var sql = held.createStatement()) { sql.setQueryTimeout(5); sql.execute("lock table messages in access exclusive mode"); }
                                    lockDeadline = System.nanoTime() + Duration.ofSeconds(30).toNanos(); reply = Map.of("held", true);
                                }
                                case "waiters" -> {
                                    if (held == null) throw new IllegalStateException("No lock held");
                                    try (var sql = held.createStatement()) {
                                        sql.execute("select pg_stat_clear_snapshot()");
                                        try (var rows = sql.executeQuery("select count(*) from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query ilike '%messages%'")) {
                                            rows.next(); reply = Map.of("waiting", rows.getLong(1));
                                        }
                                    }
                                }
                                case "release" -> { if (held != null) { held.rollback(); held.close(); held = null; } reply = Map.of("released", true); }
                                default -> throw new IllegalArgumentException("Unsupported test control");
                            }
                            write(json, local.resolve("reply-" + id + ".tmp"), local.resolve("reply-" + id + ".json"), reply);
                        }
                        Thread.sleep(100);
                    }
                } finally { if (held != null) { held.rollback(); held.close(); } }
            }
        } finally {
            try (var paths = Files.walk(temporary)) { for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path); }
        }
    }
    private static Job job(JobRepository jobs, Company company, String title) {
        return jobs.saveAndFlush(Job.builder().company(company).title(title).description("Synthetic isolated role")
                .jobType(JobType.INTERNSHIP).workingModel(WorkingModel.REMOTE).status(JobStatus.ACTIVE).deadline(LocalDate.now().plusMonths(2)).build());
    }
    private static void write(ObjectMapper mapper, Path staging, Path destination, Object data) throws Exception {
        mapper.writeValue(staging.toFile(), data); Files.move(staging, destination, StandardCopyOption.ATOMIC_MOVE);
    }
    private static String digest(JdbcTemplate jdbc, String table) throws Exception {
        String rows = jdbc.queryForObject("select coalesce(jsonb_agg(to_jsonb(r) order by id)::text,'[]') from " + table + " r", String.class);
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(rows.getBytes(StandardCharsets.UTF_8)));
    }
    private static Map<String, Object> snapshot(JdbcTemplate jdbc, Flyway flyway) throws Exception {
        var result = new LinkedHashMap<String, Object>();
        result.put("migrationVersions", jdbc.queryForList("select version from flyway_schema_history where success and version is not null order by installed_rank", String.class));
        result.put("migrationChecksums", jdbc.queryForList("select version,checksum from flyway_schema_history where success and version is not null order by installed_rank"));
        result.put("flywayValidated", flyway.validateWithResult().validationSuccessful);
        result.put("postgresMajor", jdbc.queryForObject("select current_setting('server_version_num')::int/10000", Integer.class));
        var business = new LinkedHashMap<String, Object>();
        for (String table : new String[]{"applications", "jobs", "cv_files", "interviews", "job_invitations"})
            business.put(table, Map.of("count", jdbc.queryForObject("select count(*) from " + table, Long.class), "sha256", digest(jdbc, table)));
        result.put("business", business);
        result.put("conversationCount", jdbc.queryForObject("select count(*) from conversations", Long.class));
        result.put("messageCount", jdbc.queryForObject("select count(*) from messages", Long.class));
        result.put("conversations", jdbc.queryForList("select id,application_id,company_id,student_id,last_message_at::text,created_at::text from conversations order by id"));
        result.put("messages", jdbc.queryForList("select id,conversation_id,sender_user_id,sender_role,content,is_read,created_at::text from messages order by created_at,id"));
        result.put("tupleMismatchCount", jdbc.queryForObject("select count(*) from conversations c join applications a on a.id=c.application_id join jobs j on j.id=a.job_id where c.student_id<>a.student_id or c.company_id<>j.company_id", Long.class));
        result.put("senderMismatchCount", jdbc.queryForObject("select count(*) from messages m join conversations c on c.id=m.conversation_id join students s on s.id=c.student_id join companies co on co.id=c.company_id where (m.sender_role='STUDENT' and m.sender_user_id<>s.user_id) or (m.sender_role='COMPANY' and m.sender_user_id<>co.user_id)", Long.class));
        result.put("lastMessageMismatchCount", jdbc.queryForObject("select count(*) from conversations c left join (select conversation_id,max(created_at) as latest from messages group by conversation_id) m on m.conversation_id=c.id where c.last_message_at is distinct from m.latest", Long.class));
        return result;
    }
}
