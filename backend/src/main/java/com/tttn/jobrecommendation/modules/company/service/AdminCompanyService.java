package com.tttn.jobrecommendation.modules.company.service;

import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.company.dto.request.AdminCompanyFilterRequest;
import com.tttn.jobrecommendation.modules.company.dto.request.AdminCompanyStatusUpdateRequest;
import com.tttn.jobrecommendation.modules.company.dto.response.AdminCompanyResponse;

public interface AdminCompanyService {

    PageResponse<AdminCompanyResponse> getCompanies(AdminCompanyFilterRequest request);

    AdminCompanyResponse getCompany(Long id);

    AdminCompanyResponse updateStatus(Long id, AdminCompanyStatusUpdateRequest request);
}
