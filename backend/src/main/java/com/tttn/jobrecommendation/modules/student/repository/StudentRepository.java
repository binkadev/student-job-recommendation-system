package com.tttn.jobrecommendation.modules.student.repository;

import com.tttn.jobrecommendation.modules.student.entity.Student;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface StudentRepository extends JpaRepository<Student, Long> {

    Optional<Student> findByUserId(Long userId);
}
