package com.tttn.jobrecommendation.modules.notification.service.impl;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.NotificationType;
import com.tttn.jobrecommendation.common.enums.ReferenceType;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.recommendation.entity.RecommendationRun;
import com.tttn.jobrecommendation.modules.user.entity.User;
import com.tttn.jobrecommendation.modules.notification.dto.response.NotificationResponse;
import com.tttn.jobrecommendation.modules.notification.dto.response.UnreadNotificationCountResponse;
import com.tttn.jobrecommendation.modules.notification.entity.Notification;
import com.tttn.jobrecommendation.modules.notification.mapper.NotificationMapper;
import com.tttn.jobrecommendation.modules.notification.repository.NotificationRepository;
import com.tttn.jobrecommendation.modules.notification.service.NotificationService;
import com.tttn.jobrecommendation.modules.notification.service.NotificationSettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@Profile("!no-db")
@RequiredArgsConstructor
public class NotificationServiceImpl implements NotificationService {

    private static final String APPLICATION_STATUS_TITLE = "Application status updated";

    private final NotificationRepository notificationRepository;
    private final NotificationMapper notificationMapper;
    private final NotificationSettingsService notificationSettingsService;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<NotificationResponse> getMyNotifications(Long userId, Integer page, Integer size,
                                                              Boolean unread, NotificationType type) {
        Pageable pageable = PageRequest.of(
                Math.max(page == null ? 1 : page, 1) - 1,
                Math.min(Math.max(size == null ? 20 : size, 1), 100),
                Sort.by(Sort.Direction.DESC, "createdAt", "id")
        );

        Specification<Notification> filter = (root, query, cb) -> cb.equal(root.get("user").get("id"), userId);
        if (unread != null) {
            filter = filter.and((root, query, cb) -> cb.equal(root.get("read"), !unread));
        }
        if (type != null) {
            filter = filter.and((root, query, cb) -> cb.equal(root.get("type"), type));
        }
        Page<Notification> notifications = notificationRepository.findAll(filter, pageable);
        List<NotificationResponse> items = notifications.getContent()
                .stream()
                .map(notificationMapper::toNotificationResponse)
                .toList();

        return new PageResponse<>(
                items,
                notifications.getNumber() + 1,
                notifications.getSize(),
                notifications.getTotalElements(),
                notifications.getTotalPages()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public UnreadNotificationCountResponse getUnreadCount(Long userId) {
        return UnreadNotificationCountResponse.builder()
                .unreadCount(notificationRepository.countByUserIdAndReadFalse(userId))
                .build();
    }

    @Override
    @Transactional
    public NotificationResponse markAsRead(Long userId, Long notificationId) {
        Notification notification = notificationRepository.findByIdAndUserId(notificationId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));

        if (!notification.isRead()) {
            notification.setRead(true);
            notification.setReadAt(LocalDateTime.now());
            notification = notificationRepository.save(notification);
        }

        return notificationMapper.toNotificationResponse(notification);
    }

    @Override
    @Transactional
    public void markAllAsRead(Long userId) {
        notificationRepository.markAllUnreadAsReadByUserId(userId, LocalDateTime.now());
    }

    @Override
    @Transactional
    public void createApplicationStatusChangedNotification(JobApplication application) {
        if (!notificationSettingsService.isEnabled(
                application.getStudent().getUser().getId(),
                NotificationType.APPLICATION_STATUS_CHANGED
        )) {
            return;
        }

        Notification notification = Notification.builder()
                .user(application.getStudent().getUser())
                .type(NotificationType.APPLICATION_STATUS_CHANGED)
                .title(APPLICATION_STATUS_TITLE)
                .message("Your application for " + application.getJob().getTitle()
                        + " has been updated to " + application.getStatus() + ".")
                .referenceType(ReferenceType.APPLICATION)
                .referenceId(application.getId())
                .read(false)
                .build();

        notificationRepository.save(notification);
    }

    @Override
    @Transactional
    public void createApplicationSubmittedNotification(JobApplication application) {
        deliver(
                application.getJob().getCompany().getUser(),
                NotificationType.APPLICATION_STATUS_CHANGED,
                "New application received",
                displayName(application.getStudent().getUser()) + " applied for " + application.getJob().getTitle() + ".",
                ReferenceType.APPLICATION,
                application.getId()
        );
    }

    @Override
    @Transactional
    public void createApplicationWithdrawnNotification(JobApplication application) {
        deliver(
                application.getJob().getCompany().getUser(),
                NotificationType.APPLICATION_STATUS_CHANGED,
                "Application withdrawn",
                displayName(application.getStudent().getUser()) + " withdrew the application for "
                        + application.getJob().getTitle() + ".",
                ReferenceType.APPLICATION,
                application.getId()
        );
    }

    @Override
    @Transactional
    public void createJobModerationNotification(Job job, JobStatus newStatus) {
        String title;
        String message;
        if (newStatus == JobStatus.ACTIVE) {
            title = "Job approved";
            message = "Your job \"" + job.getTitle() + "\" was approved and is now active.";
        } else if (newStatus == JobStatus.REJECTED) {
            title = "Job rejected";
            message = "Your job \"" + job.getTitle() + "\" was rejected by an administrator.";
        } else {
            return;
        }
        deliver(job.getCompany().getUser(), NotificationType.JOB_STATUS_CHANGED, title, message,
                ReferenceType.JOB, job.getId());
    }

    @Override
    @Transactional
    public void createCompanyVerificationNotification(Company company, CompanyStatus newStatus) {
        String title;
        String message;
        if (newStatus == CompanyStatus.VERIFIED) {
            title = "Company verified";
            message = "Your company account has been verified. You can now submit and publish jobs.";
        } else if (newStatus == CompanyStatus.BLOCKED) {
            title = "Company blocked";
            message = "Your company account has been blocked by an administrator.";
        } else {
            return;
        }
        deliver(company.getUser(), NotificationType.SYSTEM, title, message, null, null);
    }

    @Override
    @Transactional
    public void createRecommendationReadyNotification(RecommendationRun run, int resultCount) {
        deliver(
                run.getStudent().getUser(),
                NotificationType.RECOMMENDATION,
                "Job recommendations are ready",
                resultCount == 0
                        ? "Your recommendation run finished, but no jobs met the matching threshold."
                        : "Your recommendation run finished with " + resultCount + " matching job"
                                + (resultCount == 1 ? "" : "s") + ".",
                ReferenceType.RECOMMENDATION_RUN,
                run.getId()
        );
    }

    private void deliver(User recipient, NotificationType type, String title, String message,
                         ReferenceType referenceType, Long referenceId) {
        if (!notificationSettingsService.isEnabled(recipient.getId(), type)) {
            return;
        }
        notificationRepository.save(Notification.builder()
                .user(recipient)
                .type(type)
                .title(title)
                .message(message)
                .referenceType(referenceType)
                .referenceId(referenceId)
                .read(false)
                .build());
    }

    private String displayName(User user) {
        return user.getFullName() == null || user.getFullName().isBlank() ? "A student" : user.getFullName().trim();
    }
}
