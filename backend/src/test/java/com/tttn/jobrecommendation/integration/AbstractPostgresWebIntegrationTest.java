package com.tttn.jobrecommendation.integration;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.security.JwtTokenProvider;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.application.repository.JobApplicationRepository;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.user.entity.User;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
public abstract class AbstractPostgresWebIntegrationTest extends AbstractPostgresIntegrationTest {

    protected static final Path CV_STORAGE_DIRECTORY = Path.of(
            "target",
            "test-cv-storage",
            UUID.randomUUID().toString()
    ).toAbsolutePath().normalize();

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected JwtTokenProvider jwtTokenProvider;

    @Autowired
    protected JobApplicationRepository jobApplicationRepository;

    @DynamicPropertySource
    static void configureCvStorage(DynamicPropertyRegistry registry) {
        registry.add("app.upload.cv.storage-dir", CV_STORAGE_DIRECTORY::toString);
    }

    @BeforeEach
    void resetCvStorage() throws IOException {
        deleteRecursively(CV_STORAGE_DIRECTORY);
        Files.createDirectories(CV_STORAGE_DIRECTORY);
    }

    @AfterAll
    static void cleanCvStorage() throws IOException {
        deleteRecursively(CV_STORAGE_DIRECTORY);
    }

    protected String bearerToken(User user) {
        return "Bearer " + jwtTokenProvider.generateToken(user);
    }

    protected Path writeCvFile(CvFile cvFile, byte[] contents) throws IOException {
        Path target = CV_STORAGE_DIRECTORY.resolve(cvFile.getStoredFileName()).normalize();
        Files.createDirectories(target.getParent());
        return Files.write(target, contents);
    }

    protected JobApplication createApplication(
            Student student,
            Job job,
            CvFile cvFile,
            ApplicationStatus status
    ) {
        return jobApplicationRepository.saveAndFlush(JobApplication.builder()
                .student(student)
                .job(job)
                .cvFile(cvFile)
                .status(status)
                .build());
    }

    private static void deleteRecursively(Path directory) throws IOException {
        if (!Files.exists(directory)) {
            return;
        }

        List<Path> paths;
        try (Stream<Path> stream = Files.walk(directory)) {
            paths = stream.sorted(Comparator.reverseOrder()).toList();
        }

        for (Path path : paths) {
            Files.deleteIfExists(path);
        }
    }
}
