package com.tttn.jobrecommendation.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tttn.jobrecommendation.JobRecommendationApplication;
import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.CvAnalysisStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.JobType;
import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.common.enums.UserStatus;
import com.tttn.jobrecommendation.common.enums.WorkingModel;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.testcontainers.containers.PostgreSQLContainer;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Explicit local browser fixture, not a JUnit test or a production seeder.
 * Always creates its own disposable PostgreSQL Testcontainer, so it can never target the demo database.
 * Seeds one Admin, two verified Companies, one pending Company, two Students (one with a READY CV),
 * an ACTIVE Job and a PENDING_APPROVAL Job. Notifications are NOT seeded: the browser run triggers the real events.
 */
public class AutomaticNotificationsBrowserFixture {
    public static void main(String[] args) throws Exception {
        Path output = Path.of(args[0]).toAbsolutePath();
        Path stop = Path.of(output + ".stop");
        Files.deleteIfExists(stop);
        try (var postgres = new PostgreSQLContainer<>("postgres:17-alpine")) {
            postgres.start();
            try (var context = new SpringApplicationBuilder(JobRecommendationApplication.class)
                    .profiles("integration").run("--server.port=0", "--server.address=127.0.0.1",
                            "--spring.datasource.url=" + postgres.getJdbcUrl(),
                            "--spring.datasource.username=" + postgres.getUsername(),
                            "--spring.datasource.password=" + postgres.getPassword(),
                            "--app.jwt.secret=" + UUID.randomUUID() + UUID.randomUUID(),
                            "--spring.jpa.show-sql=false",
                            "--app.ai-service.internal-api-key=change-this-local-ai-internal-api-key-at-least-32-characters")) {
                var users = context.getBean(UserRepository.class);
                var companies = context.getBean(CompanyRepository.class);
                var students = context.getBean(StudentRepository.class);
                var jobs = context.getBean(JobRepository.class);
                var cvs = context.getBean(CvFileRepository.class);
                var encoder = context.getBean(PasswordEncoder.class);
                var accounts = new LinkedHashMap<String, Object>();
                var entities = new LinkedHashMap<String, Object>();
                Company owner = null;
                for (String alias : new String[]{"admin", "company", "otherCompany", "pendingCompany", "student", "otherStudent"}) {
                    String password = UUID.randomUUID() + "A9!";
                    UserRole role = alias.equals("admin") ? UserRole.ADMIN
                            : alias.startsWith("student") || alias.startsWith("otherStudent") ? UserRole.STUDENT : UserRole.COMPANY;
                    User user = users.saveAndFlush(User.builder().email(alias.toLowerCase(java.util.Locale.ROOT) + "@isolated-w1c.invalid")
                            .passwordHash(encoder.encode(password)).fullName("Isolated " + alias).role(role)
                            .status(UserStatus.ACTIVE).build());
                    Company company = null;
                    Student student = null;
                    if (role == UserRole.COMPANY) {
                        company = companies.saveAndFlush(Company.builder().user(user).companyName("Isolated " + alias)
                                .status(alias.equals("pendingCompany") ? CompanyStatus.PENDING : CompanyStatus.VERIFIED).build());
                        entities.put(alias + "CompanyId", company.getId());
                        if (alias.equals("company")) owner = company;
                    } else if (role == UserRole.STUDENT) {
                        student = students.saveAndFlush(Student.builder().user(user).studentCode("W1C-" + user.getId()).build());
                        if (alias.equals("student")) {
                            CvFile cv = cvs.saveAndFlush(CvFile.builder().student(student).fileName("w1c.pdf").originalFileName("w1c.pdf")
                                    .storedFileName("w1c.pdf").fileUrl("uploads/cvs/w1c.pdf").filePath("uploads/cvs/w1c.pdf")
                                    .contentType("application/pdf").fileSize(128L).active(true).build());
                            cv.setExtractedText("Java Spring Boot backend engineer with PostgreSQL experience");
                            cv.setProcessedText("java spring boot backend engineer postgresql experience");
                            cv.setExtractedSkills(List.of("java"));
                            cv.setAnalysisStatus(CvAnalysisStatus.READY);
                            cv.setLanguageCode("en");
                            cv.setLanguageConfidence(new BigDecimal("0.99"));
                            cv.setProcessingVersion("bilingual-nlp-v2-skills-v1");
                            entities.put("cvId", cvs.saveAndFlush(cv).getId());
                        }
                    }
                    accounts.put(alias, Map.of("email", user.getEmail(), "password", password, "userId", user.getId()));
                }
                Job active = jobs.saveAndFlush(Job.builder().company(owner).title("Isolated Java Backend Role")
                        .description("Java Spring Boot backend developer working with PostgreSQL").jobType(JobType.INTERNSHIP)
                        .workingModel(WorkingModel.REMOTE).status(JobStatus.ACTIVE).build());
                Job pending = jobs.saveAndFlush(Job.builder().company(owner).title("Isolated Pending Review Role")
                        .description("Awaiting admin review").jobType(JobType.INTERNSHIP)
                        .workingModel(WorkingModel.REMOTE).status(JobStatus.PENDING_APPROVAL).build());
                entities.put("activeJobId", active.getId());
                entities.put("pendingJobId", pending.getId());
                int port = ((ServletWebServerApplicationContext) context).getWebServer().getPort();
                context.getBean(ObjectMapper.class).writeValue(output.toFile(), Map.of("backendUrl", "http://127.0.0.1:" + port,
                        "accounts", accounts, "entities", entities, "createdAt", Instant.now().toString()));
                System.out.println("Isolated automatic-notification browser fixture READY (credentials remain in gitignored local file).");
                long deadline = System.nanoTime() + java.time.Duration.ofMinutes(25).toNanos();
                while (!Files.exists(stop) && System.nanoTime() < deadline) Thread.sleep(500);
            }
        }
    }
}
