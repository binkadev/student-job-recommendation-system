"""Unit tests for strict validation in offline.build_spacy_model."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from core.constants import SKILL_CATALOG_VERSION
from nlp.skill_canonicalizer import load_default_catalog, load_skill_catalog
from offline.build_spacy_model import (
    DomainPhrasesError,
    _DEFAULT_PHRASES_PATH,
    _load_domain_phrases,
    build_spacy_model,
)


def _write_json(path: Path, payload: object) -> Path:
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return path


def _valid_phrases_doc() -> dict:
    return {
        "phrasesVersion": "domain-phrases-en-v1",
        "phrases": [
            {
                "canonical": "backend developer",
                "aliases": ["backend developer"],
            },
            {
                "canonical": "cloud architect",
                "aliases": ["cloud architect"],
            },
        ],
    }


def _mini_catalog(tmp_path: Path):
    path = _write_json(
        tmp_path / "mini_catalog.json",
        {
            "catalogVersion": SKILL_CATALOG_VERSION,
            "skills": [
                {"canonical": "java", "aliases": ["java"]},
                {"canonical": "spring boot", "aliases": ["spring boot", "springboot"]},
            ],
        },
    )
    return load_skill_catalog(path)


def test_checked_in_domain_phrases_pass_strict_validation_against_default_catalog() -> None:
    catalog = load_default_catalog()
    version, entries = _load_domain_phrases(_DEFAULT_PHRASES_PATH, skill_catalog=catalog)

    assert version == "domain-phrases-en-v1"
    assert len(entries) == 364


def test_load_domain_phrases_rejects_malformed_constants_and_duplicate_json_keys(
    tmp_path: Path,
) -> None:
    nan_path = tmp_path / "nan.json"
    nan_path.write_text(
        '{"phrasesVersion":"domain-phrases-en-v1","phrases":[],"extra":NaN}',
        encoding="utf-8",
    )
    with pytest.raises(DomainPhrasesError, match="non-standard numeric constant 'NaN'"):
        _load_domain_phrases(nan_path)

    dup_path = tmp_path / "dup.json"
    dup_path.write_text(
        """
        {
          "phrasesVersion": "domain-phrases-en-v1",
          "phrasesVersion": "domain-phrases-en-v1",
          "phrases": [
            {
              "canonical": "backend developer",
              "canonical": "backend developer",
              "aliases": ["backend developer"]
            }
          ]
        }
        """,
        encoding="utf-8",
    )
    with pytest.raises(DomainPhrasesError) as captured:
        _load_domain_phrases(dup_path)

    assert captured.value.errors == (
        "root.phrases[0]: duplicate JSON key 'canonical'",
        "root: duplicate JSON key 'phrasesVersion'",
    )


@pytest.mark.parametrize(
    ("document", "expected_error"),
    [
        ([], "root: expected an object"),
        ({"phrasesVersion": "domain-phrases-en-v1"}, "root: missing key 'phrases'"),
        (
            {"phrasesVersion": "domain-phrases-en-v1", "phrases": [], "extra": 1},
            "root: unknown key 'extra'",
        ),
        (
            {"phrasesVersion": "domain-phrases-en-v2", "phrases": []},
            "root.phrasesVersion: expected 'domain-phrases-en-v1', got 'domain-phrases-en-v2'",
        ),
        (
            {"phrasesVersion": "domain-phrases-en-v1", "phrases": []},
            "root.phrases: must not be empty",
        ),
        (
            {
                "phrasesVersion": "domain-phrases-en-v1",
                "phrases": [{"canonical": "backend developer", "unexpected": 1}],
            },
            "root.phrases[0]: unknown key 'unexpected'",
        ),
    ],
)
def test_load_domain_phrases_rejects_invalid_schema_and_empty_containers(
    tmp_path: Path,
    document: object,
    expected_error: str,
) -> None:
    path = _write_json(tmp_path / "phrases.json", document)
    with pytest.raises(DomainPhrasesError) as captured:
        _load_domain_phrases(path)

    assert expected_error in captured.value.errors


@pytest.mark.parametrize(
    ("canonical", "aliases", "expected_fragment"),
    [
        ("Backend Developer", ["Backend Developer"], "normalized as 'backend developer'"),
        ("backend  developer", ["backend  developer"], "normalized as 'backend developer'"),
        ("cafe\u0301 role", ["cafe\u0301 role"], "normalized as 'café role'"),
        ("x" * 151, ["x" * 151], "at most 150"),
        ("", [""], "non-whitespace"),
        ("backend developer", ["cloud architect"], "must be included"),
        ("backend developer", ["backend developer", "backend developer"], "duplicate alias"),
    ],
)
def test_load_domain_phrases_rejects_unnormalized_overlong_and_missing_self_aliases(
    tmp_path: Path,
    canonical: str,
    aliases: list[str],
    expected_fragment: str,
) -> None:
    doc = {
        "phrasesVersion": "domain-phrases-en-v1",
        "phrases": [{"canonical": canonical, "aliases": aliases}],
    }
    path = _write_json(tmp_path / "phrases.json", doc)

    with pytest.raises(DomainPhrasesError) as captured:
        _load_domain_phrases(path)

    assert any(expected_fragment in error for error in captured.value.errors)


def test_load_domain_phrases_rejects_intra_file_duplicates_and_collisions(
    tmp_path: Path,
) -> None:
    doc = _valid_phrases_doc()
    doc["phrases"].append({"canonical": "backend developer", "aliases": ["backend developer"]})
    path = _write_json(tmp_path / "dup_entry.json", doc)

    with pytest.raises(DomainPhrasesError) as captured:
        _load_domain_phrases(path)

    assert (
        "root.phrases: duplicate canonical 'backend developer' at indexes 0, 2"
        in captured.value.errors
    )

    cross_alias_doc = _valid_phrases_doc()
    cross_alias_doc["phrases"][1]["aliases"].append("backend developer")
    cross_path = _write_json(tmp_path / "cross_alias.json", cross_alias_doc)

    with pytest.raises(DomainPhrasesError) as cross_captured:
        _load_domain_phrases(cross_path)

    assert (
        "root.phrases: alias 'backend developer' maps to multiple canonicals: "
        "'backend developer', 'cloud architect'"
    ) in cross_captured.value.errors


@pytest.mark.parametrize(
    ("phrase_canonical", "phrase_aliases", "expected_fragment"),
    [
        ("java", ["java"], "overlaps skill_catalog"),
        ("spring  engineer", ["spring  engineer"], "normalized as"),
        ("spring-boot role", ["spring-boot role", "springboot"], "alias 'springboot' overlaps skill_catalog"),
        ("custom label", ["custom label", "java"], "alias 'java' overlaps skill_catalog"),
        ("spring\u00a0boot", ["spring\u00a0boot"], "normalized as"),
    ],
)
def test_load_domain_phrases_rejects_cross_file_overlap_against_skill_catalog(
    tmp_path: Path,
    phrase_canonical: str,
    phrase_aliases: list[str],
    expected_fragment: str,
) -> None:
    catalog = _mini_catalog(tmp_path)
    doc = {
        "phrasesVersion": "domain-phrases-en-v1",
        "phrases": [{"canonical": phrase_canonical, "aliases": phrase_aliases}],
    }
    path = _write_json(tmp_path / "overlap.json", doc)

    with pytest.raises(DomainPhrasesError) as captured:
        _load_domain_phrases(path, skill_catalog=catalog)

    assert any(expected_fragment in error for error in captured.value.errors)


def test_build_spacy_model_rejects_cross_file_entity_id_collision(
    tmp_path: Path,
) -> None:
    catalog_path = _write_json(
        tmp_path / "catalog.json",
        {
            "catalogVersion": SKILL_CATALOG_VERSION,
            "skills": [{"canonical": "spring boot", "aliases": ["spring boot"]}],
        },
    )
    phrases_path = _write_json(
        tmp_path / "phrases.json",
        {
            "phrasesVersion": "domain-phrases-en-v1",
            "phrases": [{"canonical": "spring boot", "aliases": ["spring boot"]}],
        },
    )

    with pytest.raises(DomainPhrasesError, match="overlaps skill_catalog"):
        build_spacy_model(
            output_dir=tmp_path / "out_model",
            catalog_path=catalog_path,
            phrases_path=phrases_path,
        )
