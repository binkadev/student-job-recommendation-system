package com.tttn.jobrecommendation.modules.application.service;

import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.modules.application.dto.request.ApplyJobRequest;
import com.tttn.jobrecommendation.modules.application.dto.request.UpdateApplicationStatusRequest;
import com.tttn.jobrecommendation.modules.application.dto.response.ApplicationResponse;

import java.util.List;

public interface ApplicationService {

    ApplicationResponse apply(Long jobId, ApplyJobRequest request, Long userId);

    List<ApplicationResponse> getMyApplications(Long userId);

    List<ApplicationResponse> getCompanyJobApplications(Long jobId, Long userId);

    ApplicationResponse updateStatus(Long id, UpdateApplicationStatusRequest request, Long userId, UserRole role);
}
