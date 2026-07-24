package com.tttn.jobrecommendation.modules.job.service;

import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.job.dto.request.PublicJobFilterRequest;
import com.tttn.jobrecommendation.modules.job.dto.response.PublicJobDetailResponse;
import com.tttn.jobrecommendation.modules.job.dto.response.PublicJobResponse;

public interface PublicJobService {

    PageResponse<PublicJobResponse> getJobs(PublicJobFilterRequest request);

    PublicJobDetailResponse getJob(Long jobId);
}
