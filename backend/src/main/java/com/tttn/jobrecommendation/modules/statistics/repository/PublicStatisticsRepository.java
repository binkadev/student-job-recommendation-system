package com.tttn.jobrecommendation.modules.statistics.repository;

import com.tttn.jobrecommendation.modules.job.entity.Job;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;

public interface PublicStatisticsRepository extends Repository<Job, Long> {

    @Query(value = """
            SELECT
                (
                    SELECT COUNT(j.id)
                    FROM jobs j
                    JOIN companies c ON c.id = j.company_id
                    WHERE j.status = 'ACTIVE'
                      AND c.status = 'VERIFIED'
                      AND (j.deadline IS NULL OR j.deadline >= :today)
                ) AS "totalJobs",
                (
                    SELECT COUNT(c.id)
                    FROM companies c
                    WHERE c.status = 'VERIFIED'
                ) AS "totalCompanies",
                (
                    SELECT COUNT(s.id)
                    FROM students s
                    JOIN users u ON u.id = s.user_id
                    WHERE u.status = 'ACTIVE'
                ) AS "totalStudents",
                (
                    SELECT COUNT(a.id)
                    FROM applications a
                ) AS "totalApplications"
            """, nativeQuery = true)
    PublicStatisticsCountProjection getStatistics(@Param("today") LocalDate today);
}
