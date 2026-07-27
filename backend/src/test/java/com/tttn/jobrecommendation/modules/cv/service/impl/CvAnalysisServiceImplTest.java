package com.tttn.jobrecommendation.modules.cv.service.impl;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.client.AiServiceClient;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCvParseResponse;
import com.tttn.jobrecommendation.modules.cv.dto.response.CvAnalysisResponse;
import com.tttn.jobrecommendation.modules.cv.dto.response.CvFileDownload;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.cv.service.CvStorageService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CvAnalysisServiceImplTest {

    @Mock
    private CvAnalysisPersistenceService persistenceService;

    @Mock
    private CvStorageService cvStorageService;

    @Mock
    private AiServiceClient aiServiceClient;

    @Mock
    private AiCvParseResponseValidator responseValidator;

    @InjectMocks
    private CvAnalysisServiceImpl service;

    @Test
    void marksProcessingBeforeLoadingAndPersistsOnlyValidatedResponse() {
        CvFile cvFile = CvFile.builder().id(12L).build();
        CvFileDownload download = new CvFileDownload(
                new ByteArrayResource(new byte[]{1}),
                MediaType.APPLICATION_PDF,
                1L,
                "resume.pdf"
        );
        AiCvParseResponse parsed = parsedResponse();
        AiCvParseResponse validated = parsedResponse();
        CvAnalysisResponse expected = CvAnalysisResponse.builder().cvId(12L).build();

        when(persistenceService.markProcessing(7L, 12L)).thenReturn(cvFile);
        when(cvStorageService.load(cvFile)).thenReturn(download);
        when(aiServiceClient.parseCv(download.resource(), download.originalFileName(), download.contentType()))
                .thenReturn(parsed);
        when(responseValidator.validate(parsed)).thenReturn(validated);
        when(persistenceService.saveParsedAnalysis(7L, 12L, validated)).thenReturn(expected);

        assertThat(service.reanalyze(7L, 12L)).isSameAs(expected);

        InOrder order = inOrder(persistenceService, cvStorageService, aiServiceClient, responseValidator);
        order.verify(persistenceService).markProcessing(7L, 12L);
        order.verify(cvStorageService).load(cvFile);
        order.verify(aiServiceClient).parseCv(
                download.resource(),
                download.originalFileName(),
                download.contentType()
        );
        order.verify(responseValidator).validate(parsed);
        order.verify(persistenceService).saveParsedAnalysis(7L, 12L, validated);
    }

    @Test
    void marksFailedAndPreservesSafeAppExceptionContract() {
        CvFile cvFile = CvFile.builder().id(12L).build();
        CvFileDownload download = new CvFileDownload(
                new ByteArrayResource(new byte[]{1}),
                MediaType.APPLICATION_PDF,
                1L,
                "resume.pdf"
        );
        AppException timeout = new AppException(ErrorCode.AI_SERVICE_TIMEOUT);

        when(persistenceService.markProcessing(7L, 12L)).thenReturn(cvFile);
        when(cvStorageService.load(cvFile)).thenReturn(download);
        when(aiServiceClient.parseCv(download.resource(), download.originalFileName(), download.contentType()))
                .thenThrow(timeout);

        assertThatThrownBy(() -> service.reanalyze(7L, 12L))
                .isSameAs(timeout);
        verify(persistenceService).markFailed(7L, 12L, timeout);
        verify(persistenceService, never()).saveParsedAnalysis(anyLong(), anyLong(), any());
    }

    private AiCvParseResponse parsedResponse() {
        return new AiCvParseResponse(
                "raw",
                "processed",
                List.of("java"),
                "en",
                0.98d,
                "bilingual-nlp-v2",
                List.of()
        );
    }
}
