package com.tttn.jobrecommendation.common.exception;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class GlobalExceptionHandlerTest {

    @Test
    void servletMultipartLimitProducesSanitized413EnvelopeInsteadOfGeneric500() throws Exception {
        MockMvcBuilders.standaloneSetup(new OversizedUploadController())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build()
                .perform(post("/upload"))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("UPLOAD_TOO_LARGE"))
                .andExpect(jsonPath("$.message").value("Uploaded file or request exceeds the size limit"))
                .andExpect(jsonPath("$.data").value(nullValue()));
    }

    @RestController
    static class OversizedUploadController {
        @PostMapping("/upload")
        void upload() {
            throw new MaxUploadSizeExceededException(10_485_760,
                    new IllegalStateException("private multipart storage details"));
        }
    }
}
