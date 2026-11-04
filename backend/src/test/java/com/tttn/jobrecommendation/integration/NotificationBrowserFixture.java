package com.tttn.jobrecommendation.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tttn.jobrecommendation.JobRecommendationApplication;
import com.tttn.jobrecommendation.common.security.JwtTokenProvider;
import com.tttn.jobrecommendation.common.enums.*;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.company.repository.CompanyRepository;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.notification.entity.Notification;
import com.tttn.jobrecommendation.modules.notification.repository.NotificationRepository;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.repository.StudentRepository;
import com.tttn.jobrecommendation.modules.user.entity.User;
import com.tttn.jobrecommendation.modules.user.repository.UserRepository;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.testcontainers.containers.PostgreSQLContainer;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Explicit local browser fixture, not a JUnit test or a production seeder.
 * Always creates its own disposable PostgreSQL Testcontainer; cannot target the demo database.
 */
public class NotificationBrowserFixture {
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
                            "--spring.jpa.show-sql=false")) {
                var users = context.getBean(UserRepository.class);
                var companies = context.getBean(CompanyRepository.class);
                var notifications = context.getBean(NotificationRepository.class);
                var encoder = context.getBean(PasswordEncoder.class);
                var accounts = new LinkedHashMap<String, Object>();
                Company owner = null;
                Company other = null;
                for (String alias : new String[]{"company", "otherCompany", "student"}) {
                    String password = UUID.randomUUID() + "A9!";
                    User user = users.saveAndFlush(User.builder().email(alias.toLowerCase(java.util.Locale.ROOT) + "@isolated-notifications.invalid")
                            .passwordHash(encoder.encode(password)).fullName("Isolated " + alias)
                            .role(alias.equals("student") ? UserRole.STUDENT : UserRole.COMPANY)
                            .status(UserStatus.ACTIVE).build());
                    if (user.getRole() == UserRole.COMPANY) {
                        Company company = companies.saveAndFlush(Company.builder().user(user)
                                .companyName("Isolated " + alias).status(CompanyStatus.VERIFIED).build());
                        if (alias.equals("company")) owner = company;
                        else other = company;
                    } else context.getBean(StudentRepository.class).saveAndFlush(Student.builder().user(user).build());
                    accounts.put(alias, Map.of("email", user.getEmail(), "password", password, "userId", user.getId(),
                            "expiredToken", new JwtTokenProvider(context.getEnvironment().getProperty("app.jwt.secret"), -1000).generateToken(user)));
                    for (int i = 0; i < 48; i++) notifications.saveAndFlush(Notification.builder().user(user)
                            .type(NotificationType.values()[i % 4]).title("Isolated " + alias + " notice " + i)
                            .message("Synthetic isolated browser fixture").read(i % 3 == 0).build());
                }
                var jobs = context.getBean(JobRepository.class);
                Job closed = jobs.saveAndFlush(Job.builder().company(owner).title("Isolated closed job")
                        .description("Synthetic fixture").jobType(JobType.INTERNSHIP).workingModel(WorkingModel.REMOTE).status(JobStatus.CLOSED).build());
                Job foreign = jobs.saveAndFlush(Job.builder().company(other).title("Isolated foreign draft")
                        .description("Synthetic fixture").jobType(JobType.INTERNSHIP).workingModel(WorkingModel.REMOTE).status(JobStatus.DRAFT).build());
                for (var reference : Map.of("closed job", closed.getId(), "foreign job", foreign.getId(), "missing application", 2147483647L).entrySet()) {
                    notifications.saveAndFlush(Notification.builder().user(owner.getUser()).type(NotificationType.SYSTEM)
                            .title("Isolated " + reference.getKey()).message("Reference access is checked by the target API")
                            .referenceType(reference.getKey().equals("missing application") ? ReferenceType.APPLICATION : ReferenceType.JOB)
                            .referenceId(reference.getValue()).read(false).build());
                }
                int port = ((ServletWebServerApplicationContext) context).getWebServer().getPort();
                context.getBean(ObjectMapper.class).writeValue(output.toFile(), Map.of("backendUrl", "http://127.0.0.1:" + port,
                        "accounts", accounts, "closedJobId", closed.getId(), "foreignJobId", foreign.getId(), "createdAt", Instant.now().toString()));
                System.out.println("Isolated notification browser fixture READY (credentials remain in gitignored local file).");
                long deadline = System.nanoTime() + java.time.Duration.ofMinutes(15).toNanos();
                while (!Files.exists(stop) && System.nanoTime() < deadline) Thread.sleep(500);
            }
        }
    }
}
