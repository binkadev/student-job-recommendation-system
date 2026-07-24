"""
test_api.py — Integration tests for the stateless AI Service.

Run with:  pytest test_api.py -v
"""

import io
import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


# ===========================================================================
# GET /health
# ===========================================================================

class TestHealthEndpoint:
    def test_health_returns_200(self):
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_returns_exact_body(self):
        response = client.get("/health")
        body = response.json()
        assert body["status"] == "ok"
        assert body["service"] == "job-recommendation-ai"
        assert body["version"] == "tfidf-cosine-v1"


# ===========================================================================
# POST /internal/v1/cv/parse
# ===========================================================================

class TestCvParseEndpoint:
    def _make_pdf_bytes(self, text: str = "Java Spring Boot Python Docker") -> bytes:
        """Create a minimal in-memory PDF for testing without pdfplumber."""
        # We'll use a plain-text DOCX instead to avoid needing a real PDF renderer
        return None  # placeholder — see docx test below

    def _make_docx_bytes(self, text: str = "Java Spring Boot Python Docker") -> bytes:
        """Create an in-memory DOCX file with the given text."""
        import docx as _docx
        import io as _io
        doc = _docx.Document()
        doc.add_paragraph(text)
        buf = _io.BytesIO()
        doc.save(buf)
        buf.seek(0)
        return buf.read()

    def test_parse_docx_returns_200(self):
        docx_bytes = self._make_docx_bytes("Java Spring Boot React Python Docker AWS")
        response = client.post(
            "/internal/v1/cv/parse",
            files={"file": ("cv.docx", io.BytesIO(docx_bytes), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        )
        assert response.status_code == 200

    def test_parse_docx_response_has_required_fields(self):
        docx_bytes = self._make_docx_bytes("Java Spring Boot React Python Docker AWS")
        response = client.post(
            "/internal/v1/cv/parse",
            files={"file": ("cv.docx", io.BytesIO(docx_bytes), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        )
        body = response.json()
        assert "rawText" in body
        assert "processedText" in body
        assert "skills" in body
        assert isinstance(body["skills"], list)

    def test_parse_docx_detects_skills(self):
        docx_bytes = self._make_docx_bytes("Java Spring Boot React Python Docker AWS Kubernetes")
        response = client.post(
            "/internal/v1/cv/parse",
            files={"file": ("cv.docx", io.BytesIO(docx_bytes), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        )
        body = response.json()
        skills = body["skills"]
        assert "Java" in skills
        assert "Docker" in skills

    def test_parse_unsupported_type_returns_400(self):
        response = client.post(
            "/internal/v1/cv/parse",
            files={"file": ("cv.txt", io.BytesIO(b"plain text"), "text/plain")},
        )
        assert response.status_code == 400

    def test_parse_docx_raw_text_non_empty(self):
        docx_bytes = self._make_docx_bytes("Hello World Java")
        response = client.post(
            "/internal/v1/cv/parse",
            files={"file": ("cv.docx", io.BytesIO(docx_bytes), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        )
        body = response.json()
        assert len(body["rawText"].strip()) > 0


# ===========================================================================
# POST /internal/v1/recommendations
# ===========================================================================

SAMPLE_CV = {
    "processedText": "Java Spring Boot REST API Docker Kubernetes PostgreSQL Agile Scrum",
    "skills": ["Java", "Spring Boot", "Docker", "Kubernetes", "PostgreSQL"],
}

SAMPLE_JOBS = [
    {
        "id": 1,
        "processedText": "Java Spring Boot Microservices Docker Kubernetes REST API developer",
        "skills": ["Java", "Spring Boot", "Docker", "Kubernetes", "Microservices"],
    },
    {
        "id": 2,
        "processedText": "React TypeScript Frontend developer CSS HTML Redux",
        "skills": ["React", "TypeScript", "CSS", "HTML", "Redux"],
    },
    {
        "id": 3,
        "processedText": "Python Django Machine Learning TensorFlow data science",
        "skills": ["Python", "Django", "TensorFlow", "Machine Learning"],
    },
]


class TestRecommendationsEndpoint:
    def _post(self, payload: dict):
        return client.post("/internal/v1/recommendations", json=payload)

    def test_returns_200(self):
        payload = {
            "requestId": "req-001",
            "cv": SAMPLE_CV,
            "jobs": SAMPLE_JOBS,
            "threshold": 0.0,
            "limit": 10,
        }
        response = self._post(payload)
        assert response.status_code == 200

    def test_echoes_request_id(self):
        payload = {
            "requestId": "req-echo-test",
            "cv": SAMPLE_CV,
            "jobs": SAMPLE_JOBS,
            "threshold": 0.0,
            "limit": 10,
        }
        body = self._post(payload).json()
        assert body["requestId"] == "req-echo-test"

    def test_algorithm_version_present(self):
        payload = {
            "requestId": "req-002",
            "cv": SAMPLE_CV,
            "jobs": SAMPLE_JOBS,
            "threshold": 0.0,
            "limit": 10,
        }
        body = self._post(payload).json()
        assert body["algorithmVersion"] == "tfidf-cosine-v1"

    def test_results_sorted_by_score_descending(self):
        payload = {
            "requestId": "req-003",
            "cv": SAMPLE_CV,
            "jobs": SAMPLE_JOBS,
            "threshold": 0.0,
            "limit": 10,
        }
        results = self._post(payload).json()["results"]
        scores = [r["score"] for r in results]
        assert scores == sorted(scores, reverse=True), "Results must be sorted by score descending"

    def test_scores_within_bounds(self):
        payload = {
            "requestId": "req-004",
            "cv": SAMPLE_CV,
            "jobs": SAMPLE_JOBS,
            "threshold": 0.0,
            "limit": 10,
        }
        results = self._post(payload).json()["results"]
        for r in results:
            assert 0.0 <= r["score"] <= 1.0, f"Score {r['score']} out of [0,1] range"

    def test_rank_is_1_based_sequential(self):
        payload = {
            "requestId": "req-005",
            "cv": SAMPLE_CV,
            "jobs": SAMPLE_JOBS,
            "threshold": 0.0,
            "limit": 10,
        }
        results = self._post(payload).json()["results"]
        ranks = [r["rank"] for r in results]
        assert ranks == list(range(1, len(ranks) + 1)), "Ranks must be 1-based sequential"

    def test_matched_skills_are_subset_of_cv_skills(self):
        payload = {
            "requestId": "req-006",
            "cv": SAMPLE_CV,
            "jobs": SAMPLE_JOBS,
            "threshold": 0.0,
            "limit": 10,
        }
        results = self._post(payload).json()["results"]
        cv_skills_lower = {s.lower() for s in SAMPLE_CV["skills"]}
        for r in results:
            for ms in r["matchedSkills"]:
                assert ms.lower() in cv_skills_lower, f"{ms} not in CV skills"

    def test_java_job_scores_highest(self):
        """Job 1 (Java/Spring Boot) should score higher than the Python/React jobs."""
        payload = {
            "requestId": "req-007",
            "cv": SAMPLE_CV,
            "jobs": SAMPLE_JOBS,
            "threshold": 0.0,
            "limit": 10,
        }
        results = self._post(payload).json()["results"]
        top_job_id = results[0]["jobId"]
        assert top_job_id == 1, f"Expected job 1 to rank first, got {top_job_id}"

    def test_empty_jobs_returns_empty_results(self):
        payload = {
            "requestId": "req-empty",
            "cv": SAMPLE_CV,
            "jobs": [],
        }
        body = self._post(payload).json()
        assert body["results"] == []
        assert body["requestId"] == "req-empty"

    def test_limit_is_respected(self):
        payload = {
            "requestId": "req-limit",
            "cv": SAMPLE_CV,
            "jobs": SAMPLE_JOBS,
            "threshold": 0.0,
            "limit": 2,
        }
        results = self._post(payload).json()["results"]
        assert len(results) <= 2

    def test_threshold_filters_low_scores(self):
        payload = {
            "requestId": "req-threshold",
            "cv": SAMPLE_CV,
            "jobs": SAMPLE_JOBS,
            "threshold": 0.99,  # Very high — likely no results
            "limit": 10,
        }
        results = self._post(payload).json()["results"]
        for r in results:
            assert r["score"] >= 0.99

    def test_result_contains_required_fields(self):
        payload = {
            "requestId": "req-fields",
            "cv": SAMPLE_CV,
            "jobs": SAMPLE_JOBS,
            "threshold": 0.0,
            "limit": 10,
        }
        results = self._post(payload).json()["results"]
        assert len(results) > 0
        for r in results:
            assert "jobId" in r
            assert "score" in r
            assert "rank" in r
            assert "matchedSkills" in r
            assert "missingSkills" in r
            assert "reason" in r

    def test_only_input_jobs_returned(self):
        """Guarantee: results only contain jobIds from the input list."""
        payload = {
            "requestId": "req-boundary",
            "cv": SAMPLE_CV,
            "jobs": SAMPLE_JOBS,
            "threshold": 0.0,
            "limit": 10,
        }
        input_job_ids = {j["id"] for j in SAMPLE_JOBS}
        results = self._post(payload).json()["results"]
        for r in results:
            assert r["jobId"] in input_job_ids, f"jobId {r['jobId']} not in input jobs"
