package com.tttn.jobrecommendation.modules.notification.service;

import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.NotificationType;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.recommendation.entity.RecommendationRun;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.notification.dto.response.NotificationResponse;
import com.tttn.jobrecommendation.modules.notification.dto.response.UnreadNotificationCountResponse;

public interface NotificationService {

    default PageResponse<NotificationResponse> getMyNotifications(Long userId, Integer page, Integer size) {
        return getMyNotifications(userId, page, size, null, null);
    }

    PageResponse<NotificationResponse> getMyNotifications(Long userId, Integer page, Integer size,
                                                       Boolean unread, NotificationType type);

    UnreadNotificationCountResponse getUnreadCount(Long userId);

    NotificationResponse markAsRead(Long userId, Long notificationId);

    void markAllAsRead(Long userId);

    void createApplicationStatusChangedNotification(JobApplication application);

    /** Notifies the Company owning the Job that a Student submitted an application. */
    void createApplicationSubmittedNotification(JobApplication application);

    /** Notifies the Company owning the Job that a Student withdrew an application. */
    void createApplicationWithdrawnNotification(JobApplication application);

    /** Notifies the owning Company after an Admin moved a Job to ACTIVE or REJECTED. */
    void createJobModerationNotification(Job job, JobStatus newStatus);

    /** Notifies the Company user after an Admin changed its verification status to VERIFIED or BLOCKED. */
    void createCompanyVerificationNotification(Company company, CompanyStatus newStatus);

    /** Notifies the Student that a Recommendation V3 run finished and its results were persisted. */
    void createRecommendationReadyNotification(RecommendationRun run, int resultCount);
}
