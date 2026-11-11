package com.tttn.jobrecommendation.modules.interview.repository;

import com.tttn.jobrecommendation.modules.interview.entity.Interview;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface InterviewRepository extends JpaRepository<Interview, Long> {
    Page<Interview> findByCompanyId(Long companyId, Pageable pageable);
    Page<Interview> findByStudentId(Long studentId, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select item from Interview item where item.id = :id")
    Optional<Interview> findByIdForUpdate(@Param("id") Long id);
}
