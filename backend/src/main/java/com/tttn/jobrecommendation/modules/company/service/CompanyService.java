package com.tttn.jobrecommendation.modules.company.service;

import com.tttn.jobrecommendation.modules.company.dto.request.CompanyUpdateRequest;
import com.tttn.jobrecommendation.modules.company.dto.response.CompanyResponse;

public interface CompanyService {

    CompanyResponse getMe(Long userId);

    CompanyResponse updateMe(Long userId, CompanyUpdateRequest request);
}
