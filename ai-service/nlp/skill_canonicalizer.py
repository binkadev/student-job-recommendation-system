"""Deterministic boundary canonicalization for supplied skill values."""

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
import json
from pathlib import Path
from types import MappingProxyType
from typing import Iterable, Mapping
import unicodedata

from core.constants import SKILL_CATALOG_VERSION


_CATALOG_ROOT_KEYS = frozenset({"catalogVersion", "skills"})
_CATALOG_ENTRY_KEYS = frozenset({"canonical", "aliases"})
_MAX_SKILL_LENGTH = 150


class SkillCatalogError(ValueError):
    """Raised when a catalog cannot be decoded or validated."""

    def __init__(self, errors: Iterable[str]) -> None:
        self.errors = tuple(sorted(set(errors)))
        detail = "\n".join(f"- {error}" for error in self.errors)
        super().__init__(f"Invalid skill catalog:\n{detail}")


class _JsonObjectPairs(list[tuple[str, object]]):
    """Preserve JSON object pairs so duplicate keys can be detected."""


@dataclass(frozen=True, slots=True)
class SkillCatalog:
    """An immutable exact-alias index for request-boundary skills."""

    catalog_version: str
    canonical_skills: frozenset[str]
    alias_to_canonical: Mapping[str, str]
    canonical_to_aliases: Mapping[str, tuple[str, ...]]

    @property
    def canonical_count(self) -> int:
        return len(self.canonical_skills)

    @property
    def lookup_key_count(self) -> int:
        """Count canonical spellings and non-canonical aliases."""

        return len(self.alias_to_canonical)

    @property
    def non_canonical_alias_count(self) -> int:
        return sum(
            alias != canonical
            for alias, canonical in self.alias_to_canonical.items()
        )

    def canonicalize_one(self, skill: str) -> str:
        """Resolve one supplied skill, preserving normalized unknown values."""

        normalized = normalize_skill(skill)
        return self.alias_to_canonical.get(normalized, normalized)

    def canonicalize_many(self, skills: Iterable[str]) -> frozenset[str]:
        """Canonicalize and deduplicate the complete iterable without a cap."""

        if isinstance(skills, (str, bytes)):
            raise TypeError("skills must be an iterable of strings, not a string")
        return frozenset(self.canonicalize_one(skill) for skill in skills)

    @staticmethod
    def sorted_presentation(skills: Iterable[str]) -> tuple[str, ...]:
        """Return an immutable deterministic presentation of canonical values."""

        return tuple(sorted(skills))

    def canonicalize_many_sorted(
        self,
        skills: Iterable[str],
    ) -> tuple[str, ...]:
        """Canonicalize the complete input and return sorted presentation."""

        return self.sorted_presentation(self.canonicalize_many(skills))


def normalize_skill(skill: str) -> str:
    """Apply the Backend-compatible syntactic skill normalization policy."""

    if not isinstance(skill, str):
        raise TypeError("skill must be a string")
    if len(skill) > _MAX_SKILL_LENGTH:
        raise ValueError(
            f"skill must contain at most {_MAX_SKILL_LENGTH} characters"
        )

    normalized = unicodedata.normalize("NFC", skill)
    normalized = normalized.casefold()
    normalized = " ".join(normalized.split())
    normalized = unicodedata.normalize("NFC", normalized)

    if not normalized:
        raise ValueError("skill must contain a non-whitespace character")
    if len(normalized) > _MAX_SKILL_LENGTH:
        raise ValueError(
            f"skill must contain at most {_MAX_SKILL_LENGTH} characters"
        )
    return normalized


def load_strict_json_document(
    path: str | Path,
    *,
    error_cls: type[ValueError] = SkillCatalogError,
    label: str = "catalog",
) -> object:
    """Read a UTF-8 JSON file while rejecting malformed syntax, constants, and duplicate keys."""

    document_path = Path(path)
    try:
        source = document_path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        raise error_cls([f"{label} cannot be read as UTF-8: {exc}"]) from exc

    try:
        parsed = json.loads(
            source,
            object_pairs_hook=_JsonObjectPairs,
            parse_constant=_reject_non_json_constant,
        )
    except json.JSONDecodeError as exc:
        raise error_cls(
            [
                "malformed JSON at "
                f"line {exc.lineno}, column {exc.colno}: {exc.msg}"
            ]
        ) from exc
    except ValueError as exc:
        raise error_cls([f"malformed JSON: {exc}"]) from exc

    duplicate_key_errors: list[str] = []
    _collect_duplicate_key_errors(parsed, "root", duplicate_key_errors)
    if duplicate_key_errors:
        raise error_cls(duplicate_key_errors)

    return _convert_json_objects(parsed)


def load_skill_catalog(path: str | Path) -> SkillCatalog:
    """Load and exhaustively validate a versioned skill catalog."""

    document = load_strict_json_document(
        path,
        error_cls=SkillCatalogError,
        label="catalog",
    )
    return _build_catalog(document)


def load_default_catalog() -> SkillCatalog:
    """Load the checked-in catalog independently of the process CWD."""

    catalog_path = (
        Path(__file__).resolve().parents[1]
        / "resources"
        / "skill_catalog.v1.json"
    )
    return load_skill_catalog(catalog_path)


def _reject_non_json_constant(value: str) -> object:
    raise ValueError(f"non-standard numeric constant {value!r}")


def _collect_duplicate_key_errors(
    value: object,
    path: str,
    errors: list[str],
) -> None:
    if isinstance(value, _JsonObjectPairs):
        key_counts = Counter(key for key, _ in value)
        for key in sorted(key for key, count in key_counts.items() if count > 1):
            errors.append(f"{path}: duplicate JSON key {key!r}")
        for key, child in value:
            _collect_duplicate_key_errors(child, f"{path}.{key}", errors)
        return

    if isinstance(value, list):
        for index, child in enumerate(value):
            _collect_duplicate_key_errors(child, f"{path}[{index}]", errors)


def _convert_json_objects(value: object) -> object:
    if isinstance(value, _JsonObjectPairs):
        return {
            key: _convert_json_objects(child)
            for key, child in value
        }
    if isinstance(value, list):
        return [_convert_json_objects(child) for child in value]
    return value


def validate_alias_catalog_document(
    document: object,
    *,
    version_key: str,
    expected_version: str,
    list_key: str,
    error_cls: type[ValueError] = SkillCatalogError,
) -> list[tuple[int, str, tuple[str, ...]]]:
    """Validate an alias-mapped catalog document and return normalized records."""

    errors: list[str] = []
    if type(document) is not dict:
        raise error_cls(["root: expected an object"])

    root_keys = frozenset({version_key, list_key})
    _validate_exact_keys(document, root_keys, "root", errors)

    version = document.get(version_key)
    if type(version) is not str:
        errors.append(f"root.{version_key}: expected a string")
    elif version != expected_version:
        errors.append(
            f"root.{version_key}: expected "
            f"{expected_version!r}, got {version!r}"
        )

    items = document.get(list_key)
    records: list[tuple[int, str, tuple[str, ...]]] = []
    if type(items) is not list:
        errors.append(f"root.{list_key}: expected an array")
    else:
        if not items:
            errors.append(f"root.{list_key}: must not be empty")
        for index, entry in enumerate(items):
            record = _validate_entry(entry, index, errors, list_key=list_key)
            if record is not None:
                records.append(record)

    _validate_global_collisions(records, errors, list_key=list_key)

    if errors:
        raise error_cls(errors)
    return records


def _build_catalog(document: object) -> SkillCatalog:
    records = validate_alias_catalog_document(
        document,
        version_key="catalogVersion",
        expected_version=SKILL_CATALOG_VERSION,
        list_key="skills",
        error_cls=SkillCatalogError,
    )

    alias_to_canonical: dict[str, str] = {}
    canonical_to_aliases: dict[str, tuple[str, ...]] = {}
    for _, canonical, aliases in sorted(records, key=lambda item: item[1]):
        canonical_to_aliases[canonical] = tuple(sorted(aliases))
        for alias in aliases:
            alias_to_canonical[alias] = canonical

    return SkillCatalog(
        catalog_version=SKILL_CATALOG_VERSION,
        canonical_skills=frozenset(canonical_to_aliases),
        alias_to_canonical=MappingProxyType(dict(sorted(alias_to_canonical.items()))),
        canonical_to_aliases=MappingProxyType(
            dict(sorted(canonical_to_aliases.items()))
        ),
    )


def _validate_exact_keys(
    value: dict,
    expected: frozenset[str],
    path: str,
    errors: list[str],
) -> None:
    actual = set(value)
    for key in sorted(expected - actual):
        errors.append(f"{path}: missing key {key!r}")
    for key in sorted(actual - expected):
        errors.append(f"{path}: unknown key {key!r}")


def _validate_entry(
    entry: object,
    index: int,
    errors: list[str],
    *,
    list_key: str = "skills",
) -> tuple[int, str, tuple[str, ...]] | None:
    path = f"root.{list_key}[{index}]"
    if type(entry) is not dict:
        errors.append(f"{path}: expected an object")
        return None

    _validate_exact_keys(entry, _CATALOG_ENTRY_KEYS, path, errors)

    canonical = _validate_catalog_value(
        entry.get("canonical"),
        f"{path}.canonical",
        errors,
    )

    aliases_value = entry.get("aliases")
    aliases: list[str] = []
    if type(aliases_value) is not list:
        errors.append(f"{path}.aliases: expected an array")
    else:
        if not aliases_value:
            errors.append(f"{path}.aliases: must not be empty")
        for alias_index, alias_value in enumerate(aliases_value):
            alias = _validate_catalog_value(
                alias_value,
                f"{path}.aliases[{alias_index}]",
                errors,
            )
            if alias is not None:
                aliases.append(alias)

        duplicate_aliases = sorted(
            alias
            for alias, count in Counter(aliases).items()
            if count > 1
        )
        for alias in duplicate_aliases:
            errors.append(f"{path}.aliases: duplicate alias {alias!r}")

    if canonical is not None and type(aliases_value) is list:
        if canonical not in aliases:
            errors.append(
                f"{path}.aliases: canonical {canonical!r} must be included"
            )

    if canonical is None or type(aliases_value) is not list:
        return None
    return index, canonical, tuple(aliases)


def _validate_catalog_value(
    value: object,
    path: str,
    errors: list[str],
) -> str | None:
    if type(value) is not str:
        errors.append(f"{path}: expected a string")
        return None

    try:
        normalized = normalize_skill(value)
    except (TypeError, ValueError) as exc:
        errors.append(f"{path}: {exc}")
        return None

    if value != normalized:
        errors.append(
            f"{path}: value must already be normalized as {normalized!r}"
        )
    return normalized


def _validate_global_collisions(
    records: list[tuple[int, str, tuple[str, ...]]],
    errors: list[str],
    *,
    list_key: str = "skills",
) -> None:
    canonical_indexes: dict[str, list[int]] = defaultdict(list)
    alias_owners: dict[str, list[tuple[int, str]]] = defaultdict(list)

    for index, canonical, aliases in records:
        canonical_indexes[canonical].append(index)
        for alias in set(aliases):
            alias_owners[alias].append((index, canonical))

    for canonical, indexes in canonical_indexes.items():
        if len(indexes) > 1:
            rendered_indexes = ", ".join(str(index) for index in sorted(indexes))
            errors.append(
                f"root.{list_key}: duplicate canonical {canonical!r} "
                f"at indexes {rendered_indexes}"
            )

    for alias, owners in alias_owners.items():
        canonical_owners = sorted({canonical for _, canonical in owners})
        if len(canonical_owners) > 1:
            errors.append(
                f"root.{list_key}: alias {alias!r} maps to multiple canonicals: "
                f"{', '.join(repr(owner) for owner in canonical_owners)}"
            )
            continue

        owner_indexes = sorted({index for index, _ in owners})
        if len(owner_indexes) > 1:
            rendered_indexes = ", ".join(str(index) for index in owner_indexes)
            errors.append(
                f"root.{list_key}: duplicate alias {alias!r} "
                f"at indexes {rendered_indexes}"
            )
