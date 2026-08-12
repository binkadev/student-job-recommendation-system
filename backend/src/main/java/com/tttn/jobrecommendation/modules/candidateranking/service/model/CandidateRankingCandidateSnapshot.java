package com.tttn.jobrecommendation.modules.candidateranking.service.model;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CvAnalysisStatus;

import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.util.List;

public record CandidateRankingCandidateSnapshot(
        Long applicationId,
        ApplicationStatus applicationStatus,
        Long cvId,
        String extractedText,
        String processedText,
        List<String> canonicalExtractedSkills,
        CvAnalysisStatus analysisStatus,
        String languageCode,
        BigDecimal languageConfidence,
        String processingVersion,
        LocalDateTime analyzedAt
) {

    public CandidateRankingCandidateSnapshot {
        canonicalExtractedSkills = canonicalExtractedSkills == null
                ? List.of()
                : List.copyOf(canonicalExtractedSkills);
    }

    public CandidateRankingCandidateSnapshot(
            Long applicationId, ApplicationStatus applicationStatus, Long cvId, String extractedText,
            List<String> canonicalExtractedSkills, CvAnalysisStatus analysisStatus,
            String processingVersion, LocalDateTime analyzedAt
    ) {
        this(applicationId, applicationStatus, cvId, extractedText, null, canonicalExtractedSkills,
                analysisStatus, null, null, processingVersion, analyzedAt);
    }
}
