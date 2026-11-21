"""Offline compiler for the custom English spaCy EntityRuler pipeline.

Compiles ``en_core_web_sm`` + custom technical tokenizer rules + deterministic
``EntityRuler`` (from ``resources/skill_catalog.v1.json``,
``_CONVENTIONAL_SHORT_ALIASES``, and ``resources/domain_phrases.en.json``) +
``merge_entities`` and persists the self-contained model to disk via
``nlp.to_disk(...)`` alongside ``model_manifest.json``.
"""

from __future__ import annotations

import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import shutil
import sys
from typing import Iterable, Sequence

import spacy
from spacy.symbols import ORTH

from nlp.skill_canonicalizer import (
    SkillCatalog,
    load_skill_catalog,
    load_strict_json_document,
    validate_alias_catalog_document,
)
from nlp.skill_extractor import _CONVENTIONAL_SHORT_ALIASES


_SERVICE_ROOT = Path(__file__).resolve().parents[1]
_DEFAULT_CATALOG_PATH = _SERVICE_ROOT / "resources" / "skill_catalog.v1.json"
_DEFAULT_PHRASES_PATH = _SERVICE_ROOT / "resources" / "domain_phrases.en.json"
_DEFAULT_OUTPUT_DIR = _SERVICE_ROOT / "built_models" / "spacy_custom_model"
_BASE_MODEL_NAME = "en_core_web_sm"
_PHRASES_VERSION = "domain-phrases-en-v1"


class DomainPhrasesError(ValueError):
    """Raised when domain_phrases.en.json fails strict schema or collision validation."""

    def __init__(self, errors: Iterable[str]) -> None:
        self.errors = tuple(sorted(set(errors)))
        detail = "\n".join(f"- {error}" for error in self.errors)
        super().__init__(f"Invalid domain phrases catalog:\n{detail}")

# Exact technical spellings preserved as single tokens by the spaCy tokenizer.
_SPECIAL_TOKEN_SPELLINGS = (
    "c++",
    "C++",
    "c#",
    "C#",
    ".net",
    ".NET",
    ".Net",
    "asp.net",
    "ASP.NET",
    "Asp.Net",
    "node.js",
    "Node.js",
    "Node.JS",
    "NODE.JS",
    "next.js",
    "Next.js",
    "Next.JS",
    "NEXT.JS",
    "nuxt.js",
    "Nuxt.js",
    "Nuxt.JS",
    "vue.js",
    "Vue.js",
    "Vue.JS",
    "express.js",
    "Express.js",
    "Express.JS",
    "react.js",
    "React.js",
    "React.JS",
    "ci/cd",
    "CI/CD",
    "Ci/Cd",
    "scikit-learn",
    "Scikit-learn",
    "Scikit-Learn",
    "SCIKIT-LEARN",
    "spring-boot",
    "Spring-boot",
    "Spring-Boot",
    "SPRING-BOOT",
)


def canonical_to_entity_id(canonical: str) -> str:
    """Convert a canonical skill/phrase into its atomic whitespace-safe token."""

    return "_".join(canonical.strip().lower().split())


def _load_domain_phrases(
    path: Path,
    *,
    skill_catalog: SkillCatalog | None = None,
) -> tuple[str, list[tuple[str, list[str]]]]:
    """Load and exhaustively validate domain_phrases.en.json."""

    document = load_strict_json_document(
        path,
        error_cls=DomainPhrasesError,
        label="domain phrases",
    )
    records = validate_alias_catalog_document(
        document,
        version_key="phrasesVersion",
        expected_version=_PHRASES_VERSION,
        list_key="phrases",
        error_cls=DomainPhrasesError,
    )

    errors: list[str] = []
    entity_id_owners: dict[str, list[tuple[int, str]]] = defaultdict(list)
    entries: list[tuple[str, list[str]]] = []

    skill_canonicals = skill_catalog.canonical_skills if skill_catalog is not None else frozenset()
    skill_aliases = skill_catalog.alias_to_canonical if skill_catalog is not None else {}
    skill_entity_ids = (
        {canonical_to_entity_id(skill): skill for skill in skill_canonicals}
        if skill_catalog is not None
        else {}
    )

    for index, canonical, aliases in records:
        entity_id = canonical_to_entity_id(canonical)
        entity_id_owners[entity_id].append((index, canonical))
        entries.append((entity_id, list(aliases)))

        if skill_catalog is not None:
            if canonical in skill_canonicals or canonical in skill_aliases:
                errors.append(
                    f"root.phrases[{index}].canonical: {canonical!r} overlaps skill_catalog"
                )
            elif entity_id in skill_entity_ids:
                errors.append(
                    f"root.phrases[{index}].canonical: entity_id {entity_id!r} "
                    f"overlaps skill_catalog canonical {skill_entity_ids[entity_id]!r}"
                )
            for alias_index, alias in enumerate(aliases):
                alias_eid = canonical_to_entity_id(alias)
                if (
                    alias in skill_canonicals
                    or alias in skill_aliases
                    or alias_eid in skill_entity_ids
                ):
                    errors.append(
                        f"root.phrases[{index}].aliases[{alias_index}]: "
                        f"alias {alias!r} overlaps skill_catalog"
                    )

    for entity_id, owners in entity_id_owners.items():
        if len(owners) > 1:
            rendered = ", ".join(f"{index} ({canon!r})" for index, canon in owners)
            errors.append(
                f"root.phrases: duplicate entity_id {entity_id!r} at indexes {rendered}"
            )

    if errors:
        raise DomainPhrasesError(errors)

    return _PHRASES_VERSION, entries


def _tokenize_pattern_words(nlp: spacy.language.Language, phrase: str) -> list[str]:
    return [token.text for token in nlp.make_doc(phrase) if not token.is_space]


def _build_patterns(
    nlp: spacy.language.Language,
    catalog: SkillCatalog,
    domain_phrases: list[tuple[str, list[str]]],
) -> list[dict[str, object]]:
    patterns: list[dict[str, object]] = []

    # 1. Skill aliases from skill_catalog.v1.json (longest aliases first).
    for alias in sorted(
        catalog.alias_to_canonical,
        key=lambda item: (-len(item), item),
    ):
        canonical = catalog.alias_to_canonical[alias]
        entity_id = canonical_to_entity_id(canonical)
        if alias in _CONVENTIONAL_SHORT_ALIASES:
            # Ambiguous short aliases require exact uppercase/conventional casing
            # so ordinary prose words ("go", "rest", "c", "r") are never merged.
            for spelling in _CONVENTIONAL_SHORT_ALIASES[alias]:
                patterns.append(
                    {
                        "label": "SKILL",
                        "id": entity_id,
                        "pattern": [{"TEXT": spelling}],
                    }
                )
            continue

        words = _tokenize_pattern_words(nlp, alias)
        if not words:
            continue
        patterns.append(
            {
                "label": "SKILL",
                "id": entity_id,
                "pattern": [{"LOWER": word.lower()} for word in words],
            }
        )

    # 2. Compound non-skill IT domain phrases from domain_phrases.en.json.
    for canonical, aliases in domain_phrases:
        for alias in sorted(set(aliases), key=lambda item: (-len(item), item)):
            words = _tokenize_pattern_words(nlp, alias)
            if not words:
                continue
            patterns.append(
                {
                    "label": "CUSTOM_PHRASE",
                    "id": canonical,
                    "pattern": [{"LOWER": word.lower()} for word in words],
                }
            )

    return patterns


def _compute_manifest_hash(
    *,
    catalog_path: Path,
    phrases_path: Path,
    base_model_version: str,
) -> str:
    digest = hashlib.sha256()
    digest.update(f"spacy={spacy.__version__}\n".encode("utf-8"))
    digest.update(f"base={_BASE_MODEL_NAME}:{base_model_version}\n".encode("utf-8"))
    digest.update(b"catalog:\n")
    digest.update(catalog_path.read_bytes())
    digest.update(b"\nphrases:\n")
    digest.update(phrases_path.read_bytes())
    return digest.hexdigest()


def build_spacy_model(
    *,
    output_dir: Path = _DEFAULT_OUTPUT_DIR,
    catalog_path: Path = _DEFAULT_CATALOG_PATH,
    phrases_path: Path = _DEFAULT_PHRASES_PATH,
) -> dict[str, object]:
    """Compile and persist the offline spaCy custom English model atomically."""

    catalog = load_skill_catalog(catalog_path)
    phrases_version, domain_phrases = _load_domain_phrases(
        phrases_path,
        skill_catalog=catalog,
    )

    nlp = spacy.load(_BASE_MODEL_NAME)
    base_model_version = str(nlp.meta.get("version", "unknown"))

    # Preserve technical punctuation tokens inside spaCy's tokenizer.
    for spelling in _SPECIAL_TOKEN_SPELLINGS:
        nlp.tokenizer.add_special_case(spelling, [{ORTH: spelling}])

    # Stage 2: EntityRuler runs BEFORE statistical NER so canonical skills and
    # compound phrases are never hijacked by generic ORG/GPE/PERSON tags.
    ruler = nlp.add_pipe(
        "entity_ruler",
        before="ner",
        config={"overwrite_ents": False, "validate": True},
    )
    patterns = _build_patterns(nlp, catalog, domain_phrases)
    ruler.add_patterns(patterns)

    # Merge spans into single atomic tokens AFTER ner so PERSON spans merge
    # cleanly too (and are dropped in Stage 3) while SKILL/CUSTOM_PHRASE spans
    # keep their exact canonical ent_id_.
    nlp.add_pipe("merge_entities", after="ner")

    model_hash = _compute_manifest_hash(
        catalog_path=catalog_path,
        phrases_path=phrases_path,
        base_model_version=base_model_version,
    )
    manifest: dict[str, object] = {
        "nlpModelHash": model_hash,
        "baseModel": _BASE_MODEL_NAME,
        "baseModelVersion": base_model_version,
        "spacyVersion": spacy.__version__,
        "catalogVersion": catalog.catalog_version,
        "phrasesVersion": phrases_version,
        "patternCount": len(patterns),
        "pipes": list(nlp.pipe_names),
    }

    target_dir = Path(output_dir)
    staging_dir = target_dir.parent / f".{target_dir.name}.tmp"
    target_dir.parent.mkdir(parents=True, exist_ok=True)
    if staging_dir.exists():
        shutil.rmtree(staging_dir)

    nlp.to_disk(staging_dir)
    (staging_dir / "model_manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )

    if target_dir.exists():
        shutil.rmtree(target_dir)
    staging_dir.rename(target_dir)
    return manifest


def main(arguments: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=_DEFAULT_OUTPUT_DIR,
    )
    parser.add_argument(
        "--catalog-path",
        type=Path,
        default=_DEFAULT_CATALOG_PATH,
    )
    parser.add_argument(
        "--phrases-path",
        type=Path,
        default=_DEFAULT_PHRASES_PATH,
    )
    args = parser.parse_args(arguments)
    manifest = build_spacy_model(
        output_dir=args.output_dir,
        catalog_path=args.catalog_path,
        phrases_path=args.phrases_path,
    )
    print(
        "Compiled spaCy custom model: "
        f"dir={args.output_dir} patterns={manifest['patternCount']} "
        f"hash={str(manifest['nlpModelHash'])[:12]}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
