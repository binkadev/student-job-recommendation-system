# Recommendation & Candidate Ranking V3 Contract

## 1. Purpose

This document is the implementation source of truth for the V3 migration of:

1. Student -> Job Recommendation
2. Company -> Candidate Ranking

The goal is to correct score semantics, reuse persisted CV analysis snapshots, and prevent cross-language skill-only results from being presented as overall match scores.

This contract does not replace CV parsing. The existing CV analysis pipeline and its processing version remain the source of persisted CV representations.

## 2. Locked invariants

- Algorithm name remains `tfidf-cosine-hybrid`.
- CV processing version remains `bilingual-nlp-v2-skills-v1` unless preprocessing itself changes in a separate migration.
- Same-language hybrid weight remains `0.65 * textScore + 0.35 * skillScore` when Job skills exist.
- Same-language with no declared canonical Job skills uses `overallScore = textScore`, `skillScore = 0`.
- `PRIMARY` means `SAME_LANGUAGE_HYBRID`.
- `FALLBACK` means `CROSS_LANGUAGE_SKILL_BASED`.
- V3 recommendation/ranking uses persisted CV `processedText`; it does not preprocess CV text again.
- V3 uses persisted CV `languageCode`, `languageConfidence`, `skills`, and `processingVersion`.
- Job language detection and Job preprocessing remain in the AI Service.
- Backend owns authentication/authorization, eligibility, validation, official ordering, rank assignment, persistence, and public responses.
- AI Service remains stateless and does not own official rank positions.
- Unknown request/response fields remain rejected at internal contract boundaries.
- V2 endpoints remain available during migration until V3 is verified.

## 3. Language-confidence rule

A pair is eligible for same-language text scoring only when:

```text
CV languageCode in {en, vi}
AND CV languageConfidence >= 0.65
AND Job languageCode in {en, vi}
AND Job languageConfidence >= 0.65
AND CV languageCode == Job languageCode
```

Otherwise the pair is evaluated with the FALLBACK skill-based strategy.

## 4. Score semantics

### 4.1 PRIMARY / SAME_LANGUAGE_HYBRID

With declared canonical Job skills:

```text
skillScore = matchedJobSkillCount / totalJobSkillCount
overallScore = 0.65 * textScore + 0.35 * skillScore
rankingScore = overallScore
rankingTier = PRIMARY
scoringStrategy = SAME_LANGUAGE_HYBRID
```

Without declared canonical Job skills:

```text
skillScore = 0
overallScore = textScore
rankingScore = textScore
rankingTier = PRIMARY
scoringStrategy = SAME_LANGUAGE_HYBRID
```

Required semantic constraints:

- `textScore != null`
- `overallScore != null`
- `rankingScore == overallScore`

### 4.2 FALLBACK / CROSS_LANGUAGE_SKILL_BASED

```text
skillScore = matchedJobSkillCount / totalJobSkillCount
textScore = null
overallScore = null
rankingScore = skillScore
rankingTier = FALLBACK
scoringStrategy = CROSS_LANGUAGE_SKILL_BASED
```

If the Job has no canonical skills, `skillScore = 0`.

No hidden score-eligibility rule is introduced. Threshold remains the score boundary:

```text
include result iff rankingScore >= threshold
```

Therefore a request with `threshold = 0` may intentionally retain zero-score results. Product defaults may use a higher threshold, but the scoring contract itself does not silently remove them.

### 4.3 Meaning of 100%

For FALLBACK, `skillScore = 1.0` means 100% coverage of the canonical Job skills declared to the system. It does not mean overall candidate/job fit is 100%.

Public UI must not label FALLBACK `rankingScore` as overall Match Score.

## 5. Shared CV snapshot input

V3 scoring must consume the persisted analysis snapshot:

```json
{
  "processedText": "java spring_boot rest_api postgresql ...",
  "skills": ["java", "postgresql", "rest api", "spring boot"],
  "languageCode": "vi",
  "languageConfidence": 0.9821,
  "processingVersion": "bilingual-nlp-v2-skills-v1"
}
```

V3 must not send raw/extracted CV text as scoring input.

V3 scoring payloads must not add separately supplied candidate PII such as name, email, phone, file path, file URL, cover letter, or unrelated Student profile data.

## 6. AI internal endpoints

Keep CV parsing on the existing V2 endpoint unless CV preprocessing itself changes:

```http
POST /internal/v2/cv/parse
```

Add:

```http
POST /internal/v3/recommendations
POST /internal/v3/candidate-rankings
```

Existing internal authentication, request tracing, timeout, capacity, sanitization, and no-body-logging rules remain in force.

## 7. Student -> Job Recommendation V3

### 7.1 Internal request

```json
{
  "requestId": "uuid",
  "cv": {
    "id": 55,
    "processedText": "...",
    "skills": ["java", "spring boot"],
    "languageCode": "vi",
    "languageConfidence": 0.9821,
    "processingVersion": "bilingual-nlp-v2-skills-v1"
  },
  "jobs": [
    {
      "id": 10,
      "text": "TITLE:\n...\nDESCRIPTION:\n...\nREQUIREMENTS:\n...\nSKILLS:\n...",
      "skills": ["java", "mysql", "spring boot"]
    }
  ],
  "threshold": 0.1,
  "limit": 20
}
```

Public Student generation request may remain:

```json
{
  "cvId": 55,
  "threshold": 0.1,
  "limit": 20
}
```

### 7.2 AI behavior

- Do not detect CV language from `processedText`.
- Do not call CV preprocessing again.
- Use persisted CV language metadata.
- Detect and preprocess each structured Job text as currently required.
- Same-language jobs use the existing Student recommendation TF-IDF/cosine direction.
- Cross-language or low-confidence jobs use skill-only scoring.

### 7.3 Student ordering and Top-K

Student recommendation keeps one global `limit`.

Order:

```text
PRIMARY: rankingScore DESC, jobId ASC
then
FALLBACK: rankingScore DESC, jobId ASC
then take request.limit
```

This explicitly avoids cross-tier numeric comparison while preserving one recommendation list.

### 7.4 Student AI response result

PRIMARY:

```json
{
  "jobId": 10,
  "rankingTier": "PRIMARY",
  "rankingScore": 0.8235,
  "overallScore": 0.8235,
  "textScore": 0.73,
  "skillScore": 1.0,
  "scoringStrategy": "SAME_LANGUAGE_HYBRID",
  "matchedSkills": ["java", "spring boot"],
  "missingSkills": ["docker"],
  "reason": "..."
}
```

FALLBACK:

```json
{
  "jobId": 11,
  "rankingTier": "FALLBACK",
  "rankingScore": 1.0,
  "overallScore": null,
  "textScore": null,
  "skillScore": 1.0,
  "scoringStrategy": "CROSS_LANGUAGE_SKILL_BASED",
  "matchedSkills": ["java", "mysql", "rest api", "spring boot"],
  "missingSkills": [],
  "reason": "..."
}
```

AI does not return official `rankPosition` or `tierRankPosition`.

## 8. Company -> Candidate Ranking V3

### 8.1 Candidate eligibility remains unchanged

Backend continues to:

- scope to the authenticated Company's owned Job;
- start from all Applications belonging to that Job;
- allow `PENDING` and `REVIEWED` Applications;
- exclude `ACCEPTED`, `REJECTED`, and `WITHDRAWN`;
- use the CV submitted by the Application;
- verify submitted CV ownership against the Application Student;
- require persisted `READY` CV analysis;
- never fall back to active CV, another CV, Student profile text, or manually maintained `student_skills`;
- avoid reparsing PDF/DOCX during ranking.

For V3 ranking readiness the submitted CV snapshot must contain:

- nonblank `processedText`;
- supported `languageCode` metadata;
- finite persisted `languageConfidence`;
- compatible `processingVersion`;
- persisted extracted/canonical skills, which may be empty.

`extractedText` is no longer a scoring dependency for V3 candidate ranking.

### 8.2 Company public create request

Target V3 public body:

```json
{
  "threshold": 0.1,
  "primaryLimit": 20,
  "fallbackLimit": 20
}
```

Validation:

```text
0 <= primaryLimit <= 100
0 <= fallbackLimit <= 100
1 <= primaryLimit + fallbackLimit <= 100
0 <= threshold <= 1
```

Unknown fields are rejected.

### 8.3 Company internal request

```json
{
  "requestId": "uuid",
  "job": {
    "id": 10,
    "text": "TITLE:\nBackend Intern\n...",
    "skills": ["docker", "java", "spring boot"]
  },
  "candidates": [
    {
      "applicationId": 300,
      "cvId": 55,
      "processedText": "...",
      "skills": ["java", "spring boot"],
      "languageCode": "vi",
      "languageConfidence": 0.9821,
      "processingVersion": "bilingual-nlp-v2-skills-v1"
    }
  ],
  "threshold": 0.1,
  "primaryLimit": 20,
  "fallbackLimit": 20
}
```

### 8.4 Company AI behavior

- Detect and preprocess the selected Job once.
- Do not detect candidate language from CV text.
- Do not preprocess Candidate `processedText` again.
- Partition Candidates into PRIMARY/FALLBACK using persisted Candidate language metadata versus detected Job language metadata.
- Preserve current candidate-ranking TF-IDF direction for PRIMARY:
  - fit one shared vectorizer on the complete same-language Candidate `processedText` corpus;
  - transform the selected processed Job once;
  - compute cosine similarity against all Candidate vectors.
- Never fit a vectorizer per Candidate.
- Never split one logical TF-IDF corpus into independently fitted batches and merge scores.

### 8.5 Company independent Top-K

PRIMARY:

```text
filter rankingScore >= threshold
sort rankingScore DESC, applicationId ASC
take primaryLimit
```

FALLBACK:

```text
filter rankingScore >= threshold
sort rankingScore DESC, applicationId ASC
take fallbackLimit
```

The AI response contains at most `primaryLimit + fallbackLimit <= 100` results.

AI does not assign official rank positions.

## 9. Backend validation

Backend must reject the whole AI response on semantic inconsistency.

### 9.1 Common validation

Validate:

- `requestId` matches;
- expected algorithm/version;
- identifiers belong to the request corpus;
- identifiers are unique;
- all numeric scores are finite and in `[0,1]`;
- score precision follows the existing public score scale;
- result count obeys limits;
- each `rankingScore >= threshold`;
- strategy and tier agree;
- matched/missing skill lists are canonical and bounded.

### 9.2 PRIMARY validation

Require:

```text
rankingTier = PRIMARY
scoringStrategy = SAME_LANGUAGE_HYBRID
textScore != null
overallScore != null
rankingScore == overallScore
```

Backend recomputes the expected hybrid formula from returned `textScore` and validated skill evidence.

If Job skills exist:

```text
expectedOverall = 0.65 * textScore + 0.35 * skillScore
```

If Job skills do not exist:

```text
skillScore = 0
expectedOverall = textScore
```

### 9.3 FALLBACK validation

Require:

```text
rankingTier = FALLBACK
scoringStrategy = CROSS_LANGUAGE_SKILL_BASED
textScore = null
overallScore = null
rankingScore == skillScore
```

### 9.4 Skill evidence validation

Backend recomputes:

```text
expectedMatched = CV canonical skills ∩ Job canonical skills
expectedMissing = Job canonical skills - CV canonical skills
expectedSkillScore = |expectedMatched| / |Job canonical skills|
```

If Job canonical skills are empty, expected skill score is zero.

Backend must not trust AI-provided skill evidence without verification.

## 10. Official ranking

### 10.1 Student

Backend validates results, reorders using:

```text
PRIMARY rankingScore DESC, jobId ASC
then
FALLBACK rankingScore DESC, jobId ASC
```

Then assigns:

- global `rankPosition`;
- per-tier `tierRankPosition`.

Student UI may use global result order but must use score semantics from `rankingTier`.

### 10.2 Company

Backend partitions validated results by tier.

PRIMARY:

```text
rankingScore DESC, applicationId ASC
```

FALLBACK:

```text
rankingScore DESC, applicationId ASC
```

Assign independent `tierRankPosition` within each tier.

Keep global `rankPosition` only as deterministic persistence/audit order:

```text
all PRIMARY results first, then all FALLBACK results
```

Recruiter UI must use `tierRankPosition` for human-facing ranking.

## 11. Persistence migration

Create the next Flyway migration after current master.

For `recommendation_results` add:

- `overall_score` nullable;
- `ranking_tier`;
- `tier_rank_position`.

For `candidate_ranking_results` add the same fields.

The existing physical `score` column remains and represents V3 `rankingScore`.

Java code may map:

```java
@Column(name = "score")
private BigDecimal rankingScore;
```

Historical backfill:

```text
SAME_LANGUAGE_HYBRID:
  ranking_tier = PRIMARY
  overall_score = score

CROSS_LANGUAGE_SKILL_BASED:
  ranking_tier = FALLBACK
  overall_score = NULL
```

Backfill `tier_rank_position` deterministically per `(run_id, ranking_tier)` using existing score descending plus deterministic id tie-break.

For `candidate_ranking_runs`:

- keep legacy `requested_limit` for V2 history;
- allow it to be nullable for new V3 runs if necessary;
- add nullable `requested_primary_limit`;
- add nullable `requested_fallback_limit`;
- do not pretend historical V2 runs used independent tier limits.

## 12. Candidate ranking fingerprint

V3 candidate ranking input fingerprint must bump encoding version from the current V1 encoding.

The Candidate part must fingerprint actual V3 scoring input, including:

- application id/status;
- CV id;
- processedText;
- canonical extracted skills;
- languageCode;
- languageConfidence;
- processingVersion;
- analyzedAt.

It must no longer fingerprint extractedText as the scoring representation.

## 13. Public Backend response target

Public endpoints may retain legacy `score` temporarily as a deprecated alias of `rankingScore` for compatibility.

New Frontend code must use typed fields:

```text
rankingTier
rankingScore
overallScore
textScore
skillScore
scoringStrategy
rankPosition
tierRankPosition
```

FALLBACK must always expose:

```text
overallScore = null
textScore = null
```

## 14. Algorithm versions

```text
algorithm = tfidf-cosine-hybrid
Student algorithmVersion = bilingual-recommendation-v3
Company algorithmVersion = bilingual-candidate-ranking-v3
CV processingVersion = bilingual-nlp-v2-skills-v1
```

## 15. Required regression cases

At minimum verify:

1. Student EN CV -> EN Job => PRIMARY.
2. Student VI CV -> VI Job => PRIMARY.
3. Student VI CV -> EN Job => FALLBACK.
4. Low-confidence CV or Job => FALLBACK.
5. FALLBACK 4/4 skills => skillScore=1, overallScore=null.
6. Job with no skills => FALLBACK skillScore=0; threshold alone decides eligibility.
7. `threshold=0` retains zero-score result when limits allow it.
8. PRIMARY bad formula => Backend rejects.
9. FALLBACK non-null overallScore => Backend rejects.
10. strategy/tier mismatch => Backend rejects.
11. processingVersion mismatch => request is rejected or CV requires reanalysis per implementation boundary.
12. Company mixed corpus => independent PRIMARY/FALLBACK Top-K.
13. Company total requested limits >100 => validation error.
14. Deterministic ties use jobId/applicationId ascending.
15. Empty eligible Company corpus => successful zero-result run without AI call.
16. Historical V2 data remains readable with correct backfilled semantics.
17. V3 request proves CV language detection/preprocessing is not invoked again.
18. Candidate ranking shared TF-IDF corpus is fitted once, not per Candidate.

## 16. Definition of Done

V3 is complete only when:

- Student and Company internal V3 endpoints exist and pass strict contract tests.
- V2 endpoints remain stable during migration.
- Student scoring input uses persisted processedText snapshot.
- Company Candidate scoring input uses submitted CV persisted processedText snapshot.
- CV language detection/preprocessing is not repeated in V3 scoring.
- Backend independently validates formula, strategy/tier, score ranges, threshold, and skill evidence.
- PRIMARY and FALLBACK are not treated as one comparable overall-score scale.
- Company exposes independent tier ranks and independent limits.
- Public Backend responses expose the new typed score semantics expected by FE.
- Historical V2 records remain readable with correct semantics.
- AI full tests, Backend full tests, and available real E2E verification pass.
- Documentation and demo wording no longer call FALLBACK skill coverage an overall Match Score.
