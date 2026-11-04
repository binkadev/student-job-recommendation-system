package com.tttn.jobrecommendation.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tttn.jobrecommendation.JobRecommendationApplication;
import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.common.enums.UserStatus;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.company.repository.CompanyRepository;
import com.tttn.jobrecommendation.modules.user.entity.User;
import com.tttn.jobrecommendation.modules.user.repository.UserRepository;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.testcontainers.containers.PostgreSQLContainer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Explicit disposable browser fixture; cannot point at the demo database. */
public class CompanyAnalyticsBrowserFixture {
    public static void main(String[] args) throws Exception {
        Path output = Path.of(args[0]).toAbsolutePath(), stop = Path.of(output + ".stop");
        Files.deleteIfExists(stop);
        try (var postgres = new PostgreSQLContainer<>("postgres:17-alpine")) {
            postgres.start();
            try (var context = new SpringApplicationBuilder(JobRecommendationApplication.class).profiles("integration").run(
                    "--server.port=0", "--server.address=127.0.0.1", "--spring.datasource.url=" + postgres.getJdbcUrl(),
                    "--spring.datasource.username=" + postgres.getUsername(), "--spring.datasource.password=" + postgres.getPassword(),
                    "--app.jwt.secret=" + UUID.randomUUID() + UUID.randomUUID(), "--spring.jpa.show-sql=false")) {
                var users = context.getBean(UserRepository.class); var companies = context.getBean(CompanyRepository.class);
                var encoder = context.getBean(PasswordEncoder.class); var jdbc = context.getBean(JdbcTemplate.class);
                var accounts = new LinkedHashMap<String, Object>();
                for (String alias : new String[]{"company", "otherCompany"}) {
                    String password = UUID.randomUUID() + "A9!";
                    User user = users.saveAndFlush(User.builder().email(alias.toLowerCase(java.util.Locale.ROOT) + "@analytics-isolated.invalid")
                            .passwordHash(encoder.encode(password)).fullName("Analytics " + alias).role(UserRole.COMPANY).status(UserStatus.ACTIVE).build());
                    Company company = companies.saveAndFlush(Company.builder().user(user).companyName("Analytics " + alias)
                            .status(alias.equals("company") ? CompanyStatus.VERIFIED : CompanyStatus.BLOCKED).build());
                    CompanyAnalyticsFixtures.seed(jdbc, company.getId(), alias.equals("company") ? "a" : "b");
                    accounts.put(alias, Map.of("email", user.getEmail(), "password", password, "companyId", company.getId(),
                            "firstJob", jdbc.queryForObject("select min(id) from jobs where company_id=?", Long.class, company.getId()),
                            "activeJob", jdbc.queryForObject("select min(id) from jobs where company_id=? and status='ACTIVE'", Long.class, company.getId())));
                }
                int port = ((ServletWebServerApplicationContext) context).getWebServer().getPort();
                context.getBean(ObjectMapper.class).writeValue(output.toFile(), Map.of("backendUrl", "http://127.0.0.1:" + port,
                        "containerId", postgres.getContainerId(), "accounts", accounts));
                System.out.println("Analytics browser fixture READY (260 Jobs/724 histories, private credentials local only).");
                long deadline = System.nanoTime() + java.time.Duration.ofMinutes(15).toNanos();
                while (!Files.exists(stop) && System.nanoTime() < deadline) Thread.sleep(500);
            }
        }
    }
}
