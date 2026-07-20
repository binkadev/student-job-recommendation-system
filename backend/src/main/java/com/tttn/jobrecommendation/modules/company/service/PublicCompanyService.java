package com.tttn.jobrecommendation.modules.company.service;

import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.company.dto.request.PublicCompanyFilterRequest;
import com.tttn.jobrecommendation.modules.company.dto.response.PublicCompanyDetailResponse;
import com.tttn.jobrecommendation.modules.company.dto.response.PublicCompanyResponse;

public interface PublicCompanyService {

    PageResponse<PublicCompanyResponse> getCompanies(PublicCompanyFilterRequest request);

    PublicCompanyDetailResponse getCompany(Long id);
}
