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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.testcontainers.containers.PostgreSQLContainer;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Disposable fixture only: no demo accounts, external database or shared file storage. */
public class CompanyVerificationBrowserFixture {
    public static void main(String[] args) throws Exception {
        Path output = Path.of(args[0]).toAbsolutePath();
        Path stop = Path.of(output + ".stop");
        Path temporary = Files.createTempDirectory("sjrs-company-verification-e2e-").toRealPath();
        Path privateStorage = temporary.resolve("private-documents");
        Files.deleteIfExists(stop);
        try (var postgres = new PostgreSQLContainer<>("postgres:17-alpine")) {
            postgres.start();
            try (var context = new SpringApplicationBuilder(JobRecommendationApplication.class)
                    .profiles("integration").run("--server.port=0", "--server.address=127.0.0.1",
                            "--spring.datasource.url=" + postgres.getJdbcUrl(),
                            "--spring.datasource.username=" + postgres.getUsername(),
                            "--spring.datasource.password=" + postgres.getPassword(),
                            "--app.jwt.secret=" + UUID.randomUUID() + UUID.randomUUID(),
                            "--app.upload.company-verification.storage-dir=" + privateStorage,
                            "--spring.jpa.show-sql=false")) {
                var users = context.getBean(UserRepository.class);
                var companies = context.getBean(CompanyRepository.class);
                var encoder = context.getBean(PasswordEncoder.class);
                var accounts = new LinkedHashMap<String, Object>();
                for (String alias : new String[]{"company", "otherCompany", "admin", "student"}) {
                    UserRole role = switch (alias) {
                        case "admin" -> UserRole.ADMIN;
                        case "student" -> UserRole.STUDENT;
                        default -> UserRole.COMPANY;
                    };
                    String password = UUID.randomUUID() + "A9!";
                    User user = users.saveAndFlush(User.builder()
                            .email(alias.toLowerCase(java.util.Locale.ROOT) + "@isolated-w2b3.invalid")
                            .passwordHash(encoder.encode(password)).fullName("Isolated " + alias)
                            .role(role).status(UserStatus.ACTIVE).build());
                    var account = new LinkedHashMap<String, Object>();
                    account.put("email", user.getEmail()); account.put("password", password);
                    if (role == UserRole.COMPANY) {
                        Company company = companies.saveAndFlush(Company.builder().user(user)
                                .companyName("Isolated " + alias).status(CompanyStatus.PENDING)
                                .description("Preserved synthetic description").address("Synthetic address")
                                .phone("0901234567").industry("Software").taxCode("TEST-" + alias).build());
                        account.put("companyId", company.getId());
                    }
                    accounts.put(alias, account);
                }
                ImageIO.write(new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB), "png", output.resolveSibling("replacement.png").toFile());
                int port = ((ServletWebServerApplicationContext) context).getWebServer().getPort();
                context.getBean(ObjectMapper.class).writeValue(output.toFile(), Map.of(
                        "backendUrl", "http://127.0.0.1:" + port, "accounts", accounts,
                        "privateStorage", privateStorage.toString(), "temporaryRoot", temporary.toString(),
                        "containerId", postgres.getContainerId(), "postgresImage", "postgres:17-alpine"));
                System.out.println("Isolated Company verification fixture READY.");
                long deadline = System.nanoTime() + Duration.ofMinutes(15).toNanos();
                while (!Files.exists(stop) && System.nanoTime() < deadline) Thread.sleep(250);
            }
        } finally {
            // Only the unique directory created above; walk does not follow symbolic links.
            try (var paths = Files.walk(temporary)) {
                for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
            }
        }
    }
}
