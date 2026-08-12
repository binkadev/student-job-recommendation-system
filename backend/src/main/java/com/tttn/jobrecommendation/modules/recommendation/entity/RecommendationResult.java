package com.tttn.jobrecommendation.modules.recommendation.entity;

import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;
import com.tttn.jobrecommendation.common.enums.RecommendationRankingTier;
import com.tttn.jobrecommendation.modules.job.entity.Job;
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
        name = "recommendation_results",
        uniqueConstraints = @UniqueConstraint(name = "uk_recommendation_results_run_job", columnNames = {"run_id", "job_id"})
)
public class RecommendationResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "run_id", nullable = false)
    private RecommendationRun run;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "job_id", nullable = false)
    private Job job;

    @Column(name = "score", nullable = false, precision = 8, scale = 5)
    private BigDecimal rankingScore;

    @Column(name = "overall_score", precision = 8, scale = 5)
    private BigDecimal overallScore;

    @Column(name = "text_score", precision = 8, scale = 5)
    private BigDecimal textScore;

    @Column(name = "skill_score", precision = 8, scale = 5)
    private BigDecimal skillScore;

    @Enumerated(EnumType.STRING)
    @Column(name = "ranking_tier", length = 20)
    private RecommendationRankingTier rankingTier;

    @Enumerated(EnumType.STRING)
    @Column(name = "scoring_strategy", length = 50)
    private RecommendationScoringStrategy scoringStrategy;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "matched_keywords", columnDefinition = "jsonb")
    private List<String> matchedKeywords;

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

    public static class RecommendationResultBuilder {

        /**
         * Transitional V2 builder compatibility. V3 code must use rankingScore.
         */
        @Deprecated(forRemoval = false)
        public RecommendationResultBuilder score(BigDecimal score) {
            return rankingScore(score);
        }
    }

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
