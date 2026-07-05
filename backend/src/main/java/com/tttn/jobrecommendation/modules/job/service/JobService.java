package com.tttn.jobrecommendation.modules.job.service;

import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.job.dto.request.CreateJobRequest;
import com.tttn.jobrecommendation.modules.job.dto.request.JobFilterRequest;
import com.tttn.jobrecommendation.modules.job.dto.request.UpdateJobRequest;
import com.tttn.jobrecommendation.modules.job.dto.request.UpdateJobStatusRequest;
import com.tttn.jobrecommendation.modules.job.dto.response.JobDetailResponse;
import com.tttn.jobrecommendation.modules.job.dto.response.JobResponse;

public interface JobService {

    PageResponse<JobResponse> getJobs(JobFilterRequest request, Long userId, UserRole role);

    JobDetailResponse getJob(Long id, Long userId, UserRole role);

    JobDetailResponse createJob(CreateJobRequest request, Long userId, UserRole role);

    JobDetailResponse updateJob(Long id, UpdateJobRequest request, Long userId, UserRole role);

    JobDetailResponse updateJobStatus(Long id, UpdateJobStatusRequest request, Long userId, UserRole role);

    JobDetailResponse closeJob(Long id, Long userId, UserRole role);
}
