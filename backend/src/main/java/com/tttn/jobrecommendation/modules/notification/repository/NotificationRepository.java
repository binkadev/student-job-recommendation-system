package com.tttn.jobrecommendation.modules.notification.repository;

import com.tttn.jobrecommendation.modules.notification.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    Page<Notification> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    long countByUserIdAndReadFalse(Long userId);

    Optional<Notification> findByIdAndUserId(Long id, Long userId);

    @Modifying
    @Query("""
            update Notification n
            set n.read = true,
                n.readAt = :readAt,
                n.updatedAt = :readAt
            where n.user.id = :userId
              and n.read = false
            """)
    int markAllUnreadAsReadByUserId(Long userId, LocalDateTime readAt);
}
