# Student V3 frozen prediction evaluation

**TOOLING COMPLETE != HUMAN-LABELED EVALUATION COMPLETE.** This workflow evaluates current Student Recommendation V3 from saved predictions and external labels. It adds no scoring implementation, dependency, API, database migration or rank ownership change. No verified real human evaluation dataset or final thesis quality results are supplied.

## Prediction input

Save complete responses from the existing authenticated Student endpoint `GET /api/students/me/recommendation-runs/{runId}` during a controlled experiment. Put them into a JSON array with exactly one chosen SUCCESS run per labeled CV. Each element may be a successful `ApiResponse` envelope or its `data` run-detail object. Generation responses have the same data shape. No new endpoint is needed. Latest-results-only arrays lack required run metadata and are rejected.

Required fields use actual public names:

| Run | Result |
|---|---|
| `id` (run identity), `cvId`, `sourceType=CV`, `status=SUCCESS` | `jobId`, `rankingTier`, `rankingScore` |
| `algorithm=tfidf-cosine-hybrid`, `algorithmVersion=bilingual-recommendation-v3` | `overallScore`, `textScore`, `skillScore`, `scoringStrategy` |
| `totalJobsScanned`, `totalRecommended`, `results` | `rankPosition`, `tierRankPosition` by default |
| Existing `startedAt`, `finishedAt`, `createdAt` retained when present | Optional deprecated `score` must agree with `rankingScore` |

PRIMARY requires SAME_LANGUAGE_HYBRID, non-null text/overall and rankingScore=overallScore. FALLBACK requires CROSS_LANGUAGE_SKILL_BASED, null text/overall and rankingScore=skillScore. Scores must be finite numeric values in [0,1]. The adapter checks evidence shape/nullability/equalities; it does not revalidate skill coverage, cosine, language routing or the hybrid formula against historical scoring inputs. Official Backend validation remains authoritative.

Predictions may contain fewer Jobs than the labeled corpus, including zero. Returned count must match `totalRecommended`, be <=100 and <=`totalJobsScanned`. Each run's scanned count must match the frozen labeled Job count; this count check **cannot establish historical corpus membership**. Use a shared frozen eligible corpus across evaluated CVs and record membership at experiment time. The V3 loader permits more than 100 labeled Jobs; it never sends them to AI or splits TF-IDF corpora.

Use the same positive CV/Job IDs in predictions and labels, or consistently apply a private frozen ID mapping before evaluation. Every labeled CV must have exactly one chosen run. Account for failed queries separately in the experiment protocol; do not silently omit difficult or empty queries to improve means. Duplicate runs/CVs/Jobs, missing/unknown judgments, mixed/invalid ranks, inconsistent tiers/scores/counts, malformed JSON, duplicate JSON keys and non-finite scores fail before artifacts are created.

`examples/toy-v1/student-v3.predictions.synthetic.json` is **hand-authored SYNTHETIC/FIXTURE evidence**. Its IDs, timestamps, scores and ranks are simulated to test the adapter, not captured Backend/AI outputs or measured model quality. It contains shuffled rows and a higher-scored FALLBACK. Do not infer actual Top-K membership or cosine values from this fixture.

## External ground truth

Retain the existing dataset files:

- `cvs.json`: array of positive `id`, nonblank anonymized raw `text`, `skills` string array.
- `jobs.json`: same shape for the frozen eligible Job corpus.
- `judgments.csv`: exact header `cv_id,job_id,relevance`; exactly one label for every CV×Job pair.

Keep the existing graded rubric: **0=not relevant, 1=relevant, 2=highly relevant**. Invalid labels, unknown IDs, duplicates and incomplete judgments are rejected; unjudged predictions are never silently treated as irrelevant. Never infer labels from predictions, application status, skills, scores, ranks or explanations. Text supports annotation only; V3 evaluation never preprocesses or scores it.

`--relevance-threshold` defaults to **1**, consistent with this rubric; **2** evaluates only highly relevant labels. Binary relevance is `label >= threshold`. This threshold is separate from Recommendation's score eligibility threshold. The V3 loader permits all-zero CVs. The legacy V2 runner/annotation finalizer retain their >=1 positive label and <=100 Job restrictions; all-zero/large studies can supply independently adjudicated complete external CSV labels directly to V3 evaluation. Do not invent a relevant label to bypass legacy restrictions.

Real evaluation requires authorized anonymized CVs, independent blinded human reviews and adjudication. See the [annotation workflow](README.md#independent-annotation-workflow). Reviewers must not see predictions or metric outputs. **SYNTHETIC/FIXTURE** tests prove tooling correctness only; they cannot support real recommendation-quality claims.

## Official V3 ordering and K

For official DATN evaluation, prefer persisted/public `rankPosition` evidence, requiring unique contiguous global ranks 1..N. Validate PRIMARY before FALLBACK, nonincreasing rankingScore within each tier and continuous tier-local ranks. `tierRankPosition` never defines global output order.

Backend ranks before rounding scores to five decimals for persistence. Preserve official ranks even when rounded scores tie and Job IDs descend. Re-sorting persisted ties would change official predictions.

Exact unranked evidence can opt in with `--allow-unranked`: PRIMARY first, then FALLBACK, rankingScore DESC/jobId ASC within each tier. This is flagged `reconstructed_v3_order` and creates no official ranks. Never use this option for rounded public history or as a substitute for Backend validation/ranking. It does not verify omitted Top-K members.

Apply evaluation K **after** ordering. Consider at most the first K predictions, or all available predictions when fewer exist. Do not fabricate missing predictions, re-filter by score or rerun scoring to fill lists. K is separate from the original request's global result limit and score threshold. Do not globally compare PRIMARY and FALLBACK scores as calibrated overall similarity.

## Metrics and aggregation

For each CV at K:

- Precision@K = relevant retrieved Jobs / available retrieved Jobs considered in top K; zero for an empty list.
- Recall@K = relevant retrieved Jobs / **all** relevant ground-truth Jobs for that CV, including relevant Jobs absent from predictions; zero when no labels meet the binary threshold.
- F1@K = 2 * Precision@K * Recall@K / (Precision@K + Recall@K); zero when both are zero.
- NDCG@K uses graded gain `2^label - 1`, discount `log2(rank+1)` and ideal DCG from all labels at K. It is independent of the binary threshold; zero when ideal graded DCG is zero. A CV with only label=1 can have zero binary Recall/F1 at threshold=2 and positive graded NDCG.

When a CV has zero binary-relevant ground-truth Jobs at the selected threshold, the convention is **Precision@K=0, Recall@K=0, F1@K=0**, even when predictions exist. With complete judgments, no prediction can be a binary hit in that case. These CVs remain in the macro averages with their zero values; they are not excluded. This convention does not force graded NDCG to zero when positive graded labels remain below the binary threshold.

Output includes per-CV metrics and **unweighted macro means across every CV**, including empty predictions and zero-relevant CVs. Macro F1 is mean per-CV F1, not the harmonic mean of macro Precision/Recall. Summary/CSV metrics round to six decimals after computation. DCG is an unnormalized intermediate; NDCG, Precision, Recall and F1 are bounded [0,1].

Scores and metrics have distinct meanings. FALLBACK rankingScore is canonical skill coverage, not calibrated overall similarity. rankingScore is never accuracy, precision, recall, F1 or model confidence.

## Run

From repository root, PowerShell (synthetic demonstration only):

```powershell
cd ai-service
.\.venv\Scripts\python.exe -m evaluation.prediction_runner --dataset evaluation/examples/toy-v1 --predictions evaluation/examples/toy-v1/student-v3.predictions.synthetic.json --ground-truth-kind SYNTHETIC --k 5 --relevance-threshold 1 --dataset-version toy-v1 --label-version synthetic-v1 --output-dir evaluation/output/toy-v3
```

In an already verified Python 3.11 environment on Linux/macOS, `cd ai-service`, then:

```bash
python -m evaluation.prediction_runner --dataset evaluation/examples/toy-v1 --predictions evaluation/examples/toy-v1/student-v3.predictions.synthetic.json --ground-truth-kind SYNTHETIC --k 5 --relevance-threshold 1 --dataset-version toy-v1 --label-version synthetic-v1 --output-dir evaluation/output/toy-v3
```

For a real authorized anonymized, independently annotated/adjudicated dataset, replace paths with frozen private inputs and use `--ground-truth-kind HUMAN_LABELED --dataset-version pilot-v1 --label-version adjudicated-v1`. Provenance is **declared by the operator**, not independently certified by this tool; checked-in examples cannot be declared HUMAN_LABELED. Real data/outputs belong under ignored `evaluation/private/` and `evaluation/work/`, never in commits or public artifacts.

Focused tests from `ai-service/`:

```bash
python -m pytest tests/test_evaluation_metrics.py tests/test_evaluation_dataset.py tests/test_evaluation_runner.py tests/test_evaluation_annotation.py tests/test_evaluation_predictions.py -q
```

## Artifacts and reproducibility limits

- `summary.json`: K, binary threshold, scale, aggregation/zero policy, provenance declaration, available dataset/label versions, algorithm/version, run identities/timestamps/order sources, input SHA256 hashes, evaluator module hashes, Python version, requirements.lock hash, macro metrics and limitations.
- `per_cv.csv`: CV/run IDs, retrieved count at K, total binary-relevant ground-truth count and all four metrics.
- `rankings.csv`: every frozen prediction in evaluation order, separate `evaluationPosition`, official ranks, tier, score components/strategy and external relevance. Metrics consider only top K.
- `predictions.json`: sanitized reusable public-shaped runs retaining identities/counts/versions/timestamps/ranks/tiers/scores/strategy. Excludes titles, Company names, reasons, CV text and extra fields. Nullable scores stay JSON null, blank in CSV.

Artifacts are deterministic UTF-8 without BOM. `evaluationId` hashes configuration, input hashes, tooling hashes and environment identifiers; it replaces a changing execution timestamp. Repeating identical inputs/configuration/tooling/Python produces identical bytes. Raw prediction-file hash also identifies input row order and transport fields. Re-evaluating the sanitized export gives the same metrics/order, with a new input hash/identity. Outputs cannot overwrite an input. V3 evaluation uses only the standard library.

No execution-time timestamp is generated: exported timestamps are copied from the frozen prediction input. File SHA256 values hash exact bytes, independent of absolute paths, hostname, user account or environment variables; input/tooling traversal uses explicit fixed field/file order. `evaluationId` also includes the declared Python version, so changing that runtime version intentionally changes the identity. `datasetName` is the input directory basename in summary.json: relocating identical files under a different basename changes that display metadata, but not the hashes/evaluationId. Byte identity assumes the same dataset basename as well as identical input bytes, configuration, tooling bytes and Python version; newline/content changes are byte changes, not equivalent inputs for these hashes.

Optionally supply `--experiment-manifest evaluation/private/pilot-v1/experiment.json`. It must be a JSON object; its file hash is recorded without copying potentially private contents. At experiment time, freeze and retain source SHA, dependency environment, catalog hash, consent/anonymization and annotation provenance, corpus membership/text versions, private ID mapping, CV analysis metadata, and original per-run score threshold/global limit. The tool hashes requirements.lock but does not verify installed packages; run `python -m pip check` separately.

This reproduces **prediction evaluation**, not exact historical scoring input. Student history does not persist requestId, score threshold, requested limit, immutable CV analysis version/input or corpus/text fingerprint. Job relations are mutable. These cannot be recovered truthfully by an offline adapter; unknown historical values must remain unknown. Exact scoring replay needs separately captured input evidence or a separately reviewed design. No migration/public API change is proposed or implemented here.
