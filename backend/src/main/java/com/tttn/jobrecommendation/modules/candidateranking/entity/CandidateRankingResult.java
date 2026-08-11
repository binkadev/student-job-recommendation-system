package com.tttn.jobrecommendation.modules.candidateranking.entity;

import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;
import com.tttn.jobrecommendation.common.enums.RecommendationRankingTier;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(
        name = "candidate_ranking_results",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_candidate_ranking_results_run_application",
                        columnNames = {"run_id", "application_id"}
                ),
                @UniqueConstraint(
                        name = "uk_candidate_ranking_results_run_rank",
                        columnNames = {"run_id", "rank_position"}
                )
        }
)
public class CandidateRankingResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "run_id", nullable = false)
    private CandidateRankingRun run;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false)
    private JobApplication application;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cv_file_id", nullable = false)
    private CvFile cvFile;

    @Column(name = "score", nullable = false, precision = 8, scale = 5)
    private BigDecimal rankingScore;

    @Column(name = "overall_score", precision = 8, scale = 5)
    private BigDecimal overallScore;

    @Column(name = "text_score", precision = 8, scale = 5)
    private BigDecimal textScore;

    @Column(name = "skill_score", nullable = false, precision = 8, scale = 5)
    private BigDecimal skillScore;

    @Enumerated(EnumType.STRING)
    @Column(name = "ranking_tier", length = 20)
    private RecommendationRankingTier rankingTier;

    @Enumerated(EnumType.STRING)
    @Column(name = "scoring_strategy", nullable = false, length = 50)
    private RecommendationScoringStrategy scoringStrategy;

    @Builder.Default
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "matched_skills", nullable = false, columnDefinition = "jsonb")
    private List<String> matchedSkills = List.of();

    @Builder.Default
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "missing_skills", nullable = false, columnDefinition = "jsonb")
    private List<String> missingSkills = List.of();

    @Column(name = "reason", columnDefinition = "TEXT")
    private String reason;

    @Column(name = "rank_position", nullable = false)
    private Integer rankPosition;

    @Column(name = "tier_rank_position")
    private Integer tierRankPosition;

    @Column(name = "cv_processing_version", length = 100)
    private String cvProcessingVersion;

    @Column(name = "cv_analyzed_at_snapshot")
    private LocalDateTime cvAnalyzedAtSnapshot;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /**
     * Transitional V2 source compatibility. V3 code must use rankingScore.
     */
    @Deprecated(forRemoval = false)
    public BigDecimal getScore() {
        return rankingScore;
    }

    /**
     * Transitional V2 source compatibility. V3 code must use rankingScore.
     */
    @Deprecated(forRemoval = false)
    public void setScore(BigDecimal score) {
        this.rankingScore = score;
    }

    public static class CandidateRankingResultBuilder {

        /**
         * Transitional V2 builder compatibility. V3 code must use rankingScore.
         */
        @Deprecated(forRemoval = false)
        public CandidateRankingResultBuilder score(BigDecimal score) {
            return rankingScore(score);
        }
    }
}
