"""Tests for the deterministic V2 boundary skill catalog."""

from __future__ import annotations

import ast
from dataclasses import FrozenInstanceError
import json
from pathlib import Path

import pytest

from v2.constants import SKILL_CATALOG_VERSION
import v2.skill_canonicalizer as canonicalizer_module
from v2.skill_canonicalizer import (
    SkillCatalogError,
    load_default_catalog,
    load_skill_catalog,
    normalize_skill,
)


BACKEND_SEEDED_SKILLS = {
    "css",
    "docker",
    "git",
    "html",
    "java",
    "javascript",
    "mysql",
    "next.js",
    "postgresql",
    "react",
    "rest api",
    "spring boot",
    "typescript",
}


def _write_catalog(tmp_path: Path, document: object) -> Path:
    path = tmp_path / "catalog.json"
    path.write_text(
        json.dumps(document, ensure_ascii=False),
        encoding="utf-8",
    )
    return path


def _valid_document() -> dict:
    return {
        "catalogVersion": SKILL_CATALOG_VERSION,
        "skills": [
            {
                "canonical": "java",
                "aliases": ["java"],
            },
            {
                "canonical": "spring boot",
                "aliases": ["spring boot", "spring-boot", "springboot"],
            },
        ],
    }


def _load_v1_skill_definitions() -> tuple[set[str], dict[str, str]]:
    source_path = Path(__file__).resolve().parents[1] / "nlp_processor.py"
    syntax_tree = ast.parse(source_path.read_text(encoding="utf-8"))
    assignments: dict[str, object] = {}

    for node in syntax_tree.body:
        if not isinstance(node, (ast.Assign, ast.AnnAssign)):
            continue
        targets = node.targets if isinstance(node, ast.Assign) else [node.target]
        for target in targets:
            if (
                isinstance(target, ast.Name)
                and target.id in {"KNOWN_SKILLS", "SKILL_ALIASES"}
            ):
                assignments[target.id] = ast.literal_eval(node.value)

    return assignments["KNOWN_SKILLS"], assignments["SKILL_ALIASES"]


def test_default_catalog_has_expected_version_and_counts() -> None:
    catalog = load_default_catalog()

    assert catalog.catalog_version == "skills-v1"
    assert catalog.canonical_count == 89
    assert catalog.lookup_key_count == 146
    assert catalog.non_canonical_alias_count == 57


def test_all_backend_seeded_skills_map_exactly_to_themselves() -> None:
    catalog = load_default_catalog()

    assert BACKEND_SEEDED_SKILLS <= catalog.canonical_skills
    assert {
        skill: catalog.canonicalize_one(skill)
        for skill in BACKEND_SEEDED_SKILLS
    } == {skill: skill for skill in BACKEND_SEEDED_SKILLS}


def test_catalog_preserves_current_english_v1_skill_compatibility() -> None:
    catalog = load_default_catalog()
    known_skills, aliases = _load_v1_skill_definitions()

    for skill in known_skills:
        normalized = normalize_skill(skill)
        expected = "go" if normalized == "golang" else normalized
        assert catalog.canonicalize_one(skill) == expected

    for alias, canonical in aliases.items():
        assert catalog.canonicalize_one(alias) == normalize_skill(canonical)


@pytest.mark.parametrize(
    ("supplied", "expected"),
    [
        ("Go", "go"),
        ("Golang", "go"),
        ("K8s", "kubernetes"),
        ("  SpringBoot  ", "spring boot"),
        ("SPRING-BOOT", "spring boot"),
        ("Node.js", "nodejs"),
        ("C#", "c#"),
        ("C++", "c++"),
        (".NET", ".net"),
        ("ASP.NET", "asp.net"),
        ("CI/CD", "ci/cd"),
        ("Next.js", "next.js"),
    ],
)
def test_required_aliases_and_technical_punctuation(
    supplied: str,
    expected: str,
) -> None:
    assert load_default_catalog().canonicalize_one(supplied) == expected


@pytest.mark.parametrize(
    ("supplied", "expected"),
    [
        ("học máy", "machine learning"),
        ("hoc may", "machine learning"),
        ("trí tuệ nhân tạo", "artificial intelligence"),
        ("tri tue nhan tao", "artificial intelligence"),
        ("cơ sở dữ liệu", "database"),
        ("co so du lieu", "database"),
        ("điện toán đám mây", "cloud computing"),
        ("dien toan dam may", "cloud computing"),
        ("kiến trúc vi dịch vụ", "microservices"),
        ("vi dịch vụ", "microservices"),
        ("lập trình hướng đối tượng", "object oriented programming"),
        ("kiểm thử phần mềm", "software testing"),
        ("quản lý dự án", "project management"),
    ],
)
def test_vietnamese_aliases_share_the_canonical_namespace(
    supplied: str,
    expected: str,
) -> None:
    assert load_default_catalog().canonicalize_one(supplied) == expected


def test_normalization_uses_nfc_casefold_and_unicode_whitespace_collapse() -> None:
    decomposed = "  CAFE\u0301\u2003DATA\t "

    assert normalize_skill(decomposed) == "café data"
    assert normalize_skill("  C#  C++  .NET  CI/CD  spring-boot  ") == (
        "c# c++ .net ci/cd spring-boot"
    )


def test_unknown_skills_use_only_syntactic_normalization() -> None:
    catalog = load_default_catalog()

    assert catalog.canonicalize_one("  Unknown\u2003Skill  ") == "unknown skill"
    assert catalog.canonicalize_one("  HỌC   MÁY  ") == "machine learning"
    assert catalog.canonicalize_one("  Chuyên môn mới  ") == "chuyên môn mới"


def test_canonicalize_many_uses_complete_input_and_deduplicates() -> None:
    catalog = load_default_catalog()
    supplied = [f" Skill {index:03d} " for index in range(250)]
    supplied.extend(["Golang", "GO", "K8s", "Kubernetes", "SpringBoot"])

    canonical = catalog.canonicalize_many(supplied)

    assert isinstance(canonical, frozenset)
    assert len(canonical) == 253
    assert {"go", "kubernetes", "spring boot"} <= canonical
    assert "skill 249" in canonical
    assert catalog.sorted_presentation(canonical) == tuple(sorted(canonical))
    assert catalog.canonicalize_many_sorted(reversed(supplied)) == tuple(
        sorted(canonical)
    )


def test_canonicalize_many_rejects_a_bare_string() -> None:
    with pytest.raises(TypeError, match="iterable of strings"):
        load_default_catalog().canonicalize_many("java")


@pytest.mark.parametrize("invalid", [None, True, 1, b"java"])
def test_normalize_skill_rejects_non_strings(invalid: object) -> None:
    with pytest.raises(TypeError, match="must be a string"):
        normalize_skill(invalid)


@pytest.mark.parametrize(
    "invalid",
    ["", " \t\r\n", "x" * 151, " " * 151, "ß" * 76],
)
def test_normalize_skill_rejects_blank_or_overlong_values(invalid: str) -> None:
    with pytest.raises(ValueError):
        normalize_skill(invalid)


def test_loaded_indexes_are_deeply_immutable_and_repeatable() -> None:
    first = load_default_catalog()
    second = load_default_catalog()

    assert first.catalog_version == second.catalog_version
    assert first.canonical_skills == second.canonical_skills
    assert dict(first.alias_to_canonical) == dict(second.alias_to_canonical)
    assert dict(first.canonical_to_aliases) == dict(second.canonical_to_aliases)
    assert isinstance(first.canonical_skills, frozenset)
    assert isinstance(first.canonical_to_aliases["spring boot"], tuple)

    with pytest.raises(TypeError):
        first.alias_to_canonical["new"] = "new"
    with pytest.raises(TypeError):
        first.canonical_to_aliases["java"] = ("changed",)
    with pytest.raises(TypeError):
        first.canonical_to_aliases["spring boot"][0] = "changed"
    with pytest.raises(FrozenInstanceError):
        first.catalog_version = "changed"


def test_default_catalog_path_is_independent_of_current_directory(
    monkeypatch,
    tmp_path: Path,
) -> None:
    monkeypatch.chdir(tmp_path)

    assert load_default_catalog().catalog_version == SKILL_CATALOG_VERSION


def test_missing_or_invalid_utf8_catalog_is_rejected(tmp_path: Path) -> None:
    with pytest.raises(SkillCatalogError, match="cannot be read"):
        load_skill_catalog(tmp_path / "missing.json")

    invalid_utf8 = tmp_path / "invalid-utf8.json"
    invalid_utf8.write_bytes(b"\xff\xfe")
    with pytest.raises(SkillCatalogError, match="cannot be read as UTF-8"):
        load_skill_catalog(invalid_utf8)


def test_malformed_json_is_rejected(tmp_path: Path) -> None:
    path = tmp_path / "catalog.json"
    path.write_text('{"catalogVersion":', encoding="utf-8")

    with pytest.raises(SkillCatalogError, match="malformed JSON"):
        load_skill_catalog(path)

    path.write_text(
        '{"catalogVersion":"skills-v1","skills":[],"value":NaN}',
        encoding="utf-8",
    )
    with pytest.raises(
        SkillCatalogError,
        match="non-standard numeric constant 'NaN'",
    ):
        load_skill_catalog(path)


def test_duplicate_json_keys_are_detected_at_every_object_level(
    tmp_path: Path,
) -> None:
    path = tmp_path / "catalog.json"
    path.write_text(
        """
        {
          "catalogVersion": "skills-v1",
          "catalogVersion": "skills-v1",
          "skills": [
            {
              "canonical": "java",
              "canonical": "java",
              "aliases": ["java"]
            }
          ]
        }
        """,
        encoding="utf-8",
    )

    with pytest.raises(SkillCatalogError) as captured:
        load_skill_catalog(path)

    assert captured.value.errors == (
        "root.skills[0]: duplicate JSON key 'canonical'",
        "root: duplicate JSON key 'catalogVersion'",
    )


@pytest.mark.parametrize(
    ("document", "expected_error"),
    [
        ([], "root: expected an object"),
        (
            {"catalogVersion": "skills-v1"},
            "root: missing key 'skills'",
        ),
        (
            {
                "catalogVersion": "skills-v1",
                "skills": [],
                "unexpected": True,
            },
            "root: unknown key 'unexpected'",
        ),
        (
            {"catalogVersion": 1, "skills": []},
            "root.catalogVersion: expected a string",
        ),
        (
            {"catalogVersion": "skills-v2", "skills": []},
            "root.catalogVersion: expected 'skills-v1', got 'skills-v2'",
        ),
        (
            {"catalogVersion": "skills-v1", "skills": {}},
            "root.skills: expected an array",
        ),
        (
            {"catalogVersion": "skills-v1", "skills": []},
            "root.skills: must not be empty",
        ),
        (
            {"catalogVersion": "skills-v1", "skills": [None]},
            "root.skills[0]: expected an object",
        ),
    ],
)
def test_root_and_entry_container_validation(
    tmp_path: Path,
    document: object,
    expected_error: str,
) -> None:
    with pytest.raises(SkillCatalogError) as captured:
        load_skill_catalog(_write_catalog(tmp_path, document))

    assert expected_error in captured.value.errors


def test_entry_keys_are_exact(tmp_path: Path) -> None:
    document = _valid_document()
    document["skills"][0] = {
        "canonical": "java",
        "unexpected": True,
    }

    with pytest.raises(SkillCatalogError) as captured:
        load_skill_catalog(_write_catalog(tmp_path, document))

    assert "root.skills[0]: missing key 'aliases'" in captured.value.errors
    assert "root.skills[0]: unknown key 'unexpected'" in captured.value.errors


@pytest.mark.parametrize("invalid", [None, True, 1, [], {}])
def test_canonical_values_require_strict_strings(
    tmp_path: Path,
    invalid: object,
) -> None:
    document = _valid_document()
    document["skills"][0]["canonical"] = invalid

    with pytest.raises(SkillCatalogError) as captured:
        load_skill_catalog(_write_catalog(tmp_path, document))

    assert (
        "root.skills[0].canonical: expected a string"
        in captured.value.errors
    )


@pytest.mark.parametrize("invalid", [None, True, 1, "java", {}])
def test_aliases_require_an_array(
    tmp_path: Path,
    invalid: object,
) -> None:
    document = _valid_document()
    document["skills"][0]["aliases"] = invalid

    with pytest.raises(SkillCatalogError) as captured:
        load_skill_catalog(_write_catalog(tmp_path, document))

    assert "root.skills[0].aliases: expected an array" in captured.value.errors


@pytest.mark.parametrize("invalid", [None, True, 1, [], {}])
def test_alias_values_require_strict_strings(
    tmp_path: Path,
    invalid: object,
) -> None:
    document = _valid_document()
    document["skills"][0]["aliases"] = ["java", invalid]

    with pytest.raises(SkillCatalogError) as captured:
        load_skill_catalog(_write_catalog(tmp_path, document))

    assert (
        "root.skills[0].aliases[1]: expected a string"
        in captured.value.errors
    )


@pytest.mark.parametrize(
    ("field", "invalid", "expected_fragment"),
    [
        ("canonical", "", "non-whitespace"),
        ("canonical", " \t ", "non-whitespace"),
        ("canonical", "x" * 151, "at most 150"),
        ("canonical", " " * 151, "at most 150"),
        ("canonical", "Java", "normalized as 'java'"),
        ("aliases", "", "non-whitespace"),
        ("aliases", " \t ", "non-whitespace"),
        ("aliases", "x" * 151, "at most 150"),
        ("aliases", " " * 151, "at most 150"),
        ("aliases", "JAVA", "normalized as 'java'"),
    ],
)
def test_catalog_values_reject_blanks_overlong_and_unnormalized_text(
    tmp_path: Path,
    field: str,
    invalid: str,
    expected_fragment: str,
) -> None:
    document = _valid_document()
    if field == "canonical":
        document["skills"][0]["canonical"] = invalid
    else:
        document["skills"][0]["aliases"] = ["java", invalid]

    with pytest.raises(SkillCatalogError) as captured:
        load_skill_catalog(_write_catalog(tmp_path, document))

    assert any(
        expected_fragment in error
        for error in captured.value.errors
    )


def test_alias_array_must_be_nonempty_and_include_canonical(
    tmp_path: Path,
) -> None:
    document = _valid_document()
    document["skills"][0]["aliases"] = []
    document["skills"][1]["aliases"] = ["springboot"]

    with pytest.raises(SkillCatalogError) as captured:
        load_skill_catalog(_write_catalog(tmp_path, document))

    assert "root.skills[0].aliases: must not be empty" in captured.value.errors
    assert (
        "root.skills[0].aliases: canonical 'java' must be included"
        in captured.value.errors
    )
    assert (
        "root.skills[1].aliases: canonical 'spring boot' must be included"
        in captured.value.errors
    )


def test_duplicate_alias_within_entry_is_rejected(tmp_path: Path) -> None:
    document = _valid_document()
    document["skills"][0]["aliases"] = ["java", "java"]

    with pytest.raises(SkillCatalogError) as captured:
        load_skill_catalog(_write_catalog(tmp_path, document))

    assert (
        "root.skills[0].aliases: duplicate alias 'java'"
        in captured.value.errors
    )


def test_duplicate_canonical_and_alias_across_entries_are_rejected(
    tmp_path: Path,
) -> None:
    document = _valid_document()
    document["skills"].append(
        {
            "canonical": "java",
            "aliases": ["java", "jdk"],
        }
    )

    with pytest.raises(SkillCatalogError) as captured:
        load_skill_catalog(_write_catalog(tmp_path, document))

    assert (
        "root.skills: duplicate canonical 'java' at indexes 0, 2"
        in captured.value.errors
    )
    assert (
        "root.skills: duplicate alias 'java' at indexes 0, 2"
        in captured.value.errors
    )


def test_cross_canonical_alias_collision_is_rejected(tmp_path: Path) -> None:
    document = _valid_document()
    document["skills"][1]["aliases"].append("java")

    with pytest.raises(SkillCatalogError) as captured:
        load_skill_catalog(_write_catalog(tmp_path, document))

    assert (
        "root.skills: alias 'java' maps to multiple canonicals: "
        "'java', 'spring boot'"
    ) in captured.value.errors


def test_validation_errors_are_sorted_and_repeatable(tmp_path: Path) -> None:
    document = {
        "unexpected": True,
        "skills": [
            {"canonical": "Java", "aliases": ["JAVA", "JAVA"]},
            None,
        ],
    }
    path = _write_catalog(tmp_path, document)

    with pytest.raises(SkillCatalogError) as first:
        load_skill_catalog(path)
    with pytest.raises(SkillCatalogError) as second:
        load_skill_catalog(path)

    assert first.value.errors == tuple(sorted(first.value.errors))
    assert second.value.errors == first.value.errors
    assert str(second.value) == str(first.value)


def test_module_has_no_free_text_skill_extraction_api() -> None:
    forbidden_names = {
        "extract_entities",
        "extract_skills",
        "find_alias_spans",
        "scan_aliases",
    }

    assert forbidden_names.isdisjoint(vars(canonicalizer_module))
