package com.tttn.jobrecommendation.infrastructure.ai.client;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.observability.RequestIdSupport;
import com.tttn.jobrecommendation.infrastructure.ai.config.AiCandidateRankingProperties;
import com.tttn.jobrecommendation.infrastructure.ai.config.AiServiceProperties;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingRequest;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingResponse;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCvParseResponse;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationRequest;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationResponse;
import com.tttn.jobrecommendation.infrastructure.ai.exception.AiCandidateRankingCapacityException;
import org.slf4j.MDC;
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

import java.io.IOException;
import java.net.SocketTimeoutException;
import java.net.http.HttpTimeoutException;
import java.util.Objects;

@Component
public class RestAiServiceClient implements AiServiceClient {

    private static final String INTERNAL_API_KEY_HEADER = "X-Internal-Api-Key";

    private final RestClient restClient;
    private final String internalApiKey;
    private final ObjectMapper objectMapper;
    private final int maxCandidatesPerRequest;
    private final long maxRequestBytes;

    public RestAiServiceClient(
            @Qualifier("aiServiceRestClient") RestClient restClient,
            AiServiceProperties properties,
            ObjectMapper objectMapper,
            AiCandidateRankingProperties candidateRankingProperties
    ) {
        this.restClient = restClient;
        this.internalApiKey = properties.getInternalApiKey();
        this.objectMapper = objectMapper;
        this.maxCandidatesPerRequest = candidateRankingProperties.getMaxCandidatesPerRequest();
        this.maxRequestBytes = candidateRankingProperties.getMaxRequestBytes();
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
            String requestId = outboundRequestId();
            return restClient.post()
                    .uri("/internal/v2/cv/parse")
                    .header(INTERNAL_API_KEY_HEADER, internalApiKey)
                    .header(RequestIdSupport.HEADER_NAME, requestId)
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
            String requestId = outboundRequestId();
            return restClient.post()
                    .uri("/internal/v2/recommendations")
                    .header(INTERNAL_API_KEY_HEADER, internalApiKey)
                    .header(RequestIdSupport.HEADER_NAME, requestId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(AiRecommendationResponse.class);
        } catch (RestClientException exception) {
            throw mapException(exception);
        }
    }

    @Override
    public AiCandidateRankingResponse rankCandidates(
            AiCandidateRankingRequest request,
            String transportRequestId
    ) {
        Objects.requireNonNull(request, "request must not be null");
        Objects.requireNonNull(transportRequestId, "transportRequestId must not be null");
        Objects.requireNonNull(request.candidates(), "request.candidates must not be null");
        if (request.candidates().size() > maxCandidatesPerRequest) {
            throw new AiCandidateRankingCapacityException();
        }

        byte[] serializedRequest = serializeCandidateRankingRequest(request);
        if (serializedRequest.length > maxRequestBytes) {
            throw new AiCandidateRankingCapacityException();
        }

        try {
            byte[] responseBody = restClient.post()
                    .uri("/internal/v2/candidate-rankings")
                    .header(INTERNAL_API_KEY_HEADER, internalApiKey)
                    .header(RequestIdSupport.HEADER_NAME, transportRequestId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(serializedRequest)
                    .retrieve()
                    .onStatus(status -> !status.is2xxSuccessful(), (sentRequest, response) -> {
                        if (response.getStatusCode().value() == 413) {
                            throw new AiCandidateRankingCapacityException();
                        }
                        if (response.getStatusCode().is5xxServerError()) {
                            throw new AppException(ErrorCode.AI_SERVICE_UNAVAILABLE);
                        }
                        throw new AppException(ErrorCode.AI_SERVICE_INVALID_RESPONSE);
                    })
                    .body(byte[].class);
            return deserializeCandidateRankingResponse(responseBody);
        } catch (RestClientException exception) {
            throw mapCandidateRankingException(exception);
        }
    }

    private byte[] serializeCandidateRankingRequest(AiCandidateRankingRequest request) {
        try {
            return objectMapper.writeValueAsBytes(request);
        } catch (IOException exception) {
            throw new AppException(ErrorCode.AI_SERVICE_INVALID_RESPONSE);
        }
    }

    private AiCandidateRankingResponse deserializeCandidateRankingResponse(byte[] responseBody) {
        if (responseBody == null || responseBody.length == 0) {
            throw new AppException(ErrorCode.AI_SERVICE_INVALID_RESPONSE);
        }
        try {
            return objectMapper.readerFor(AiCandidateRankingResponse.class)
                    .with(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                    .readValue(responseBody);
        } catch (IOException exception) {
            throw new AppException(ErrorCode.AI_SERVICE_INVALID_RESPONSE);
        }
    }

    private RuntimeException mapCandidateRankingException(RestClientException exception) {
        if (exception instanceof RestClientResponseException responseException
                && responseException.getStatusCode().value() == 413) {
            return new AiCandidateRankingCapacityException();
        }
        return mapException(exception);
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

    private String outboundRequestId() {
        return RequestIdSupport.resolveOrGenerate(
                MDC.get(RequestIdSupport.MDC_KEY)
        );
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
