package com.tttn.jobrecommendation.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tttn.jobrecommendation.JobRecommendationApplication;
import com.tttn.jobrecommendation.common.enums.*;
import com.tttn.jobrecommendation.common.security.JwtTokenProvider;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.application.repository.JobApplicationRepository;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.company.repository.CompanyRepository;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.cv.repository.CvFileRepository;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.repository.StudentRepository;
import com.tttn.jobrecommendation.modules.user.entity.User;
import com.tttn.jobrecommendation.modules.user.repository.UserRepository;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;
import java.math.BigDecimal;
import java.nio.file.*;
import java.time.*;
import java.util.*;

/** Explicit isolated runtime: fresh PostgreSQL + real AI image + loopback transport faults. */
public class ReliabilityBrowserFixture {
    public static void main(String[] args) throws Exception {
        Path output = Path.of(args[0]).toAbsolutePath(), stop = Path.of(output + ".stop");
        Files.deleteIfExists(stop);
        String key = UUID.randomUUID().toString() + UUID.randomUUID();
        try (var postgres = new PostgreSQLContainer<>("postgres:17-alpine");
             var ai = new GenericContainer<>(DockerImageName.parse("student-job-recommendation-ai:local"))
                     .withEnv("AI_INTERNAL_API_KEY", key).withExposedPorts(8000)
                     .waitingFor(Wait.forHttp("/health").forPort(8000))) {
            postgres.start(); ai.start();
            try (var proxy = new ReliabilityFaultProxy("http://127.0.0.1:" + ai.getMappedPort(8000));
                 var context = new SpringApplicationBuilder(JobRecommendationApplication.class).profiles("integration")
                         .run("--spring.profiles.active=integration", "--server.port=0", "--server.address=127.0.0.1",
                                 "--spring.datasource.url=" + postgres.getJdbcUrl(),
                                 "--spring.datasource.username=" + postgres.getUsername(), "--spring.datasource.password=" + postgres.getPassword(),
                                 "--app.jwt.secret=" + UUID.randomUUID() + UUID.randomUUID(),
                                 "--app.ai-service.base-url=" + proxy.aiUrl(), "--app.ai-service.internal-api-key=" + key,
                                 "--logging.level.com.tttn.jobrecommendation.infrastructure.ai.client.RestAiServiceClient=DEBUG",
                                 "--spring.jpa.show-sql=false", "--logging.level.org.hibernate.SQL=WARN")) {
                proxy.backend = "http://127.0.0.1:" + ((ServletWebServerApplicationContext) context).getWebServer().getPort();
                var mapper = context.getBean(ObjectMapper.class);
                var users = context.getBean(UserRepository.class);
                var encoder = context.getBean(PasswordEncoder.class);
                var accounts = new LinkedHashMap<String, Object>();
                Company company = null; Student student = null;
                for (String alias : List.of("company", "otherCompany", "student", "otherStudent")) {
                    String password = UUID.randomUUID() + "A9!";
                    boolean isStudent = alias.toLowerCase(Locale.ROOT).contains("student");
                    User user = users.saveAndFlush(User.builder().email(alias.toLowerCase(Locale.ROOT) + "@isolated-reliability.invalid")
                            .fullName("Reliability " + alias).passwordHash(encoder.encode(password)).status(UserStatus.ACTIVE)
                            .role(isStudent ? UserRole.STUDENT : UserRole.COMPANY).build());
                    if (isStudent) {
                        var saved = context.getBean(StudentRepository.class).saveAndFlush(Student.builder().user(user).build());
                        context.getBean(com.tttn.jobrecommendation.modules.student.repository.StudentProfileRepository.class)
                                .saveAndFlush(com.tttn.jobrecommendation.modules.student.entity.StudentProfile.builder().student(saved).profileCompleteness(0).build());
                        if (alias.equals("student")) student = saved;
                    } else {
                        var saved = context.getBean(CompanyRepository.class).saveAndFlush(Company.builder().user(user)
                                .companyName("Reliability " + alias).status(CompanyStatus.VERIFIED).build());
                        if (alias.equals("company")) company = saved;
                    }
                    accounts.put(alias, Map.of("email", user.getEmail(), "password", password, "userId", user.getId(),
                            "expiredToken", new JwtTokenProvider(context.getEnvironment().getProperty("app.jwt.secret"), -1000).generateToken(user)));
                }
                String english = "java backend developer spring boot software engineer application development database sql git teamwork web services testing programming";
                CvFile cv = context.getBean(CvFileRepository.class).saveAndFlush(CvFile.builder().student(student)
                        .fileName("isolated-ready.pdf").originalFileName("isolated-ready.pdf").storedFileName("isolated-ready.pdf")
                        .filePath("isolated-ready.pdf").fileUrl("isolated-ready.pdf").contentType("application/pdf").fileSize(128L)
                        .active(true).analysisStatus(CvAnalysisStatus.READY).extractedText(english).processedText(english)
                        .extractedSkills(List.of("Java", "SQL", "Git")).languageCode("en").languageConfidence(new BigDecimal("0.99"))
                        .processingVersion("bilingual-nlp-v2-skills-v1").analyzedAt(LocalDateTime.now()).build());
                var jobs = new ArrayList<Job>();
                for (String language : List.of("en", "vi")) jobs.add(context.getBean(JobRepository.class).saveAndFlush(Job.builder()
                        .company(company).title(language.equals("en") ? "Reliability Java backend internship" : "Thực tập lập trình viên Java")
                        .description(language.equals("en") ? english + ". We are looking for a developer to build web applications with the team and develop database services."
                                : "Công ty tuyển thực tập sinh lập trình phần mềm, phát triển ứng dụng và quản lý cơ sở dữ liệu. Ứng viên có khả năng làm việc nhóm, lập trình Java, SQL và Git.")
                        .requirements(language.equals("en") ? "Experience in Java SQL and Git. Work with our software development team." : "Có kiến thức lập trình Java và cơ sở dữ liệu SQL.")
                        .jobType(JobType.INTERNSHIP).workingModel(WorkingModel.REMOTE).status(JobStatus.ACTIVE)
                        .deadline(LocalDate.of(2099, 12, 31)).publishedAt(LocalDateTime.now()).build()));
                for (var job : jobs) context.getBean(JobApplicationRepository.class).saveAndFlush(JobApplication.builder()
                        .student(student).job(job).cvFile(cv).status(ApplicationStatus.PENDING).build());
                JdbcTemplate db = context.getBean(JdbcTemplate.class);
                proxy.evidence = () -> {
                    try {
                        var value = new LinkedHashMap<String, Object>();
                        value.put("aiRequests", proxy.aiRequests.get()); value.put("publicGenerations", proxy.publicGenerations.get()); value.put("jwtLeaks", proxy.jwtLeaks.get());
                        value.put("heldRequests", proxy.heldRequests.get());
                        for (String table : List.of("recommendation_runs", "candidate_ranking_runs"))
                            value.put(table, db.queryForList("select id, status, error_message from " + table + " order by id"));
                        for (String table : List.of("recommendation_results", "candidate_ranking_results"))
                            value.put(table, db.queryForList("select id, run_id, md5(to_jsonb(r)::text) digest from " + table + " r order by id"));
                        value.put("cvs", db.queryForList("select id, md5(to_jsonb(c)::text) digest from cv_files c order by id"));
                        value.put("company", db.queryForList("select id, company_name, account_revision, status from companies order by id"));
                        value.put("preferences", db.queryForList("select user_id, revision, application_status_enabled, system_enabled from user_notification_settings order by user_id"));
                        return mapper.writeValueAsString(value);
                    } catch (Exception e) { throw new IllegalStateException("Cannot collect isolated evidence", e); }
                };
                mapper.writeValue(output.toFile(), Map.of("backendUrl", proxy.gatewayUrl(), "accounts", accounts,
                        "jobId", jobs.getFirst().getId(), "cvId", cv.getId(), "createdAt", Instant.now().toString()));
                System.out.println("Isolated reliability fixture READY (real AI + PostgreSQL; private credentials stay local).");
                long deadline = System.nanoTime() + Duration.ofMinutes(25).toNanos();
                while (!Files.exists(stop) && System.nanoTime() < deadline) Thread.sleep(500);
            }
        }
    }
}
