package com.tttn.jobrecommendation.modules.job.service;

import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.client.AiServiceClient;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiJobPreprocessRequest;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiJobPreprocessResponse;
import com.tttn.jobrecommendation.infrastructure.ai.job.JobTextContentHasher;
import com.tttn.jobrecommendation.modules.company.repository.CompanyRepository;
import com.tttn.jobrecommendation.modules.job.dto.request.CreateJobRequest;
import com.tttn.jobrecommendation.modules.job.dto.request.UpdateJobStatusRequest;
import com.tttn.jobrecommendation.modules.job.dto.response.JobDetailResponse;
import com.tttn.jobrecommendation.modules.job.mapper.JobMapper;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.job.repository.JobSkillRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JobServicePreprocessHookTest {

    @Test
    void doesNotCallAiPreprocessWhenDraftJobCreated() {
        JobPersistenceService persistence = mock(JobPersistenceService.class);
        AiServiceClient aiClient = mock(AiServiceClient.class);
        JobServiceImpl service = service(persistence, aiClient);

        CreateJobRequest request = new CreateJobRequest();
        JobDetailResponse expected = JobDetailResponse.builder().id(10L).status(JobStatus.DRAFT).build();
        JobPersistenceService.SnapshotTarget draftTarget = new JobPersistenceService.SnapshotTarget(
                10L, JobStatus.DRAFT, "Title", "Desc", "Req", "hash", false
        );
        when(persistence.createJob(request, 1L, UserRole.COMPANY))
                .thenReturn(new JobPersistenceService.MutationResult(expected, draftTarget));

        JobDetailResponse actual = service.createJob(request, 1L, UserRole.COMPANY);

        assertThat(actual).isSameAs(expected);
        verify(aiClient, never()).preprocessJobs(any());
        verify(persistence, never()).savePreprocessedSnapshotIfHashMatches(any(), any(), any());
    }

    @Test
    void preprocessesAndSavesSnapshotAfterApprovalToActive() {
        JobPersistenceService persistence = mock(JobPersistenceService.class);
        AiServiceClient aiClient = mock(AiServiceClient.class);
        JobServiceImpl service = service(persistence, aiClient);

        UpdateJobStatusRequest request = new UpdateJobStatusRequest();
        request.setStatus(JobStatus.ACTIVE);
        JobDetailResponse expected = JobDetailResponse.builder().id(42L).status(JobStatus.ACTIVE).build();
        String hash = JobTextContentHasher.sha256("Java Backend", "Build APIs", "Spring Boot");
        JobPersistenceService.SnapshotTarget activeTarget = new JobPersistenceService.SnapshotTarget(
                42L, JobStatus.ACTIVE, "Java Backend", "Build APIs", "Spring Boot", hash, true
        );
        when(persistence.updateJobStatus(42L, request, 99L, UserRole.ADMIN))
                .thenReturn(new JobPersistenceService.MutationResult(expected, activeTarget));

        AiJobPreprocessResponse.JobResult aiResult = new AiJobPreprocessResponse.JobResult(
                42L,
                "java backend build api spring_boot",
                "en",
                new BigDecimal("0.98"),
                JobTextContentHasher.PROCESSING_VERSION
        );
        when(aiClient.preprocessJobs(any())).thenReturn(new AiJobPreprocessResponse(List.of(aiResult)));

        JobDetailResponse actual = service.updateJobStatus(42L, request, 99L, UserRole.ADMIN);

        assertThat(actual).isSameAs(expected);
        ArgumentCaptor<AiJobPreprocessRequest> captor = ArgumentCaptor.forClass(AiJobPreprocessRequest.class);
        verify(aiClient).preprocessJobs(captor.capture());
        assertThat(captor.getValue().jobs()).hasSize(1);
        assertThat(captor.getValue().jobs().getFirst().id()).isEqualTo(42L);
        assertThat(captor.getValue().jobs().getFirst().text())
                .isEqualTo("TITLE:\nJava Backend\nDESCRIPTION:\nBuild APIs\nREQUIREMENTS:\nSpring Boot");
        verify(persistence).savePreprocessedSnapshotIfHashMatches(eq(42L), eq(hash), eq(aiResult));
    }

    @Test
    void failsOpenWhenAiServiceIsUnavailableDuringActiveCreation() {
        JobPersistenceService persistence = mock(JobPersistenceService.class);
        AiServiceClient aiClient = mock(AiServiceClient.class);
        JobServiceImpl service = service(persistence, aiClient);

        CreateJobRequest request = new CreateJobRequest();
        JobDetailResponse expected = JobDetailResponse.builder().id(77L).status(JobStatus.ACTIVE).build();
        String hash = JobTextContentHasher.sha256("DevOps", "Run k8s", null);
        JobPersistenceService.SnapshotTarget activeTarget = new JobPersistenceService.SnapshotTarget(
                77L, JobStatus.ACTIVE, "DevOps", "Run k8s", null, hash, true
        );
        when(persistence.createJob(request, 99L, UserRole.ADMIN))
                .thenReturn(new JobPersistenceService.MutationResult(expected, activeTarget));
        when(aiClient.preprocessJobs(any())).thenThrow(new AppException(ErrorCode.AI_SERVICE_UNAVAILABLE));

        JobDetailResponse actual = service.createJob(request, 99L, UserRole.ADMIN);

        assertThat(actual).isSameAs(expected);
        verify(persistence, never()).savePreprocessedSnapshotIfHashMatches(any(), any(), any());
    }

    private JobServiceImpl service(JobPersistenceService persistence, AiServiceClient aiClient) {
        return new JobServiceImpl(
                mock(JobRepository.class),
                mock(JobSkillRepository.class),
                mock(CompanyRepository.class),
                mock(JobMapper.class),
                persistence,
                aiClient
        );
    }
}
