ALTER TABLE recommendation_results
    ADD COLUMN overall_score NUMERIC(8, 5),
    ADD COLUMN ranking_tier VARCHAR(20),
    ADD COLUMN tier_rank_position INTEGER;

ALTER TABLE candidate_ranking_results
    ADD COLUMN overall_score NUMERIC(8, 5),
    ADD COLUMN ranking_tier VARCHAR(20),
    ADD COLUMN tier_rank_position INTEGER;

-- Only rows with complete V2 strategy semantics are backfilled. Older or
-- incomplete historical rows deliberately remain without V3 tier semantics.
UPDATE recommendation_results
SET ranking_tier = 'PRIMARY',
    overall_score = score
WHERE scoring_strategy = 'SAME_LANGUAGE_HYBRID'
  AND text_score IS NOT NULL;

UPDATE recommendation_results
SET ranking_tier = 'FALLBACK',
    overall_score = NULL
WHERE scoring_strategy = 'CROSS_LANGUAGE_SKILL_BASED'
  AND text_score IS NULL;

UPDATE candidate_ranking_results
SET ranking_tier = 'PRIMARY',
    overall_score = score
WHERE scoring_strategy = 'SAME_LANGUAGE_HYBRID'
  AND text_score IS NOT NULL;

UPDATE candidate_ranking_results
SET ranking_tier = 'FALLBACK',
    overall_score = NULL
WHERE scoring_strategy = 'CROSS_LANGUAGE_SKILL_BASED'
  AND text_score IS NULL;

WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY run_id, ranking_tier
               ORDER BY score DESC, job_id ASC
           ) AS tier_rank_position
    FROM recommendation_results
    WHERE ranking_tier IS NOT NULL
)
UPDATE recommendation_results result
SET tier_rank_position = ranked.tier_rank_position
FROM ranked
WHERE result.id = ranked.id;

WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY run_id, ranking_tier
               ORDER BY score DESC, application_id ASC
           ) AS tier_rank_position
    FROM candidate_ranking_results
    WHERE ranking_tier IS NOT NULL
)
UPDATE candidate_ranking_results result
SET tier_rank_position = ranked.tier_rank_position
FROM ranked
WHERE result.id = ranked.id;

ALTER TABLE recommendation_results
    ADD CONSTRAINT chk_recommendation_results_ranking_tier
        CHECK (ranking_tier IS NULL OR ranking_tier IN ('PRIMARY', 'FALLBACK')),
    ADD CONSTRAINT chk_recommendation_results_overall_score
        CHECK (overall_score IS NULL OR overall_score BETWEEN 0 AND 1),
    ADD CONSTRAINT chk_recommendation_results_tier_rank_position
        CHECK (tier_rank_position IS NULL OR tier_rank_position > 0),
    ADD CONSTRAINT chk_recommendation_results_tier_semantics
        CHECK (
            ranking_tier IS NULL
            OR (
                ranking_tier = 'PRIMARY'
                AND scoring_strategy = 'SAME_LANGUAGE_HYBRID'
                AND text_score IS NOT NULL
                AND overall_score IS NOT NULL
                AND overall_score = score
            )
            OR (
                ranking_tier = 'FALLBACK'
                AND scoring_strategy = 'CROSS_LANGUAGE_SKILL_BASED'
                AND text_score IS NULL
                AND overall_score IS NULL
            )
        );

ALTER TABLE candidate_ranking_results
    ADD CONSTRAINT chk_candidate_ranking_results_ranking_tier
        CHECK (ranking_tier IS NULL OR ranking_tier IN ('PRIMARY', 'FALLBACK')),
    ADD CONSTRAINT chk_candidate_ranking_results_overall_score
        CHECK (overall_score IS NULL OR overall_score BETWEEN 0 AND 1),
    ADD CONSTRAINT chk_candidate_ranking_results_tier_rank_position
        CHECK (tier_rank_position IS NULL OR tier_rank_position > 0),
    ADD CONSTRAINT chk_candidate_ranking_results_tier_semantics
        CHECK (
            ranking_tier IS NULL
            OR (
                ranking_tier = 'PRIMARY'
                AND scoring_strategy = 'SAME_LANGUAGE_HYBRID'
                AND text_score IS NOT NULL
                AND overall_score IS NOT NULL
                AND overall_score = score
            )
            OR (
                ranking_tier = 'FALLBACK'
                AND scoring_strategy = 'CROSS_LANGUAGE_SKILL_BASED'
                AND text_score IS NULL
                AND overall_score IS NULL
            )
        );

CREATE UNIQUE INDEX uk_recommendation_results_run_tier_rank
    ON recommendation_results (run_id, ranking_tier, tier_rank_position)
    WHERE ranking_tier IS NOT NULL
      AND tier_rank_position IS NOT NULL;

CREATE UNIQUE INDEX uk_candidate_ranking_results_run_tier_rank
    ON candidate_ranking_results (run_id, ranking_tier, tier_rank_position)
    WHERE ranking_tier IS NOT NULL
      AND tier_rank_position IS NOT NULL;

ALTER TABLE candidate_ranking_runs
    ALTER COLUMN requested_limit DROP NOT NULL,
    ADD COLUMN requested_primary_limit INTEGER,
    ADD COLUMN requested_fallback_limit INTEGER,
    ADD CONSTRAINT chk_candidate_ranking_runs_requested_primary_limit
        CHECK (requested_primary_limit IS NULL OR requested_primary_limit BETWEEN 0 AND 100),
    ADD CONSTRAINT chk_candidate_ranking_runs_requested_fallback_limit
        CHECK (requested_fallback_limit IS NULL OR requested_fallback_limit BETWEEN 0 AND 100),
    ADD CONSTRAINT chk_candidate_ranking_runs_requested_limit_shape
        CHECK (
            (
                requested_limit IS NOT NULL
                AND requested_primary_limit IS NULL
                AND requested_fallback_limit IS NULL
            )
            OR (
                requested_limit IS NULL
                AND requested_primary_limit IS NOT NULL
                AND requested_fallback_limit IS NOT NULL
                AND requested_primary_limit + requested_fallback_limit BETWEEN 1 AND 100
            )
        );
