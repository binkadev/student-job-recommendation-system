package com.tttn.jobrecommendation.modules.candidateranking.service.model;

public record CandidateRankingCorpusCounters(
        int totalApplicationsScanned,
        int eligibleCandidates,
        int skippedNoCv,
        int skippedNotReady,
        int skippedTerminalStatus
) {

    public CandidateRankingCorpusCounters {
        if (totalApplicationsScanned < 0
                || eligibleCandidates < 0
                || skippedNoCv < 0
                || skippedNotReady < 0
                || skippedTerminalStatus < 0) {
            throw new IllegalArgumentException("Candidate ranking counters must be nonnegative");
        }
        if (totalApplicationsScanned
                != eligibleCandidates + skippedNoCv + skippedNotReady + skippedTerminalStatus) {
            throw new IllegalArgumentException("Candidate ranking counters are inconsistent");
        }
    }
}
