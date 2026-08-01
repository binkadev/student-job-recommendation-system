# Candidate Ranking Contract

## 1. Purpose and authority

This document defines the locked contract for recruiter-side candidate ranking.
It is the source of truth for the Backend and AI Service implementation of this
feature.

Candidate ranking means ranking the eligible Applications of one
company-owned Job. It is not a global candidate search, student discovery, or
cross-job ranking feature.

The existing Student-to-Job recommendation behavior and its V1/V2 contracts
must remain unchanged.

## 2. System boundary

- Frontend calls Backend only.
- Backend authenticates and authorizes the Company, owns eligibility rules,
  transaction boundaries, run state, validation, official ordering, rank
  assignment, persistence, and public responses.
- Backend calls the AI Service through an authenticated internal endpoint.
- AI Service remains stateless, has no database access, receives no user JWT,
  and returns no official rank.
- Ranking uses persisted CV analysis. It must not load or parse PDF/DOCX files
  during candidate ranking.
- A ranking score is decision support. It is not a hiring decision and must not
  be presented as one.

## 3. Candidate pool and eligibility

Backend must start from all Applications that belong to the selected Job. It
must not accept an Application list, Student list, Company id, or user id from
the public request.

An Application is eligible only when all of the following are true at ranking
time:

1. The selected Job belongs to the authenticated Company.
2. The Application belongs to that exact Job.
3. The Application status is `PENDING` or `REVIEWED`.
4. The Application has a submitted `cv_file_id`.
5. The submitted CV belongs to the same Student as the Application.
6. The submitted CV has persisted analysis status `READY`.
7. The submitted CV has non-blank `extractedText` and `processedText`.

The following rules also apply:

- `ACCEPTED`, `REJECTED`, and `WITHDRAWN` Applications are ineligible.
- The submitted CV is used even when it is no longer the Student's active CV.
- A closed Job may rank its existing eligible Applications.
- Job deadline and active-CV status do not change candidate eligibility.
- Candidate ranking must not fall back to the active CV, another CV, Student
  profile text, or manually maintained `student_skills`.
- A missing or ineligible submitted CV is not reparsed during ranking.
- An empty eligible corpus is a valid result: Backend creates a successful run
  with zero eligible Candidates and zero results and does not call AI.
  `totalApplicationsScanned` and all skip counters must still reflect the
  Applications that actually belonged to the selected Job.

Run preparation records these counters:

- `totalApplicationsScanned`: every Application belonging to the selected Job
  at preparation time.
- `eligibleCandidates`: Applications included in the AI corpus.
- `skippedNoCv`: Applications without a submitted CV.
- `skippedNotReady`: Applications whose submitted CV is not `READY` or whose
  required persisted analysis text is blank.
- `skippedTerminalStatus`: `ACCEPTED`, `REJECTED`, or `WITHDRAWN`
  Applications.

The counters must satisfy:

```text
totalApplicationsScanned =
eligibleCandidates
+ skippedNoCv
+ skippedNotReady
+ skippedTerminalStatus
```

A CV/Application Student ownership mismatch is a data-integrity failure and
fails the run. It is not counted as a normal skip.

## 4. Candidate volume and Top K

Candidate volume is not a business-rule limit. A ranking run represents all
eligible Applications belonging to the selected Job.

Backend must never silently truncate the eligible candidate corpus. AI must
not be called once per CV. The corpus must not be split into independently
fitted TF-IDF batches whose scores are later merged, because scores from those
separate vector spaces are not comparable.

Each synchronous execution performs one logical ranking run and, when the
eligible corpus is non-empty and within current operational safeguards, one
bulk AI request over the complete corpus. AI evaluates the complete corpus and
returns at most the requested Top K results. Backend persists and returns only
those Top K results.

`limit` controls the number of results, not the number of candidates evaluated.
Its public range is `1..100`, with a default of `20`.

### 4.1 Operational safeguards

Transport and infrastructure limits are deployment safeguards, not domain
rules, benchmark commitments, thesis claims, or production capacity promises.
They must be externally configurable and must not be embedded in candidate
eligibility logic.

Backend configuration:

- `APP_AI_CANDIDATE_RANKING_MAX_CANDIDATES_PER_REQUEST`
- `APP_AI_CANDIDATE_RANKING_MAX_REQUEST_BYTES`

AI Service configuration:

- `AI_CANDIDATE_RANKING_MAX_CANDIDATES`
- `AI_CANDIDATE_RANKING_MAX_REQUEST_BYTES`

Deployments must supply positive values appropriate to their resources and
keep Backend and AI safeguards compatible. Product documentation must not
describe any configured value as guaranteed capacity.

Backend must first resolve the complete eligible corpus. If the corpus or
serialized request exceeds a configured synchronous safeguard, Backend must:

1. persist the logical run and its complete eligible count as `PROCESSING`;
2. avoid calling AI;
3. mark the run `FAILED` in an independent transaction; and
4. return the sanitized `CANDIDATE_RANKING_CAPACITY_EXCEEDED` error.

If AI independently rejects the request with its sanitized capacity response,
Backend maps it to the same public capacity error and marks the run `FAILED`.
Neither service may return CV content, configured limits, payload details, or
infrastructure internals in the error.

A future large-corpus design may use an asynchronous queue/worker architecture
with one shared or fixed vector representation. It must not merge scores from
independently fitted TF-IDF batches.

## 5. Public Backend API

All endpoints require role `COMPANY` and operate only on Jobs owned by the
authenticated Company.

### 5.1 Create a ranking run

```http
POST /api/companies/me/jobs/{jobId}/candidate-ranking-runs
Authorization: Bearer <jwt>
Content-Type: application/json
```

Request:

```json
{
  "threshold": 0.1,
  "limit": 20
}
```

Validation:

- `threshold` defaults to `0.1` and must be within `[0,1]`.
- `limit` defaults to `20` and must be within `1..100`.
- Unknown fields are rejected, including `companyId`, `studentId`, `userId`,
  `applicationIds`, and `cvIds`.
- A foreign and an absent Job return the same `404 RESOURCE_NOT_FOUND`
  response.
- Only one `PROCESSING` run may exist for a Job. A concurrent create request
  returns `409 CANDIDATE_RANKING_ALREADY_PROCESSING`.

Generation is synchronous for this contract. A successful response contains
the completed run detail in the standard `ApiResponse<T>` envelope.

### 5.2 List Job ranking runs

```http
GET /api/companies/me/jobs/{jobId}/candidate-ranking-runs?page=1&size=20
Authorization: Bearer <jwt>
```

The endpoint returns
`ApiResponse<PageResponse<CandidateRankingRunResponse>>`. Page numbering and
size validation follow the repository's existing public pagination
conventions. Runs are returned newest first using
`createdAt DESC, id DESC`. The query is scoped through the authenticated
Company's ownership of the Job.

Run detail remains non-paginated because only Top K results are persisted and
`limit` is at most `100`.

### 5.3 Get one Job ranking run

```http
GET /api/companies/me/jobs/{jobId}/candidate-ranking-runs/{runId}
Authorization: Bearer <jwt>
```

The run must belong to the selected Job and that Job must belong to the current
Company. Foreign and absent run identifiers return the same
`404 CANDIDATE_RANKING_RUN_NOT_FOUND` response.

### 5.4 Public response shape

A completed run detail has this shape:

```json
{
  "id": 70,
  "jobId": 10,
  "jobTitle": "Backend Intern",
  "status": "SUCCESS",
  "algorithm": "tfidf-cosine-hybrid",
  "algorithmVersion": "bilingual-candidate-ranking-v2",
  "threshold": 0.1,
  "requestedLimit": 20,
  "totalApplicationsScanned": 48,
  "eligibleCandidates": 35,
  "skippedNoCv": 4,
  "skippedNotReady": 6,
  "skippedTerminalStatus": 3,
  "totalRanked": 2,
  "errorMessage": null,
  "startedAt": "2026-08-01T10:00:00",
  "finishedAt": "2026-08-01T10:00:01",
  "createdAt": "2026-08-01T10:00:00",
  "results": [
    {
      "id": 101,
      "applicationId": 300,
      "studentId": 25,
      "studentName": "Candidate Name",
      "studentEmail": "candidate@example.com",
      "cvFileId": 55,
      "cvFileName": "candidate-cv.pdf",
      "applicationStatus": "PENDING",
      "appliedAt": "2026-07-28T08:30:00",
      "score": 0.72000,
      "textScore": 0.65000,
      "skillScore": 0.85000,
      "scoringStrategy": "SAME_LANGUAGE_HYBRID",
      "matchedSkills": ["java", "spring boot"],
      "missingSkills": ["docker"],
      "reason": "Matched 2 of 3 declared job skills: java, spring boot. Missing: docker.",
      "rankPosition": 1,
      "createdAt": "2026-08-01T10:00:01"
    }
  ]
}
```

The response may expose candidate identity already available to the owning
Company through its Application APIs. It must not expose extracted or processed
CV text, file paths, file URLs, stored filenames, password data, analysis
errors, internal configuration, or `inputFingerprint`.

`inputFingerprint` is internal consistency and audit metadata. Frontend must
not depend on it.

User interfaces must label `score` as a match score and communicate that it is
decision support rather than a hiring decision.

## 6. Internal Backend-AI contract

### 6.1 Endpoint and authentication

```http
POST /internal/v2/candidate-rankings
X-Internal-Api-Key: <shared-secret>
X-Request-Id: <transport-request-id>
Content-Type: application/json
```

The transport `X-Request-Id` is tracing metadata. The JSON `requestId` is the
business correlation identifier and is validated independently.

### 6.2 Request

```json
{
  "requestId": "f8dd2777-3457-4515-8829-a63599e74775",
  "job": {
    "id": 10,
    "text": "TITLE:\nBackend Intern\n\nDESCRIPTION:\nBuild APIs.\n\nREQUIREMENTS:\nJava experience.\n\nSKILLS:\njava, spring boot, docker",
    "skills": ["docker", "java", "spring boot"]
  },
  "candidates": [
    {
      "applicationId": 300,
      "cvId": 55,
      "text": "Persisted extracted CV text",
      "skills": ["java", "spring boot"]
    }
  ],
  "threshold": 0.1,
  "limit": 20
}
```

Request rules:

- `requestId` is a UUID.
- Job, Application, and CV ids are strict positive integers.
- `candidates` contains every eligible Application and has unique
  `applicationId` values.
- The same `cvId` may appear only when it is genuinely the submitted CV of the
  corresponding Applications; Backend validates each Application/CV pair.
- Candidate `text` comes from that submitted CV's persisted `extractedText`.
- Candidate `skills` comes from that same CV's persisted `extractedSkills`.
- AI performs language detection and deterministic preprocessing from the
  extracted text, preserving the current bilingual scoring semantics.
- Each text field remains non-blank and bounded by the existing V2 per-document
  text limit. Aggregate request size is controlled only by the externally
  configured operational safeguard.
- Candidate arrays have no business-defined maximum in the wire schema.
- Skill strings are canonical, non-blank, bounded, unique after normalization,
  and deterministically sorted by Backend.
- Job text uses exactly `TITLE`, `DESCRIPTION`, `REQUIREMENTS`, and `SKILLS` in
  that order. It excludes benefits, salary, location, Company identity,
  timestamps, status, deadline, working model, and application counts.
- The request contains no JWT, Student id, name, email, phone, cover letter,
  filename, path, URL, stored filename, or other separately supplied PII.
- An empty candidate corpus is handled by Backend and is not sent to AI.

The CV's extracted text may inherently contain personal information needed for
text matching. Neither service may log request bodies or include them in error
messages. No additional personal fields may be sent.

### 6.3 Response

```json
{
  "requestId": "f8dd2777-3457-4515-8829-a63599e74775",
  "algorithm": "tfidf-cosine-hybrid",
  "algorithmVersion": "bilingual-candidate-ranking-v2",
  "results": [
    {
      "applicationId": 300,
      "cvId": 55,
      "score": 0.72,
      "textScore": 0.65,
      "skillScore": 0.85,
      "scoringStrategy": "SAME_LANGUAGE_HYBRID",
      "matchedSkills": ["java", "spring boot"],
      "missingSkills": ["docker"]
    }
  ]
}
```

AI response rules:

- `requestId` exactly matches the request.
- `algorithm` is `tfidf-cosine-hybrid`.
- `algorithmVersion` is `bilingual-candidate-ranking-v2`.
- Results contain unique eligible `applicationId` values.
- Each response `cvId` exactly matches the submitted CV mapped to that
  `applicationId` by Backend.
- Results contain at most the requested `limit` and every score is at least the
  requested threshold.
- Scores are finite and within `[0,1]`.
- `matchedSkills` and `missingSkills` are non-null, bounded canonical lists.
- AI does not return `rank`, `rankPosition`, `reason`, candidate identity, or
  any storage metadata.
- Unknown fields are rejected at every request and response object level.

## 7. Scoring and Top-K selection

AI retains the current bilingual V2 scoring semantics.

For a same-language CV/Job pair with declared Job skills:

```text
score = 0.65 * textScore + 0.35 * skillScore
```

For a same-language pair without declared Job skills:

```text
score = textScore
```

For a cross-language or insufficient-confidence pair:

```text
textScore = null
score = skillScore
```

The existing two strategies remain the only strategies:

- `SAME_LANGUAGE_HYBRID`
- `CROSS_LANGUAGE_SKILL_BASED`

When the Job has no declared canonical skills:

- Same-language:
  - `textScore` is cosine similarity;
  - `skillScore = 0`;
  - `score = textScore`;
  - `scoringStrategy = SAME_LANGUAGE_HYBRID`.
- Cross-language or insufficient-confidence:
  - `textScore = null`;
  - `skillScore = 0`;
  - `score = 0`;
  - `scoringStrategy = CROSS_LANGUAGE_SKILL_BASED`.

Threshold filtering still applies. No new scoring strategy is introduced.

For same-language candidate ranking, AI fits one shared TF-IDF
representation on the complete same-language candidate CV document corpus
only. It then transforms the selected Job once into that fitted vector space
and computes cosine similarity between the transformed Job and every
same-language candidate CV.

The selected Job is not included in the TF-IDF fit corpus. AI must not fit a
vectorizer independently per candidate or independently per batch.

Cross-language candidates are evaluated through canonical skill matching. AI
filters by threshold and selects Top K from the complete corpus using
`score DESC, applicationId ASC` so the Top-K boundary is deterministic.

This AI ordering selects the returned set but is not the official persisted
rank. Backend validates all results, sorts the accepted results again by
`score DESC, applicationId ASC`, assigns continuous `rankPosition` values from
one, and persists that ordering.

AI response score components are projected to scale `8` with `HALF_UP`
rounding. For same-language results with declared Job skills, Backend projects
`0.65 * returnedTextScore + 0.35 * returnedSkillScore` to that same scale and
accepts an absolute difference from the returned score of at most
`0.00000001`, the maximum one-unit double-rounding discrepancy. Non-weighted
branches require exact numeric score equality, and the expected canonical
skill-overlap score is projected to scale `8` with `HALF_UP` and compared
exactly. Backend compares the returned raw score against the threshold and
sorts by that raw score before projecting persistence-ready scores to database
scale `5` with `HALF_UP`. One invalid result invalidates the whole AI response;
no partial result is persisted.

## 8. Backend-generated explanations

AI returns scoring facts but no official explanation. Backend generates a
deterministic, bounded explanation from the validated scoring strategy and
validated matched/missing skill lists.

Templates:

- Same-language with declared skills:
  `Matched {matchedCount} of {jobSkillCount} declared job skills: {matchedList}. Missing: {missingList}.`
- Same-language without declared skills:
  `Match score is based on the submitted CV and Job text.`
- Cross-language with declared skills:
  `Cross-language match is based on canonical skill overlap. Matched {matchedCount} of {jobSkillCount}: {matchedList}. Missing: {missingList}.`
- Cross-language without declared skills:
  `Cross-language match is based on canonical skill overlap.`

Empty matched or missing lists use `none` in the corresponding placeholder.
Skill lists use normalized alphabetical order. Explanations must not infer
personality, protected characteristics, employability, or a hiring decision.

## 9. Run state and transaction boundaries

Allowed run transitions are:

```text
PROCESSING -> SUCCESS
PROCESSING -> FAILED
```

Only one `PROCESSING` run may exist for a Job. This invariant must be backed by
a partial database unique index, not only an application-level check.

Generation uses these phases:

1. **Preparation transaction**
   - Resolve the authenticated Company and owned Job.
   - Enforce the one-processing-run invariant.
   - Load Job skills and the complete eligible Application/CV corpus with
     bounded queries.
   - Build detached AI input values and a deterministic aggregate input
     fingerprint.
   - Generate and persist the business `requestId` before the AI call.
   - Save and flush a `PROCESSING` run with threshold, requested limit,
     `totalApplicationsScanned`, `eligibleCandidates`, all skip counters, and
     the fingerprint.
2. **No database transaction**
   - Apply configured capacity safeguards.
   - Make exactly one bulk AI call when the corpus is non-empty and within the
     safeguards.
3. **Pure validation**
   - Validate the complete AI response and build Backend ranks/explanations.
4. **Success transaction**
   - Reload the run and require `PROCESSING`.
   - Reload the Job and complete eligible corpus.
   - Recompute and compare the input fingerprint.
   - Save and flush all Top K result rows.
   - Mark the run `SUCCESS` and set `finishedAt`.
5. **Independent failure transaction**
   - On any transport, validation, capacity, input-change, or persistence
     failure, mark the still-processing run `FAILED` in `REQUIRES_NEW`.
   - Set `finishedAt` and store only a sanitized error.

External AI calls must never execute while a database transaction is open.
Success persistence is all-or-nothing.

## 10. Input consistency and traceability

An aggregate SHA-256 input fingerprint is computed from a canonical
representation of:

- Job id, title, description, requirements, and sorted canonical Job skills;
- all eligible Applications sorted by `applicationId`;
- each Application id, status, and submitted `cvId`; and
- each CV's extracted text, canonical extracted skills, analysis status,
  processing version, and `analyzedAt`.

Before success persistence, Backend reloads the complete corpus and recomputes
the fingerprint. The run fails without results if any ranking input changed,
including:

- Job text or skills;
- Application status;
- addition or removal of an eligible Application;
- submitted CV association;
- CV analysis state, content, processing version, or analysis timestamp.

The JSON `requestId` is the business correlation identifier. Backend persists
it before the AI call, validates that the AI response contains the same value,
and uses it for tracing together with the transport `X-Request-Id`. It does not
have to be exposed in the public Frontend response.

The fingerprint supports change detection and traceability without persisting
another copy of CV text. It does not make the mutable CV row an immutable
historical document snapshot.

For historical explanation, the run also records the selected Job's
`updatedAt` value at preparation time, and each persisted result records the
submitted CV's `processingVersion` and `analyzedAt` values. These snapshots do
not replace the aggregate fingerprint or immutable CV versioning.

## 11. Persistence contract

### 11.1 `candidate_ranking_runs`

Required columns:

- `id`
- `job_id`
- `request_id`
- `status`
- `algorithm`
- `algorithm_version`
- `threshold`
- `requested_limit`
- `total_applications_scanned`
- `eligible_candidates`
- `skipped_no_cv`
- `skipped_not_ready`
- `skipped_terminal_status`
- `input_fingerprint`
- `job_updated_at_snapshot`
- `started_at`
- `finished_at`
- `error_message`
- `created_at`
- `updated_at`

Required constraints and indexes:

- restrictive foreign key from `job_id` to `jobs.id`;
- `request_id UUID NOT NULL UNIQUE`;
- known run status;
- threshold within `[0,1]`;
- requested limit within `1..100`;
- nonnegative scanned, eligible, and skip counters;
- a check that scanned count equals eligible count plus all skip counters;
- unique partial index on `job_id` where status is `PROCESSING`; and
- query index on `(job_id, status, created_at DESC, id DESC)`.

### 11.2 `candidate_ranking_results`

Required columns:

- `id`
- `run_id`
- `application_id`
- `cv_file_id`
- `score`
- `text_score`
- `skill_score`
- `scoring_strategy`
- `matched_skills`
- `missing_skills`
- `reason`
- `rank_position`
- `cv_processing_version`
- `cv_analyzed_at_snapshot`
- `created_at`
- `updated_at`

Required constraints and indexes:

- restrictive foreign keys to the run, Application, and CV;
- unique `(run_id, application_id)`;
- unique `(run_id, rank_position)`;
- scores within `[0,1]`;
- positive rank;
- known scoring strategy and strategy-specific `text_score` nullability; and
- non-null JSON skill arrays.

Backend must additionally validate that each result Application belongs to the
run's Job and that `cv_file_id` is the CV submitted by that Application. Those
multi-table invariants are not delegated to AI.

Only Top K result rows are persisted. Historical runs retain algorithm
metadata, threshold, requested Top K, complete eligible count, fingerprint,
submitted CV references, component scores, strategy, skills, explanation, and
official Backend rank.

## 12. Authorization, privacy, and error handling

- Public endpoints require `COMPANY` role.
- Ownership is derived from the authenticated user and checked in the service.
- Foreign and absent Jobs/runs are intentionally indistinguishable.
- AI receives opaque `applicationId` and `cvId` correlation identifiers, not
  candidate identity fields.
- Backend never forwards the user JWT.
- Neither service logs CV/request/response bodies, credentials, or raw upstream
  error bodies.
- Persisted and public failure messages are sanitized.
- Public responses never expose internal capacity values or infrastructure
  details.

Candidate-ranking error codes:

- `CANDIDATE_RANKING_RUN_NOT_FOUND`: `404 Not Found`
- `CANDIDATE_RANKING_ALREADY_PROCESSING`: `409 Conflict`
- `CANDIDATE_RANKING_CAPACITY_EXCEEDED`: `503 Service Unavailable`
- `CANDIDATE_RANKING_GENERATION_FAILED`: `502 Bad Gateway`

Existing AI transport codes remain applicable:

- `AI_SERVICE_UNAVAILABLE`
- `AI_SERVICE_TIMEOUT`
- `AI_SERVICE_INVALID_RESPONSE`

AI capacity rejection uses sanitized HTTP `413`; Backend maps it to
`CANDIDATE_RANKING_CAPACITY_EXCEEDED` rather than exposing the internal body.

## 13. Required verification

Implementation must cover:

- every Application status and CV eligibility combination;
- accurate scanned, eligible, and skip counters, including empty eligible
  corpus with nonzero scanned Applications;
- use of the submitted READY CV when it is inactive;
- closed Jobs with existing Applications;
- empty-corpus success without an AI call;
- Company role, ownership, and foreign-resource hiding;
- request validation and unknown-field rejection;
- exactly one bulk AI request and no per-CV calls;
- full-corpus behavior without silent truncation or independently fitted
  batches;
- externally configured candidate-count and request-size safeguards;
- explicit capacity failure without an AI call after Backend preflight;
- sanitized AI capacity mapping;
- request privacy and absence of JWT/file/identity metadata;
- strict response identity, CV mapping, score, strategy, threshold, and result
  limit validation;
- deterministic Top-K boundary selection, Backend sorting, and continuous
  ranks;
- same-language TF-IDF fitted on the complete same-language candidate CV corpus
  only, with the selected Job transformed into that vector space;
- explicit no-declared-skill behavior for both scoring strategies;
- deterministic Backend explanations;
- committed `PROCESSING` state before AI I/O;
- no transaction during AI I/O;
- all-or-nothing success persistence and independent failure persistence;
- input-fingerprint failure when any corpus input changes;
- database uniqueness/check/foreign-key constraints, unique persisted
  request correlation, and counter consistency;
- bounded query count as reasonable test corpus size grows; and
- unchanged Student-to-Job recommendation and AI V1/V2 regression behavior.

The initial implementation does not require a benchmark tied to an exact
candidate count. Performance evidence must be described as observations for a
documented environment, not as a guaranteed capacity promise.

## 14. Non-goals

This contract does not implement or authorize:

- global candidate search;
- ranking Students who did not apply to the selected Job;
- reparsing CV files during ranking;
- replacing the submitted CV with an active or newer CV;
- asynchronous workers or queues in the initial synchronous implementation;
- embeddings, semantic search, or a new scoring formula;
- independently fitted TF-IDF batches;
- AI-owned official ranks or hiring decisions;
- Frontend-to-AI communication; or
- changes to the existing Student-to-Job recommendation contract.
