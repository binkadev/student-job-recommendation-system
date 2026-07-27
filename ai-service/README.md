# Bilingual Job Recommendation AI Service

Stateless FastAPI service for English/Vietnamese CV parsing and Content-Based job recommendation.

## Responsibilities

The AI Service owns:

- PDF and DOCX text extraction;
- strict input validation and sanitized errors;
- English and Vietnamese language detection;
- deterministic language-specific preprocessing;
- technical-token preservation such as `C++`, `C#`, `.NET`, `Node.js`, and `CI/CD`;
- canonical skill extraction and alias normalization;
- same-language TF-IDF and Cosine Similarity;
- cross-language canonical-skill matching;
- deterministic matched-skill, missing-skill, and explanation output.

The AI Service is stateless. It must not access PostgreSQL, receive user JWTs, persist recommendation runs, or assign public rank positions.

## Supported contracts

### Legacy compatibility V1

- `POST /internal/v1/cv/parse`
- `POST /internal/v1/recommendations`

V1 remains for older deployments and regression coverage. Names and metadata containing `tfidf-cosine-v1` are valid only in explicitly documented V1 code paths.

### Current V2

- `POST /internal/v2/cv/parse`
- `POST /internal/v2/recommendations`

Current metadata:

- Algorithm: `tfidf-cosine-hybrid`
- Algorithm version: `bilingual-recommendation-v2`
- Processing version: `bilingual-nlp-v2-skills-v1`

Production V2 orchestration uses `recommend_bilingual`. A deprecated `recommend_english` alias remains only for older internal test/extension compatibility and must not be used by new production code.

## Language and scoring behavior

| Pair | Strategy | Behavior |
|---|---|---|
| English CV ↔ English Job | `SAME_LANGUAGE_HYBRID` | English TF-IDF plus canonical skills |
| Vietnamese CV ↔ Vietnamese Job | `SAME_LANGUAGE_HYBRID` | Vietnamese TF-IDF plus canonical skills |
| English CV ↔ Vietnamese Job | `CROSS_LANGUAGE_SKILL_BASED` | Canonical skills only |
| Vietnamese CV ↔ English Job | `CROSS_LANGUAGE_SKILL_BASED` | Canonical skills only |
| Mixed or insufficient-confidence pair | `CROSS_LANGUAGE_SKILL_BASED` | Canonical skills only |

```text
same language + declared skills:
score = 0.65 * textScore + 0.35 * skillScore

same language + no declared skills:
score = textScore
skillScore = 0

cross language / insufficient confidence:
textScore = null
score = skillScore
```

Skill score is the fraction of the Job's canonical skills present in the CV's canonical skill set.

## Ranking ownership

AI returns:

- `jobId`
- `score`
- `textScore`
- `skillScore`
- `scoringStrategy`
- `matchedSkills`
- `missingSkills`
- `reason`

AI never returns `rank` or `rankPosition`. The Spring Boot backend validates the response, sorts by `score DESC` then `jobId ASC`, assigns continuous `rankPosition`, and persists the result set.

## Requirements and setup

- Python 3.11
- dependencies locked with hashes in `requirements.lock`

Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install --require-hashes -r requirements.lock
python -m pip check
```

Linux/macOS:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install --require-hashes -r requirements.lock
python -m pip check
```

## Run

Local-only binding:

```powershell
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Development reload:

```powershell
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Do not bind the internal AI service to a public interface without private networking and service authentication.

## Health metadata

Current bilingual metadata:

```text
GET http://localhost:8000/health/v2
```

Example:

```json
{
  "status": "ok",
  "service": "job-recommendation-ai",
  "version": "bilingual-recommendation-v2",
  "supportedContracts": ["v1", "v2"],
  "currentContract": "v2",
  "legacyV1Version": "tfidf-cosine-v1",
  "recommendationVersion": "bilingual-recommendation-v2",
  "processingVersion": "bilingual-nlp-v2-skills-v1"
}
```

`GET /health` is retained as a legacy-compatible liveness response. New deployment checks should use `/health/v2`.

OpenAPI for local development:

```text
http://localhost:8000/docs
```

## Configuration

Maximum V2 CV upload size:

```powershell
$env:AI_CV_MAX_FILE_SIZE_BYTES="10485760"
```

Default: 10 MiB.

## V2 CV parse response

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

Supported language codes: `en`, `vi`, `mixed`, `unknown`.

## Tests and CI

```powershell
python -m pip install --require-hashes -r requirements.lock
python -m pip check
python -m pytest
```

GitHub Actions workflow `.github/workflows/ai-ci.yml` runs the same locked dependency installation, `pip check`, and complete pytest suite for AI changes.

The tests cover strict V2 schemas, extraction, bilingual preprocessing, canonical aliases, same-language hybrid scoring, cross-language skill scoring, deterministic ordering/explanations, V1 compatibility, and sanitized HTTP errors.

## Important files

- `main.py`: FastAPI application, V1 compatibility routes, health metadata, and V2 router registration
- `v2/api.py`: strict V2 HTTP boundary
- `v2/schemas.py`: V2 wire contract
- `v2/cv_service.py`: CV parsing orchestration
- `v2/language_detector.py`: deterministic language detection
- `v2/preprocessor.py`: English and Vietnamese preprocessing
- `v2/skill_canonicalizer.py`: canonical skill catalog
- `v2/skill_extractor.py`: skill extraction
- `v2/recommender.py`: TF-IDF, Cosine Similarity, and component scoring
- `v2/service.py`: per-Job bilingual recommendation orchestration
- `resources/skill_catalog.v1.json`: canonical skills and aliases

## Current limitations

- No OCR for scanned/image-only CVs
- No embeddings or semantic vector model
- No vector database
- No online model training
- No asynchronous queue
- No production service-to-service authentication
- No database access by design
- Skill importance and minimum proficiency are not part of V2 scoring
