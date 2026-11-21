"""Unit tests for Stage 1: deterministic English regex denoising."""

from __future__ import annotations

import pytest

from nlp.denoiser import denoise_english_text


def test_repairs_glued_delimiters_and_camelcase_prose() -> None:
    raw = "SoftwareEngineer experienced in Java,SpringBoot and Docker/Kubernetes;MachineLearning(Python)"
    denoised = denoise_english_text(raw)

    assert "Software Engineer" in denoised
    assert "Java , SpringBoot" in denoised
    assert "Docker / Kubernetes" in denoised
    assert "Machine Learning" in denoised
    assert "Python" in denoised


def test_preserves_technical_punctuation_and_brand_casing() -> None:
    raw = (
        "Built ASP.NET, .NET, C++, C#, Node.js, Next.js, CI/CD, and scikit-learn "
        "services with JavaScript, TypeScript, PostgreSQL, MySQL, GraphQL, FastAPI, PyTorch, TensorFlow."
    )
    denoised = denoise_english_text(raw)

    for token in (
        "ASP.NET",
        ".NET",
        "C++",
        "C#",
        "Node.js",
        "Next.js",
        "CI/CD",
        "scikit-learn",
        "JavaScript",
        "TypeScript",
        "PostgreSQL",
        "MySQL",
        "GraphQL",
        "FastAPI",
        "PyTorch",
        "TensorFlow",
    ):
        assert token in denoised


def test_strips_structured_pii_urls_emails_and_phones() -> None:
    raw = (
        "Contact: alice.dev@example.com | +84 909-123-456 | (415) 555-0199 | "
        "https://github.com/alice-dev | www.alice.dev\n"
        "Built Java backend services in 2025."
    )
    denoised = denoise_english_text(raw)

    assert "alice.dev@example.com" not in denoised
    assert "909-123-456" not in denoised
    assert "555-0199" not in denoised
    assert "https://github.com" not in denoised
    assert "www.alice.dev" not in denoised
    assert "Java backend services" in denoised


def test_normalizes_bullets_and_rejects_non_string() -> None:
    assert "Java" in denoise_english_text("• Java ▪ Spring Boot — Docker")
    with pytest.raises(TypeError, match="must be a string"):
        denoise_english_text(123)  # type: ignore[arg-type]
