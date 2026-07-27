package com.tttn.jobrecommendation.modules.statistics.repository;

public interface PublicStatisticsCountProjection {

    long getTotalJobs();

    long getTotalCompanies();

    long getTotalStudents();

    long getTotalApplications();
}
