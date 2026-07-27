"""Health metadata tests for legacy compatibility and current bilingual V2."""

from fastapi.testclient import TestClient

from main import app
from v2.constants import ALGORITHM_VERSION, PROCESSING_VERSION


CLIENT = TestClient(app)


def test_legacy_health_response_remains_compatible() -> None:
    response = CLIENT.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "job-recommendation-ai",
        "version": "tfidf-cosine-v1",
        "supportedContracts": ["v1", "v2"],
        "recommendationVersion": ALGORITHM_VERSION,
        "processingVersion": PROCESSING_VERSION,
    }


def test_current_health_response_advertises_bilingual_v2() -> None:
    response = CLIENT.get("/health/v2")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "job-recommendation-ai",
        "version": ALGORITHM_VERSION,
        "supportedContracts": ["v1", "v2"],
        "currentContract": "v2",
        "legacyV1Version": "tfidf-cosine-v1",
        "recommendationVersion": ALGORITHM_VERSION,
        "processingVersion": PROCESSING_VERSION,
    }
    assert app.version == ALGORITHM_VERSION
