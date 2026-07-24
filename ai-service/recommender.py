"""
recommender.py — Stateless TF-IDF + Cosine Similarity recommendation engine.

Integration Contract v1.0:
- Receives ALL data (CV text, job documents, skills) from the caller per request.
- No database access, no global cache.
- Returns results sorted by score descending; ties broken by jobId ascending.
- Each result includes: jobId, score (4dp, clamped to [0.0, 1.0]),
  rank (1-based), matchedSkills, missingSkills, reason.
"""

from typing import List, Dict, Any

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def _recover_casing(lower_set: set, source_list: List[str]) -> List[str]:
    """
    Given a set of lower-cased skill names and the original list they came
    from, return the canonical-cased versions from that list.
    """
    return [s for s in source_list if s.lower() in lower_set]


def generate_recommendations(
    cv_processed_text: str,
    cv_skills: List[str],
    jobs: List[Dict[str, Any]],
    threshold: float = 0.1,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """
    Core TF-IDF + Cosine Similarity recommender.

    Args:
        cv_processed_text: Pre-processed CV text (stopwords already removed).
        cv_skills:         Canonical IT skills extracted from the CV.
        jobs:              List of job dicts, each with keys:
                             id           — unique job identifier (int)
                             processedText — pre-processed job text
                             skills       — list of canonical skill strings
        threshold:         Minimum cosine similarity score to include a result.
        limit:             Maximum number of results to return.

    Returns:
        List of result dicts sorted by score descending (ties: jobId ascending),
        each containing: jobId, score, rank, matchedSkills, missingSkills, reason.
    """
    # Guard: nothing to score
    if not jobs:
        return []

    # -----------------------------------------------------------------------
    # Build TF-IDF corpus
    # [0]      = CV document (query)
    # [1..n]   = job documents (corpus)
    # -----------------------------------------------------------------------
    job_texts = [job.get("processedText", "") for job in jobs]
    all_docs = [cv_processed_text] + job_texts

    # ngram_range=(1,2) captures two-word IT phrases like "spring boot"
    # stop_words=None  because our NLP module already removed stopwords
    vectorizer = TfidfVectorizer(
        analyzer="word",
        ngram_range=(1, 2),
        stop_words=None,
        token_pattern=r"(?u)\b\w[\w.#+]*\b",  # allow tokens like "C#", ".NET"
    )

    try:
        tfidf_matrix = vectorizer.fit_transform(all_docs)
    except ValueError:
        # Empty vocabulary — all texts are empty or contain only stopwords
        return []

    cv_vector = tfidf_matrix[0]
    job_vectors = tfidf_matrix[1:]

    # -----------------------------------------------------------------------
    # Compute cosine similarities
    # -----------------------------------------------------------------------
    raw_similarities = cosine_similarity(cv_vector, job_vectors).flatten()

    # -----------------------------------------------------------------------
    # Normalised skill sets for the CV (for comparison)
    # -----------------------------------------------------------------------
    cv_skills_lower = {s.lower() for s in cv_skills}

    # -----------------------------------------------------------------------
    # Build scored candidates list
    # -----------------------------------------------------------------------
    candidates = []
    for idx, job in enumerate(jobs):
        raw_score = float(raw_similarities[idx])
        # Safety clamp: cosine similarity is mathematically in [0, 1] for
        # non-negative TF-IDF vectors, but float arithmetic can drift.
        score = max(0.0, min(1.0, raw_score))

        if score < threshold:
            continue

        job_skills: List[str] = job.get("skills", [])
        job_skills_lower = {s.lower() for s in job_skills}

        # Skill intersection / difference
        matched_lower = cv_skills_lower & job_skills_lower
        missing_lower = job_skills_lower - cv_skills_lower

        # Recover canonical casing
        matched_skills = _recover_casing(matched_lower, cv_skills)
        missing_skills = _recover_casing(missing_lower, job_skills)

        # Human-readable reason
        if matched_skills:
            top3 = ", ".join(matched_skills[:3])
            reason = (
                f"Profile matches {len(matched_skills)} key skill(s): {top3}. "
                f"Similarity score: {int(score * 100)}%."
            )
        else:
            reason = (
                f"General profile similarity of {int(score * 100)}% "
                "based on text content."
            )

        candidates.append({
            "jobId": job["id"],
            "score": round(score, 4),
            "_sort_key": (-score, job["id"]),  # desc score, asc jobId for ties
            "matchedSkills": matched_skills,
            "missingSkills": missing_skills,
            "reason": reason,
        })

    # -----------------------------------------------------------------------
    # Sort: score descending, jobId ascending for ties; then apply limit
    # -----------------------------------------------------------------------
    candidates.sort(key=lambda c: c["_sort_key"])
    top_candidates = candidates[:limit]

    # -----------------------------------------------------------------------
    # Assign 1-based rank and strip internal sort key
    # -----------------------------------------------------------------------
    results = []
    for rank, candidate in enumerate(top_candidates, start=1):
        results.append({
            "jobId": candidate["jobId"],
            "score": candidate["score"],
            "rank": rank,
            "matchedSkills": candidate["matchedSkills"],
            "missingSkills": candidate["missingSkills"],
            "reason": candidate["reason"],
        })

    return results
