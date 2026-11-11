package com.tttn.jobrecommendation.modules.message.repository;

import com.tttn.jobrecommendation.modules.message.entity.Conversation;
import com.tttn.jobrecommendation.modules.message.dto.response.ConversationResponse;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {
    Optional<Conversation> findByApplicationId(Long applicationId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Conversation c where c.id = :id")
    Optional<Conversation> findByIdForUpdate(@Param("id") Long id);

    @Query(value = """
            select new com.tttn.jobrecommendation.modules.message.dto.response.ConversationResponse(
                c.id, a.id, c.company.id, c.student.id, a.job.id, c.lastMessageAt, c.createdAt, c.updatedAt)
            from Conversation c join c.application a
            where c.student.id = a.student.id and c.company.id = a.job.company.id
              and ((:company = true and a.job.company.user.id = :userId)
                or (:company = false and a.student.user.id = :userId))
            order by coalesce(c.lastMessageAt, c.createdAt) desc, c.id desc
            """, countQuery = """
            select count(c) from Conversation c join c.application a
            where c.student.id = a.student.id and c.company.id = a.job.company.id
              and ((:company = true and a.job.company.user.id = :userId)
                or (:company = false and a.student.user.id = :userId))
            """)
    Page<ConversationResponse> findOwned(@Param("userId") Long userId, @Param("company") boolean company, Pageable pageable);
}
