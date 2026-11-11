package com.tttn.jobrecommendation.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.params.provider.Arguments;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.ResultActions;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class SettingsConcurrencyIT extends AbstractPostgresWebIntegrationTest {
    @Autowired private ObjectMapper objectMapper;

    @Test
    void companySizeAndLogoRoundTripClearAndOmittedValuesPreserveExistingData() throws Exception {
        var company = createCompany("profile-fields@example.test", "Original", CompanyStatus.VERIFIED);
        company.setTaxCode("tax-123"); company.setDescription("Existing description");
        company.setWebsiteUrl("https://company.example.test"); company.setAddress("Existing address");
        company.setPhone("0123456789"); company.setIndustry("Software");
        companyRepository.saveAndFlush(company);
        var job = createJob(company, "Existing job", JobStatus.ACTIVE);
        var student = createStudent("profile-applicant@example.test");
        var application = createApplication(student, job, createCv(student, "isolated-profile-test.pdf", true), ApplicationStatus.PENDING);
        String originalCompany = companyBusinessData(company.getId());
        String originalJob = jdbcTemplate.queryForObject("select to_jsonb(j)::text from jobs j where id = ?", String.class, job.getId());
        String originalApplication = jdbcTemplate.queryForObject("select to_jsonb(a)::text from applications a where id = ?", String.class, application.getId());
        String token = bearerToken(company.getUser());
        mockMvc.perform(get("/api/companies/me").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk()).andExpect(header().string("ETag", "\"0\""))
                .andExpect(jsonPath("$.data.companySize").isEmpty()).andExpect(jsonPath("$.data.logoUrl").isEmpty());
        updateCompany(company, 0, Map.of("companySize", "  51-200 employees  ", "logoUrl", "https://cdn.example.test/logo.png"))
                .andExpect(status().isOk()).andExpect(header().string("ETag", "\"1\""))
                .andExpect(jsonPath("$.data.revision").value(1)).andExpect(jsonPath("$.data.companySize").value("51-200 employees"))
                .andExpect(jsonPath("$.data.logoUrl").value("https://cdn.example.test/logo.png"));
        mockMvc.perform(get("/api/companies/me").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk()).andExpect(header().string("ETag", "\"1\""))
                .andExpect(jsonPath("$.data.companySize").value("51-200 employees"))
                .andExpect(jsonPath("$.data.logoUrl").value("https://cdn.example.test/logo.png"));
        // Omission and explicit null retain both saved values, like the existing optional fields.
        updateCompany(company, 1, Map.of()).andExpect(status().isOk()).andExpect(header().string("ETag", "\"2\""));
        mockMvc.perform(put("/api/companies/me").header(HttpHeaders.AUTHORIZATION, token).header(HttpHeaders.IF_MATCH, "\"2\"")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"companySize\":null,\"logoUrl\":null}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.companySize").value("51-200 employees"))
                .andExpect(jsonPath("$.data.logoUrl").value("https://cdn.example.test/logo.png"));
        // Each field can change independently without overwriting its sibling.
        updateCompany(company, 3, Map.of("companySize", "201-500"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.logoUrl").value("https://cdn.example.test/logo.png"));
        updateCompany(company, 4, Map.of("logoUrl", ""))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.companySize").value("201-500"))
                .andExpect(jsonPath("$.data.logoUrl").isEmpty());
        updateCompany(company, 5, Map.of("companySize", ""))
                .andExpect(status().isOk()).andExpect(header().string("ETag", "\"6\""))
                .andExpect(jsonPath("$.data.companySize").isEmpty()).andExpect(jsonPath("$.data.logoUrl").isEmpty());
        mockMvc.perform(get("/api/companies/me").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk()).andExpect(header().string("ETag", "\"6\""))
                .andExpect(jsonPath("$.data.companySize").isEmpty()).andExpect(jsonPath("$.data.logoUrl").isEmpty());
        var saved = companyRepository.findById(company.getId()).orElseThrow();
        assertThat(saved.getCompanySize()).isNull(); assertThat(saved.getLogoUrl()).isNull();
        assertThat(companyBusinessData(company.getId())).isEqualTo(originalCompany);
        assertThat(jdbcTemplate.queryForObject("select to_jsonb(j)::text from jobs j where id = ?", String.class, job.getId())).isEqualTo(originalJob);
        assertThat(jdbcTemplate.queryForObject("select to_jsonb(a)::text from applications a where id = ?", String.class, application.getId())).isEqualTo(originalApplication);
    }

    @ParameterizedTest
    @ValueSource(strings = {"http://cdn.example.test/logo.png", "https://cdn.example.test/logo.png", "HTTPS://cdn.example.test/logo.png", "https://[::1]:8080/logo.png", "https://cdn.example.test/logo%20image.png"})
    void companyLogoAcceptsAbsoluteHttpUrls(String logoUrl) throws Exception {
        var company = createCompany("logo-valid@example.test", "Original", CompanyStatus.VERIFIED);
        updateCompany(company, 0, Map.of("logoUrl", logoUrl)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.logoUrl").value(logoUrl));
        assertThat(companyRepository.findById(company.getId()).orElseThrow().getLogoUrl()).isEqualTo(logoUrl);
    }

    @Test
    void companyProfileAcceptsExactMaximumLengths() throws Exception {
        var company = createCompany("logo-boundary@example.test", "Original", CompanyStatus.VERIFIED);
        String size = "a".repeat(100), logo = "https://example.test/" + "a".repeat(500 - "https://example.test/".length());
        assertThat(logo.length()).isEqualTo(500);
        updateCompany(company, 0, Map.of("companySize", size, "logoUrl", logo)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.companySize").value(size)).andExpect(jsonPath("$.data.logoUrl").value(logo));
    }

    @ParameterizedTest
    @MethodSource("invalidCompanyProfileFields")
    void invalidCompanyProfileFieldsNeverPersistOrAdvanceRevision(String field, String value) throws Exception {
        var company = createCompany("logo-invalid@example.test", "Original", CompanyStatus.VERIFIED);
        company.setCompanySize("Original size"); company.setLogoUrl("https://example.test/original.png");
        companyRepository.saveAndFlush(company);
        updateCompany(company, 0, Map.of(field, value, "description", "Must not persist"))
                .andExpect(status().isBadRequest());
        var saved = companyRepository.findById(company.getId()).orElseThrow();
        assertThat(saved.getCompanySize()).isEqualTo("Original size");
        assertThat(saved.getLogoUrl()).isEqualTo("https://example.test/original.png");
        assertThat(saved.getDescription()).isNull(); assertThat(saved.getAccountRevision()).isZero();
    }

    static Stream<Arguments> invalidCompanyProfileFields() {
        return Stream.concat(Stream.of(Arguments.of("companySize", "a".repeat(101)), Arguments.of("logoUrl", "https://example.test/" + "a".repeat(481))),
                Stream.of("relative.png", "//cdn.example.test/logo.png", "https:///logo.png", "ftp://cdn.example.test/logo.png", "javascript:alert(1)", "data:image/png;base64,abc",
                        "https://user:password@cdn.example.test/logo.png", "https://@cdn.example.test/logo.png", "https://cdn.example.test/logo image.png", "https://cdn.example.test/lo\tgo.png",
                        " https://cdn.example.test/logo.png", "https://cdn.example.test/logo.png ", " ", "https://cdn.example.test/logo\u00a0image.png", "https://cdn.example.test/%zz", "https://")
                        .map(value -> Arguments.of("logoUrl", value)));
    }

    @ParameterizedTest
    @EnumSource(CompanyStatus.class)
    void publicAndAdminResponsesExposeSavedFieldsWithoutChangingVisibility(CompanyStatus verification) throws Exception {
        var company = createCompany("logo-mapping@example.test", "Mapping", verification);
        updateCompany(company, 0, Map.of("companySize", "51-200", "logoUrl", "https://example.test/logo.png"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value(verification.name()));
        var admin = createUser("logo-admin@example.test", UserRole.ADMIN);
        String adminToken = bearerToken(admin);
        mockMvc.perform(get("/api/admin/companies/{id}", company.getId()).header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.companySize").value("51-200"))
                .andExpect(jsonPath("$.data.logoUrl").value("https://example.test/logo.png"));
        mockMvc.perform(get("/api/admin/companies").header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.items[0].companySize").value("51-200"))
                .andExpect(jsonPath("$.data.items[0].logoUrl").value("https://example.test/logo.png"));
        if (verification == CompanyStatus.VERIFIED) {
            mockMvc.perform(get("/api/public/companies/{id}", company.getId())).andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.companySize").value("51-200"))
                    .andExpect(jsonPath("$.data.logoUrl").value("https://example.test/logo.png"));
            mockMvc.perform(get("/api/public/companies")).andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.totalItems").value(1)).andExpect(jsonPath("$.data.items[0].companySize").value("51-200"))
                    .andExpect(jsonPath("$.data.items[0].logoUrl").value("https://example.test/logo.png"));
        } else {
            mockMvc.perform(get("/api/public/companies/{id}", company.getId())).andExpect(status().isNotFound());
            mockMvc.perform(get("/api/public/companies")).andExpect(status().isOk()).andExpect(jsonPath("$.data.totalItems").value(0));
        }
    }

    @Test
    void companyProfileFieldsRemainJwtScopedAndDenyOtherRoles() throws Exception {
        var owner = createCompany("logo-owner@example.test", "Owner", CompanyStatus.VERIFIED);
        var other = createCompany("logo-other@example.test", "Other", CompanyStatus.VERIFIED);
        for (var user : java.util.List.of(createStudent("logo-student@example.test").getUser(), createUser("logo-admin-denied@example.test", UserRole.ADMIN))) {
            mockMvc.perform(get("/api/companies/me").header(HttpHeaders.AUTHORIZATION, bearerToken(user))).andExpect(status().isForbidden());
            mockMvc.perform(put("/api/companies/me").header(HttpHeaders.AUTHORIZATION, bearerToken(user)).header(HttpHeaders.IF_MATCH, "\"0\"")
                            .contentType(MediaType.APPLICATION_JSON).content("{\"companySize\":\"Wrong actor\",\"logoUrl\":\"https://example.test/wrong.png\"}"))
                    .andExpect(status().isForbidden());
        }
        mockMvc.perform(get("/api/companies/me")).andExpect(status().isUnauthorized());
        mockMvc.perform(put("/api/companies/me").header(HttpHeaders.IF_MATCH, "\"0\"").contentType(MediaType.APPLICATION_JSON).content("{\"companySize\":\"Anonymous\"}"))
                .andExpect(status().isUnauthorized());
        // A caller-supplied companyId cannot redirect /me to a different company.
        mockMvc.perform(put("/api/companies/me").param("companyId", owner.getId().toString())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(other.getUser())).header(HttpHeaders.IF_MATCH, "\"0\"")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"companySize\":\"Other size\",\"logoUrl\":\"https://example.test/other.png\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.id").value(other.getId()));
        assertThat(companyRepository.findById(owner.getId()).orElseThrow().getCompanySize()).isNull();
        assertThat(companyRepository.findById(owner.getId()).orElseThrow().getLogoUrl()).isNull();
        assertThat(companyRepository.findById(owner.getId()).orElseThrow().getAccountRevision()).isZero();
        assertThat(companyRepository.findById(other.getId()).orElseThrow().getCompanySize()).isEqualTo("Other size");
    }

    private ResultActions updateCompany(Company company, long revision, Map<String, ?> fields) throws Exception {
        return mockMvc.perform(put("/api/companies/me").header(HttpHeaders.AUTHORIZATION, bearerToken(company.getUser()))
                .header(HttpHeaders.IF_MATCH, "\"" + revision + "\"").contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(fields)));
    }

    private String companyBusinessData(Long id) {
        return jdbcTemplate.queryForObject("select (to_jsonb(c) - 'account_revision' - 'updated_at' - 'company_size' - 'logo_url')::text from companies c where id = ?", String.class, id);
    }

    @Test
    void missingMalformedAndStalePreconditionsNeverWrite() throws Exception {
        var company = createCompany("cas-preconditions@example.test", "Original", CompanyStatus.VERIFIED);
        String token = bearerToken(company.getUser());
        for (String path : java.util.List.of("/api/companies/me", "/api/users/me/notification-settings")) {
            String body = path.endsWith("notification-settings")
                    ? "{\"applicationStatusEnabled\":true,\"jobStatusEnabled\":true,\"recommendationEnabled\":true,\"systemEnabled\":true}"
                    : "{\"companyName\":\"Changed\",\"companySize\":\"Changed size\",\"logoUrl\":\"https://example.test/changed.png\"}";
            mockMvc.perform(get(path).header(HttpHeaders.AUTHORIZATION, token))
                    .andExpect(header().string("ETag", "\"0\""));
            mockMvc.perform(put(path).header(HttpHeaders.AUTHORIZATION, token).contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isPreconditionRequired()).andExpect(jsonPath("$.errorCode").value("SETTINGS_REVISION_REQUIRED"));
            for (String value : java.util.List.of("*", "W/\"0\"", "0", "\"-1\"", "\"0\",\"1\"", "\"99999999999999999999999999999\""))
                mockMvc.perform(put(path).header(HttpHeaders.AUTHORIZATION, token).header(HttpHeaders.IF_MATCH, value)
                        .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
            mockMvc.perform(put(path).header(HttpHeaders.AUTHORIZATION, token).header(HttpHeaders.IF_MATCH, "\"9\"")
                    .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isConflict());
            mockMvc.perform(get(path).header(HttpHeaders.AUTHORIZATION, token))
                    .andExpect(header().string("ETag", "\"0\""));
        }
        assertThat(companyRepository.findById(company.getId()).orElseThrow().getCompanyName()).isEqualTo("Original");
    }

    @Test
    void simultaneousCompanyWritesHaveExactlyOneWinner() throws Exception {
        var company = createCompany("cas-simultaneous@example.test", "Original", CompanyStatus.VERIFIED);
        String token = bearerToken(company.getUser());
        var start = new java.util.concurrent.CountDownLatch(1);
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var writes = java.util.stream.Stream.of("A", "B").map(name -> pool.submit(() -> {
                start.await();
                return mockMvc.perform(put("/api/companies/me").header(HttpHeaders.AUTHORIZATION, token).header(HttpHeaders.IF_MATCH, "\"0\"")
                        .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(Map.of("companyName", name, "companySize", name + " size", "logoUrl", "https://example.test/" + name + ".png"))))
                        .andReturn().getResponse().getStatus();
            })).toList();
            start.countDown();
            assertThat(java.util.List.of(writes.get(0).get(10, java.util.concurrent.TimeUnit.SECONDS), writes.get(1).get(10, java.util.concurrent.TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(200, 409);
        }
        var persisted = companyRepository.findById(company.getId()).orElseThrow();
        assertThat(persisted.getAccountRevision()).isEqualTo(1);
        assertThat(persisted.getCompanyName()).isIn("A", "B");
        assertThat(persisted.getStatus()).isEqualTo(CompanyStatus.VERIFIED);
        assertThat(persisted.getCompanySize()).isEqualTo(persisted.getCompanyName() + " size");
        assertThat(persisted.getLogoUrl()).isEqualTo("https://example.test/" + persisted.getCompanyName() + ".png");
    }
    @Test
    void staleCompanyTabCannotOverwriteConfirmedAccount() throws Exception {
        var company = createCompany("cas-company@example.test", "Original", CompanyStatus.VERIFIED);
        String token = bearerToken(company.getUser());
        String path = "/api/companies/me";
        // Both tabs captured the same original account, before either mutation.
        mockMvc.perform(get(path).header(HttpHeaders.AUTHORIZATION, token)).andExpect(status().isOk());
        mockMvc.perform(get(path).header(HttpHeaders.AUTHORIZATION, token)).andExpect(status().isOk());
        mockMvc.perform(put(path).header(HttpHeaders.AUTHORIZATION, token).header(HttpHeaders.IF_MATCH, "\"0\"")
                .contentType(MediaType.APPLICATION_JSON).content("{\"companyName\":\"Tab A\",\"companySize\":\"Confirmed size\",\"logoUrl\":\"https://example.test/confirmed.png\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(put(path).header(HttpHeaders.AUTHORIZATION, token).header(HttpHeaders.IF_MATCH, "\"0\"")
                .contentType(MediaType.APPLICATION_JSON).content("{\"companyName\":\"Tab B stale\",\"companySize\":\"Stale size\",\"logoUrl\":\"https://example.test/stale.png\"}"))
                .andExpect(status().isConflict());
        var saved = companyRepository.findById(company.getId()).orElseThrow();
        assertThat(saved.getCompanyName()).isEqualTo("Tab A");
        assertThat(saved.getCompanySize()).isEqualTo("Confirmed size");
        assertThat(saved.getLogoUrl()).isEqualTo("https://example.test/confirmed.png");
        assertThat(saved.getAccountRevision()).isEqualTo(1);
    }

    @Test
    void stalePreferencesTabCannotOverwriteFirstInsert() throws Exception {
        var student = createStudent("cas-student@example.test");
        String token = bearerToken(student.getUser()), path = "/api/users/me/notification-settings";
        mockMvc.perform(get(path).header(HttpHeaders.AUTHORIZATION, token)).andExpect(status().isOk());
        mockMvc.perform(get(path).header(HttpHeaders.AUTHORIZATION, token)).andExpect(status().isOk());
        String a = "{\"applicationStatusEnabled\":false,\"jobStatusEnabled\":true,\"recommendationEnabled\":true,\"systemEnabled\":true}";
        String b = "{\"applicationStatusEnabled\":true,\"jobStatusEnabled\":false,\"recommendationEnabled\":true,\"systemEnabled\":true}";
        mockMvc.perform(put(path).header(HttpHeaders.AUTHORIZATION, token).header(HttpHeaders.IF_MATCH, "\"0\"")
                .contentType(MediaType.APPLICATION_JSON).content(a)).andExpect(status().isOk());
        mockMvc.perform(put(path).header(HttpHeaders.AUTHORIZATION, token).header(HttpHeaders.IF_MATCH, "\"0\"")
                .contentType(MediaType.APPLICATION_JSON).content(b)).andExpect(status().isConflict());
        mockMvc.perform(get(path).header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(jsonPath("$.data.applicationStatusEnabled").value(false));
    }
}
