package com.tttn.jobrecommendation.modules.message.entity;

import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.modules.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "messages")
public class Message {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conversation_id", nullable = false)
    private Conversation conversation;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sender_user_id", nullable = false)
    private User sender;
    @Enumerated(EnumType.STRING)
    @Column(name = "sender_role", nullable = false, length = 20)
    private UserRole senderRole;
    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;
    @Column(name = "is_read", nullable = false)
    private boolean read;
    // Set after obtaining the conversation lock, together with lastMessageAt.
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
