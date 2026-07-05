package com.tttn.jobrecommendation.modules.company.service.impl;

import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.modules.company.dto.request.CompanyUpdateRequest;
import com.tttn.jobrecommendation.modules.company.dto.response.CompanyResponse;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.company.mapper.CompanyMapper;
import com.tttn.jobrecommendation.modules.company.repository.CompanyRepository;
import com.tttn.jobrecommendation.modules.company.service.CompanyService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class CompanyServiceImpl implements CompanyService {

    private final CompanyRepository companyRepository;
    private final CompanyMapper companyMapper;

    @Override
    @Transactional(readOnly = true)
    public CompanyResponse getMe(Long userId) {
        Company company = getCompanyByUserId(userId);
        return companyMapper.toCompanyResponse(company);
    }

    @Override
    @Transactional
    public CompanyResponse updateMe(Long userId, CompanyUpdateRequest request) {
        Company company = getCompanyByUserId(userId);

        if (StringUtils.hasText(request.getCompanyName())) {
            company.setCompanyName(request.getCompanyName().trim());
        }

        if (request.getTaxCode() != null) {
            company.setTaxCode(trimToNull(request.getTaxCode()));
        }

        if (request.getDescription() != null) {
            company.setDescription(trimToNull(request.getDescription()));
        }

        if (request.getWebsite() != null) {
            company.setWebsiteUrl(trimToNull(request.getWebsite()));
        }

        if (request.getAddress() != null) {
            company.setAddress(trimToNull(request.getAddress()));
        }

        if (request.getPhone() != null) {
            String phone = trimToNull(request.getPhone());
            company.setPhone(phone);
            company.getUser().setPhone(phone);
        }

        if (request.getIndustry() != null) {
            company.setIndustry(trimToNull(request.getIndustry()));
        }

        Company savedCompany = companyRepository.save(company);
        return companyMapper.toCompanyResponse(savedCompany);
    }

    private Company getCompanyByUserId(Long userId) {
        return companyRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Company profile not found"));
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }
}
