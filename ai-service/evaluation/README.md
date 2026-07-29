# Offline Recommendation Evaluation

This package evaluates recommendation rankings against a complete dataset of human-assigned relevance judgments. It is offline tooling only: it does not change the production algorithm, API contract, scoring weights, or Backend ranking ownership.

> **TOY DATASET KHÔNG PHẢI BẰNG CHỨNG CHẤT LƯỢNG VÀ KHÔNG ĐƯỢC DÙNG TRONG BÁO CÁO NHƯ KẾT QUẢ THỰC NGHIỆM.**

The checked-in `examples/toy-v1/` data is synthetic and exists only to demonstrate that the framework works. Its judgments were written manually for framework verification; they are not user-study results and must not be presented as evidence of recommendation quality.

## Dataset contract

Each dataset directory contains exactly the three inputs used by the runner:

- `cvs.json`: an array of anonymized CV objects with positive integer `id`, non-blank raw `text`, and a `skills` string array.
- `jobs.json`: an array of Job objects with positive integer `id`, non-blank raw `text`, and a `skills` string array.
- `judgments.csv`: the final adjudicated ground truth with header `cv_id,job_id,relevance`.

Relevance labels are:

- `0`: not relevant
- `1`: relevant
- `2`: highly relevant

Every CV–Job pair must have exactly one judgment, and every CV must have at least one Job whose relevance is greater than zero. A dataset may contain at most 100 Jobs because the runner sends all Jobs in one real Contract V2 request.

`templates/annotations.template.csv` is a worksheet for independent human annotation. It is not an input to the runner. The runner never derives ground truth from titles, skills, production scores, explanations, or any other algorithm output.

Validation fails clearly for missing files, malformed JSON or CSV schemas, invalid or duplicate IDs, unknown references, duplicate or missing CV–Job judgments, invalid relevance, empty datasets, blank text or skills, CVs without a relevant Job, and corpora exceeding 100 Jobs.

## Production scoring and ranking variants

For each CV, the runner:

1. Builds a real `v2.schemas.RecommendationRequest`.
2. Includes every Job, with `threshold=0` and `limit` equal to the Job count.
3. Derives a deterministic UUID5 request ID from the CV ID.
4. Loads the current production skill catalog.
5. Calls `v2.service.recommend_bilingual` directly.

The runner does not copy or reimplement production scoring. From each production result it creates:

- `production_hybrid` from `score`
- `text_only` from `textScore`
- `skill_only` from `skillScore`

For `text_only`, a null `textScore` on cross-language or insufficient-confidence pairs is evaluated as `0`. Every variant is sorted by score descending and then `jobId` ascending. `reason` and `matchedSkills` never affect ranking.

## Metrics

The default cutoff is `k=5`.

- Precision@k and Recall@k treat relevance `1` and `2` as relevant.
- DCG@k and NDCG@k use graded gain `2^relevance - 1` and discount `log2(rank + 1)`.
- Precision uses the number of available ranked Jobs when fewer than `k` Jobs exist.
- Precision, Recall, and NDCG are bounded to `[0, 1]`.
- Reported summary metrics are macro averages across CVs and are rounded to six decimal places.

DCG is the unnormalized intermediate and can exceed `1`; NDCG is the normalized reported metric.

## Run

From `ai-service/`, Linux/macOS:

```bash
python -m evaluation.runner \
  --dataset evaluation/examples/toy-v1 \
  --k 5 \
  --output-dir evaluation/output/toy-v1
```

Windows PowerShell, one line:

```powershell
python -m evaluation.runner --dataset evaluation/examples/toy-v1 --k 5 --output-dir evaluation/output/toy-v1
```

The ignored output directory contains:

- `summary.json`: dataset counts, production metadata, scoring description, and macro metrics for all three variants.
- `per_cv.csv`: per-CV metrics and relevant Job counts.
- `rankings.csv`: every ranked Job, component score, and human relevance label.

Files are deterministic UTF-8 without BOM. They have stable score and metric formatting and contain no runtime timestamp.

## Real pilot workflow

1. Prepare 10 anonymized CVs with all direct personal identifiers removed.
2. Prepare 30–50 representative Jobs.
3. Recruit two or three reviewers to assess pairs independently.
4. Assign every CV–Job pair a relevance of `0`, `1`, or `2`.
5. Do not show reviewers any algorithm score, rank, explanation, or matched-skill output.
6. Resolve disagreements through adjudication and create the final complete `judgments.csv`.
7. Run the evaluation runner against that frozen dataset.
8. Report Precision@5, Recall@5, and NDCG@5.
9. Compare `production_hybrid`, `text_only`, and `skill_only`.
10. State limitations, especially sample size, Job selection, reviewer subjectivity, and annotator bias.

Automated tests only establish framework behavior and scoring-pipeline correctness. Only a dataset labeled and adjudicated by humans can provide evidence about ranking quality.
