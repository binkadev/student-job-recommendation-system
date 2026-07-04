package com.tttn.jobrecommendation.modules.student.repository;

import com.tttn.jobrecommendation.modules.student.entity.StudentProfile;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudentProfileRepository extends JpaRepository<StudentProfile, Long> {
}
