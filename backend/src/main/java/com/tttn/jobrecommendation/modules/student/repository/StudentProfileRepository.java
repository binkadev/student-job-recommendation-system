package com.tttn.jobrecommendation.modules.student.repository;

import com.tttn.jobrecommendation.modules.student.entity.StudentProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface StudentProfileRepository extends JpaRepository<StudentProfile, Long> {

    Optional<StudentProfile> findByStudentId(Long studentId);

    List<StudentProfile> findByStudentIdIn(Collection<Long> studentIds);
}
