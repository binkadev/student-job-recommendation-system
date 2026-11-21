# English Job Recommendation AI Service

Stateless FastAPI microservice for English-only 3-stage spaCy CV parsing and Global-IDF TF-IDF job recommendation & candidate ranking.

## Architecture & Responsibilities

The AI Service owns:

- PDF and DOCX text extraction (including DOCX ZIP-bomb & encryption preflight)
- strict Pydantic input validation (`extra="forbid"`) and sanitized 2-field error envelopes
- deterministic English-only language gate (`en` with confidence `>= 0.65`; rejects non-English CVs with `422 UNSUPPORTED_LANGUAGE`)
- **3-stage English NLP pipeline** (`nlp/english_pipeline.py`):
  1. **Stage 1 — Regex Denoising (`nlp/denoiser.py`)**: repairs PDF/DOCX glued delimiters/CamelCase (`Java,SpringBoot`, `SoftwareEngineer`), strips structured PII (URLs, emails, phones), and shields technical symbols (`C++`, `C#`, `.NET`, `ASP.NET`, `Node.js`, `CI/CD`, `scikit-learn`) and brand casings (`JavaScript`, `PostgreSQL`, `FastAPI`, `PyTorch`).
  2. **Stage 2 — Offline-Compiled spaCy `EntityRuler` Merging (`offline/build_spacy_model.py`)**: merges all 89 canonical IT skills (`resources/skill_catalog.v1.json`, with exact case-sensitive rules for `C`, `R`, `Go`, `AI`, `ML`, `JS`, `TS`, `TF`, `REST`) and compound IT domain phrases (`resources/domain_phrases.en.json`) into atomic protected tokens (`SKILL` / `CUSTOM_PHRASE`).
  3. **Stage 3 — spaCy NER & POS Filtering**: drops `PERSON` and numeric/date noise entities, filters non-informative POS tags & stopwords, and preserves all merged `SKILL`/`CUSTOM_PHRASE` tokens verbatim.
- **Global-IDF TF-IDF Scoring via Incremental DF (`.transform()` only)**:
  - Online `ai-service` loads the compiled immutable spaCy model (`/app/built_models/spacy_custom_model`) and `tfidf_model.pkl` into RAM once at startup and executes **`.transform()` only** (never `.fit()`).
  - Offline Incremental DF trainer (`offline/train_tfidf_incremental.py`) updates `df_state.sqlite` (`N`, `term_df`, per-doc delta index for `INSERT`/`UPDATE`/`DELETE`) without re-scanning unchanged documents, computes exact smooth global IDF $\ln((1+N)/(1+\text{df}(t))) + 1$, hydrates a fitted scikit-learn `TfidfVectorizer`, and writes `tfidf_model.pkl` atomically.
- **Stateless by Packaging Design**: online `ai-service` (`Dockerfile` `target: runtime`) physically installs ZERO PostgreSQL drivers (`psycopg` exists only in `requirements-offline.lock` / `target: trainer`).

## HTTP Endpoints

- `GET /health` — Public liveness probe exposing service, contract, and loaded model metadata (`status`, `service`, `algorithm`, `recommendationVersion`, `candidateRankingVersion`, `processingVersion`, `nlpModelHash`, `tfidfModelVersion`, `tfidfModelSource`, `tfidfDocCount`, `tfidfVocabSize`).
- `POST /internal/cv/parse` — Multipart PDF/DOCX English CV parsing & skill extraction.
- `POST /internal/recommendations` — Tiered Student Job Recommendation scoring (`PRIMARY` / `FALLBACK`).
- `POST /internal/candidate-rankings` — Tiered Bulk Recruiter Candidate Ranking scoring (`PRIMARY` / `FALLBACK`).

Every `/internal/*` route requires `X-Internal-Api-Key` validated with constant-time `hmac.compare_digest`.

### Active Contract Metadata

- Algorithm: `tfidf-cosine-hybrid`
- Recommendation algorithm version: `english-global-idf-recommendation-v1`
- Candidate ranking algorithm version: `english-global-idf-candidate-ranking-v1`
- CV processing version: `english-spacy-v1-skills-v1`
- Skill catalog version: `skills-v1`

## Docker Multi-Stage Build & Offline Training

`ai-service/Dockerfile` provides two stages:
- **`runtime`** (default `ai-service` service): installs `requirements.lock` (`--require-hashes --only-binary=:all:`), compiles immutable `/app/built_models/spacy_custom_model` and bootstrap `/app/built_models/tfidf/tfidf_model.pkl`, mounts `ai_tfidf_models:/app/models/tfidf:ro` for updated trained models.
- **`trainer`** (`ai-trainer` under Compose `profiles: ["trainer"]`): extends `runtime` with `requirements-offline.lock` (`psycopg[binary]`) and mounts `ai_tfidf_models:/app/models/tfidf:rw`.

### Rebuilding Bootstrap `tfidf_model.pkl` from Raw CSVs

Replace or append English rows in `data/bootstrap_raw/resumes.csv` (`id,raw_text`) and `data/bootstrap_raw/jobs.csv` (`id,title,description,requirements`), then run:

```powershell
docker compose --profile trainer run --rm ai-trainer --bootstrap --force-rebuild
docker compose restart ai-service
```

### Incremental PostgreSQL Sync

```powershell
# Sync only newly inserted, modified, or deleted English READY CVs & ACTIVE VERIFIED Jobs:
docker compose --profile trainer run --rm ai-trainer --keep-bootstrap
docker compose restart ai-service

# Drop bootstrap seed rows once live PostgreSQL corpus is large enough:
docker compose --profile trainer run --rm ai-trainer --drop-bootstrap
# Or auto-drop automatically once live docs >= 500:
docker compose --profile trainer run --rm ai-trainer --auto-drop-bootstrap-at 500
```

## Configuration

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `AI_INTERNAL_API_KEY` | Yes | *(none)* | Minimum 32 chars, no edge whitespace. Must match Backend `APP_AI_SERVICE_INTERNAL_API_KEY`. |
| `AI_CV_MAX_FILE_SIZE_BYTES` | No | `10485760` | Max CV upload size in bytes |
| `AI_CANDIDATE_RANKING_MAX_CANDIDATES` | No | `500` | Max candidates per synchronous ranking request |
| `AI_CANDIDATE_RANKING_MAX_REQUEST_BYTES` | No | `8388608` | Max serialized candidate-ranking JSON body bytes |
| `AI_SPACY_MODEL_DIR` | No | `built_models/spacy_custom_model` | Immutable compiled spaCy model directory |
| `AI_TFIDF_MODEL_PATH` | No | `models/tfidf/tfidf_model.pkl` | Mutable trained Global IDF `.pkl` path |
| `AI_TFIDF_BOOTSTRAP_MODEL_PATH` | No | `built_models/tfidf/tfidf_model.pkl` | Cold-start fallback `.pkl` when mounted volume is empty |
| `AI_TRAINER_DATABASE_URL` | Trainer only | *(none)* | PostgreSQL DSN used strictly by `offline/train_tfidf_incremental.py` |

## Testing & Offline Evaluation

```powershell
# Run full AI test suite inside official Linux Python 3.11.9 runtime image:
docker run --rm -e AI_INTERNAL_API_KEY="test-internal-api-key-at-least-32-characters-ok" `
  -v "${PWD}\ai-service\tests:/app/tests:ro" `
  student-job-recommendation-ai:local python -m pytest -o cache_dir=/tmp/.pytest_cache -q

# Compare Local-Corpus TF-IDF vs. Global Incremental-DF TF-IDF (Precision@K, Recall@K, F1@K, NDCG@K):
python -m evaluation.compare_local_vs_global_idf `
  --dataset evaluation/examples/toy-v1 `
  --spacy-model-dir built_models/spacy_custom_model `
  --tfidf-model-path built_models/tfidf/tfidf_model.pkl --k 5
```
