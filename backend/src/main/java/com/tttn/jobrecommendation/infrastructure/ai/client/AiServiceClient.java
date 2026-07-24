package com.tttn.jobrecommendation.infrastructure.ai.client;

import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCvParseResponse;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationRequest;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationResponse;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;

public interface AiServiceClient {

    AiCvParseResponse parseCv(Resource resource, String fileName, MediaType contentType);

    AiRecommendationResponse recommend(AiRecommendationRequest request);
}
