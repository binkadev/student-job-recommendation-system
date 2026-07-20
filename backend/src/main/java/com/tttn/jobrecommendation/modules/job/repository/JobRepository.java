package com.tttn.jobrecommendation.modules.job.repository;

import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface JobRepository extends JpaRepository<Job, Long>, JpaSpecificationExecutor<Job> {

    Optional<Job> findFirstByCompanyIdAndTitleOrderByIdAsc(Long companyId, String title);

    long countByCompanyIdAndStatus(Long companyId, JobStatus status);

    List<Job> findByCompanyIdAndStatusOrderByPublishedAtDescIdDesc(Long companyId, JobStatus status);

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
