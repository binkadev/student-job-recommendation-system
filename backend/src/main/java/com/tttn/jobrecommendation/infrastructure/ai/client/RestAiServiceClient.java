package com.tttn.jobrecommendation.infrastructure.ai.client;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCvParseResponse;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationRequest;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationResponse;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.net.SocketTimeoutException;
import java.net.http.HttpTimeoutException;

@Component
public class RestAiServiceClient implements AiServiceClient {

    private final RestClient restClient;

    public RestAiServiceClient(@Qualifier("aiServiceRestClient") RestClient restClient) {
        this.restClient = restClient;
    }

    @Override
    public AiCvParseResponse parseCv(Resource resource, String fileName, MediaType contentType) {
        HttpHeaders fileHeaders = new HttpHeaders();
        fileHeaders.setContentType(contentType);
        fileHeaders.setContentDisposition(ContentDisposition.formData()
                .name("file")
                .filename(fileName)
                .build());
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new HttpEntity<>(resource, fileHeaders));

        try {
            return restClient.post()
                    .uri("/internal/v1/cv/parse")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(body)
                    .retrieve()
                    .body(AiCvParseResponse.class);
        } catch (RestClientException exception) {
            throw mapException(exception);
        }
    }

    @Override
    public AiRecommendationResponse recommend(AiRecommendationRequest request) {
        try {
            return restClient.post()
                    .uri("/internal/v1/recommendations")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(AiRecommendationResponse.class);
        } catch (RestClientException exception) {
            throw mapException(exception);
        }
    }

    private AppException mapException(RestClientException exception) {
        if (isTimeout(exception)) {
            return new AppException(ErrorCode.AI_SERVICE_TIMEOUT);
        }
        if (exception instanceof ResourceAccessException) {
            return new AppException(ErrorCode.AI_SERVICE_UNAVAILABLE);
        }
        if (exception instanceof RestClientResponseException responseException
                && responseException.getStatusCode().is5xxServerError()) {
            return new AppException(ErrorCode.AI_SERVICE_UNAVAILABLE);
        }
        return new AppException(ErrorCode.AI_SERVICE_INVALID_RESPONSE);
    }

    private boolean isTimeout(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            if (current instanceof SocketTimeoutException || current instanceof HttpTimeoutException) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }
}
