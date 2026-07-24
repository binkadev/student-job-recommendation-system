package com.tttn.jobrecommendation.integration;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.cv.service.CvStorageService;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CvDeleteFailureIT extends AbstractPostgresWebIntegrationTest {

    @MockitoBean
    private CvStorageService cvStorageService;

    @Test
    void storageDeleteFailureReturnsErrorAndRollsBackCvMetadataDeletion() throws Exception {
        Student student = createStudent("cv-delete-failure@student.test");
        CvFile cvFile = createCv(student, "delete-failure.pdf", false);
        AppException storageFailure = new AppException(
                ErrorCode.INTERNAL_SERVER_ERROR,
                "Failed to delete CV file"
        );
        doThrow(storageFailure).when(cvStorageService).delete(any(CvFile.class));

        mockMvc.perform(delete("/api/students/me/cv/{cvId}", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser())))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("INTERNAL_SERVER_ERROR"))
                .andExpect(jsonPath("$.message").value("Failed to delete CV file"));

        assertThat(cvFileRepository.findById(cvFile.getId())).isPresent();
        verify(cvStorageService).delete(any(CvFile.class));
    }
}
