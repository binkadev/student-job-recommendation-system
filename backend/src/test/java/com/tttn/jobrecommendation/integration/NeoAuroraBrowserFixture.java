package com.tttn.jobrecommendation.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tttn.jobrecommendation.JobRecommendationApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;

/** Real default E2E on a fresh database and private CV directory, never the demo. */
public class NeoAuroraBrowserFixture {
    public static void main(String[] args) throws Exception {
        Path output = Path.of(args[0]).toAbsolutePath();
        Path stop = Path.of(output + ".stop");
        Files.deleteIfExists(stop);
        String key = UUID.randomUUID().toString() + UUID.randomUUID();
        try (var postgres = new PostgreSQLContainer<>("postgres:17-alpine");
             var ai = new GenericContainer<>(DockerImageName.parse("student-job-recommendation-ai:local"))
                     .withEnv("AI_INTERNAL_API_KEY", key).withExposedPorts(8000)
                     .waitingFor(Wait.forHttp("/health").forPort(8000))) {
            postgres.start();
            ai.start();
            try (var context = new SpringApplicationBuilder(JobRecommendationApplication.class).profiles("dev", "integration")
                    .run("--server.port=0", "--server.address=127.0.0.1",
                            "--spring.datasource.url=" + postgres.getJdbcUrl(),
                            "--spring.datasource.username=" + postgres.getUsername(),
                            "--spring.datasource.password=" + postgres.getPassword(),
                            "--app.jwt.secret=" + UUID.randomUUID() + UUID.randomUUID(),
                            "--app.ai-service.base-url=http://127.0.0.1:" + ai.getMappedPort(8000),
                            "--app.ai-service.internal-api-key=" + key,
                            "--app.upload.cv.storage-dir=" + output.getParent().resolve("cvs"),
                            "--spring.jpa.show-sql=false", "--logging.level.org.hibernate.SQL=WARN")) {
                int port = ((ServletWebServerApplicationContext) context).getWebServer().getPort();
                context.getBean(ObjectMapper.class).writeValue(output.toFile(), Map.of("backendUrl", "http://127.0.0.1:" + port));
                while (!Files.exists(stop)) Thread.sleep(300);
            }
        }
    }
}
