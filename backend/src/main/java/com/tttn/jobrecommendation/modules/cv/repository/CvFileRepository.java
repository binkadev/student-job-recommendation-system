package com.tttn.jobrecommendation.modules.cv.repository;

import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface CvFileRepository extends JpaRepository<CvFile, Long> {

    List<CvFile> findByStudentIdOrderByUploadedAtDesc(Long studentId);

    Optional<CvFile> findByIdAndStudentId(Long id, Long studentId);

    Optional<CvFile> findFirstByStudentIdAndActiveTrueOrderByUploadedAtDesc(Long studentId);

    @Modifying
    @Query("update CvFile c set c.active = false where c.student.id = :studentId and c.active = true")
    void deactivateActiveCvFiles(Long studentId);

    @Modifying(flushAutomatically = true)
    @Query("update CvFile c set c.active = false where c.student.id = :studentId and c.id <> :cvFileId and c.active = true")
    void deactivateOtherActiveCvFiles(Long studentId, Long cvFileId);
}
