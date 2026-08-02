package com.tttn.jobrecommendation.modules.candidateranking.service;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.candidateranking.dto.request.CreateCandidateRankingRunRequest;
import com.tttn.jobrecommendation.modules.candidateranking.dto.response.CandidateRankingRunDetailResponse;
import com.tttn.jobrecommendation.modules.candidateranking.dto.response.CandidateRankingRunResponse;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.company.repository.CompanyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
@RequiredArgsConstructor
public class CandidateRankingPublicService {

    private static final int THRESHOLD_SCALE = 5;

    private final CompanyRepository companyRepository;
    private final CandidateRankingGenerationService generationService;
    private final CandidateRankingQueryService queryService;

    public CandidateRankingRunDetailResponse createRun(
            Long userId,
            Long jobId,
            CreateCandidateRankingRunRequest request
    ) {
        Company company = getCompanyByUserId(userId);
        BigDecimal threshold = canonicalizeThreshold(request.getThreshold());
        Long runId = generationService.generate(
                company.getId(),
                jobId,
                threshold,
                request.getLimit()
        );
        return queryService.getRunDetail(company.getId(), jobId, runId);
    }

    public PageResponse<CandidateRankingRunResponse> getRuns(
            Long userId,
            Long jobId,
            int page,
            int size
    ) {
        Company company = getCompanyByUserId(userId);
        return queryService.getRuns(company.getId(), jobId, page, size);
    }

    public CandidateRankingRunDetailResponse getRunDetail(
            Long userId,
            Long jobId,
            Long runId
    ) {
        Company company = getCompanyByUserId(userId);
        return queryService.getRunDetail(company.getId(), jobId, runId);
    }

    private Company getCompanyByUserId(Long userId) {
        return companyRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Company profile not found"));
    }

    private BigDecimal canonicalizeThreshold(BigDecimal threshold) {
        try {
            return threshold.setScale(THRESHOLD_SCALE, RoundingMode.UNNECESSARY);
        } catch (ArithmeticException exception) {
            throw new AppException(ErrorCode.BAD_REQUEST);
        }
    }
}
