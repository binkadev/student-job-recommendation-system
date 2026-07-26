"""Deterministic catalog-backed skill extraction from English CV text."""

from __future__ import annotations

from dataclasses import dataclass
import re
import unicodedata

from .skill_canonicalizer import SkillCatalog, normalize_skill


_MAX_EXTRACTED_SKILLS = 200
_CONVENTIONAL_SHORT_ALIASES = {
    "c": ("C",),
    "r": ("R",),
    "go": ("Go",),
    "ai": ("AI",),
    "ml": ("ML",),
    "js": ("JS",),
    "ts": ("TS",),
    "tf": ("TF",),
    "rest": ("REST",),
}


@dataclass(frozen=True, slots=True)
class _Candidate:
    start: int
    end: int
    alias: str
    canonical: str


@dataclass(frozen=True, slots=True)
class SkillExtractor:
    """Immutable leftmost-longest extractor compiled from one catalog."""

    catalog: SkillCatalog
    general_pattern: re.Pattern[str] | None
    conventional_pattern: re.Pattern[str] | None

    @classmethod
    def from_catalog(cls, catalog: SkillCatalog) -> SkillExtractor:
        if not isinstance(catalog, SkillCatalog):
            raise TypeError("catalog must be a SkillCatalog")

        general_aliases = [
            alias
            for alias in catalog.alias_to_canonical
            if alias not in _CONVENTIONAL_SHORT_ALIASES
        ]
        conventional_spellings = [
            spelling
            for alias in sorted(_CONVENTIONAL_SHORT_ALIASES)
            if alias in catalog.alias_to_canonical
            for spelling in _CONVENTIONAL_SHORT_ALIASES[alias]
        ]
        return cls(
            catalog=catalog,
            general_pattern=_compile_pattern(
                general_aliases,
                flags=re.IGNORECASE | re.UNICODE,
            ),
            conventional_pattern=_compile_pattern(
                conventional_spellings,
                flags=re.UNICODE,
            ),
        )

    def extract(
        self,
        text: str,
        *,
        limit: int = _MAX_EXTRACTED_SKILLS,
    ) -> tuple[str, ...]:
        """Return sorted canonical skills after non-overlapping span matching."""

        if not isinstance(text, str):
            raise TypeError("skill extraction text must be a string")
        if isinstance(limit, bool) or not isinstance(limit, int) or limit <= 0:
            raise ValueError("skill extraction limit must be a positive integer")

        normalized_text = _normalize_text(text)
        candidates: list[_Candidate] = []
        candidates.extend(
            self._find_candidates(normalized_text, self.general_pattern)
        )
        candidates.extend(
            self._find_candidates(normalized_text, self.conventional_pattern)
        )
        candidates.sort(
            key=lambda candidate: (
                candidate.start,
                -(candidate.end - candidate.start),
                candidate.alias,
                candidate.canonical,
            )
        )

        selected: list[_Candidate] = []
        last_end = -1
        for candidate in candidates:
            if candidate.start < last_end:
                continue
            selected.append(candidate)
            last_end = candidate.end

        canonical_values = sorted(
            {candidate.canonical for candidate in selected}
        )
        return tuple(canonical_values[:limit])

    def _find_candidates(
        self,
        text: str,
        pattern: re.Pattern[str] | None,
    ) -> list[_Candidate]:
        if pattern is None:
            return []

        candidates: list[_Candidate] = []
        for match in pattern.finditer(text):
            alias = normalize_skill(match.group(0))
            canonical = self.catalog.alias_to_canonical[alias]
            candidates.append(
                _Candidate(
                    start=match.start(),
                    end=match.end(),
                    alias=alias,
                    canonical=canonical,
                )
            )
        return candidates


def _compile_pattern(
    values: list[str],
    *,
    flags: re.RegexFlag,
) -> re.Pattern[str] | None:
    if not values:
        return None
    alternatives = "|".join(
        re.escape(value)
        for value in sorted(set(values), key=lambda value: (-len(value), value))
    )
    return re.compile(
        rf"(?<!\w)(?:{alternatives})(?!\w)",
        flags=flags,
    )


def _normalize_text(text: str) -> str:
    normalized = unicodedata.normalize("NFC", text)
    normalized = " ".join(normalized.split())
    return unicodedata.normalize("NFC", normalized)
