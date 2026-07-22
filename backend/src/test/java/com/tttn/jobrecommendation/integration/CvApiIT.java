package com.tttn.jobrecommendation.integration;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CvApiIT extends AbstractPostgresWebIntegrationTest {

    private static final byte[] CV_CONTENTS = "%PDF-student-cv".getBytes(StandardCharsets.UTF_8);

    @Test
    void ownerCanStreamCvInlineByDefaultAndAsAttachment() throws Exception {
        Student owner = createStudent("cv-owner@example.test");
        CvFile cvFile = createStoredCv(owner, "owner-stored.pdf", "owner-resume.pdf", false);

        MvcResult inlineResult = mockMvc.perform(get("/api/students/me/cv/{cvId}/file", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(owner.getUser())))
                .andExpect(status().isOk())
                .andExpect(content().bytes(CV_CONTENTS))
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "application/pdf"))
                .andExpect(header().longValue(HttpHeaders.CONTENT_LENGTH, CV_CONTENTS.length))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, startsWith("inline;")))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, containsString("owner-resume.pdf")))
                .andReturn();

        String inlineHeaders = inlineResult.getResponse().getHeaderNames().stream()
                .flatMap(name -> inlineResult.getResponse().getHeaders(name).stream())
                .reduce("", (left, right) -> left + " " + right);
        assertThat(inlineHeaders)
                .doesNotContain(cvFile.getStoredFileName())
                .doesNotContain(CV_STORAGE_DIRECTORY.toString());

        mockMvc.perform(get("/api/students/me/cv/{cvId}/file", cvFile.getId())
                        .param("download", "true")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(owner.getUser())))
                .andExpect(status().isOk())
                .andExpect(content().bytes(CV_CONTENTS))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, startsWith("attachment;")))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, containsString("owner-resume.pdf")));
    }

    @Test
    void anotherStudentGetsSameNotFoundResponseAsAnAbsentCv() throws Exception {
        Student owner = createStudent("private-cv-owner@example.test");
        Student anotherStudent = createStudent("private-cv-reader@example.test");
        CvFile cvFile = createStoredCv(owner, "private-stored.pdf", "private-resume.pdf", false);

        MvcResult nonOwnedResult = mockMvc.perform(get("/api/students/me/cv/{cvId}/file", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(anotherStudent.getUser())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"))
                .andReturn();

        MvcResult absentResult = mockMvc.perform(get("/api/students/me/cv/{cvId}/file", Long.MAX_VALUE)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(anotherStudent.getUser())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"))
                .andReturn();

        assertThat(nonOwnedResult.getResponse().getContentAsString())
                .isEqualTo(absentResult.getResponse().getContentAsString());
    }

    @Test
    void missingPhysicalCvFileReturnsNotFound() throws Exception {
        Student owner = createStudent("missing-file-owner@example.test");
        CvFile cvFile = createCv(owner, "missing-stored.pdf", false);

        mockMvc.perform(get("/api/students/me/cv/{cvId}/file", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(owner.getUser())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));
    }

    @Test
    void unsafeStoredPathCannotEscapeConfiguredStorageDirectory() throws Exception {
        Student owner = createStudent("unsafe-path-owner@example.test");
        String outsideFileName = "outside-" + UUID.randomUUID() + ".pdf";
        Path outsideFile = CV_STORAGE_DIRECTORY.getParent().resolve(outsideFileName);
        Files.write(outsideFile, "outside contents".getBytes(StandardCharsets.UTF_8));

        try {
            CvFile cvFile = createCv(owner, "../" + outsideFileName, false);
            mockMvc.perform(get("/api/students/me/cv/{cvId}/file", cvFile.getId())
                            .header(HttpHeaders.AUTHORIZATION, bearerToken(owner.getUser())))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));

            assertThat(Files.readString(outsideFile)).isEqualTo("outside contents");
        } finally {
            Files.deleteIfExists(outsideFile);
        }
    }

    @Test
    void malformedDownloadFlagIsRejectedAsBadRequest() throws Exception {
        Student owner = createStudent("bad-download-owner@example.test");
        CvFile cvFile = createStoredCv(owner, "bad-download-stored.pdf", "resume.pdf", false);

        mockMvc.perform(get("/api/students/me/cv/{cvId}/file", cvFile.getId())
                        .param("download", "not-a-boolean")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(owner.getUser())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("BAD_REQUEST"));
    }

    @Test
    void nonStudentCannotAccessStudentCvFileOrDeleteRoutes() throws Exception {
        Student owner = createStudent("role-owner@example.test");
        CvFile cvFile = createStoredCv(owner, "role-stored.pdf", "role-resume.pdf", false);
        var company = createCompany(
                "role-company@example.test",
                "Role Company",
                CompanyStatus.VERIFIED
        );
        var admin = createUser("role-admin@example.test", UserRole.ADMIN);

        mockMvc.perform(get("/api/students/me/cv/{cvId}/file", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(company.getUser())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("ACCESS_DENIED"));

        mockMvc.perform(delete("/api/students/me/cv/{cvId}", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(admin)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("ACCESS_DENIED"));
    }

    @Test
    void ownerCanDeleteUnusedCvMetadataAndPhysicalFile() throws Exception {
        Student owner = createStudent("delete-owner@example.test");
        CvFile cvFile = createStoredCv(owner, "delete-stored.pdf", "delete-resume.pdf", false);
        Path physicalFile = CV_STORAGE_DIRECTORY.resolve(cvFile.getStoredFileName());

        mockMvc.perform(delete("/api/students/me/cv/{cvId}", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(owner.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("CV deleted successfully"))
                .andExpect(jsonPath("$.data").value(nullValue()));

        assertThat(cvFileRepository.existsById(cvFile.getId())).isFalse();
        assertThat(Files.exists(physicalFile)).isFalse();
    }

    @Test
    void nonOwnerCannotDeleteCvAndMetadataAndPhysicalFileArePreserved() throws Exception {
        Student owner = createStudent("protected-delete-owner@example.test");
        Student anotherStudent = createStudent("protected-delete-attacker@example.test");
        CvFile cvFile = createStoredCv(owner, "protected-stored.pdf", "protected-resume.pdf", false);
        Path physicalFile = CV_STORAGE_DIRECTORY.resolve(cvFile.getStoredFileName());

        MvcResult nonOwnedResult = mockMvc.perform(delete("/api/students/me/cv/{cvId}", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(anotherStudent.getUser())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"))
                .andReturn();

        MvcResult absentResult = mockMvc.perform(delete("/api/students/me/cv/{cvId}", Long.MAX_VALUE)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(anotherStudent.getUser())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"))
                .andReturn();

        assertThat(nonOwnedResult.getResponse().getContentAsString())
                .isEqualTo(absentResult.getResponse().getContentAsString());

        assertThat(cvFileRepository.existsById(cvFile.getId())).isTrue();
        assertThat(Files.exists(physicalFile)).isTrue();
    }

    @Test
    void referencedCvCannotBeDeletedAndMetadataAndPhysicalFileArePreserved() throws Exception {
        Student owner = createStudent("referenced-cv-owner@example.test");
        CvFile cvFile = createStoredCv(owner, "referenced-stored.pdf", "referenced-resume.pdf", false);
        Path physicalFile = CV_STORAGE_DIRECTORY.resolve(cvFile.getStoredFileName());
        Job job = createJob(
                createCompany("referenced-company@example.test", "Referenced Company", CompanyStatus.VERIFIED),
                "Referenced CV Job",
                JobStatus.ACTIVE
        );
        JobApplication application = createApplication(owner, job, cvFile, ApplicationStatus.PENDING);

        mockMvc.perform(delete("/api/students/me/cv/{cvId}", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(owner.getUser())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("CV_IN_USE"));

        assertThat(cvFileRepository.existsById(cvFile.getId())).isTrue();
        assertThat(jobApplicationRepository.existsById(application.getId())).isTrue();
        assertThat(Files.exists(physicalFile)).isTrue();
    }

    @Test
    void deletingActiveUnusedCvDoesNotActivateAnotherCv() throws Exception {
        Student owner = createStudent("active-delete-owner@example.test");
        CvFile inactiveCv = createStoredCv(owner, "inactive-stored.pdf", "inactive-resume.pdf", false);
        CvFile activeCv = createStoredCv(owner, "active-stored.pdf", "active-resume.pdf", true);

        mockMvc.perform(delete("/api/students/me/cv/{cvId}", activeCv.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(owner.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        assertThat(cvFileRepository.existsById(activeCv.getId())).isFalse();
        assertThat(cvFileRepository.findFirstByStudentIdAndActiveTrueOrderByUploadedAtDesc(owner.getId())).isEmpty();
        assertThat(cvFileRepository.findById(inactiveCv.getId()).orElseThrow().isActive()).isFalse();
    }

    private CvFile createStoredCv(
            Student student,
            String storedFileName,
            String originalFileName,
            boolean active
    ) throws Exception {
        CvFile cvFile = createCv(student, storedFileName, active);
        cvFile.setFileName(originalFileName);
        cvFile.setOriginalFileName(originalFileName);
        cvFile = cvFileRepository.saveAndFlush(cvFile);
        writeCvFile(cvFile, CV_CONTENTS);
        return cvFile;
    }
}
