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
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingV3Request;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationV3Request;
import com.tttn.jobrecommendation.infrastructure.ai.exception.AiCandidateRankingCapacityException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
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

class RestAiServiceClientV3Test {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final String API_KEY = "v3-internal-api-key-at-least-32-characters";
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
    void studentV3UsesExactEndpointHeadersBodyAndStrictResponse() throws Exception {
        AtomicReference<String> apiKey = new AtomicReference<>();
        AtomicReference<String> transportId = new AtomicReference<>();
        AtomicReference<byte[]> body = new AtomicReference<>();
        AiRecommendationV3Request request = studentRequest();
        server.createContext("/internal/v3/recommendations", exchange -> {
            assertThat(exchange.getRequestMethod()).isEqualTo("POST");
            apiKey.set(exchange.getRequestHeaders().getFirst("X-Internal-Api-Key"));
            transportId.set(exchange.getRequestHeaders().getFirst("X-Request-Id"));
            body.set(exchange.getRequestBody().readAllBytes());
            respond(exchange, 200, studentResponse(request.requestId(), ""));
        });
        MDC.put(RequestIdSupport.MDC_KEY, "v3.student.trace-1");

        var response = client(5, Long.MAX_VALUE, Duration.ofSeconds(2)).recommendV3(request);

        JsonNode json = OBJECT_MAPPER.readTree(body.get());
        assertThat(apiKey.get()).isEqualTo(API_KEY);
        assertThat(transportId.get()).isEqualTo("v3.student.trace-1");
        assertThat(json.path("cv").has("processedText")).isTrue();
        assertThat(json.toString()).doesNotContain("extractedText", "rawText", "rankPosition");
        assertThat(response.results()).hasSize(1);
        assertThat(response.results().getFirst().rankingScore()).isEqualByComparingTo("0.75000000");
    }

    @Test
    void studentV3MapsMalformedEmptyUnknownTimeoutAndHttpFailures() throws IOException {
        AiRecommendationV3Request request = studentRequest();
        server.createContext("/internal/v3/recommendations", exchange -> respond(exchange, 200, ""));
        assertError(() -> client(5, Long.MAX_VALUE, Duration.ofSeconds(2)).recommendV3(request), ErrorCode.AI_SERVICE_INVALID_RESPONSE);
        server.removeContext("/internal/v3/recommendations");
        server.createContext("/internal/v3/recommendations", exchange -> respond(exchange, 200, studentResponse(request.requestId(), ",\"unknown\":true")));
        assertError(() -> client(5, Long.MAX_VALUE, Duration.ofSeconds(2)).recommendV3(request), ErrorCode.AI_SERVICE_INVALID_RESPONSE);
        server.removeContext("/internal/v3/recommendations");
        server.createContext("/internal/v3/recommendations", exchange -> respond(exchange, 500, "private upstream error"));
        assertError(() -> client(5, Long.MAX_VALUE, Duration.ofSeconds(2)).recommendV3(request), ErrorCode.AI_SERVICE_UNAVAILABLE);
        server.removeContext("/internal/v3/recommendations");
        server.createContext("/internal/v3/recommendations", exchange -> respond(exchange, 400, "private request error"));
        assertError(() -> client(5, Long.MAX_VALUE, Duration.ofSeconds(2)).recommendV3(request), ErrorCode.AI_SERVICE_INVALID_RESPONSE);
        server.removeContext("/internal/v3/recommendations");
        server.createContext("/internal/v3/recommendations", exchange -> {
            try {
                Thread.sleep(300);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
            }
        });
        assertError(() -> client(5, Long.MAX_VALUE, Duration.ofMillis(50)).recommendV3(request), ErrorCode.AI_SERVICE_TIMEOUT);
    }

    @Test
    void companyV3UsesOneSerializedRequestAndPreservesCapacityAuthAndTracing() throws Exception {
        AiCandidateRankingV3Request request = companyRequest(1);
        byte[] expected = OBJECT_MAPPER.writeValueAsBytes(request);
        AtomicInteger calls = new AtomicInteger();
        AtomicReference<byte[]> sent = new AtomicReference<>();
        AtomicReference<String> requestId = new AtomicReference<>();
        server.createContext("/internal/v3/candidate-rankings", exchange -> {
            calls.incrementAndGet();
            sent.set(exchange.getRequestBody().readAllBytes());
            requestId.set(exchange.getRequestHeaders().getFirst("X-Request-Id"));
            assertThat(exchange.getRequestHeaders().getFirst("X-Internal-Api-Key")).isEqualTo(API_KEY);
            JsonNode json = OBJECT_MAPPER.readTree(sent.get());
            respond(exchange, 200, companyResponse(json.path("requestId").asText(), ""));
        });

        var response = client(1, expected.length, Duration.ofSeconds(2))
                .rankCandidatesV3(request, "company-v3-trace-1");

        assertThat(calls).hasValue(1);
        assertThat(sent.get()).containsExactly(expected);
        assertThat(requestId.get()).isEqualTo("company-v3-trace-1");
        assertThat(response.results().getFirst().overallScore()).isNull();
        assertThatThrownBy(() -> client(0, Long.MAX_VALUE, Duration.ofSeconds(2))
                .rankCandidatesV3(request, "company-v3-trace-1"))
                .isInstanceOf(AiCandidateRankingCapacityException.class);
        assertThat(calls).hasValue(1);
    }

    @Test
    void companyV3MapsStrictResponseAndTransportFailures() throws IOException {
        AiCandidateRankingV3Request request = companyRequest(1);
        server.createContext("/internal/v3/candidate-rankings", exchange -> respond(exchange, 413, "private capacity error"));
        assertThatThrownBy(() -> client(5, Long.MAX_VALUE, Duration.ofSeconds(2)).rankCandidatesV3(request, "trace"))
                .isInstanceOf(AiCandidateRankingCapacityException.class);
        server.removeContext("/internal/v3/candidate-rankings");
        server.createContext("/internal/v3/candidate-rankings", exchange -> respond(exchange, 200, companyResponse(request.requestId().toString(), ",\"rank\":1")));
        assertError(() -> client(5, Long.MAX_VALUE, Duration.ofSeconds(2)).rankCandidatesV3(request, "trace"), ErrorCode.AI_SERVICE_INVALID_RESPONSE);
        server.removeContext("/internal/v3/candidate-rankings");
        server.createContext("/internal/v3/candidate-rankings", exchange -> respond(exchange, 500, "private error"));
        assertError(() -> client(5, Long.MAX_VALUE, Duration.ofSeconds(2)).rankCandidatesV3(request, "trace"), ErrorCode.AI_SERVICE_UNAVAILABLE);
        server.removeContext("/internal/v3/candidate-rankings");
        server.createContext("/internal/v3/candidate-rankings", exchange -> respond(exchange, 400, "private error"));
        assertError(() -> client(5, Long.MAX_VALUE, Duration.ofSeconds(2)).rankCandidatesV3(request, "trace"), ErrorCode.AI_SERVICE_INVALID_RESPONSE);
        int unusedPort;
        try (ServerSocket socket = new ServerSocket(0)) {
            unusedPort = socket.getLocalPort();
        }
        assertError(() -> client("http://127.0.0.1:" + unusedPort, 5, Long.MAX_VALUE, Duration.ofMillis(100))
                .rankCandidatesV3(request, "trace"), ErrorCode.AI_SERVICE_UNAVAILABLE);
    }

    private RestAiServiceClient client(int maximumCandidates, long maximumBytes, Duration timeout) {
        return client("http://127.0.0.1:" + server.getAddress().getPort(), maximumCandidates, maximumBytes, timeout);
    }

    private RestAiServiceClient client(String baseUrl, int maximumCandidates, long maximumBytes, Duration timeout) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofMillis(100));
        factory.setReadTimeout(timeout);
        AiServiceProperties properties = new AiServiceProperties();
        properties.setInternalApiKey(API_KEY);
        AiCandidateRankingProperties candidateProperties = new AiCandidateRankingProperties();
        candidateProperties.setMaxCandidatesPerRequest(maximumCandidates);
        candidateProperties.setMaxRequestBytes(maximumBytes);
        return new RestAiServiceClient(RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build(), properties, OBJECT_MAPPER, candidateProperties);
    }

    private AiRecommendationV3Request studentRequest() {
        return new AiRecommendationV3Request(UUID.randomUUID(),
                new AiRecommendationV3Request.CvInput(1L, "private processed CV", List.of("java"), "en", new BigDecimal("0.99"), "bilingual-nlp-v2-skills-v1"),
                List.of(new AiRecommendationV3Request.JobInput(2L, "Java job", List.of("java"))), new BigDecimal("0.1"), 20);
    }

    private AiCandidateRankingV3Request companyRequest(int candidateCount) {
        return new AiCandidateRankingV3Request(UUID.randomUUID(),
                new AiCandidateRankingV3Request.JobInput(1L, "Java job", List.of("java")),
                java.util.stream.IntStream.range(0, candidateCount).mapToObj(index ->
                        new AiCandidateRankingV3Request.CandidateInput(10L + index, 20L + index, "private processed CV", List.of("java"), "en", new BigDecimal("0.99"), "bilingual-nlp-v2-skills-v1")
                ).toList(), new BigDecimal("0.1"), 20, 20);
    }

    private String studentResponse(UUID requestId, String suffix) {
        return """
                {"requestId":"%s","algorithm":"tfidf-cosine-hybrid","algorithmVersion":"bilingual-recommendation-v3","results":[{"jobId":2,"rankingTier":"PRIMARY","rankingScore":0.75000000,"overallScore":0.75000000,"textScore":0.65000000,"skillScore":0.93571429,"scoringStrategy":"SAME_LANGUAGE_HYBRID","matchedSkills":["java"],"missingSkills":[],"reason":"reason"}]%s}
                """.formatted(requestId, suffix);
    }

    private String companyResponse(String requestId, String suffix) {
        return """
                {"requestId":"%s","algorithm":"tfidf-cosine-hybrid","algorithmVersion":"bilingual-candidate-ranking-v3","results":[{"applicationId":10,"cvId":20,"rankingTier":"FALLBACK","rankingScore":0.50000000,"overallScore":null,"textScore":null,"skillScore":0.50000000,"scoringStrategy":"CROSS_LANGUAGE_SKILL_BASED","matchedSkills":["java"],"missingSkills":[]}]%s}
                """.formatted(requestId, suffix);
    }

    private void assertError(Runnable action, ErrorCode expected) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(AppException.class,
                exception -> assertThat(exception.getErrorCode()).isEqualTo(expected));
    }

    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }
}
