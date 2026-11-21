"""Dependency compatibility and stateless-runtime packaging smoke tests."""

import importlib.util
from pathlib import Path
import re

import numpy as np
import pytest
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import spacy


class _PydanticSmokeModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1)
    score: float = Field(ge=0.0, le=1.0)


def test_pydantic_v2_validation_executes() -> None:
    model = _PydanticSmokeModel.model_validate({"name": "smoke", "score": 0.5})

    assert model.model_dump() == {"name": "smoke", "score": 0.5}
    with pytest.raises(ValidationError):
        _PydanticSmokeModel.model_validate(
            {"name": "smoke", "score": 0.5, "unexpected": True}
        )


def test_spacy_english_model_loads_and_underthesea_is_absent(ai_service_root: Path) -> None:
    nlp = spacy.load("en_core_web_sm")
    doc = nlp("Software engineers build backend APIs with Python and PostgreSQL.")

    assert [token.text for token in doc if token.text == "Python"] == ["Python"]
    assert importlib.util.find_spec("underthesea") is None
    requirements_lock = (ai_service_root / "requirements.lock").read_text(encoding="utf-8")
    assert not any(
        re.match(r"^psycopg(?:$|[-_=<>!~;\s\[])", line.strip().lower())
        for line in requirements_lock.splitlines()
        if line.strip() and not line.strip().startswith("#")
    )


def test_numpy_import_and_execution() -> None:
    values = np.array([1.0, 2.0, 3.0], dtype=np.float64)

    assert np.isfinite(values).all()
    assert float(np.dot(values, values)) == pytest.approx(14.0)


def test_tfidf_and_cosine_similarity_execute() -> None:
    vectorizer = TfidfVectorizer(ngram_range=(1, 1), sublinear_tf=True)
    job_vectors = vectorizer.fit_transform(
        ["java spring_boot backend", "react typescript frontend"]
    )
    cv_vector = vectorizer.transform(["java spring_boot"])
    similarities = cosine_similarity(cv_vector, job_vectors).ravel()

    assert similarities.shape == (2,)
    assert np.isfinite(similarities).all()
    assert 0.0 <= similarities[1] < similarities[0] <= 1.0
