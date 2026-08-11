package com.tttn.jobrecommendation.infrastructure.ai.client;

import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCvParseResponse;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingRequest;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingResponse;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingV3Request;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingV3Response;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationRequest;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationResponse;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationV3Request;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationV3Response;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;

public interface AiServiceClient {

    AiCvParseResponse parseCv(Resource resource, String fileName, MediaType contentType);

    AiRecommendationResponse recommend(AiRecommendationRequest request);

    AiRecommendationV3Response recommendV3(AiRecommendationV3Request request);

    AiCandidateRankingResponse rankCandidates(
            AiCandidateRankingRequest request,
            String transportRequestId
    );

    AiCandidateRankingV3Response rankCandidatesV3(
            AiCandidateRankingV3Request request,
            String transportRequestId
    );
}
