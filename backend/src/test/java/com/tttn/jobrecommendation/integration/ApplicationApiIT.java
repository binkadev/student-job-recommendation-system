package com.tttn.jobrecommendation.integration;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MvcResult;

import java.sql.Timestamp;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ApplicationApiIT extends AbstractPostgresWebIntegrationTest {

    private static final byte[] CV_CONTENTS = "%PDF-company-application-cv".getBytes();

    private User admin;
    private Student alice;
    private Company acme;
    private Company betaCompany;
    private Job platformJob;
    private Job dataJob;
    private CvFile aliceCv;
    private JobApplication aliceApplication;
    private JobApplication bobApplication;

    @BeforeEach
    void createApplicationFixtures() throws Exception {
        admin = createUser("admin-api@example.test", UserRole.ADMIN);

        alice = createStudent("alice.key@example.test");
        alice.getUser().setFullName("Alice Orbit");
        userRepository.saveAndFlush(alice.getUser());

        Student bob = createStudent("bob.key@example.test");
        bob.getUser().setFullName("Bob Vector");
        userRepository.saveAndFlush(bob.getUser());

        acme = createCompany("acme@example.test", "Acme Nebula", CompanyStatus.VERIFIED);
        betaCompany = createCompany("beta@example.test", "Beta Systems", CompanyStatus.VERIFIED);
        platformJob = createJob(acme, "Platform Rocket Engineer", JobStatus.ACTIVE);
        dataJob = createJob(betaCompany, "Data Analyst", JobStatus.ACTIVE);

        aliceCv = createCv(alice, "alice-stored.pdf", false);
        aliceCv.setOriginalFileName("alice-resume.pdf");
        aliceCv = cvFileRepository.saveAndFlush(aliceCv);
        writeCvFile(aliceCv, CV_CONTENTS);

        aliceApplication = createApplication(alice, platformJob, aliceCv, ApplicationStatus.PENDING);
        bobApplication = createApplication(bob, dataJob, null, ApplicationStatus.REVIEWED);
    }

    @Test
    void owningCompanyCanStreamApplicationCvInlineAndAsAttachment() throws Exception {
        MvcResult inlineResult = mockMvc.perform(get("/api/companies/me/applications/{applicationId}/cv/file", aliceApplication.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(acme.getUser())))
                .andExpect(status().isOk())
                .andExpect(content().bytes(CV_CONTENTS))
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "application/pdf"))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, startsWith("inline;")))
                .andReturn();

        String inlineHeaders = inlineResult.getResponse().getHeaderNames().stream()
                .flatMap(name -> inlineResult.getResponse().getHeaders(name).stream())
                .reduce("", (left, right) -> left + " " + right);
        assertThat(inlineHeaders)
                .doesNotContain(aliceCv.getStoredFileName())
                .doesNotContain(CV_STORAGE_DIRECTORY.toString());

        mockMvc.perform(get("/api/companies/me/applications/{applicationId}/cv/file", aliceApplication.getId())
                        .param("download", "true")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(acme.getUser())))
                .andExpect(status().isOk())
                .andExpect(content().bytes(CV_CONTENTS))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, startsWith("attachment;")));
    }

    @Test
    void anotherCompanyCannotAccessApplicationCv() throws Exception {
        mockMvc.perform(get("/api/companies/me/applications/{applicationId}/cv/file", aliceApplication.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(betaCompany.getUser())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("ACCESS_DENIED"));
    }

    @Test
    void applicationWithoutCvReturnsNotFoundForOwningCompany() throws Exception {
        mockMvc.perform(get("/api/companies/me/applications/{applicationId}/cv/file", bobApplication.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(betaCompany.getUser())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));
    }

    @Test
    void nonCompanyCannotAccessCompanyApplicationCv() throws Exception {
        mockMvc.perform(get("/api/companies/me/applications/{applicationId}/cv/file", aliceApplication.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(alice.getUser())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("ACCESS_DENIED"));
    }

    @Test
    void adminCanListAndApplyEveryExactFilter() throws Exception {
        assertAdminFilter("status", "PENDING", aliceApplication.getId());
        assertAdminFilter("studentId", alice.getId().toString(), aliceApplication.getId());
        assertAdminFilter("jobId", platformJob.getId().toString(), aliceApplication.getId());
        assertAdminFilter("companyId", acme.getId().toString(), aliceApplication.getId());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "alice orbit",
            "ALICE.KEY",
            "platform rocket",
            "ACME NEBULA"
    })
    void adminKeywordSearchesEverySupportedFieldCaseInsensitively(String keyword) throws Exception {
        mockMvc.perform(get("/api/admin/applications")
                        .param("keyword", keyword)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(1))
                .andExpect(jsonPath("$.data.items[0].id").value(aliceApplication.getId().intValue()));
    }

    @Test
    void adminPaginationUsesOneBasedPageNumbers() throws Exception {
        mockMvc.perform(get("/api/admin/applications")
                        .param("page", "1")
                        .param("size", "1")
                        .param("sort", "id,asc")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.page").value(1))
                .andExpect(jsonPath("$.data.size").value(1))
                .andExpect(jsonPath("$.data.totalItems").value(2))
                .andExpect(jsonPath("$.data.totalPages").value(2))
                .andExpect(jsonPath("$.data.items[0].id").value(aliceApplication.getId().intValue()));

        mockMvc.perform(get("/api/admin/applications")
                        .param("page", "2")
                        .param("size", "1")
                        .param("sort", "id,asc")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.page").value(2))
                .andExpect(jsonPath("$.data.items[0].id").value(bobApplication.getId().intValue()));
    }

    @Test
    void adminDefaultSortsByAppliedAtDescending() throws Exception {
        jdbcTemplate.update(
                "UPDATE applications SET applied_at = ? WHERE id = ?",
                Timestamp.valueOf(LocalDateTime.of(2026, 1, 1, 0, 0)),
                aliceApplication.getId()
        );
        jdbcTemplate.update(
                "UPDATE applications SET applied_at = ? WHERE id = ?",
                Timestamp.valueOf(LocalDateTime.of(2026, 1, 2, 0, 0)),
                bobApplication.getId()
        );

        mockMvc.perform(get("/api/admin/applications")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].id").value(bobApplication.getId().intValue()))
                .andExpect(jsonPath("$.data.items[1].id").value(aliceApplication.getId().intValue()));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "id,asc",
            "status,asc",
            "appliedAt,asc",
            "reviewedAt,asc",
            "createdAt,asc",
            "updatedAt,asc"
    })
    void adminAcceptsEveryAllowedSortField(String sort) throws Exception {
        mockMvc.perform(get("/api/admin/applications")
                        .param("sort", sort)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(2));
    }

    @Test
    void invalidAdminSortIsRejected() throws Exception {
        mockMvc.perform(get("/api/admin/applications")
                        .param("sort", "filePath,asc")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(admin)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("BAD_REQUEST"));

        mockMvc.perform(get("/api/admin/applications")
                        .param("sort", "id,sideways")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(admin)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("BAD_REQUEST"));
    }

    @Test
    void studentAndCompanyCannotListAdminApplications() throws Exception {
        mockMvc.perform(get("/api/admin/applications")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(alice.getUser())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("ACCESS_DENIED"));

        mockMvc.perform(get("/api/admin/applications/{applicationId}", aliceApplication.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(alice.getUser())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("ACCESS_DENIED"));

        mockMvc.perform(get("/api/admin/applications")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(acme.getUser())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("ACCESS_DENIED"));
    }

    @Test
    void adminDetailReturnsSafeApplicationResponse() throws Exception {
        mockMvc.perform(get("/api/admin/applications")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].filePath").doesNotExist())
                .andExpect(jsonPath("$.data.items[0].fileUrl").doesNotExist())
                .andExpect(jsonPath("$.data.items[0].storedFileName").doesNotExist());

        mockMvc.perform(get("/api/admin/applications/{applicationId}", aliceApplication.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(aliceApplication.getId().intValue()))
                .andExpect(jsonPath("$.data.cvFileId").value(aliceCv.getId().intValue()))
                .andExpect(jsonPath("$.data.cvFileName").value(aliceCv.getFileName()))
                .andExpect(jsonPath("$.data.filePath").doesNotExist())
                .andExpect(jsonPath("$.data.fileUrl").doesNotExist())
                .andExpect(jsonPath("$.data.storedFileName").doesNotExist());
    }

    @Test
    void absentAdminApplicationDetailReturnsNotFound() throws Exception {
        mockMvc.perform(get("/api/admin/applications/{applicationId}", Long.MAX_VALUE)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(admin)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));
    }

    private void assertAdminFilter(String name, String value, Long expectedApplicationId) throws Exception {
        mockMvc.perform(get("/api/admin/applications")
                        .param(name, value)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.page").value(1))
                .andExpect(jsonPath("$.data.totalItems").value(1))
                .andExpect(jsonPath("$.data.items[0].id").value(expectedApplicationId.intValue()));
    }
}
