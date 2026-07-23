package com.tttn.jobrecommendation.modules.student.repository;

import com.tttn.jobrecommendation.modules.student.entity.SavedSearch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SavedSearchRepository extends JpaRepository<SavedSearch, Long> {

    List<SavedSearch> findByStudentIdOrderByUpdatedAtDescIdDesc(Long studentId);

    Optional<SavedSearch> findByIdAndStudentId(Long id, Long studentId);

    boolean existsByStudentIdAndNameIgnoreCase(Long studentId, String name);

    boolean existsByStudentIdAndNameIgnoreCaseAndIdNot(Long studentId, String name, Long id);
}
