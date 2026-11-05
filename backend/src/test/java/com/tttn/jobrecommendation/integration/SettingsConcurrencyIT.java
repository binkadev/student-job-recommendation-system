package com.tttn.jobrecommendation.integration;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class SettingsConcurrencyIT extends AbstractPostgresWebIntegrationTest {
    @Test
    void missingMalformedAndStalePreconditionsNeverWrite() throws Exception {
        var company = createCompany("cas-preconditions@example.test", "Original", CompanyStatus.VERIFIED);
        String token = bearerToken(company.getUser());
        for (String path : java.util.List.of("/api/companies/me", "/api/users/me/notification-settings")) {
            String body = path.endsWith("notification-settings")
                    ? "{\"applicationStatusEnabled\":true,\"jobStatusEnabled\":true,\"recommendationEnabled\":true,\"systemEnabled\":true}"
                    : "{\"companyName\":\"Changed\"}";
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
                        .contentType(MediaType.APPLICATION_JSON).content("{\"companyName\":\"" + name + "\"}"))
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
                .contentType(MediaType.APPLICATION_JSON).content("{\"companyName\":\"Tab A\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(put(path).header(HttpHeaders.AUTHORIZATION, token).header(HttpHeaders.IF_MATCH, "\"0\"")
                .contentType(MediaType.APPLICATION_JSON).content("{\"companyName\":\"Tab B stale\"}"))
                .andExpect(status().isConflict());
        assertThat(companyRepository.findById(company.getId()).orElseThrow().getCompanyName()).isEqualTo("Tab A");
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
