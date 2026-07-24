package com.tttn.jobrecommendation.modules.job.repository;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface JobRepository extends JpaRepository<Job, Long>, JpaSpecificationExecutor<Job> {

    @Override
    @EntityGraph(attributePaths = {"company"})
    Page<Job> findAll(Specification<Job> specification, Pageable pageable);

    Optional<Job> findFirstByCompanyIdAndTitleOrderByIdAsc(Long companyId, String title);

    long countByStatus(JobStatus status);

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
