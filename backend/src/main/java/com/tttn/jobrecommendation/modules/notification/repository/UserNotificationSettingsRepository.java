package com.tttn.jobrecommendation.modules.notification.repository;

import com.tttn.jobrecommendation.modules.notification.entity.UserNotificationSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface UserNotificationSettingsRepository extends JpaRepository<UserNotificationSettings, Long> {

    Optional<UserNotificationSettings> findByUserId(Long userId);

    List<UserNotificationSettings> findByUserIdIn(Collection<Long> userIds);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
            INSERT INTO user_notification_settings (
                user_id,
                application_status_enabled,
                job_status_enabled,
                recommendation_enabled,
                system_enabled,
                created_at,
                updated_at
            )
            VALUES (
                :userId,
                :applicationStatusEnabled,
                :jobStatusEnabled,
                :recommendationEnabled,
                :systemEnabled,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            )
            ON CONFLICT (user_id) DO UPDATE SET
                application_status_enabled = EXCLUDED.application_status_enabled,
                job_status_enabled = EXCLUDED.job_status_enabled,
                recommendation_enabled = EXCLUDED.recommendation_enabled,
                system_enabled = EXCLUDED.system_enabled,
                updated_at = CURRENT_TIMESTAMP
            """, nativeQuery = true)
    int upsert(
            @Param("userId") Long userId,
            @Param("applicationStatusEnabled") boolean applicationStatusEnabled,
            @Param("jobStatusEnabled") boolean jobStatusEnabled,
            @Param("recommendationEnabled") boolean recommendationEnabled,
            @Param("systemEnabled") boolean systemEnabled
    );
}
