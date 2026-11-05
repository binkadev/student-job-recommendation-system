package com.tttn.jobrecommendation.modules.student.repository;

import com.tttn.jobrecommendation.modules.student.entity.Student;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface StudentRepository extends JpaRepository<Student, Long> {

    Optional<Student> findByUserId(Long userId);

    @Modifying
    @Query(value = "UPDATE students SET profile_revision = profile_revision + 1 WHERE user_id = :userId AND profile_revision = :revision", nativeQuery = true)
    int advanceProfileRevision(@Param("userId") Long userId, @Param("revision") long revision);
}
