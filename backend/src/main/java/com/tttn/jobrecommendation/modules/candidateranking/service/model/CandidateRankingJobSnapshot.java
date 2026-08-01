package com.tttn.jobrecommendation.modules.candidateranking.service.model;

import java.time.LocalDateTime;
import java.util.List;

public record CandidateRankingJobSnapshot(
        Long id,
        String title,
        String description,
        String requirements,
        List<String> canonicalSkills,
        LocalDateTime updatedAt
) {

    public CandidateRankingJobSnapshot {
        canonicalSkills = canonicalSkills == null ? List.of() : List.copyOf(canonicalSkills);
    }
}
