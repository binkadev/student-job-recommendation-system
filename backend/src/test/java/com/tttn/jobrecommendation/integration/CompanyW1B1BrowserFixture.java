package com.tttn.jobrecommendation.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tttn.jobrecommendation.JobRecommendationApplication;
import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.JobType;
import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.common.enums.UserStatus;
import com.tttn.jobrecommendation.common.enums.WorkingModel;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.company.repository.CompanyRepository;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.skill.entity.Skill;
import com.tttn.jobrecommendation.modules.skill.repository.SkillRepository;
import com.tttn.jobrecommendation.modules.user.entity.User;
import com.tttn.jobrecommendation.modules.user.repository.UserRepository;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.testcontainers.containers.PostgreSQLContainer;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Isolated disposable PostgreSQL Testcontainer fixture for W1-B1 Company browser verification.
 * Never touches the demo database.
 */
public class CompanyW1B1BrowserFixture {
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
                var jobs = context.getBean(JobRepository.class);
                var encoder = context.getBean(PasswordEncoder.class);

                var accounts = new LinkedHashMap<String, Object>();
                Company owner = null;
                Company other = null;
                for (String alias : new String[]{"company", "otherCompany"}) {
                    String password = UUID.randomUUID() + "A9!";
                    User user = users.saveAndFlush(User.builder()
                            .email(alias.toLowerCase(Locale.ROOT) + "@isolated-w1b1.invalid")
                            .passwordHash(encoder.encode(password))
                            .fullName("Isolated " + alias)
                            .role(UserRole.COMPANY)
                            .status(UserStatus.ACTIVE)
                            .build());
                    Company company = companies.saveAndFlush(Company.builder()
                            .user(user)
                            .companyName("Isolated " + alias)
                            .status(CompanyStatus.VERIFIED)
                            .build());
                    accounts.put(alias, Map.of("email", user.getEmail(), "password", password, "companyId", company.getId()));
                    if (alias.equals("company")) owner = company;
                    else other = company;
                }

                List<Long> activeJobIds = new ArrayList<>();
                for (int i = 1; i <= 7; i++) {
                    Job j = jobs.saveAndFlush(Job.builder()
                            .company(owner)
                            .title(String.format("Owned Active Job %02d (No Applicants)", i))
                            .description("Isolated active job " + i)
                            .location("Hà Nội")
                            .jobType(JobType.FULL_TIME)
                            .workingModel(WorkingModel.HYBRID)
                            .status(JobStatus.ACTIVE)
                            .deadline(LocalDate.of(2099, 12, 31))
                            .build());
                    activeJobIds.add(j.getId());
                }
                Job draft = jobs.saveAndFlush(Job.builder()
                        .company(owner)
                        .title("Owned Draft Job 01 (No Applicants)")
                        .description("Isolated draft job")
                        .location("Hà Nội")
                        .jobType(JobType.INTERNSHIP)
                        .workingModel(WorkingModel.REMOTE)
                        .status(JobStatus.DRAFT)
                        .deadline(LocalDate.of(2099, 12, 31))
                        .build());
                Job foreign = jobs.saveAndFlush(Job.builder()
                        .company(other)
                        .title("Foreign Active Job 99")
                        .description("Foreign active job")
                        .location("Đà Nẵng")
                        .jobType(JobType.FULL_TIME)
                        .workingModel(WorkingModel.ONSITE)
                        .status(JobStatus.ACTIVE)
                        .deadline(LocalDate.of(2099, 12, 31))
                        .build());

                int port = ((ServletWebServerApplicationContext) context).getWebServer().getPort();
                context.getBean(ObjectMapper.class).writeValue(output.toFile(), Map.of(
                        "backendUrl", "http://127.0.0.1:" + port,
                        "accounts", accounts,
                        "activeJobIds", activeJobIds,
                        "draftJobId", draft.getId(),
                        "foreignJobId", foreign.getId(),
                        "createdAt", Instant.now().toString()
                ));
                System.out.println("Isolated W1-B1 browser fixture READY.");
                long deadline = System.nanoTime() + java.time.Duration.ofMinutes(20).toNanos();
                while (!Files.exists(stop) && System.nanoTime() < deadline) Thread.sleep(500);
            }
        }
    }
}
