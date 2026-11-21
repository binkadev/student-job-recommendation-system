"""Unit tests for canonical skill extraction, trie regex parity, and Admin /api/skills sync."""

from __future__ import annotations

import re

from scripts.bulk_job_ingest import DEFAULT_SKILL_CATALOG_PATH
from scripts.bulk_job_ingest.skill_matcher import (
    _CONVENTIONAL_SHORT_ALIASES,
    _compile_flat_pattern,
    _normalize_skill_name,
    _normalize_text,
    CanonicalSkillMatcher,
    sync_catalog_skills,
)


def _extract_with_flat_reference(
    matcher: CanonicalSkillMatcher, text: str, *, limit: int = 100
) -> tuple[str, ...]:
    general_aliases = [
        alias
        for alias in matcher._alias_to_canonical
        if alias not in _CONVENTIONAL_SHORT_ALIASES
    ]
    flat_general = _compile_flat_pattern(
        general_aliases, flags=re.IGNORECASE | re.UNICODE
    )
    normalized = _normalize_text(text)
    candidates: list[tuple[int, int, str, str]] = []
    for pattern in (flat_general, matcher._conventional_pattern):
        if pattern is None:
            continue
        for match in pattern.finditer(normalized):
            alias = _normalize_skill_name(match.group(0))
            canonical = matcher._alias_to_canonical.get(alias)
            if canonical is not None:
                candidates.append((match.start(), match.end(), alias, canonical))
    candidates.sort(key=lambda item: (item[0], -(item[1] - item[0]), item[2], item[3]))
    selected: set[str] = set()
    last_end = -1
    for start, end, _alias, canonical in candidates:
        if start < last_end:
            continue
        selected.add(canonical)
        last_end = end
    return tuple(sorted(selected)[:limit])


def test_extracts_canonical_skills_with_short_alias_protection() -> None:
    matcher = CanonicalSkillMatcher.from_catalog_file(DEFAULT_SKILL_CATALOG_PATH)
    assert len(matcher.canonical_names) == 1822

    text = (
        "Backend Developer: We go to great lengths and take a rest, "
        "building REST APIs in Go, Java, Spring Boot, PostgreSQL, C++, and .NET."
    )
    extracted = matcher.extract_canonical_skills(text)
    assert extracted == (".net", "c++", "go", "java", "postgresql", "rest apis", "spring boot")

    # Standalone uppercase "REST" maps to "rest api"; lowercase "go"/"rest" prose does NOT trigger.
    assert matcher.extract_canonical_skills("Built REST endpoints.") == ("rest api",)
    prose_only = "We go to work and rest well while using Python."
    assert matcher.extract_canonical_skills(prose_only) == ("python",)


def test_prefix_trie_regex_matches_flat_longest_first_alternation_identically() -> None:
    matcher = CanonicalSkillMatcher.from_catalog_file(DEFAULT_SKILL_CATALOG_PATH)
    samples = [
        "C, C#, C++, .NET, .NET Core, ASP.NET, ASP.NET Core, ASP.NET MVC",
        "Java, JavaScript, JS, TypeScript, TS, Spring, Spring Boot, Spring Framework",
        "React, React.js, ReactJS, React Native, Next.js, NextJS, Vue, Vue.js, VueJS",
        "Node.js, NodeJS, Express, Express.js, NestJS, Python, PyTorch, TensorFlow, TF",
        "we go to rest while using ai ml js ts tf c and r in javascript_v2 reactjs2",
        "Kubernetes, K8s, Docker, CI/CD, AWS, GCP, Google Cloud Platform, Elasticsearch",
        "Git, GitHub, GitHub Actions, GitLab, PostgreSQL, MySQL, MongoDB, SQL Server",
    ]
    for sample in samples:
        assert matcher.extract_canonical_skills(sample) == _extract_with_flat_reference(
            matcher, sample
        )


class _FakeSkillApiClient:
    def __init__(self) -> None:
        self.db: dict[str, dict[str, object]] = {
            "java": {"id": 1, "name": "java", "normalizedName": "java"},
        }
        self.next_id = 2

    def list_skills_page(
        self, *, token: str, page: int, size: int = 100
    ) -> tuple[list[dict[str, object]], int]:
        assert token == "admin-jwt"
        assert size == 100
        return (list(self.db.values()) if page == 1 else []), 1

    def create_skill_as_admin(
        self, *, token: str, name: str, category: str
    ) -> dict[str, object]:
        assert token == "admin-jwt"
        assert category == "IT"
        norm = name.lower()
        row = {"id": self.next_id, "name": name, "normalizedName": norm}
        self.db[norm] = row
        self.next_id += 1
        return row


def test_sync_catalog_skills_seeds_missing_canonical_skills() -> None:
    matcher = CanonicalSkillMatcher.from_catalog_file(DEFAULT_SKILL_CATALOG_PATH)
    fake_client = _FakeSkillApiClient()

    skill_map = sync_catalog_skills(
        fake_client, admin_token="admin-jwt", matcher=matcher
    )

    assert len(skill_map) == 1822
    assert skill_map["java"] == 1
    assert skill_map["python"] > 1
