package com.tttn.jobrecommendation.infrastructure.ai.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.observability.RequestIdSupport;
import com.tttn.jobrecommendation.infrastructure.ai.config.AiCandidateRankingProperties;
import com.tttn.jobrecommendation.infrastructure.ai.config.AiServiceProperties;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RestAiServiceClientTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final String TEST_INTERNAL_API_KEY =
            "test-backend-ai-internal-api-key-at-least-32-characters";

    private HttpServer server;
    private ExecutorService executor;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        executor = Executors.newCachedThreadPool();
        server.setExecutor(executor);
        server.start();
    }

    @AfterEach
    void stopServer() {
        MDC.clear();
        server.stop(0);
        executor.shutdownNow();
    }

    @Test
    void sendsMultipartParseRequestAndMapsSuccess() {
        AtomicReference<String> contentType = new AtomicReference<>();
        AtomicReference<String> internalApiKey = new AtomicReference<>();
        AtomicReference<String> requestId = new AtomicReference<>();
        AtomicReference<String> body = new AtomicReference<>();
        server.createContext("/internal/v2/cv/parse", exchange -> {
            contentType.set(exchange.getRequestHeaders().getFirst("Content-Type"));
            internalApiKey.set(exchange.getRequestHeaders().getFirst("X-Internal-Api-Key"));
            requestId.set(exchange.getRequestHeaders().getFirst("X-Request-Id"));
            body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.ISO_8859_1));
            respond(exchange, 200, """
                    {
                      "rawText": "Java resume",
                      "processedText": "java spring boot",
                      "skills": ["Java", "Spring Boot"],
                      "languageCode": "en",
                      "languageConfidence": 0.98,
                      "processingVersion": "bilingual-nlp-v2",
                      "warnings": []
                    }
                    """);
        });

        MDC.put(RequestIdSupport.MDC_KEY, "backend.parse-trace:1");
        var response = client(Duration.ofSeconds(2)).parseCv(
                new ByteArrayResource("%PDF-test".getBytes(StandardCharsets.UTF_8)),
                "resume.pdf",
                MediaType.APPLICATION_PDF
        );

        assertThat(response.processedText()).isEqualTo("java spring boot");
        assertThat(response.skills()).containsExactly("Java", "Spring Boot");
        assertThat(contentType.get()).startsWith("multipart/form-data;boundary=");
        assertThat(internalApiKey.get()).isEqualTo(TEST_INTERNAL_API_KEY);
        assertThat(requestId.get()).isEqualTo("backend.parse-trace:1");
        assertThat(body.get()).contains("name=\"file\"", "filename=\"resume.pdf\"", "%PDF-test");
    }

    @Test
    void mapsSuccessfulAndEmptyRecommendationResponses() {
        AtomicInteger calls = new AtomicInteger();
        AtomicReference<String> internalApiKey = new AtomicReference<>();
        AtomicReference<String> traceRequestId = new AtomicReference<>();
        server.createContext("/internal/v2/recommendations", exchange -> {
            internalApiKey.set(exchange.getRequestHeaders().getFirst("X-Internal-Api-Key"));
            traceRequestId.set(exchange.getRequestHeaders().getFirst("X-Request-Id"));
            JsonNode request = OBJECT_MAPPER.readTree(exchange.getRequestBody());
            String requestId = request.get("requestId").asText();
            String results = calls.getAndIncrement() == 0
                    ? """
                      [{
                        "jobId": 101,
                        "score": 0.75,
                        "textScore": 0.70,
                        "skillScore": 0.85,
                        "scoringStrategy": "SAME_LANGUAGE_HYBRID",
                        "matchedSkills": ["Java"],
                        "missingSkills": [],
                        "reason": "Matched Java"
                      }]
                      """
                    : "[]";
            respond(exchange, 200, """
                    {
                      "requestId": "%s",
                      "algorithm": "tfidf-cosine-hybrid",
                      "algorithmVersion": "bilingual-recommendation-v2",
                      "results": %s
                    }
                    """.formatted(requestId, results));
        });
        AiRecommendationRequest firstRequest = recommendationRequest();

        MDC.put(RequestIdSupport.MDC_KEY, "backend.recommend-trace:1");
        var response = client(Duration.ofSeconds(2)).recommend(firstRequest);

        assertThat(response.requestId()).isEqualTo(firstRequest.requestId());
        assertThat(response.algorithm()).isEqualTo("tfidf-cosine-hybrid");
        assertThat(response.results()).hasSize(1);
        assertThat(client(Duration.ofSeconds(2)).recommend(recommendationRequest()).results()).isEmpty();
        assertThat(internalApiKey.get()).isEqualTo(TEST_INTERNAL_API_KEY);
        assertThat(traceRequestId.get()).isEqualTo("backend.recommend-trace:1");
    }

    @Test
    void generatesValidOutboundRequestIdWithoutChangingMdc() {
        AtomicReference<String> requestId = new AtomicReference<>();
        AtomicReference<String> internalApiKey = new AtomicReference<>();
        server.createContext("/internal/v2/recommendations", exchange -> {
            requestId.set(exchange.getRequestHeaders().getFirst("X-Request-Id"));
            internalApiKey.set(exchange.getRequestHeaders().getFirst("X-Internal-Api-Key"));
            JsonNode request = OBJECT_MAPPER.readTree(exchange.getRequestBody());
            respond(exchange, 200, """
                    {
                      "requestId": "%s",
                      "algorithm": "tfidf-cosine-hybrid",
                      "algorithmVersion": "bilingual-recommendation-v2",
                      "results": []
                    }
                    """.formatted(request.get("requestId").asText()));
        });

        client(Duration.ofSeconds(2)).recommend(recommendationRequest());

        assertThat(RequestIdSupport.isValid(requestId.get())).isTrue();
        assertThat(internalApiKey.get()).isEqualTo(TEST_INTERNAL_API_KEY);
        assertThat(MDC.get(RequestIdSupport.MDC_KEY)).isNull();
    }

    @Test
    void mapsTimeoutConnectionFailureAndHttpErrors() throws IOException {
        server.createContext("/internal/v2/recommendations", exchange -> {
            try {
                Thread.sleep(300);
                respond(exchange, 200, "{}");
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
            }
        });
        assertError(
                () -> client(Duration.ofMillis(50)).recommend(recommendationRequest()),
                ErrorCode.AI_SERVICE_TIMEOUT
        );

        server.createContext("/internal/v2/cv/parse", exchange -> {
            try {
                Thread.sleep(300);
                respond(exchange, 200, "{}");
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
            }
        });
        assertError(
                () -> client(Duration.ofMillis(50)).parseCv(
                        new ByteArrayResource(new byte[]{1}),
                        "resume.pdf",
                        MediaType.APPLICATION_PDF
                ),
                ErrorCode.AI_SERVICE_TIMEOUT
        );

        int unusedPort;
        try (ServerSocket socket = new ServerSocket(0)) {
            unusedPort = socket.getLocalPort();
        }
        RestAiServiceClient unavailableClient = client("http://127.0.0.1:" + unusedPort, Duration.ofMillis(100));
        assertError(
                () -> unavailableClient.recommend(recommendationRequest()),
                ErrorCode.AI_SERVICE_UNAVAILABLE
        );
    }

    @Test
    void mapsHttp4xxHttp5xxAndMalformedJsonWithoutLeakingBodies() {
        server.createContext("/internal/v2/cv/parse", exchange ->
                respond(exchange, 400, "{\"detail\":\"raw CV must never escape\"}"));
        server.createContext("/internal/v2/recommendations", exchange ->
                respond(exchange, 400, "{\"detail\":\"request rejected\"}"));

        assertError(
                () -> client(Duration.ofSeconds(2)).parseCv(
                        new ByteArrayResource(new byte[]{1}),
                        "resume.pdf",
                        MediaType.APPLICATION_PDF
                ),
                ErrorCode.AI_SERVICE_INVALID_RESPONSE
        );
        server.removeContext("/internal/v2/cv/parse");
        server.createContext("/internal/v2/cv/parse", exchange -> respond(exchange, 200, "{broken-json"));
        assertError(
                () -> client(Duration.ofSeconds(2)).parseCv(
                        new ByteArrayResource(new byte[]{1}),
                        "resume.pdf",
                        MediaType.APPLICATION_PDF
                ),
                ErrorCode.AI_SERVICE_INVALID_RESPONSE
        );
        assertError(
                () -> client(Duration.ofSeconds(2)).recommend(recommendationRequest()),
                ErrorCode.AI_SERVICE_INVALID_RESPONSE
        );
        server.removeContext("/internal/v2/recommendations");
        server.createContext("/internal/v2/recommendations", exchange ->
                respond(exchange, 500, "{\"detail\":\"internal stack trace\"}"));
        assertError(
                () -> client(Duration.ofSeconds(2)).recommend(recommendationRequest()),
                ErrorCode.AI_SERVICE_UNAVAILABLE
        );

        server.removeContext("/internal/v2/recommendations");
        server.createContext("/internal/v2/recommendations", exchange -> respond(exchange, 200, "{broken-json"));
        assertError(
                () -> client(Duration.ofSeconds(2)).recommend(recommendationRequest()),
                ErrorCode.AI_SERVICE_INVALID_RESPONSE
        );
    }

    private RestAiServiceClient client(Duration readTimeout) {
        return client("http://127.0.0.1:" + server.getAddress().getPort(), readTimeout);
    }

    private RestAiServiceClient client(String baseUrl, Duration readTimeout) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofMillis(100));
        requestFactory.setReadTimeout(readTimeout);
        AiServiceProperties properties = new AiServiceProperties();
        properties.setInternalApiKey(TEST_INTERNAL_API_KEY);
        return new RestAiServiceClient(RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build(), properties, OBJECT_MAPPER, new AiCandidateRankingProperties());
    }

    private AiRecommendationRequest recommendationRequest() {
        return new AiRecommendationRequest(
                UUID.randomUUID(),
                new AiRecommendationRequest.CvInput(12L, "java", List.of("java")),
                List.of(new AiRecommendationRequest.JobInput(101L, "java backend", List.of("java"))),
                new BigDecimal("0.1"),
                20
        );
    }

    private void assertError(Runnable action, ErrorCode expectedCode) {
        assertThatThrownBy(action::run)
                .isInstanceOfSatisfying(AppException.class, exception -> {
                    assertThat(exception.getErrorCode()).isEqualTo(expectedCode);
                    assertThat(exception.getMessage()).isEqualTo(expectedCode.getDefaultMessage());
                });
    }

    private static void respond(HttpExchange exchange, int status, String responseBody) throws IOException {
        byte[] bytes = responseBody.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }
}
