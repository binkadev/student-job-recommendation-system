package com.tttn.jobrecommendation.modules.job.repository;

import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;

import java.util.Collection;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface JobRepository extends JpaRepository<Job, Long>, JpaSpecificationExecutor<Job> {

    @Override
    @EntityGraph(attributePaths = {"company"})
    Page<Job> findAll(Specification<Job> specification, Pageable pageable);

    Optional<Job> findFirstByCompanyIdAndTitleOrderByIdAsc(Long companyId, String title);

    Optional<Job> findByIdAndCompanyId(Long id, Long companyId);

    @Query("select job.company.id from Job job where job.id = :id")
    Optional<Long> findCompanyIdById(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select job from Job job where job.id = :id")
    Optional<Job> findByIdForUpdate(@Param("id") Long id);

    long countByCompanyIdAndStatus(Long companyId, JobStatus status);

    List<Job> findByCompanyIdAndStatusOrderByPublishedAtDescIdDesc(Long companyId, JobStatus status);

    @EntityGraph(attributePaths = {"company"})
    @Query("""
            select job
            from Job job
            where job.id = :jobId
              and job.status = :jobStatus
              and job.company.status = :companyStatus
              and (job.deadline is null or job.deadline >= :today)
            """)
    Optional<Job> findPublicById(
            @Param("jobId") Long jobId,
            @Param("jobStatus") JobStatus jobStatus,
            @Param("companyStatus") CompanyStatus companyStatus,
            @Param("today") LocalDate today
    );

    @EntityGraph(attributePaths = {"company"})
    @Query("""
            select job
            from Job job
            where job.status = :jobStatus
              and job.company.status = :companyStatus
              and (job.deadline is null or job.deadline >= :today)
            order by job.id asc
            """)
    List<Job> findEligibleForRecommendation(
            @Param("jobStatus") JobStatus jobStatus,
            @Param("companyStatus") CompanyStatus companyStatus,
            @Param("today") LocalDate today
    );

    @Query("""
            select count(job.id)
            from Job job
            where job.status = :jobStatus
              and job.company.status = :companyStatus
              and (job.deadline is null or job.deadline >= :today)
            """)
    long countEligibleForRecommendation(
            @Param("jobStatus") JobStatus jobStatus,
            @Param("companyStatus") CompanyStatus companyStatus,
            @Param("today") LocalDate today
    );

    @Query(value = """
            SELECT j.id
            FROM jobs j
            JOIN companies c ON c.id = j.company_id
            LEFT JOIN (
                SELECT js.job_id, COUNT(*) AS skill_matches
                FROM job_skills js
                JOIN skills s ON s.id = js.skill_id
                WHERE COALESCE(NULLIF(BTRIM(LOWER(s.normalized_name)), ''), LOWER(s.name)) IN (:cvSkills)
                GROUP BY js.job_id
            ) sm ON sm.job_id = j.id
            WHERE j.status = 'ACTIVE'
              AND c.status = 'VERIFIED'
              AND (j.deadline IS NULL OR j.deadline >= :today)
            ORDER BY
                (CAST(COALESCE(sm.skill_matches, 0) AS DOUBLE PRECISION) * 10.0 +
                 CASE
                     WHEN :ftsQuery = '' THEN 0.0
                     ELSE CAST(ts_rank_cd(
                         to_tsvector(
                             'english',
                             COALESCE(j.title, '') || ' ' || COALESCE(j.description, '') || ' ' || COALESCE(j.requirements, '')
                         ),
                         to_tsquery('english', :ftsQuery)
                     ) AS DOUBLE PRECISION)
                 END) DESC,
                COALESCE(j.published_at, j.created_at) DESC,
                j.id ASC
            LIMIT :maxCandidates
            """, nativeQuery = true)
    List<Long> findTopCandidateJobIdsForRecommendation(
            @Param("today") LocalDate today,
            @Param("cvSkills") Collection<String> cvSkills,
            @Param("ftsQuery") String ftsQuery,
            @Param("maxCandidates") int maxCandidates
    );

    @Query("""
            select job
            from Job job
            join fetch job.company
            where job.id in :ids
            """)
    List<Job> findWithCompanyByIdIn(@Param("ids") Collection<Long> ids);

    @Query("""
            select j.company.id as companyId, count(j.id) as openJobs
            from Job j
            where j.company.id in :companyIds and j.status = :status
            group by j.company.id
            """)
    List<CompanyOpenJobsCount> countOpenJobsByCompanyIds(
            @Param("companyIds") Collection<Long> companyIds,
            @Param("status") JobStatus status
    );
}
