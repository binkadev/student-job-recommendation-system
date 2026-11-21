"""Immutable runtime dependency container for the stateless AI Service."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from pathlib import Path

from core.config import load_settings
from nlp.english_pipeline import LoadedSpacyPipeline, load_compiled_spacy_pipeline
from nlp.skill_canonicalizer import SkillCatalog, load_default_catalog
from nlp.skill_extractor import SkillExtractor
from scoring.tfidf_artifact import TfidfModelArtifact, load_tfidf_artifact

from .cv_service import CvParsingService


@dataclass(frozen=True, slots=True)
class AppRuntime:
    """Immutable dependencies loaded once into RAM and shared across routes."""

    internal_api_key: str
    max_file_size_bytes: int
    catalog: SkillCatalog
    skill_extractor: SkillExtractor
    spacy_pipeline: LoadedSpacyPipeline
    tfidf_artifact: TfidfModelArtifact
    cv_service: CvParsingService
    max_candidate_ranking_candidates: int = 500
    max_candidate_ranking_request_bytes: int = 8_388_608


def build_runtime(
    *,
    environment: Mapping[str, str] | None = None,
    catalog_loader: Callable[[], SkillCatalog] = load_default_catalog,
    spacy_loader: Callable[[Path], LoadedSpacyPipeline] = load_compiled_spacy_pipeline,
    tfidf_loader: Callable[..., TfidfModelArtifact] = load_tfidf_artifact,
) -> AppRuntime:
    """Validate configuration and load all AI runtime models into RAM once."""

    settings = load_settings(environment)
    catalog = catalog_loader()
    extractor = SkillExtractor.from_catalog(catalog)
    spacy_pipeline = spacy_loader(settings.spacy_model_dir)
    tfidf_artifact = tfidf_loader(
        settings.tfidf_model_path,
        bootstrap_fallback_path=settings.tfidf_bootstrap_model_path,
        expected_nlp_model_hash=spacy_pipeline.model_hash,
    )
    cv_service = CvParsingService(
        max_file_size_bytes=settings.max_file_size_bytes,
        skill_extractor=extractor,
        spacy_pipeline=spacy_pipeline,
    )
    return AppRuntime(
        internal_api_key=settings.internal_api_key,
        max_file_size_bytes=settings.max_file_size_bytes,
        catalog=catalog,
        skill_extractor=extractor,
        spacy_pipeline=spacy_pipeline,
        tfidf_artifact=tfidf_artifact,
        cv_service=cv_service,
        max_candidate_ranking_candidates=(
            settings.max_candidate_ranking_candidates
        ),
        max_candidate_ranking_request_bytes=(
            settings.max_candidate_ranking_request_bytes
        ),
    )


__all__ = ["AppRuntime", "build_runtime"]
