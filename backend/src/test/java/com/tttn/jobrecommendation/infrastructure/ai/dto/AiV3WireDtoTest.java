package com.tttn.jobrecommendation.infrastructure.ai.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tttn.jobrecommendation.common.enums.RecommendationRankingTier;
import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AiV3WireDtoTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Test
    void studentRequestHasExactV3Shape() {
        JsonNode json = OBJECT_MAPPER.valueToTree(studentRequest());
        assertThat(json.fieldNames()).toIterable().containsExactly("requestId", "cv", "jobs", "threshold", "limit");
        assertThat(json.path("cv").fieldNames()).toIterable().containsExactly(
                "id", "processedText", "skills", "languageCode", "languageConfidence", "processingVersion"
        );
        assertThat(json.path("jobs").get(0).fieldNames()).toIterable().containsExactly("id", "text", "skills");
        assertThat(json.toString()).doesNotContain("extractedText", "rawText", "rankPosition", "tierRankPosition");
    }

    @Test
    void studentResponseDeserializesBigDecimalAndNullableTierSemanticsStrictly() throws Exception {
        AiRecommendationV3Response response = OBJECT_MAPPER.readValue("""
                {"requestId":"%s","algorithm":"tfidf-cosine-hybrid","algorithmVersion":"bilingual-recommendation-v3","results":[
                  {"jobId":1,"rankingTier":"PRIMARY","rankingScore":0.70000000,"overallScore":0.70000000,"textScore":0.65000000,"skillScore":0.80000000,"scoringStrategy":"SAME_LANGUAGE_HYBRID","matchedSkills":["java"],"missingSkills":[],"reason":"reason"},
                  {"jobId":2,"rankingTier":"FALLBACK","rankingScore":0.50000000,"overallScore":null,"textScore":null,"skillScore":0.50000000,"scoringStrategy":"CROSS_LANGUAGE_SKILL_BASED","matchedSkills":[],"missingSkills":["java"],"reason":"reason"}]}
                """.formatted(studentRequest().requestId()), AiRecommendationV3Response.class);
        assertThat(response.results().get(0).rankingScore()).isInstanceOf(BigDecimal.class);
        assertThat(response.results().get(1).overallScore()).isNull();
        assertThat(response.results().get(1).textScore()).isNull();
        assertThatThrownBy(() -> strictRead("{\"requestId\":\"%s\",\"algorithm\":\"a\",\"algorithmVersion\":\"v\",\"results\":[],\"score\":1}".formatted(studentRequest().requestId()), AiRecommendationV3Response.class))
                .isInstanceOf(IOException.class);
        assertThat(OBJECT_MAPPER.readValue("{\"algorithm\":\"a\",\"algorithmVersion\":\"v\",\"results\":[]}", AiRecommendationV3Response.class).requestId()).isNull();
    }

    @Test
    void companyRequestAndResponseHaveExactV3Shapes() throws Exception {
        JsonNode request = OBJECT_MAPPER.valueToTree(companyRequest());
        assertThat(request.fieldNames()).toIterable().containsExactly(
                "requestId", "job", "candidates", "threshold", "primaryLimit", "fallbackLimit"
        );
        assertThat(request.path("candidates").get(0).fieldNames()).toIterable().containsExactly(
                "applicationId", "cvId", "processedText", "skills", "languageCode", "languageConfidence", "processingVersion"
        );
        assertThat(request.toString()).doesNotContain("\"limit\"", "extractedText", "rawText", "profile", "coverLetter");

        AiCandidateRankingV3Response response = strictRead("""
                {"requestId":"%s","algorithm":"tfidf-cosine-hybrid","algorithmVersion":"bilingual-candidate-ranking-v3","results":[
                  {"applicationId":1,"cvId":2,"rankingTier":"PRIMARY","rankingScore":0.9,"overallScore":0.9,"textScore":0.8,"skillScore":1.0,"scoringStrategy":"SAME_LANGUAGE_HYBRID","matchedSkills":["java"],"missingSkills":[]},
                  {"applicationId":3,"cvId":4,"rankingTier":"FALLBACK","rankingScore":0.5,"overallScore":null,"textScore":null,"skillScore":0.5,"scoringStrategy":"CROSS_LANGUAGE_SKILL_BASED","matchedSkills":[],"missingSkills":["java"]}]}
                """.formatted(companyRequest().requestId()), AiCandidateRankingV3Response.class);
        assertThat(response.results().get(1).overallScore()).isNull();
        assertThat(response.results().get(1).textScore()).isNull();
        assertThatThrownBy(() -> strictRead("{\"requestId\":\"%s\",\"algorithm\":\"a\",\"algorithmVersion\":\"v\",\"results\":[],\"reason\":\"not allowed\"}".formatted(companyRequest().requestId()), AiCandidateRankingV3Response.class))
                .isInstanceOf(IOException.class);
    }

    private <T> T strictRead(String json, Class<T> type) throws IOException {
        return OBJECT_MAPPER.readerFor(type)
                .with(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                .readValue(json);
    }

    private AiRecommendationV3Request studentRequest() {
        return new AiRecommendationV3Request(
                UUID.randomUUID(),
                new AiRecommendationV3Request.CvInput(1L, "java spring", List.of("java"), "en", new BigDecimal("0.98"), "bilingual-nlp-v2-skills-v1"),
                List.of(new AiRecommendationV3Request.JobInput(2L, "Java job", List.of("java"))),
                new BigDecimal("0.1"), 20
        );
    }

    private AiCandidateRankingV3Request companyRequest() {
        return new AiCandidateRankingV3Request(
                UUID.randomUUID(),
                new AiCandidateRankingV3Request.JobInput(1L, "Java job", List.of("java")),
                List.of(new AiCandidateRankingV3Request.CandidateInput(2L, 3L, "java spring", List.of("java"), "en", new BigDecimal("0.98"), "bilingual-nlp-v2-skills-v1")),
                new BigDecimal("0.1"), 20, 20
        );
    }
}
