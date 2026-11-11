package com.tttn.jobrecommendation.modules.invitation.repository;

import com.tttn.jobrecommendation.modules.invitation.entity.JobInvitation;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface JobInvitationRepository extends JpaRepository<JobInvitation, Long> {
    boolean existsByCompanyIdAndStudentIdAndJobIdAndStatus(Long companyId, Long studentId, Long jobId, com.tttn.jobrecommendation.common.enums.InvitationStatus status);

    Page<JobInvitation> findByCompanyId(Long companyId, Pageable pageable);
    Page<JobInvitation> findByStudentId(Long studentId, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select item from JobInvitation item where item.id = :id")
    Optional<JobInvitation> findByIdForUpdate(@Param("id") Long id);
}
