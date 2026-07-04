package com.tttn.jobrecommendation.modules.student.repository;

import com.tttn.jobrecommendation.modules.student.entity.Student;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudentRepository extends JpaRepository<Student, Long> {
}
