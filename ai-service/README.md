# Bilingual Job Recommendation AI Service

Stateless FastAPI service for CV parsing and Content-Based job recommendation in English and Vietnamese.

## Responsibilities

The AI Service owns:

- PDF and DOCX text extraction
- strict input validation and sanitized errors
- English and Vietnamese language detection
- deterministic language-specific preprocessing
- technical-token preservation such as `C++`, `C#`, `.NET`, `Node.js`, and `CI/CD`
- canonical skill extraction and alias normalization
- same-language TF-IDF and Cosine Similarity
- cross-language skill-only matching
- deterministic matched-skill, missing-skill, and explanation output

The AI Service is stateless. It must not:

- access the Spring Boot database
- receive or validate a user JWT
- persist recommendation runs
- assign public rank positions

## Supported Contracts

### Compatibility V1

- `POST /internal/v1/cv/parse`
- `POST /internal/v1/recommendations`

V1 remains for regression compatibility.

### Current V2

- `POST /internal/v2/cv/parse`
- `POST /internal/v2/recommendations`

V2 uses strict Pydantic models with unknown fields rejected. Every
`/internal/v2/**` request must provide `X-Internal-Api-Key`; missing, blank, or
incorrect keys receive the sanitized `401 UNAUTHORIZED` V2 error. `/health` and
the compatibility V1 routes do not require this internal header.

Current metadata:

- Algorithm: `tfidf-cosine-hybrid`
- Algorithm version: `bilingual-recommendation-v2`
- Processing version: `bilingual-nlp-v2-skills-v1`

## Language and Scoring Behavior

The service detects the CV language and each Job language independently.

| Pair | Strategy | Behavior |
|---|---|---|
| English CV ↔ English Job | `SAME_LANGUAGE_HYBRID` | English TF-IDF plus canonical skills |
| Vietnamese CV ↔ Vietnamese Job | `SAME_LANGUAGE_HYBRID` | Vietnamese TF-IDF plus canonical skills |
| English CV ↔ Vietnamese Job | `CROSS_LANGUAGE_SKILL_BASED` | Canonical skills only |
| Vietnamese CV ↔ English Job | `CROSS_LANGUAGE_SKILL_BASED` | Canonical skills only |
| Mixed or insufficient-confidence pair | `CROSS_LANGUAGE_SKILL_BASED` | Canonical skills only |

For a same-language job with declared skills:

```text
score = 0.65 * textScore + 0.35 * skillScore
```

For a same-language job without declared skills:

```text
score = textScore
skillScore = 0
```

For a cross-language or insufficient-confidence pair:

```text
textScore = null
score = skillScore
```

Skill score is the fraction of the Job's canonical skills present in the CV's canonical skill set.

## Ranking Ownership

AI returns results containing:

- `jobId`
- `score`
- `textScore`
- `skillScore`
- `scoringStrategy`
- `matchedSkills`
- `missingSkills`
- `reason`

AI does not return:

- `rank`
- `rankPosition`

The Spring Boot backend validates the AI response, sorts by `score DESC` then `jobId ASC`, assigns continuous ranks, and persists the final result set.

## Requirements

- Python 3.11

Dependencies are locked with hashes in `requirements.lock`.

## Setup

Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install --require-hashes -r requirements.lock
python -m pip check
```

Linux or macOS:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install --require-hashes -r requirements.lock
python -m pip check
```

## Run

From `ai-service/`:

```powershell
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Development reload:

```powershell
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Health:

```text
GET http://localhost:8000/health
```

OpenAPI:

```text
http://localhost:8000/docs
```

## Configuration

Set the internal shared key before starting the service:

```powershell
$env:AI_INTERNAL_API_KEY="<at-least-32-characters-with-no-edge-whitespace>"
```

`AI_INTERNAL_API_KEY` is required, must contain at least 32 characters, and must
not have leading or trailing whitespace. Runtime construction fails before the
skill catalog is loaded when this configuration is invalid. The Backend must use
the same value through `APP_AI_SERVICE_INTERNAL_API_KEY`. Never commit or log the
real value.

Maximum V2 CV upload size:

```powershell
$env:AI_CV_MAX_FILE_SIZE_BYTES="10485760"
```

The default is 10 MiB.

## Request Tracing and Safe Logging

Middleware applies to `/health`, `/internal/v1/**`, and `/internal/v2/**`. It
accepts a valid `X-Request-Id` or generates a UUID, stores it in a standard
library `ContextVar`, and returns it in the response. A V2 `401` response also
contains the request ID.

Completion logs contain only `requestId`, method, path, status, and duration.
They do not log bodies, multipart bytes, raw or processed CV text, Job text,
authorization headers, internal API keys, environment secrets, or input-bearing
exception details. Request context is reset after every request.

`X-Request-Id` is observability metadata, not authentication. It is independent
of the Contract V2 JSON field `requestId`. See
[`../docs/operations/request-tracing.md`](../docs/operations/request-tracing.md).

## V2 CV Parse Response

A successful V2 parse returns:

```json
{
  "rawText": "...",
  "processedText": "...",
  "skills": ["java", "postgresql", "spring boot"],
  "languageCode": "en",
  "languageConfidence": 1.0,
  "processingVersion": "bilingual-nlp-v2-skills-v1",
  "warnings": []
}
```

Supported language codes:

- `en`
- `vi`
- `mixed`
- `unknown`

## Test

Run the complete AI test suite:

```powershell
python -m pytest
```

Run a focused V2 suite:

```powershell
python -m pytest tests/test_v2_contract.py tests/test_v2_cv_service.py tests/test_bilingual_recommendation.py tests/test_v2_http_api.py
```

The tests cover:

- strict V2 schemas
- PDF and DOCX decoding
- English and Vietnamese preprocessing
- canonical skill aliases
- same-language hybrid scoring
- cross-language skill scoring
- corpus isolation
- deterministic ordering and explanations
- V1 compatibility
- sanitized HTTP errors

## Offline Ranking Evaluation

The offline evaluation framework, independent annotation workflow, dataset
templates, toy example, metric implementation, privacy rules, and pilot
procedure are documented in [`evaluation/README.md`](evaluation/README.md).
Framework availability does not mean ranking quality has been measured. The
real Job corpus still needs review/freeze, independent annotation by 2–3 people,
manual adjudication, and final Precision@5, Recall@5, and NDCG@5. Generated
output, private CV data, and in-progress annotation work are ignored and must
not be committed.

## Important Files

- `main.py`: FastAPI application, V1 compatibility routes, and V2 router registration
- `request_context.py`: request ID validation, context isolation, and completion logging
- `v2/api.py`: strict V2 HTTP boundary
- `v2/schemas.py`: V2 wire contract
- `v2/cv_service.py`: CV parsing orchestration
- `v2/language_detector.py`: deterministic language detection
- `v2/preprocessor.py`: English and Vietnamese preprocessing
- `v2/skill_canonicalizer.py`: canonical skill catalog loading
- `v2/skill_extractor.py`: skill extraction
- `v2/recommender.py`: TF-IDF, Cosine Similarity, and component scoring
- `v2/service.py`: per-Job bilingual recommendation orchestration
- `resources/skill_catalog.v1.json`: canonical skills and aliases

## Current Limitations

- No OCR for scanned or image-only CVs
- No embeddings or semantic vector model
- No vector database
- No online model training
- No database access by design
- No asynchronous queue by design
- Skill importance and minimum proficiency are not yet part of the V2 scoring contract
