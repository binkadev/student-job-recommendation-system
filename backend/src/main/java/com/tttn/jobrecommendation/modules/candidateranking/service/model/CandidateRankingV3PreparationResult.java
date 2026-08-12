package com.tttn.jobrecommendation.modules.candidateranking.service.model;

import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingV3Request;

import java.util.List;

public record CandidateRankingV3PreparationResult(
        CandidateRankingJobSnapshot jobSnapshot,
        AiCandidateRankingV3Request.JobInput aiJobInput,
        List<CandidateRankingCandidateSnapshot> eligibleCandidateSnapshots,
        List<AiCandidateRankingV3Request.CandidateInput> aiCandidateInputs,
        CandidateRankingCorpusCounters counters,
        String inputFingerprint
) {
    public CandidateRankingV3PreparationResult {
        eligibleCandidateSnapshots = List.copyOf(eligibleCandidateSnapshots);
        aiCandidateInputs = List.copyOf(aiCandidateInputs);
    }
}
