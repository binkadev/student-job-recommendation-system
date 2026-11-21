"""Offline benchmark comparing Local-Corpus TF-IDF vs. Global Incremental-DF TF-IDF.

Evaluates macro Precision@K, Recall@K, F1@K, and NDCG@K on any frozen English
dataset directory (``cvs.json``, ``jobs.json``, ``judgments.csv``).
"""

from __future__ import annotations

import argparse
from decimal import Decimal
import json
from pathlib import Path
import sys
from typing import Sequence

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from evaluation.dataset import load_dataset
from evaluation.metrics import f1_at_k, ndcg_at_k, precision_at_k, recall_at_k
from nlp.english_pipeline import load_compiled_spacy_pipeline, tokenize_english
from nlp.skill_canonicalizer import load_default_catalog
from nlp.skill_extractor import SkillExtractor
from scoring.tfidf_artifact import load_tfidf_artifact


def _hybrid_rank(
    *,
    cv_text: str,
    cv_skills: frozenset[str],
    jobs: list[tuple[int, str, frozenset[str]]],
    text_scores: list[float],
) -> list[int]:
    scored: list[tuple[float, int]] = []
    for (job_id, _job_text, job_skills), text_score in zip(jobs, text_scores, strict=True):
        if job_skills:
            skill_score = len(cv_skills & job_skills) / len(job_skills)
            overall = 0.65 * text_score + 0.35 * skill_score
        else:
            overall = text_score
        scored.append((round(overall, 8), job_id))
    scored.sort(key=lambda item: (-item[0], item[1]))
    return [job_id for _score, job_id in scored]


def compare_local_vs_global(
    *,
    dataset_directory: Path,
    spacy_model_dir: Path,
    tfidf_model_path: Path,
    k: int = 5,
    relevance_threshold: int = 1,
) -> dict[str, object]:
    dataset = load_dataset(dataset_directory)
    spacy_pipeline = load_compiled_spacy_pipeline(spacy_model_dir)
    tfidf_artifact = load_tfidf_artifact(
        tfidf_model_path,
        expected_nlp_model_hash=spacy_pipeline.model_hash,
    )
    catalog = load_default_catalog()
    extractor = SkillExtractor.from_catalog(catalog)

    prepared_jobs: list[tuple[int, str, frozenset[str]]] = []
    for job in dataset.jobs:
        tokens = tokenize_english(job.text, nlp=spacy_pipeline.nlp)
        skills = catalog.canonicalize_many(job.skills)
        prepared_jobs.append((job.id, " ".join(tokens), skills))

    local_metrics = {"precisionAtK": [], "recallAtK": [], "f1AtK": [], "ndcgAtK": []}
    global_metrics = {"precisionAtK": [], "recallAtK": [], "f1AtK": [], "ndcgAtK": []}

    job_texts = [item[1] for item in prepared_jobs]
    local_vectorizer = TfidfVectorizer(
        analyzer="word",
        tokenizer=str.split,
        token_pattern=None,
        lowercase=False,
        ngram_range=(1, 1),
        sublinear_tf=True,
        stop_words=None,
    )
    local_job_matrix = local_vectorizer.fit_transform(job_texts)

    for cv in dataset.cvs:
        cv_processed = " ".join(tokenize_english(cv.text, nlp=spacy_pipeline.nlp))
        cv_skills = frozenset(extractor.extract(cv.text)) | catalog.canonicalize_many(cv.skills)
        relevance = {job.id: dataset.relevance_for(cv.id, job.id) for job in dataset.jobs}

        local_scores = cosine_similarity(
            local_vectorizer.transform([cv_processed]),
            local_job_matrix,
        ).ravel().tolist()
        global_scores = list(
            tfidf_artifact.transform_and_cosine_similarity(
                query_text=cv_processed,
                target_texts=job_texts,
            )
        )

        local_ranking = _hybrid_rank(
            cv_text=cv_processed,
            cv_skills=cv_skills,
            jobs=prepared_jobs,
            text_scores=local_scores,
        )
        global_ranking = _hybrid_rank(
            cv_text=cv_processed,
            cv_skills=cv_skills,
            jobs=prepared_jobs,
            text_scores=global_scores,
        )

        for bucket, ranking in (
            (local_metrics, local_ranking),
            (global_metrics, global_ranking),
        ):
            bucket["precisionAtK"].append(
                precision_at_k(ranking, relevance, k, relevance_threshold=relevance_threshold)
            )
            bucket["recallAtK"].append(
                recall_at_k(ranking, relevance, k, relevance_threshold=relevance_threshold)
            )
            bucket["f1AtK"].append(
                f1_at_k(ranking, relevance, k, relevance_threshold=relevance_threshold)
            )
            bucket["ndcgAtK"].append(ndcg_at_k(ranking, relevance, k))

    def _macro(bucket: dict[str, list[float]]) -> dict[str, float]:
        return {
            name: round(sum(values) / len(values), 6) if values else 0.0
            for name, values in bucket.items()
        }

    return {
        "datasetName": dataset.name,
        "k": k,
        "cvCount": len(dataset.cvs),
        "jobCount": len(dataset.jobs),
        "tfidfModelVersion": tfidf_artifact.model_version,
        "localTfidf": _macro(local_metrics),
        "globalIncrementalTfidf": _macro(global_metrics),
    }


def main(arguments: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", required=True, type=Path)
    parser.add_argument("--spacy-model-dir", required=True, type=Path)
    parser.add_argument("--tfidf-model-path", required=True, type=Path)
    parser.add_argument("--k", type=int, default=5)
    parser.add_argument("--relevance-threshold", type=int, default=1)
    args = parser.parse_args(arguments)
    report = compare_local_vs_global(
        dataset_directory=args.dataset,
        spacy_model_dir=args.spacy_model_dir,
        tfidf_model_path=args.tfidf_model_path,
        k=args.k,
        relevance_threshold=args.relevance_threshold,
    )
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
