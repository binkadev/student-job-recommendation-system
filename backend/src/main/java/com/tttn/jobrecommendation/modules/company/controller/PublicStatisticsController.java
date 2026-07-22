package com.tttn.jobrecommendation.modules.company.controller;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.modules.application.repository.JobApplicationRepository;
import com.tttn.jobrecommendation.modules.company.dto.response.PublicStatisticsResponse;
import com.tttn.jobrecommendation.modules.company.repository.CompanyRepository;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/statistics")
@RequiredArgsConstructor
public class PublicStatisticsController {

    private final JobRepository jobRepository;
    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;
    private final JobApplicationRepository jobApplicationRepository;

    @GetMapping
    public ApiResponse<PublicStatisticsResponse> getStatistics() {
        long activeJobs = jobRepository.countByStatus(JobStatus.ACTIVE);
        long verifiedCompanies = companyRepository.countByStatus(CompanyStatus.VERIFIED);
        long students = userRepository.countByRole(UserRole.STUDENT);
        long applications = jobApplicationRepository.count();

        return ApiResponse.success(PublicStatisticsResponse.builder()
                .totalJobs(activeJobs)
                .jobCount(activeJobs)
                .totalCompanies(verifiedCompanies)
                .companyCount(verifiedCompanies)
                .totalCandidates(students)
                .candidateCount(students)
                .totalStudents(students)
                .studentCount(students)
                .totalApplications(applications)
                .applicationCount(applications)
                .applications(applications)
                .build());
    }
}
