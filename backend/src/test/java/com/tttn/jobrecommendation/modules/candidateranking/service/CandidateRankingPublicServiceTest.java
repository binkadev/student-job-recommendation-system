package com.tttn.jobrecommendation.modules.candidateranking.service;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.modules.candidateranking.dto.request.CreateCandidateRankingRunRequest;
import com.tttn.jobrecommendation.modules.candidateranking.dto.response.CandidateRankingRunDetailResponse;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.company.repository.CompanyRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CandidateRankingPublicServiceTest {

    @Mock
    private CompanyRepository companyRepository;

    @Mock
    private CandidateRankingGenerationService generationService;

    @Mock
    private CandidateRankingQueryService queryService;

    @InjectMocks
    private CandidateRankingPublicService publicService;

    @Test
    void createResolvesCompanyDelegatesExactlyOnceAndReturnsGeneratedDetail() {
        Company company = Company.builder().id(7L).build();
        CreateCandidateRankingRunRequest request = request("0.1", 20, 20);
        CandidateRankingRunDetailResponse expected = detail(91L);
        when(companyRepository.findByUserId(3L)).thenReturn(Optional.of(company));
        when(generationService.generate(7L, 11L, new BigDecimal("0.10000"), 20, 20)).thenReturn(91L);
        when(queryService.getRunDetail(7L, 11L, 91L)).thenReturn(expected);

        assertThat(publicService.createRun(3L, 11L, request)).isSameAs(expected);

        verify(companyRepository).findByUserId(3L);
        verify(generationService).generate(7L, 11L, new BigDecimal("0.10000"), 20, 20);
        verify(queryService).getRunDetail(7L, 11L, 91L);
    }

    @Test
    void exactScaleAndExtraTrailingZerosCanonicalizeWithoutRounding() {
        Company company = Company.builder().id(7L).build();
        when(companyRepository.findByUserId(3L)).thenReturn(Optional.of(company));
        when(generationService.generate(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyInt(), org.mockito.ArgumentMatchers.anyInt())).thenReturn(91L);
        when(queryService.getRunDetail(7L, 11L, 91L)).thenReturn(detail(91L));

        publicService.createRun(3L, 11L, request("0.12345", 20, 20));
        publicService.createRun(3L, 11L, request("0.100000", 20, 20));

        ArgumentCaptor<BigDecimal> thresholds = ArgumentCaptor.forClass(BigDecimal.class);
        verify(generationService, org.mockito.Mockito.times(2))
                .generate(org.mockito.ArgumentMatchers.eq(7L), org.mockito.ArgumentMatchers.eq(11L),
                        thresholds.capture(), org.mockito.ArgumentMatchers.eq(20), org.mockito.ArgumentMatchers.eq(20));
        assertThat(thresholds.getAllValues())
                .containsExactly(new BigDecimal("0.12345"), new BigDecimal("0.10000"));
    }

    @Test
    void thresholdRequiringRoundingReturnsBadRequestWithoutGeneration() {
        when(companyRepository.findByUserId(3L)).thenReturn(Optional.of(Company.builder().id(7L).build()));

        assertThatThrownBy(() -> publicService.createRun(3L, 11L, request("0.123456", 20, 20)))
                .isInstanceOfSatisfying(AppException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.BAD_REQUEST));

        verify(generationService, never()).generate(
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyInt(), org.mockito.ArgumentMatchers.anyInt()
        );
    }

    @Test
    void missingCompanyUsesGenericResourceNotFound() {
        when(companyRepository.findByUserId(3L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> publicService.getRunDetail(3L, 11L, 91L))
                .isInstanceOfSatisfying(AppException.class, exception -> {
                    assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND);
                    assertThat(exception.getMessage()).isEqualTo("Company profile not found");
                });
    }

    @Test
    void createMethodAndClassHaveNoTransactionalBoundary() throws Exception {
        assertThat(AnnotatedElementUtils.findMergedAnnotation(
                CandidateRankingPublicService.class,
                Transactional.class
        )).isNull();
        assertThat(AnnotatedElementUtils.findMergedAnnotation(
                CandidateRankingPublicService.class.getMethod(
                        "createRun",
                        Long.class,
                        Long.class,
                        CreateCandidateRankingRunRequest.class
                ),
                Transactional.class
        )).isNull();
    }

    private CreateCandidateRankingRunRequest request(String threshold, int primaryLimit, int fallbackLimit) {
        CreateCandidateRankingRunRequest request = new CreateCandidateRankingRunRequest();
        request.setThreshold(new BigDecimal(threshold));
        request.setPrimaryLimit(primaryLimit);
        request.setFallbackLimit(fallbackLimit);
        return request;
    }

    private CandidateRankingRunDetailResponse detail(Long id) {
        return new CandidateRankingRunDetailResponse(
                id, 11L, "Job", null, null, null, new BigDecimal("0.10000"), 20,
                0, 0, 0, 0, 0, 0, null, null, null, null, List.of()
        );
    }
}
