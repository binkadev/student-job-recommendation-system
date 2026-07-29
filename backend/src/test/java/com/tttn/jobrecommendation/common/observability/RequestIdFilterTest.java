package com.tttn.jobrecommendation.common.observability;

import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class RequestIdFilterTest {

    private final RequestIdFilter filter = new RequestIdFilter();

    @AfterEach
    void clearMdc() {
        MDC.clear();
    }

    @Test
    void missingHeaderGeneratesUuidAndSetsMdcDuringRequest() throws Exception {
        AtomicReference<String> requestMdc = new AtomicReference<>();
        MockHttpServletResponse response = invoke(
                null,
                HttpServletResponse.SC_OK,
                requestMdc
        );

        String requestId = response.getHeader(RequestIdSupport.HEADER_NAME);
        assertThat(requestId).isNotNull();
        assertThat(UUID.fromString(requestId).toString()).isEqualTo(requestId);
        assertThat(requestMdc.get()).isEqualTo(requestId);
        assertThat(MDC.get(RequestIdSupport.MDC_KEY)).isNull();
    }

    @Test
    void validHeaderIsPreservedAndFilterHasHighestPrecedence() throws Exception {
        String supplied = "client.trace_ID:123-abc";

        MockHttpServletResponse response = invoke(
                supplied,
                HttpServletResponse.SC_OK,
                new AtomicReference<>()
        );

        assertThat(response.getHeader(RequestIdSupport.HEADER_NAME))
                .isEqualTo(supplied);
        Order order = RequestIdFilter.class.getAnnotation(Order.class);
        assertThat(order).isNotNull();
        assertThat(order.value()).isEqualTo(Ordered.HIGHEST_PRECEDENCE);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "",
            "   ",
            "contains space",
            "contains/slash",
            "unicode-\u0111",
            "line\rbreak",
            "line\nbreak"
    })
    void invalidHeaderGeneratesNewUuid(String supplied) throws Exception {
        MockHttpServletResponse response = invoke(
                supplied,
                HttpServletResponse.SC_OK,
                new AtomicReference<>()
        );

        String requestId = response.getHeader(RequestIdSupport.HEADER_NAME);
        assertThat(requestId).isNotEqualTo(supplied);
        assertThat(UUID.fromString(requestId).toString()).isEqualTo(requestId);
    }

    @Test
    void overlyLongHeaderGeneratesNewUuid() throws Exception {
        String supplied = "a".repeat(129);

        MockHttpServletResponse response = invoke(
                supplied,
                HttpServletResponse.SC_OK,
                new AtomicReference<>()
        );

        String requestId = response.getHeader(RequestIdSupport.HEADER_NAME);
        assertThat(requestId).isNotEqualTo(supplied);
        assertThat(RequestIdSupport.isValid(requestId)).isTrue();
    }

    @Test
    void consecutiveRequestsDoNotReuseMdcOrGeneratedIds() throws Exception {
        MockHttpServletResponse first = invoke(
                null,
                HttpServletResponse.SC_OK,
                new AtomicReference<>()
        );
        assertThat(MDC.get(RequestIdSupport.MDC_KEY)).isNull();
        MockHttpServletResponse second = invoke(
                null,
                HttpServletResponse.SC_OK,
                new AtomicReference<>()
        );

        assertThat(first.getHeader(RequestIdSupport.HEADER_NAME))
                .isNotEqualTo(second.getHeader(RequestIdSupport.HEADER_NAME));
        assertThat(MDC.get(RequestIdSupport.MDC_KEY)).isNull();
    }

    @Test
    void clientErrorResponseStillContainsRequestId() throws Exception {
        MockHttpServletResponse response = invoke(
                null,
                HttpServletResponse.SC_BAD_REQUEST,
                new AtomicReference<>()
        );

        assertThat(response.getStatus()).isEqualTo(HttpServletResponse.SC_BAD_REQUEST);
        assertThat(RequestIdSupport.isValid(
                response.getHeader(RequestIdSupport.HEADER_NAME)
        )).isTrue();
    }

    @Test
    void handledExceptionResponseStillContainsRequestId() throws Exception {
        MockMvc mockMvc = MockMvcBuilders
                .standaloneSetup(new ThrowingController())
                .setControllerAdvice(new TestExceptionHandler())
                .addFilters(filter)
                .build();

        String requestId = mockMvc.perform(get("/handled"))
                .andExpect(status().isInternalServerError())
                .andExpect(header().exists(RequestIdSupport.HEADER_NAME))
                .andReturn()
                .getResponse()
                .getHeader(RequestIdSupport.HEADER_NAME);

        assertThat(RequestIdSupport.isValid(requestId)).isTrue();
        assertThat(MDC.get(RequestIdSupport.MDC_KEY)).isNull();
    }

    private MockHttpServletResponse invoke(
            String suppliedRequestId,
            int status,
            AtomicReference<String> requestMdc
    ) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(
                "GET",
                "/api/test"
        );
        request.setQueryString("password=must-not-be-logged");
        if (suppliedRequestId != null) {
            request.addHeader(RequestIdSupport.HEADER_NAME, suppliedRequestId);
        }
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (servletRequest, servletResponse) -> {
            requestMdc.set(MDC.get(RequestIdSupport.MDC_KEY));
            ((HttpServletResponse) servletResponse).setStatus(status);
        });
        return response;
    }

    @RestController
    private static class ThrowingController {

        @GetMapping("/handled")
        String handled() {
            throw new IllegalStateException("safe test exception");
        }
    }

    @RestControllerAdvice
    private static class TestExceptionHandler {

        @ExceptionHandler(IllegalStateException.class)
        ResponseEntity<Void> handle() {
            return ResponseEntity.internalServerError().build();
        }
    }
}
