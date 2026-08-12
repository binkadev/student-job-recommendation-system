package com.tttn.jobrecommendation.modules.application.repository;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface JobApplicationRepository extends JpaRepository<JobApplication, Long>, JpaSpecificationExecutor<JobApplication> {

    boolean existsByStudentIdAndJobIdAndStatusIn(Long studentId, Long jobId, Set<ApplicationStatus> statuses);

    boolean existsByCvFileId(Long cvFileId);

    @Query("select distinct application.cvFile.id from JobApplication application where application.cvFile.id in :cvFileIds")
    List<Long> findReferencedCvFileIds(@Param("cvFileIds") java.util.Collection<Long> cvFileIds);

    List<JobApplication> findByStudentIdOrderByAppliedAtDescIdDesc(Long studentId);

    List<JobApplication> findByStudentIdAndJobIdOrderByAppliedAtDescIdDesc(Long studentId, Long jobId);

    Optional<JobApplication> findFirstByStudentIdAndJobIdOrderByAppliedAtDescIdDesc(Long studentId, Long jobId);

    List<JobApplication> findByJobIdOrderByAppliedAtDesc(Long jobId);

    Optional<JobApplication> findByIdAndStudentId(Long id, Long studentId);

    @Query("""
            select new com.tttn.jobrecommendation.modules.application.repository.CandidateRankingApplicationRow(
                application.id,
                application.status,
                application.student.id,
                application.job.id,
                cv.id,
                cv.student.id,
                cv.extractedText,
                cv.processedText,
                cv.extractedSkills,
                cv.analysisStatus,
                cv.languageCode,
                cv.languageConfidence,
                cv.processingVersion,
                cv.analyzedAt
            )
            from JobApplication application
            left join application.cvFile cv
            where application.job.id = :jobId
            order by application.id asc
            """)
    List<CandidateRankingApplicationRow> findCandidateRankingRowsByJobId(@Param("jobId") Long jobId);

    @EntityGraph(attributePaths = {"job", "cvFile"})
    @Query("select application from JobApplication application where application.id in :applicationIds")
    List<JobApplication> findCandidateRankingApplicationsByIdIn(
            @Param("applicationIds") Set<Long> applicationIds
    );

    @Override
    @EntityGraph(attributePaths = {"student.user", "job.company", "cvFile"})
    Page<JobApplication> findAll(Specification<JobApplication> specification, Pageable pageable);

    @EntityGraph(attributePaths = {"student.user", "job.company", "cvFile"})
    @Query("select application from JobApplication application where application.id = :id")
    Optional<JobApplication> findDetailedById(@Param("id") Long id);
}
