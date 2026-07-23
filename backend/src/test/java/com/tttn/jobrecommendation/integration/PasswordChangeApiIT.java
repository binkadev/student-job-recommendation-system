package com.tttn.jobrecommendation.integration;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.user.entity.User;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PasswordChangeApiIT extends AbstractPostgresWebIntegrationTest {

    private static final String CURRENT_PASSWORD = "CurrentPassword1!";
    private static final String NEW_PASSWORD = "NewPassword2!";

    @Autowired
    private PasswordEncoder passwordEncoder;

    @ParameterizedTest
    @EnumSource(UserRole.class)
    void everySupportedRoleCanChangeOnlyItsOwnPassword(UserRole role) throws Exception {
        User user = createRoleUser(role, "password-" + role.name().toLowerCase() + "@example.test");
        String response = changePassword(user, CURRENT_PASSWORD, NEW_PASSWORD)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").doesNotExist())
                .andReturn().getResponse().getContentAsString();

        User persisted = userRepository.findById(user.getId()).orElseThrow();
        assertThat(persisted.getPasswordHash()).isNotEqualTo(NEW_PASSWORD);
        assertThat(passwordEncoder.matches(NEW_PASSWORD, persisted.getPasswordHash())).isTrue();
        assertThat(passwordEncoder.matches(CURRENT_PASSWORD, persisted.getPasswordHash())).isFalse();
        assertThat(response)
                .doesNotContain(CURRENT_PASSWORD)
                .doesNotContain(NEW_PASSWORD)
                .doesNotContain(persisted.getPasswordHash())
                .doesNotContain("passwordHash");
    }

    @Test
    void wrongCurrentPasswordReturnsStableErrorAndDoesNotChangeHash() throws Exception {
        User user = createRoleUser(UserRole.STUDENT, "wrong-current@example.test");
        String existingHash = user.getPasswordHash();

        changePassword(user, "WrongPassword1!", NEW_PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("INVALID_CURRENT_PASSWORD"));

        assertThat(userRepository.findById(user.getId()).orElseThrow().getPasswordHash()).isEqualTo(existingHash);
    }

    @Test
    void equalAndPolicyInvalidNewPasswordsAreRejected() throws Exception {
        User user = createRoleUser(UserRole.STUDENT, "password-policy@example.test");

        changePassword(user, CURRENT_PASSWORD, CURRENT_PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("BAD_REQUEST"));

        changePassword(user, CURRENT_PASSWORD, "short")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_ERROR"));

        changePassword(user, CURRENT_PASSWORD, "a".repeat(73))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_ERROR"));

        changePassword(user, CURRENT_PASSWORD, "é".repeat(40))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_ERROR"));
    }

    @Test
    void unknownPasswordRequestPropertiesAreRejected() throws Exception {
        User user = createRoleUser(UserRole.STUDENT, "password-unknown@example.test");

        mockMvc.perform(patch("/api/users/me/password")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "currentPassword": "%s",
                                  "newPassword": "%s",
                                  "userId": 999
                                }
                                """.formatted(CURRENT_PASSWORD, NEW_PASSWORD)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("BAD_REQUEST"));
    }

    @Test
    void oldPasswordStopsAuthenticatingAndNewPasswordAuthenticates() throws Exception {
        User user = createRoleUser(UserRole.STUDENT, "password-login@example.test");

        changePassword(user, CURRENT_PASSWORD, NEW_PASSWORD).andExpect(status().isOk());

        login(user.getEmail(), CURRENT_PASSWORD)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value("INVALID_CREDENTIALS"));
        login(user.getEmail(), NEW_PASSWORD)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.token").isNotEmpty());
    }

    @Test
    void existingAccessTokenRemainsValidAndUnauthenticatedChangeIsDenied() throws Exception {
        User user = createRoleUser(UserRole.STUDENT, "password-token@example.test");
        String existingToken = bearerToken(user);

        changePassword(user, CURRENT_PASSWORD, NEW_PASSWORD).andExpect(status().isOk());

        mockMvc.perform(get("/api/auth/me").header(HttpHeaders.AUTHORIZATION, existingToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(user.getId()));

        mockMvc.perform(patch("/api/users/me/password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(passwordBody(CURRENT_PASSWORD, NEW_PASSWORD)))
                .andExpect(status().isUnauthorized());
    }

    private User createRoleUser(UserRole role, String email) {
        User user;
        if (role == UserRole.STUDENT) {
            Student student = createStudent(email);
            user = student.getUser();
        } else if (role == UserRole.COMPANY) {
            Company company = createCompany(email, "Password Company", CompanyStatus.VERIFIED);
            user = company.getUser();
        } else {
            user = createUser(email, UserRole.ADMIN);
        }
        user.setPasswordHash(passwordEncoder.encode(CURRENT_PASSWORD));
        return userRepository.saveAndFlush(user);
    }

    private org.springframework.test.web.servlet.ResultActions changePassword(
            User user,
            String currentPassword,
            String newPassword
    ) throws Exception {
        return mockMvc.perform(patch("/api/users/me/password")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(passwordBody(currentPassword, newPassword)));
    }

    private org.springframework.test.web.servlet.ResultActions login(String email, String password) throws Exception {
        return mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "email": "%s",
                          "password": "%s"
                        }
                        """.formatted(email, password)));
    }

    private String passwordBody(String currentPassword, String newPassword) {
        return """
                {
                  "currentPassword": "%s",
                  "newPassword": "%s"
                }
                """.formatted(currentPassword, newPassword);
    }
}
