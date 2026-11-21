# Bootstrap Raw Corpus (`ai-service/data/bootstrap_raw/`)

This directory holds the raw English CSV dataset used by `offline/train_tfidf_incremental.py --bootstrap` to initialize `df_state.sqlite` and export the initial Global IDF `tfidf_model.pkl` artifact.

The checked-in seed rows cover all 89 canonical IT skills from `resources/skill_catalog.v1.json` and the core compound phrases from `resources/domain_phrases.en.json` so Docker builds, CI, and local tests work immediately out of the box.

## CSV Schemas

### 1. `resumes.csv`
- Encoding: **UTF-8** (`utf-8` or `utf-8-sig`)
- Required columns:
  - `id`: unique non-blank resume identifier (e.g., `cv-0001`)
  - `raw_text`: raw English resume text (automatically passed through the 3-stage English NLP pipeline: Regex Denoising → spaCy `EntityRuler` merging → NER & POS filtering)

### 2. `jobs.csv`
- Encoding: **UTF-8** (`utf-8` or `utf-8-sig`)
- Required columns:
  - `id`: unique non-blank job identifier (e.g., `job-0001`)
  - `title`: English job title
  - `description`: English job description
  - `requirements`: English job requirements *(optional/may be blank; any `SKILLS:` section inside text is stripped before TF-IDF indexing)*

## Rebuilding `tfidf_model.pkl` After Updating Your Dataset

After replacing or appending rows in `resumes.csv` and/or `jobs.csv`:

### Option A — Inside Docker Compose (Recommended)

```powershell
# Run bootstrap build into the shared ai_tfidf_models volume:
docker compose --profile trainer run --rm ai-trainer --bootstrap --force-rebuild

# Reload the stateless online ai-service to load the new tfidf_model.pkl into RAM:
docker compose restart ai-service
```

### Option B — Local Python Environment (from `ai-service/`)

```powershell
# 1. Compile the offline spaCy model (only needed if skill_catalog.v1.json or domain_phrases.en.json changed)
python -m offline.build_spacy_model --output-dir built_models/spacy_custom_model

# 2. Build df_state.sqlite and tfidf_model.pkl from data/bootstrap_raw/
python -m offline.train_tfidf_incremental --bootstrap --force-rebuild `
  --bootstrap-dir data/bootstrap_raw `
  --spacy-model-dir built_models/spacy_custom_model `
  --state-path models/tfidf/df_state.sqlite `
  --output-path models/tfidf/tfidf_model.pkl
```

### Incremental PostgreSQL Sync (After Bootstrap)

```powershell
# Sync ONLY newly inserted, modified, or deleted English CVs & active verified Jobs from PostgreSQL:
docker compose --profile trainer run --rm ai-trainer --keep-bootstrap
docker compose restart ai-service
```

Use `--drop-bootstrap` (or `--auto-drop-bootstrap-at 500`) once your live PostgreSQL database contains enough real English CVs and Jobs to replace the seed corpus.
