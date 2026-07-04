package com.tttn.jobrecommendation.modules.cv.repository;

import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CvFileRepository extends JpaRepository<CvFile, Long> {
}
