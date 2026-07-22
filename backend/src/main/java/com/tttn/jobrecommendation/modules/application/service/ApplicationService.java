package com.tttn.jobrecommendation.modules.application.service;

import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.application.dto.request.ApplyJobRequest;
import com.tttn.jobrecommendation.modules.application.dto.request.CompanyApplicationFilterRequest;
import com.tttn.jobrecommendation.modules.application.dto.request.UpdateApplicationStatusRequest;
import com.tttn.jobrecommendation.modules.application.dto.response.ApplicationCvDownload;
import com.tttn.jobrecommendation.modules.application.dto.response.ApplicationResponse;

import java.util.List;

public interface ApplicationService {

    ApplicationResponse apply(Long jobId, ApplyJobRequest request, Long userId);

    List<ApplicationResponse> getMyApplications(Long userId);

    List<ApplicationResponse> getCompanyJobApplications(Long jobId, Long userId);

    PageResponse<ApplicationResponse> getMyCompanyApplications(Long userId, CompanyApplicationFilterRequest request);

    ApplicationResponse getMyCompanyApplication(Long id, Long userId);

    ApplicationCvDownload getMyCompanyApplicationCv(Long id, Long userId);

    ApplicationResponse getMyApplication(Long id, Long userId);

    ApplicationResponse updateStatus(Long id, UpdateApplicationStatusRequest request, Long userId, UserRole role);
}
