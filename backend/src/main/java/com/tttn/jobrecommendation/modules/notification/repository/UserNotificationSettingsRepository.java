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
                revision,
                created_at,
                updated_at
            )
            VALUES (
                :userId,
                :applicationStatusEnabled,
                :jobStatusEnabled,
                :recommendationEnabled,
                :systemEnabled,
                1,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            )
            ON CONFLICT (user_id) DO NOTHING
            """, nativeQuery = true)
    int insertInitial(
            @Param("userId") Long userId,
            @Param("applicationStatusEnabled") boolean applicationStatusEnabled,
            @Param("jobStatusEnabled") boolean jobStatusEnabled,
            @Param("recommendationEnabled") boolean recommendationEnabled,
            @Param("systemEnabled") boolean systemEnabled
    );

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
            UPDATE user_notification_settings SET
                application_status_enabled = :applicationStatusEnabled,
                job_status_enabled = :jobStatusEnabled,
                recommendation_enabled = :recommendationEnabled,
                system_enabled = :systemEnabled,
                revision = revision + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = :userId AND revision = :revision
            """, nativeQuery = true)
    int updateIfRevision(@Param("userId") Long userId,
            @Param("applicationStatusEnabled") boolean applicationStatusEnabled,
            @Param("jobStatusEnabled") boolean jobStatusEnabled,
            @Param("recommendationEnabled") boolean recommendationEnabled,
            @Param("systemEnabled") boolean systemEnabled, @Param("revision") long revision);
}
