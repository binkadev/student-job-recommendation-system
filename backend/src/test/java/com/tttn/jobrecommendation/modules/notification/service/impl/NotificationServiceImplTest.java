package com.tttn.jobrecommendation.modules.notification.service.impl;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.NotificationType;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.notification.entity.Notification;
import com.tttn.jobrecommendation.modules.notification.mapper.NotificationMapper;
import com.tttn.jobrecommendation.modules.notification.repository.NotificationRepository;
import com.tttn.jobrecommendation.modules.notification.service.NotificationSettingsService;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationServiceImplTest {

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private NotificationMapper notificationMapper;

    @Mock
    private NotificationSettingsService notificationSettingsService;

    private NotificationServiceImpl notificationService;
    private JobApplication application;

    @BeforeEach
    void setUp() {
        notificationService = new NotificationServiceImpl(
                notificationRepository,
                notificationMapper,
                notificationSettingsService
        );
        User user = User.builder().id(7L).fullName("Student").email("student@example.test").build();
        Student student = Student.builder().id(8L).user(user).build();
        Job job = Job.builder().id(9L).title("Java Intern").build();
        application = JobApplication.builder()
                .id(10L)
                .student(student)
                .job(job)
                .status(ApplicationStatus.REVIEWED)
                .build();
    }

    @Test
    void disabledApplicationStatusPreferenceSkipsCreation() {
        when(notificationSettingsService.isEnabled(7L, NotificationType.APPLICATION_STATUS_CHANGED))
                .thenReturn(false);

        notificationService.createApplicationStatusChangedNotification(application);

        verify(notificationRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void enabledApplicationStatusPreferenceCreatesNotification() {
        when(notificationSettingsService.isEnabled(7L, NotificationType.APPLICATION_STATUS_CHANGED))
                .thenReturn(true);
        ArgumentCaptor<Notification> notificationCaptor = ArgumentCaptor.forClass(Notification.class);

        notificationService.createApplicationStatusChangedNotification(application);

        verify(notificationRepository).save(notificationCaptor.capture());
        Notification notification = notificationCaptor.getValue();
        assertThat(notification.getUser()).isEqualTo(application.getStudent().getUser());
        assertThat(notification.getType()).isEqualTo(NotificationType.APPLICATION_STATUS_CHANGED);
        assertThat(notification.getReferenceId()).isEqualTo(application.getId());
        assertThat(notification.getMessage()).contains("Java Intern", "REVIEWED");
    }
}
