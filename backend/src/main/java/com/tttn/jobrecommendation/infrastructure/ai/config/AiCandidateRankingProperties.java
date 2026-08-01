package com.tttn.jobrecommendation.infrastructure.ai.config;

import jakarta.validation.constraints.Positive;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "app.ai.candidate-ranking")
public class AiCandidateRankingProperties {

    @Positive
    private int maxCandidatesPerRequest = 500;

    @Positive
    private long maxRequestBytes = 8_388_608L;

    public int getMaxCandidatesPerRequest() {
        return maxCandidatesPerRequest;
    }

    public void setMaxCandidatesPerRequest(int maxCandidatesPerRequest) {
        this.maxCandidatesPerRequest = maxCandidatesPerRequest;
    }

    public long getMaxRequestBytes() {
        return maxRequestBytes;
    }

    public void setMaxRequestBytes(long maxRequestBytes) {
        this.maxRequestBytes = maxRequestBytes;
    }
}
