package com.tttn.jobrecommendation.infrastructure.ai.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "app.ai.recommendation")
public class AiRecommendationProperties {

    @NotBlank
    @Size(max = 100)
    private String algorithm = "tfidf-cosine-hybrid";

    @NotBlank
    @Size(max = 100)
    private String algorithmVersion = "bilingual-recommendation-v2";

    public String getAlgorithm() {
        return algorithm;
    }

    public void setAlgorithm(String algorithm) {
        this.algorithm = algorithm;
    }

    public String getAlgorithmVersion() {
        return algorithmVersion;
    }

    public void setAlgorithmVersion(String algorithmVersion) {
        this.algorithmVersion = algorithmVersion;
    }
}
