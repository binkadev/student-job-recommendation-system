package com.tttn.jobrecommendation.infrastructure.ai.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.config.AiCandidateRankingProperties;
import com.tttn.jobrecommendation.infrastructure.ai.config.AiServiceProperties;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingRequest;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingResponse;
import com.tttn.jobrecommendation.infrastructure.ai.exception.AiCandidateRankingCapacityException;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.lang.reflect.AnnotatedParameterizedType;
import java.lang.reflect.AnnotatedType;
import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@ExtendWith(OutputCaptureExtension.class)
class RestAiServiceClientCandidateRankingTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final String TEST_INTERNAL_API_KEY =
            "candidate-ranking-internal-api-key-at-least-32-characters";
    private static final String TRANSPORT_REQUEST_ID = "candidate-ranking-transport-request-1";
    private static final String USER_JWT = "Bearer user-jwt-must-not-be-forwarded";
    private static final String PRIVATE_CV_TEXT = "Ứng viên Java tuyệt mật";

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
        server.stop(0);
        executor.shutdownNow();
    }

    @Test
    void sendsOneBulkRequestWithRequiredHeadersAndNoUserAuthorization(CapturedOutput output) throws Exception {
        AtomicInteger calls = new AtomicInteger();
        AtomicReference<String> method = new AtomicReference<>();
        AtomicReference<String> apiKey = new AtomicReference<>();
        AtomicReference<String> requestId = new AtomicReference<>();
        AtomicReference<String> authorization = new AtomicReference<>();
        AtomicReference<JsonNode> body = new AtomicReference<>();
        AtomicReference<byte[]> rawBody = new AtomicReference<>();
        server.createContext("/internal/v2/candidate-rankings", exchange -> {
            calls.incrementAndGet();
            method.set(exchange.getRequestMethod());
            apiKey.set(exchange.getRequestHeaders().getFirst("X-Internal-Api-Key"));
            requestId.set(exchange.getRequestHeaders().getFirst("X-Request-Id"));
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            rawBody.set(exchange.getRequestBody().readAllBytes());
            body.set(OBJECT_MAPPER.readTree(rawBody.get()));
            respondSuccess(exchange, body.get().get("requestId").asText());
        });
        AiCandidateRankingRequest request = rankingRequest(2);

        client(2, Long.MAX_VALUE, Duration.ofSeconds(2))
                .rankCandidates(request, TRANSPORT_REQUEST_ID);

        assertThat(calls).hasValue(1);
        assertThat(method.get()).isEqualTo("POST");
        assertThat(apiKey.get()).isEqualTo(TEST_INTERNAL_API_KEY);
        assertThat(requestId.get()).isEqualTo(TRANSPORT_REQUEST_ID);
        assertThat(authorization.get()).isNull();
        assertThat(rawBody.get()).containsExactly(OBJECT_MAPPER.writeValueAsBytes(request));
        assertThat(body.get().at("/candidates/0/studentId").isMissingNode()).isTrue();
        assertThat(body.get().at("/candidates/0/coverLetter").isMissingNode()).isTrue();
        assertThat(output).doesNotContain(TEST_INTERNAL_API_KEY, USER_JWT, PRIVATE_CV_TEXT);
    }

    @Test
    void deserializesNullableTextScoreBigDecimalsAndSkillLists() {
        UUID businessRequestId = UUID.randomUUID();
        server.createContext("/internal/v2/candidate-rankings", exchange -> respond(exchange, 200, """
                {
                  "requestId": "%s",
                  "algorithm": "tfidf-cosine-hybrid",
                  "algorithmVersion": "bilingual-candidate-ranking-v2",
                  "results": [{
                    "applicationId": 101,
                    "cvId": 201,
                    "score": 0.72000,
                    "textScore": null,
                    "skillScore": 0.85000,
                    "scoringStrategy": "CROSS_LANGUAGE_SKILL_BASED",
                    "matchedSkills": ["java", "spring boot"],
                    "missingSkills": ["docker"]
                  }]
                }
                """.formatted(businessRequestId)));

        var response = client(1, Long.MAX_VALUE, Duration.ofSeconds(2))
                .rankCandidates(rankingRequest(businessRequestId, 1), TRANSPORT_REQUEST_ID);

        assertThat(response.requestId()).isEqualTo(businessRequestId);
        assertThat(response.results()).singleElement().satisfies(result -> {
            assertThat(result.applicationId()).isEqualTo(101L);
            assertThat(result.cvId()).isEqualTo(201L);
            assertThat(result.score()).isEqualByComparingTo("0.72000");
            assertThat(result.textScore()).isNull();
            assertThat(result.skillScore()).isEqualByComparingTo("0.85000");
            assertThat(result.matchedSkills()).containsExactly("java", "spring boot");
            assertThat(result.missingSkills()).containsExactly("docker");
        });
    }

    @Test
    void candidateCountAtSafeguardIsSentAndAboveSafeguardFailsWithoutCallingServer() {
        AtomicInteger calls = successContext();

        client(2, Long.MAX_VALUE, Duration.ofSeconds(2))
                .rankCandidates(rankingRequest(2), TRANSPORT_REQUEST_ID);

        assertThat(calls).hasValue(1);
        assertCapacityFailure(() -> client(2, Long.MAX_VALUE, Duration.ofSeconds(2))
                .rankCandidates(rankingRequest(3), TRANSPORT_REQUEST_ID));
        assertThat(calls).hasValue(1);
    }

    @Test
    void serializedUtf8BytesAtSafeguardAreSentAndAboveSafeguardFailsWithoutCallingServer()
            throws Exception {
        AtomicInteger calls = successContext();
        AiCandidateRankingRequest request = rankingRequest(1);
        byte[] serializedRequest = OBJECT_MAPPER.writeValueAsBytes(request);
        assertThat(serializedRequest.length)
                .isGreaterThan(new String(serializedRequest, StandardCharsets.UTF_8).length());

        client(1, serializedRequest.length, Duration.ofSeconds(2))
                .rankCandidates(request, TRANSPORT_REQUEST_ID);

        assertThat(calls).hasValue(1);
        assertCapacityFailure(() -> client(1, serializedRequest.length - 1L, Duration.ofSeconds(2))
                .rankCandidates(request, TRANSPORT_REQUEST_ID));
        assertThat(calls).hasValue(1);
    }

    @Test
    void mapsHttp413ToSanitizedTypedCapacityFailure(CapturedOutput output) {
        String privateUpstreamBody = "payload too large: configured limit and CV details";
        server.createContext("/internal/v2/candidate-rankings", exchange ->
                respond(exchange, 413, privateUpstreamBody));

        assertThatThrownBy(() -> client(1, Long.MAX_VALUE, Duration.ofSeconds(2))
                .rankCandidates(rankingRequest(1), TRANSPORT_REQUEST_ID))
                .isInstanceOfSatisfying(AiCandidateRankingCapacityException.class, exception ->
                        assertThat(exception.getMessage())
                                .isEqualTo("Candidate ranking request exceeds synchronous transport capacity"))
                .hasMessageNotContaining(privateUpstreamBody);
        assertThat(output).doesNotContain(privateUpstreamBody, TEST_INTERNAL_API_KEY, PRIVATE_CV_TEXT);
    }

    @Test
    void mapsTimeoutAndConnectionFailure() throws IOException {
        server.createContext("/internal/v2/candidate-rankings", exchange -> {
            try {
                Thread.sleep(300);
                respondSuccess(exchange, UUID.randomUUID().toString());
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
            }
        });
        assertAppError(
                () -> client(1, Long.MAX_VALUE, Duration.ofMillis(50))
                        .rankCandidates(rankingRequest(1), TRANSPORT_REQUEST_ID),
                ErrorCode.AI_SERVICE_TIMEOUT
        );

        int unusedPort;
        try (ServerSocket socket = new ServerSocket(0)) {
            unusedPort = socket.getLocalPort();
        }
        assertAppError(
                () -> client(
                        "http://127.0.0.1:" + unusedPort,
                        1,
                        Long.MAX_VALUE,
                        Duration.ofMillis(100)
                ).rankCandidates(rankingRequest(1), TRANSPORT_REQUEST_ID),
                ErrorCode.AI_SERVICE_UNAVAILABLE
        );
    }

    @Test
    void mapsMalformedJsonEmptyBodyAndUnknownFieldsToInvalidResponse() {
        server.createContext("/internal/v2/candidate-rankings", exchange ->
                respond(exchange, 200, "{broken-json"));
        assertAppError(
                () -> client(1, Long.MAX_VALUE, Duration.ofSeconds(2))
                        .rankCandidates(rankingRequest(1), TRANSPORT_REQUEST_ID),
                ErrorCode.AI_SERVICE_INVALID_RESPONSE
        );

        server.removeContext("/internal/v2/candidate-rankings");
        server.createContext("/internal/v2/candidate-rankings", exchange -> respond(exchange, 200, ""));
        assertAppError(
                () -> client(1, Long.MAX_VALUE, Duration.ofSeconds(2))
                        .rankCandidates(rankingRequest(1), TRANSPORT_REQUEST_ID),
                ErrorCode.AI_SERVICE_INVALID_RESPONSE
        );

        server.removeContext("/internal/v2/candidate-rankings");
        server.createContext("/internal/v2/candidate-rankings", exchange -> respond(exchange, 200, """
                {
                  "requestId": "6b8bb66b-f97e-4bd0-8a52-8f0e06dad1e8",
                  "algorithm": "tfidf-cosine-hybrid",
                  "algorithmVersion": "bilingual-candidate-ranking-v2",
                  "results": [],
                  "rank": 1
                }
                """));
        assertAppError(
                () -> client(1, Long.MAX_VALUE, Duration.ofSeconds(2))
                        .rankCandidates(rankingRequest(1), TRANSPORT_REQUEST_ID),
                ErrorCode.AI_SERVICE_INVALID_RESPONSE
        );

        server.removeContext("/internal/v2/candidate-rankings");
        server.createContext("/internal/v2/candidate-rankings", exchange -> respond(exchange, 200, """
                {
                  "requestId": "6b8bb66b-f97e-4bd0-8a52-8f0e06dad1e8",
                  "algorithm": "tfidf-cosine-hybrid",
                  "algorithmVersion": "bilingual-candidate-ranking-v2",
                  "results": [{
                    "applicationId": 101,
                    "cvId": 201,
                    "score": 0.72,
                    "textScore": 0.65,
                    "skillScore": 0.85,
                    "scoringStrategy": "SAME_LANGUAGE_HYBRID",
                    "matchedSkills": ["java"],
                    "missingSkills": [],
                    "rankPosition": 1
                  }]
                }
                """));
        assertAppError(
                () -> client(1, Long.MAX_VALUE, Duration.ofSeconds(2))
                        .rankCandidates(rankingRequest(1), TRANSPORT_REQUEST_ID),
                ErrorCode.AI_SERVICE_INVALID_RESPONSE
        );
    }

    @Test
    void requestDtoRejectsUnknownFieldsAtEveryObjectLevel() {
        ObjectNode rootUnknown = OBJECT_MAPPER.valueToTree(rankingRequest(1));
        rootUnknown.put("studentId", 99);
        assertRequestDeserializationFails(rootUnknown);

        ObjectNode jobUnknown = OBJECT_MAPPER.valueToTree(rankingRequest(1));
        ((ObjectNode) jobUnknown.get("job")).put("companyName", "private company");
        assertRequestDeserializationFails(jobUnknown);

        ObjectNode candidateUnknown = OBJECT_MAPPER.valueToTree(rankingRequest(1));
        ((ObjectNode) candidateUnknown.withArray("candidates").get(0)).put("email", "private@example.test");
        assertRequestDeserializationFails(candidateUnknown);
    }

    @Test
    void requestSkillListsHaveNoHiddenCountLimitAndKeepElementBounds() throws Exception {
        assertUnboundedRequestSkillList(AiCandidateRankingRequest.JobInput.class);
        assertUnboundedRequestSkillList(AiCandidateRankingRequest.CandidateInput.class);
    }

    @Test
    void responseListsDeclareExistingV2MaximumOfOneHundred() throws Exception {
        assertListMaximum(AiCandidateRankingResponse.class, "results", 100);
        assertListMaximum(AiCandidateRankingResponse.Result.class, "matchedSkills", 100);
        assertListMaximum(AiCandidateRankingResponse.Result.class, "missingSkills", 100);
    }

    @Test
    void mapsUnexpectedHttpResponsesUsingExistingTransportConvention() {
        server.createContext("/internal/v2/candidate-rankings", exchange ->
                respond(exchange, 302, "unexpected redirect"));
        assertAppError(
                () -> client(1, Long.MAX_VALUE, Duration.ofSeconds(2))
                        .rankCandidates(rankingRequest(1), TRANSPORT_REQUEST_ID),
                ErrorCode.AI_SERVICE_INVALID_RESPONSE
        );

        server.removeContext("/internal/v2/candidate-rankings");
        server.createContext("/internal/v2/candidate-rankings", exchange ->
                respond(exchange, 400, "raw request details"));
        assertAppError(
                () -> client(1, Long.MAX_VALUE, Duration.ofSeconds(2))
                        .rankCandidates(rankingRequest(1), TRANSPORT_REQUEST_ID),
                ErrorCode.AI_SERVICE_INVALID_RESPONSE
        );

        server.removeContext("/internal/v2/candidate-rankings");
        server.createContext("/internal/v2/candidate-rankings", exchange ->
                respond(exchange, 503, "private upstream failure"));
        assertAppError(
                () -> client(1, Long.MAX_VALUE, Duration.ofSeconds(2))
                        .rankCandidates(rankingRequest(1), TRANSPORT_REQUEST_ID),
                ErrorCode.AI_SERVICE_UNAVAILABLE
        );
    }

    private AtomicInteger successContext() {
        AtomicInteger calls = new AtomicInteger();
        server.createContext("/internal/v2/candidate-rankings", exchange -> {
            calls.incrementAndGet();
            JsonNode request = OBJECT_MAPPER.readTree(exchange.getRequestBody());
            respondSuccess(exchange, request.get("requestId").asText());
        });
        return calls;
    }

    private RestAiServiceClient client(
            int maxCandidates,
            long maxRequestBytes,
            Duration readTimeout
    ) {
        return client(
                "http://127.0.0.1:" + server.getAddress().getPort(),
                maxCandidates,
                maxRequestBytes,
                readTimeout
        );
    }

    private RestAiServiceClient client(
            String baseUrl,
            int maxCandidates,
            long maxRequestBytes,
            Duration readTimeout
    ) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofMillis(100));
        requestFactory.setReadTimeout(readTimeout);
        AiServiceProperties serviceProperties = new AiServiceProperties();
        serviceProperties.setInternalApiKey(TEST_INTERNAL_API_KEY);
        AiCandidateRankingProperties rankingProperties = new AiCandidateRankingProperties();
        rankingProperties.setMaxCandidatesPerRequest(maxCandidates);
        rankingProperties.setMaxRequestBytes(maxRequestBytes);
        return new RestAiServiceClient(
                RestClient.builder().baseUrl(baseUrl).requestFactory(requestFactory).build(),
                serviceProperties,
                OBJECT_MAPPER,
                rankingProperties
        );
    }

    private AiCandidateRankingRequest rankingRequest(int candidateCount) {
        return rankingRequest(UUID.randomUUID(), candidateCount);
    }

    private AiCandidateRankingRequest rankingRequest(UUID requestId, int candidateCount) {
        List<AiCandidateRankingRequest.CandidateInput> candidates = new ArrayList<>();
        for (int index = 0; index < candidateCount; index++) {
            candidates.add(new AiCandidateRankingRequest.CandidateInput(
                    101L + index,
                    201L + index,
                    PRIVATE_CV_TEXT + " " + index,
                    List.of("java", "spring boot")
            ));
        }
        return new AiCandidateRankingRequest(
                requestId,
                new AiCandidateRankingRequest.JobInput(
                        10L,
                        "TITLE:\nBackend Intern\n\nDESCRIPTION:\nBuild APIs.\n\n"
                                + "REQUIREMENTS:\nJava.\n\nSKILLS:\njava, spring boot",
                        List.of("java", "spring boot")
                ),
                candidates,
                new BigDecimal("0.1"),
                20
        );
    }

    private void assertCapacityFailure(Runnable action) {
        assertThatThrownBy(action::run)
                .isInstanceOf(AiCandidateRankingCapacityException.class)
                .hasMessage("Candidate ranking request exceeds synchronous transport capacity");
    }

    private void assertRequestDeserializationFails(JsonNode requestJson) {
        assertThatThrownBy(() -> OBJECT_MAPPER.treeToValue(requestJson, AiCandidateRankingRequest.class))
                .isInstanceOf(IOException.class);
    }

    private void assertUnboundedRequestSkillList(Class<?> owner) throws Exception {
        Method accessor = owner.getDeclaredMethod("skills");
        assertThat(findAnnotation(accessor, NotNull.class)).isNotNull();
        assertThat(findAnnotation(accessor, Size.class)).isNull();

        AnnotatedType elementType = ((AnnotatedParameterizedType) accessor.getAnnotatedReturnType())
                .getAnnotatedActualTypeArguments()[0];
        assertThat(elementType.getAnnotation(NotBlank.class)).isNotNull();
        assertThat(elementType.getAnnotation(Size.class)).isNotNull().extracting(Size::max).isEqualTo(150);
    }

    private void assertListMaximum(Class<?> owner, String accessorName, int expectedMaximum) throws Exception {
        Method accessor = owner.getDeclaredMethod(accessorName);
        assertThat(findAnnotation(accessor, NotNull.class)).isNotNull();
        assertThat(findAnnotation(accessor, Size.class))
                .isNotNull()
                .extracting(Size::max)
                .isEqualTo(expectedMaximum);
    }

    private <A extends java.lang.annotation.Annotation> A findAnnotation(
            Method accessor,
            Class<A> annotationType
    ) {
        A declarationAnnotation = accessor.getAnnotation(annotationType);
        return declarationAnnotation != null
                ? declarationAnnotation
                : accessor.getAnnotatedReturnType().getAnnotation(annotationType);
    }

    private void assertAppError(Runnable action, ErrorCode expectedCode) {
        assertThatThrownBy(action::run)
                .isInstanceOfSatisfying(AppException.class, exception -> {
                    assertThat(exception.getErrorCode()).isEqualTo(expectedCode);
                    assertThat(exception.getMessage()).isEqualTo(expectedCode.getDefaultMessage());
                });
    }

    private static void respondSuccess(HttpExchange exchange, String requestId) throws IOException {
        respond(exchange, 200, """
                {
                  "requestId": "%s",
                  "algorithm": "tfidf-cosine-hybrid",
                  "algorithmVersion": "bilingual-candidate-ranking-v2",
                  "results": []
                }
                """.formatted(requestId));
    }

    private static void respond(HttpExchange exchange, int status, String responseBody) throws IOException {
        byte[] bytes = responseBody.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }
}
