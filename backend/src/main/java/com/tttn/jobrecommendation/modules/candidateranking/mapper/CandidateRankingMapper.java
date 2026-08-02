package com.tttn.jobrecommendation.modules.candidateranking.mapper;

import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.candidateranking.dto.response.CandidateRankingResultResponse;
import com.tttn.jobrecommendation.modules.candidateranking.dto.response.CandidateRankingRunDetailResponse;
import com.tttn.jobrecommendation.modules.candidateranking.dto.response.CandidateRankingRunResponse;
import com.tttn.jobrecommendation.modules.candidateranking.entity.CandidateRankingResult;
import com.tttn.jobrecommendation.modules.candidateranking.entity.CandidateRankingRun;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class CandidateRankingMapper {

    public CandidateRankingRunResponse toRunResponse(CandidateRankingRun run, int totalRanked) {
        return new CandidateRankingRunResponse(
                run.getId(),
                run.getJob().getId(),
                run.getJob().getTitle(),
                run.getStatus(),
                run.getAlgorithm(),
                run.getAlgorithmVersion(),
                run.getThreshold(),
                run.getRequestedLimit(),
                run.getTotalApplicationsScanned(),
                run.getEligibleCandidates(),
                run.getSkippedNoCv(),
                run.getSkippedNotReady(),
                run.getSkippedTerminalStatus(),
                totalRanked,
                run.getErrorMessage(),
                run.getStartedAt(),
                run.getFinishedAt(),
                run.getCreatedAt()
        );
    }

    public CandidateRankingRunDetailResponse toRunDetailResponse(
            CandidateRankingRun run,
            List<CandidateRankingResultResponse> results
    ) {
        List<CandidateRankingResultResponse> safeResults = results == null ? List.of() : List.copyOf(results);
        return new CandidateRankingRunDetailResponse(
                run.getId(),
                run.getJob().getId(),
                run.getJob().getTitle(),
                run.getStatus(),
                run.getAlgorithm(),
                run.getAlgorithmVersion(),
                run.getThreshold(),
                run.getRequestedLimit(),
                run.getTotalApplicationsScanned(),
                run.getEligibleCandidates(),
                run.getSkippedNoCv(),
                run.getSkippedNotReady(),
                run.getSkippedTerminalStatus(),
                safeResults.size(),
                run.getErrorMessage(),
                run.getStartedAt(),
                run.getFinishedAt(),
                run.getCreatedAt(),
                safeResults
        );
    }

    public CandidateRankingResultResponse toResultResponse(CandidateRankingResult result) {
        JobApplication application = result.getApplication();
        return new CandidateRankingResultResponse(
                result.getId(),
                application.getId(),
                application.getStudent().getId(),
                application.getStudent().getUser().getFullName(),
                application.getStudent().getUser().getEmail(),
                result.getCvFile().getId(),
                result.getCvFile().getFileName(),
                application.getStatus(),
                application.getAppliedAt(),
                result.getScore(),
                result.getTextScore(),
                result.getSkillScore(),
                result.getScoringStrategy(),
                result.getMatchedSkills(),
                result.getMissingSkills(),
                result.getReason(),
                result.getRankPosition(),
                result.getCreatedAt()
        );
    }
}
