package com.tttn.jobrecommendation.modules.candidateranking.entity;

import com.tttn.jobrecommendation.common.enums.RecommendationRunStatus;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(
        name = "candidate_ranking_runs",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_candidate_ranking_runs_request_id",
                columnNames = "request_id"
        ),
        indexes = @Index(
                name = "idx_candidate_ranking_runs_job_status_created_at",
                columnList = "job_id, status, created_at, id"
        )
)
public class CandidateRankingRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "job_id", nullable = false)
    private Job job;

    @Column(name = "request_id", nullable = false, unique = true)
    private UUID requestId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 50)
    private RecommendationRunStatus status;

    @Column(name = "algorithm", length = 100)
    private String algorithm;

    @Column(name = "algorithm_version", length = 100)
    private String algorithmVersion;

    @Column(name = "threshold", nullable = false, precision = 8, scale = 5)
    private BigDecimal threshold;

    @Column(name = "requested_limit")
    private Integer requestedLimit;

    @Column(name = "requested_primary_limit")
    private Integer requestedPrimaryLimit;

    @Column(name = "requested_fallback_limit")
    private Integer requestedFallbackLimit;

    @Builder.Default
    @Column(name = "total_applications_scanned", nullable = false)
    private Integer totalApplicationsScanned = 0;

    @Builder.Default
    @Column(name = "eligible_candidates", nullable = false)
    private Integer eligibleCandidates = 0;

    @Builder.Default
    @Column(name = "skipped_no_cv", nullable = false)
    private Integer skippedNoCv = 0;

    @Builder.Default
    @Column(name = "skipped_not_ready", nullable = false)
    private Integer skippedNotReady = 0;

    @Builder.Default
    @Column(name = "skipped_terminal_status", nullable = false)
    private Integer skippedTerminalStatus = 0;

    @Column(name = "input_fingerprint", nullable = false, length = 64)
    private String inputFingerprint;

    @Column(name = "job_updated_at_snapshot", nullable = false)
    private LocalDateTime jobUpdatedAtSnapshot;

    @CreationTimestamp
    @Column(name = "started_at", nullable = false, updatable = false)
    private LocalDateTime startedAt;

    @Column(name = "finished_at")
    private LocalDateTime finishedAt;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
