package com.tttn.jobrecommendation.integration;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.NotificationType;
import com.tttn.jobrecommendation.common.enums.ReferenceType;
import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.notification.entity.Notification;
import com.tttn.jobrecommendation.modules.notification.dto.request.UpdateNotificationSettingsRequest;
import com.tttn.jobrecommendation.modules.notification.repository.NotificationRepository;
import com.tttn.jobrecommendation.modules.notification.repository.UserNotificationSettingsRepository;
import com.tttn.jobrecommendation.modules.notification.service.NotificationSettingsService;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class NotificationSettingsApiIT extends AbstractPostgresWebIntegrationTest {

    private static final String ALL_ENABLED = """
            {
              "applicationStatusEnabled": true,
              "jobStatusEnabled": true,
              "recommendationEnabled": true,
              "systemEnabled": true
            }
            """;

    private static final String APPLICATION_DISABLED = """
            {
              "applicationStatusEnabled": false,
              "jobStatusEnabled": true,
              "recommendationEnabled": true,
              "systemEnabled": true
            }
            """;

    @Autowired
    private UserNotificationSettingsRepository settingsRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private NotificationSettingsService notificationSettingsService;

    private Student student;
    private Company company;
    private User admin;
    private JobApplication application;

    @BeforeEach
    void createFixtures() {
        student = createStudent("settings-student@example.test");
        student.getUser().setFullName("Settings Student");
        userRepository.saveAndFlush(student.getUser());
        company = createCompany(
                "settings-company@example.test",
                "Settings Company",
                CompanyStatus.VERIFIED
        );
        admin = createUser("settings-admin@example.test", UserRole.ADMIN);
        Job job = createJob(company, "Settings Java Intern", JobStatus.ACTIVE);
        application = createApplication(student, job, null, ApplicationStatus.PENDING);
    }

    @Test
    void getReturnsAllTrueDefaultsWithoutCreatingARow() throws Exception {
        mockMvc.perform(get("/api/users/me/notification-settings")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.applicationStatusEnabled").value(true))
                .andExpect(jsonPath("$.data.jobStatusEnabled").value(true))
                .andExpect(jsonPath("$.data.recommendationEnabled").value(true))
                .andExpect(jsonPath("$.data.systemEnabled").value(true))
                .andExpect(jsonPath("$.data.updatedAt").doesNotExist());

        assertThat(settingsRepository.count()).isZero();
    }

    @Test
    void putCreatesThenUpdatesTheSameRow() throws Exception {
        mockMvc.perform(put("/api/users/me/notification-settings")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ALL_ENABLED))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.applicationStatusEnabled").value(true))
                .andExpect(jsonPath("$.data.updatedAt").isNotEmpty());

        Long settingsId = settingsRepository.findByUserId(student.getUser().getId()).orElseThrow().getId();

        mockMvc.perform(put("/api/users/me/notification-settings")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(APPLICATION_DISABLED))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.applicationStatusEnabled").value(false))
                .andExpect(jsonPath("$.data.jobStatusEnabled").value(true));

        assertThat(settingsRepository.count()).isEqualTo(1);
        assertThat(settingsRepository.findByUserId(student.getUser().getId()).orElseThrow().getId())
                .isEqualTo(settingsId);
    }

    @Test
    void everySupportedRoleCanAccessOnlyItsOwnSettings() throws Exception {
        for (User user : new User[]{student.getUser(), company.getUser(), admin}) {
            mockMvc.perform(get("/api/users/me/notification-settings")
                            .header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.applicationStatusEnabled").value(true));

            mockMvc.perform(put("/api/users/me/notification-settings")
                            .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(ALL_ENABLED))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.applicationStatusEnabled").value(true));
        }

        mockMvc.perform(put("/api/users/me/notification-settings")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(APPLICATION_DISABLED))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/users/me/notification-settings")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(company.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.applicationStatusEnabled").value(true));

        assertThat(settingsRepository.findByUserId(student.getUser().getId())).isPresent();
        assertThat(settingsRepository.findByUserId(company.getUser().getId())).isPresent();
        assertThat(settingsRepository.findByUserId(admin.getId())).isPresent();
    }

    @Test
    void userIdCannotBeSuppliedToTargetAnotherUsersSettings() throws Exception {
        mockMvc.perform(put("/api/users/me/notification-settings")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "userId": %d,
                                  "applicationStatusEnabled": false,
                                  "jobStatusEnabled": true,
                                  "recommendationEnabled": true,
                                  "systemEnabled": true
                                }
                                """.formatted(company.getUser().getId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("BAD_REQUEST"));

        assertThat(settingsRepository.count()).isZero();
    }

    @Test
    void missingBooleanFailsValidation() throws Exception {
        mockMvc.perform(put("/api/users/me/notification-settings")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "applicationStatusEnabled": true,
                                  "jobStatusEnabled": true,
                                  "recommendationEnabled": true
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_ERROR"));
    }

    @Test
    void concurrentFirstUpdatesCreateOnlyOneRow() throws Exception {
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<?> first = executor.submit(() -> updateSettingsAfterSignal(
                    start,
                    notificationSettingsRequest(false)
            ));
            Future<?> second = executor.submit(() -> updateSettingsAfterSignal(
                    start,
                    notificationSettingsRequest(true)
            ));

            start.countDown();
            first.get(10, TimeUnit.SECONDS);
            second.get(10, TimeUnit.SECONDS);
        } finally {
            executor.shutdownNow();
        }

        assertThat(settingsRepository.count()).isEqualTo(1);
        assertThat(settingsRepository.findByUserId(student.getUser().getId())).isPresent();
    }

    @Test
    void disabledApplicationStatusPreferencePreventsFutureNotification() throws Exception {
        updateStudentSettings(APPLICATION_DISABLED);

        mockMvc.perform(patch("/api/applications/{id}/status", application.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(company.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"REVIEWED\"}"))
                .andExpect(status().isOk());

        assertThat(notificationRepository.count()).isZero();
    }

    @Test
    void missingSettingsContinueToAllowNotificationCreation() throws Exception {
        mockMvc.perform(patch("/api/applications/{id}/status", application.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(company.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"REVIEWED\"}"))
                .andExpect(status().isOk());

        assertThat(notificationRepository.count()).isEqualTo(1);
        Notification notification = notificationRepository.findAll().getFirst();
        assertThat(notification.getUser().getId()).isEqualTo(student.getUser().getId());
        assertThat(notification.getType()).isEqualTo(NotificationType.APPLICATION_STATUS_CHANGED);
    }

    @Test
    void disablingSettingsDoesNotDeleteExistingNotifications() throws Exception {
        notificationRepository.saveAndFlush(Notification.builder()
                .user(student.getUser())
                .type(NotificationType.APPLICATION_STATUS_CHANGED)
                .title("Existing notification")
                .message("Existing notification remains")
                .referenceType(ReferenceType.APPLICATION)
                .referenceId(application.getId())
                .read(false)
                .build());

        updateStudentSettings(APPLICATION_DISABLED);

        assertThat(notificationRepository.count()).isEqualTo(1);
        assertThat(notificationRepository.findAll().getFirst().getTitle()).isEqualTo("Existing notification");
    }

    private void updateStudentSettings(String content) throws Exception {
        mockMvc.perform(put("/api/users/me/notification-settings")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(content))
                .andExpect(status().isOk());
    }

    private UpdateNotificationSettingsRequest notificationSettingsRequest(boolean applicationStatusEnabled) {
        UpdateNotificationSettingsRequest request = new UpdateNotificationSettingsRequest();
        request.setApplicationStatusEnabled(applicationStatusEnabled);
        request.setJobStatusEnabled(true);
        request.setRecommendationEnabled(true);
        request.setSystemEnabled(true);
        return request;
    }

    private void updateSettingsAfterSignal(
            CountDownLatch start,
            UpdateNotificationSettingsRequest request
    ) {
        try {
            start.await();
            notificationSettingsService.updateMySettings(student.getUser().getId(), request);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(exception);
        }
    }
}
