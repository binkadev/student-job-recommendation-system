"""Phase 0 dependency compatibility smoke tests."""

import numpy as np
import pytest
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from underthesea import word_tokenize


class _PydanticSmokeModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1)
    score: float = Field(ge=0.0, le=1.0)


def test_pydantic_v2_validation_executes() -> None:
    model = _PydanticSmokeModel.model_validate({"name": "phase-0", "score": 0.5})

    assert model.model_dump() == {"name": "phase-0", "score": 0.5}
    with pytest.raises(ValidationError):
        _PydanticSmokeModel.model_validate(
            {"name": "phase-0", "score": 0.5, "unexpected": True}
        )


def test_underthesea_tokenizer_executes() -> None:
    tokenized = word_tokenize(
        "Tôi đang học lập trình Python và phát triển phần mềm.",
        format="text",
    )

    assert isinstance(tokenized, str)
    assert tokenized.strip()
    assert "Python" in tokenized


def test_numpy_import_and_execution() -> None:
    values = np.array([1.0, 2.0, 3.0], dtype=np.float64)

    assert np.isfinite(values).all()
    assert float(np.dot(values, values)) == pytest.approx(14.0)


def test_tfidf_and_cosine_similarity_execute() -> None:
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True)
    job_vectors = vectorizer.fit_transform(
        ["java spring boot backend", "react typescript frontend"]
    )
    cv_vector = vectorizer.transform(["java spring boot"])
    similarities = cosine_similarity(cv_vector, job_vectors).ravel()

    assert similarities.shape == (2,)
    assert np.isfinite(similarities).all()
    assert 0.0 <= similarities[1] < similarities[0] <= 1.0
