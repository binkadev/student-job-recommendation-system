package com.tttn.jobrecommendation.modules.message.repository;

import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.modules.message.entity.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface MessageRepository extends JpaRepository<Message, Long> {
    Page<Message> findByConversationId(Long conversationId, Pageable pageable);

    @Modifying
    @Query("""
            update Message m set m.read = true where m.conversation.id = :conversationId
              and m.sender.id = :senderId and m.senderRole = :senderRole and m.read = false
            """)
    int markIncomingRead(@Param("conversationId") Long conversationId, @Param("senderId") Long senderId,
            @Param("senderRole") UserRole senderRole);
}
