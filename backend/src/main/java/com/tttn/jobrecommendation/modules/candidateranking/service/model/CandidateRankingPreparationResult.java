package com.tttn.jobrecommendation.modules.candidateranking.service.model;

import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingRequest;

import java.util.List;

public record CandidateRankingPreparationResult(
        CandidateRankingJobSnapshot jobSnapshot,
        AiCandidateRankingRequest.JobInput aiJobInput,
        List<CandidateRankingCandidateSnapshot> eligibleCandidateSnapshots,
        List<AiCandidateRankingRequest.CandidateInput> aiCandidateInputs,
        CandidateRankingCorpusCounters counters,
        String inputFingerprint
) {

    public CandidateRankingPreparationResult {
        eligibleCandidateSnapshots = List.copyOf(eligibleCandidateSnapshots);
        aiCandidateInputs = List.copyOf(aiCandidateInputs);
    }
}
