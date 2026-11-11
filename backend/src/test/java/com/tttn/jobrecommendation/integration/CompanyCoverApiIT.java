package com.tttn.jobrecommendation.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class CompanyCoverApiIT extends AbstractPostgresWebIntegrationTest {
    private static final String URL = "/api/companies/me";
    private static final String COVER = "https://cdn.example.test/company-cover.png";
    private static final String PRIVATE_DOCUMENT = "private-storage://synthetic-verification-sentinel";
    @Autowired private ObjectMapper objectMapper;

    @Test
    void roundTripOmissionNullAndClearingPreserveExistingCompanyAndRelatedData() throws Exception {
        Company company = createCompany("cover-roundtrip@example.test", "Original", CompanyStatus.VERIFIED);
        company.setCompanySize("51-200"); company.setLogoUrl("https://example.test/logo.png");
        company.setTaxCode("TAX-123"); company.setWebsiteUrl("https://example.test");
        company.setPhone("0123456789"); company.setAddress("Existing address");
        company.setDescription("Existing description"); company.setIndustry("Software");
        companyRepository.saveAndFlush(company);
        jdbcTemplate.update("update companies set verification_document_url = ? where id = ?", PRIVATE_DOCUMENT, company.getId());
        var job = createJob(company, "Existing job", JobStatus.ACTIVE);
        var student = createStudent("cover-applicant@example.test");
        var application = createApplication(student, job, createCv(student, "isolated-cover-test.pdf", true), ApplicationStatus.PENDING);
        String before = companyBusinessData(company.getId());
        String jobBefore = rowData("jobs", job.getId()), applicationBefore = rowData("applications", application.getId());
        String userBefore = rowData("users", company.getUser().getId());
        getMe(company).andExpect(status().isOk()).andExpect(header().string("ETag", "\"0\""))
                .andExpect(jsonPath("$.data.coverImageUrl").isEmpty());
        update(company, 0, Map.of("coverImageUrl", COVER)).andExpect(status().isOk())
                .andExpect(header().string("ETag", "\"1\""))
                .andExpect(jsonPath("$.data.coverImageUrl").value(COVER)).andExpect(jsonPath("$.data.revision").value(1));
        assertThat(companyRepository.findById(company.getId()).orElseThrow().getCoverImageUrl()).isEqualTo(COVER);
        getMe(company).andExpect(status().isOk()).andExpect(jsonPath("$.data.coverImageUrl").value(COVER));
        update(company, 1, Map.of()).andExpect(status().isOk()).andExpect(jsonPath("$.data.coverImageUrl").value(COVER));
        Map<String, Object> explicitNull = new HashMap<>(); explicitNull.put("coverImageUrl", null);
        update(company, 2, explicitNull).andExpect(status().isOk()).andExpect(jsonPath("$.data.coverImageUrl").value(COVER));
        update(company, 3, Map.of("coverImageUrl", "")).andExpect(status().isOk())
                .andExpect(header().string("ETag", "\"4\""))
                .andExpect(jsonPath("$.data.coverImageUrl").isEmpty());
        getMe(company).andExpect(status().isOk()).andExpect(header().string("ETag", "\"4\""))
                .andExpect(jsonPath("$.data.coverImageUrl").isEmpty());
        assertThat(companyRepository.findById(company.getId()).orElseThrow().getCoverImageUrl()).isNull();
        assertThat(companyBusinessData(company.getId())).isEqualTo(before);
        assertThat(rowData("jobs", job.getId())).isEqualTo(jobBefore);
        assertThat(rowData("applications", application.getId())).isEqualTo(applicationBefore);
        assertThat(rowData("users", company.getUser().getId())).isEqualTo(userBefore);
    }

    @ParameterizedTest
    @ValueSource(strings = {"http://cdn.example.test/cover.png", "https://cdn.example.test/cover.png", "HTTPS://cdn.example.test/cover.png", "https://[::1]:8080/cover.png", "https://cdn.example.test/cover%20image.png"})
    void acceptsTheSameSecureHttpUrlsAsLogo(String cover) throws Exception {
        var company = createCompany("cover-valid@example.test", "Valid", CompanyStatus.VERIFIED);
        update(company, 0, Map.of("coverImageUrl", cover)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.coverImageUrl").value(cover));
        assertThat(companyRepository.findById(company.getId()).orElseThrow().getCoverImageUrl()).isEqualTo(cover);
    }

    @Test
    void acceptsExactly500Characters() throws Exception {
        var company = createCompany("cover-boundary@example.test", "Boundary", CompanyStatus.VERIFIED);
        String prefix = "https://example.test/", cover = prefix + "a".repeat(500 - prefix.length());
        update(company, 0, Map.of("coverImageUrl", cover)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.coverImageUrl").value(cover));
        getMe(company).andExpect(status().isOk()).andExpect(jsonPath("$.data.coverImageUrl").value(cover));
    }

    @ParameterizedTest
    @MethodSource("invalidCoverUrls")
    void invalidCoverNeverWritesOrAdvancesRevision(String cover) throws Exception {
        var company = createCompany("cover-invalid@example.test", "Original", CompanyStatus.VERIFIED);
        company.setCoverImageUrl(COVER); companyRepository.saveAndFlush(company);
        update(company, 0, Map.of("coverImageUrl", cover, "description", "Must not persist"))
                .andExpect(status().isBadRequest());
        var saved = companyRepository.findById(company.getId()).orElseThrow();
        assertThat(saved.getCoverImageUrl()).isEqualTo(COVER);
        assertThat(saved.getDescription()).isNull(); assertThat(saved.getAccountRevision()).isZero();
    }

    static Stream<String> invalidCoverUrls() {
        String prefix = "https://example.test/";
        return Stream.of(prefix + "a".repeat(501 - prefix.length()), "relative.png", "//example.test/cover.png", "https:///cover.png", "https://", "ftp://example.test/cover.png", "javascript:alert(1)", "data:image/png;base64,abc",
                "https://user:pass@example.test/cover.png", "https://@example.test/cover.png", "https://example.test/cover image.png", "https://example.test/co\tver.png", "https://example.test/co\nver.png",
                " https://example.test/cover.png", "https://example.test/cover.png ", " ", "https://example.test/cover\u00a0image.png", "https://example.test/%zz", "https://bad_host.test/cover.png");
    }

    @ParameterizedTest
    @EnumSource(CompanyStatus.class)
    void mapsCoverWithoutExposingPrivateDocumentOrChangingVisibility(CompanyStatus verification) throws Exception {
        var company = createCompany("cover-mapping@example.test", "Mapping", verification);
        jdbcTemplate.update("update companies set verification_document_url = ? where id = ?", PRIVATE_DOCUMENT, company.getId());
        update(company, 0, Map.of("coverImageUrl", COVER)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value(verification.name()));
        var admin = createUser("cover-admin@example.test", UserRole.ADMIN);
        String token = bearerToken(admin);
        assertPrivateDocumentAbsent(mockMvc.perform(get("/api/admin/companies/{id}", company.getId()).header(HttpHeaders.AUTHORIZATION, token)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.coverImageUrl").value(COVER));
        assertPrivateDocumentAbsent(mockMvc.perform(get("/api/admin/companies").header(HttpHeaders.AUTHORIZATION, token)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.items[0].coverImageUrl").value(COVER));
        if (verification == CompanyStatus.VERIFIED) {
            assertPrivateDocumentAbsent(mockMvc.perform(get("/api/public/companies/{id}", company.getId())))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.coverImageUrl").value(COVER));
            assertPrivateDocumentAbsent(mockMvc.perform(get("/api/public/companies")))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.items[0].coverImageUrl").value(COVER))
                    .andExpect(jsonPath("$.data.totalItems").value(1));
            update(company, 1, Map.of("coverImageUrl", "")).andExpect(status().isOk());
            assertPrivateDocumentAbsent(mockMvc.perform(get("/api/public/companies/{id}", company.getId())))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.coverImageUrl").isEmpty());
        } else {
            assertPrivateDocumentAbsent(mockMvc.perform(get("/api/public/companies/{id}", company.getId()))).andExpect(status().isNotFound());
            assertPrivateDocumentAbsent(mockMvc.perform(get("/api/public/companies"))).andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.totalItems").value(0));
        }
    }

    @Test
    void verificationDocumentCannotBeSubmittedOrTriggerVerification() throws Exception {
        var company = createCompany("cover-private-boundary@example.test", "Pending", CompanyStatus.PENDING);
        jdbcTemplate.update("update companies set verification_document_url = ? where id = ?", PRIVATE_DOCUMENT, company.getId());
        // Unknown properties retain the existing request contract; no document field is bound or persisted.
        update(company, 0, Map.of("coverImageUrl", COVER, "verificationDocumentUrl", "https://example.test/attempted-document"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("PENDING"));
        assertThat(jdbcTemplate.queryForObject("select verification_document_url from companies where id = ?", String.class, company.getId())).isEqualTo(PRIVATE_DOCUMENT);
        assertThat(companyRepository.findById(company.getId()).orElseThrow().getStatus()).isEqualTo(CompanyStatus.PENDING);
    }

    @Test
    void missingMalformedAndStaleEtagsCannotOverwriteCover() throws Exception {
        var company = createCompany("cover-etag@example.test", "ETag", CompanyStatus.VERIFIED);
        String token = bearerToken(company.getUser()), payload = objectMapper.writeValueAsString(Map.of("coverImageUrl", COVER));
        mockMvc.perform(put(URL).header(HttpHeaders.AUTHORIZATION, token).contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isPreconditionRequired());
        mockMvc.perform(put(URL).header(HttpHeaders.AUTHORIZATION, token).header(HttpHeaders.IF_MATCH, "*").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isBadRequest());
        assertThat(companyRepository.findById(company.getId()).orElseThrow().getAccountRevision()).isZero();
        update(company, 0, Map.of("coverImageUrl", COVER)).andExpect(status().isOk());
        update(company, 0, Map.of("coverImageUrl", "https://example.test/stale.png"))
                .andExpect(status().isConflict());
        getMe(company).andExpect(status().isOk()).andExpect(header().string("ETag", "\"1\""))
                .andExpect(jsonPath("$.data.coverImageUrl").value(COVER));
    }

    @Test
    void concurrentCoverWritesHaveOneWinner() throws Exception {
        var company = createCompany("cover-concurrent@example.test", "Race", CompanyStatus.VERIFIED);
        var start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var futures = Stream.of("https://example.test/a.png", "https://example.test/b.png").map(cover -> pool.submit(() -> {
                start.await();
                return update(company, 0, Map.of("coverImageUrl", cover)).andReturn().getResponse().getStatus();
            })).toList();
            start.countDown();
            assertThat(List.of(futures.get(0).get(10, TimeUnit.SECONDS), futures.get(1).get(10, TimeUnit.SECONDS))).containsExactlyInAnyOrder(200, 409);
        }
        var saved = companyRepository.findById(company.getId()).orElseThrow();
        assertThat(saved.getAccountRevision()).isEqualTo(1);
        assertThat(saved.getCoverImageUrl()).isIn("https://example.test/a.png", "https://example.test/b.png");
        assertThat(saved.getStatus()).isEqualTo(CompanyStatus.VERIFIED);
    }

    @Test
    void coverWritesRemainScopedToAuthenticatedCompany() throws Exception {
        var owner = createCompany("cover-owner@example.test", "Owner", CompanyStatus.VERIFIED);
        var other = createCompany("cover-other@example.test", "Other", CompanyStatus.VERIFIED);
        for (var actor : List.of(createStudent("cover-student@example.test").getUser(), createUser("cover-wrong-admin@example.test", UserRole.ADMIN))) {
            mockMvc.perform(put(URL).header(HttpHeaders.AUTHORIZATION, bearerToken(actor)).header(HttpHeaders.IF_MATCH, "\"0\"")
                            .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(Map.of("coverImageUrl", COVER))))
                    .andExpect(status().isForbidden());
        }
        mockMvc.perform(put(URL).contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(Map.of("coverImageUrl", COVER))))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(put(URL).param("companyId", owner.getId().toString()).header(HttpHeaders.AUTHORIZATION, bearerToken(other.getUser()))
                        .header(HttpHeaders.IF_MATCH, "\"0\"").contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(Map.of("coverImageUrl", COVER))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.id").value(other.getId()));
        assertThat(companyRepository.findById(owner.getId()).orElseThrow().getCoverImageUrl()).isNull();
        assertThat(companyRepository.findById(owner.getId()).orElseThrow().getAccountRevision()).isZero();
        assertThat(companyRepository.findById(other.getId()).orElseThrow().getCoverImageUrl()).isEqualTo(COVER);
    }

    private ResultActions getMe(Company company) throws Exception {
        return assertPrivateDocumentAbsent(mockMvc.perform(get(URL).header(HttpHeaders.AUTHORIZATION, bearerToken(company.getUser()))));
    }
    private ResultActions update(Company company, long revision, Map<String, ?> fields) throws Exception {
        return assertPrivateDocumentAbsent(mockMvc.perform(put(URL).header(HttpHeaders.AUTHORIZATION, bearerToken(company.getUser()))
                .header(HttpHeaders.IF_MATCH, "\"" + revision + "\"").contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(fields))));
    }
    private ResultActions assertPrivateDocumentAbsent(ResultActions result) throws Exception {
        return result.andDo(response -> {
            String body = response.getResponse().getContentAsString();
            assertThat(objectMapper.readTree(body).findValues("verificationDocumentUrl")).isEmpty();
            assertThat(body).doesNotContain(PRIVATE_DOCUMENT, "verification_document_url");
        });
    }
    private String companyBusinessData(Long id) {
        return jdbcTemplate.queryForObject("select (to_jsonb(c) - 'account_revision' - 'updated_at' - 'cover_image_url')::text from companies c where id = ?", String.class, id);
    }
    private String rowData(String table, Long id) {
        return jdbcTemplate.queryForObject("select to_jsonb(r)::text from " + table + " r where id = ?", String.class, id);
    }
}
