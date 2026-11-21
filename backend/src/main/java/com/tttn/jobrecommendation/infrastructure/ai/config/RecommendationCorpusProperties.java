package com.tttn.jobrecommendation.infrastructure.ai.config;

import jakarta.validation.constraints.Positive;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "app.recommendation")
public class RecommendationCorpusProperties {

    @Positive
    private int maxCandidateJobs = 500;

    public int getMaxCandidateJobs() {
        return maxCandidateJobs;
    }

    public void setMaxCandidateJobs(int maxCandidateJobs) {
        this.maxCandidateJobs = maxCandidateJobs;
    }
}
