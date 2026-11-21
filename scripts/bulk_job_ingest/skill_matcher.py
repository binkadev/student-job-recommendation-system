"""Canonical IT skill matcher and Backend /api/skills catalog synchronizer."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
import json
from pathlib import Path
import re
from typing import Protocol
import unicodedata

# Exact conventional casing required for short ambiguous aliases (matches ai-service).
_CONVENTIONAL_SHORT_ALIASES: dict[str, tuple[str, ...]] = {
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


class SkillApiClient(Protocol):
    def list_skills_page(
        self, *, token: str, page: int, size: int = 100
    ) -> tuple[list[dict[str, object]], int]: ...

    def create_skill_as_admin(
        self, *, token: str, name: str, category: str
    ) -> dict[str, object]: ...


def _normalize_text(text: str) -> str:
    normalized = unicodedata.normalize("NFC", text)
    normalized = " ".join(normalized.split())
    return unicodedata.normalize("NFC", normalized)


def _normalize_skill_name(skill: str) -> str:
    return _normalize_text(skill).casefold()


def _compile_flat_pattern(
    values: list[str], *, flags: re.RegexFlag
) -> re.Pattern[str] | None:
    if not values:
        return None
    alternatives = "|".join(
        re.escape(value)
        for value in sorted(set(values), key=lambda item: (-len(item), item))
    )
    return re.compile(rf"(?<!\w)(?:{alternatives})(?!\w)", flags=flags)


def _compile_pattern(
    values: list[str], *, flags: re.RegexFlag
) -> re.Pattern[str] | None:
    """Compile a boundary-aware prefix-trie regex equivalent to longest-first alternation."""
    unique = sorted(set(values))
    if not unique:
        return None

    trie: dict[str, dict] = {}
    for word in unique:
        node = trie
        for ch in word:
            node = node.setdefault(ch, {})
        node[""] = {}

    def _emit(node: dict[str, dict]) -> str:
        has_end = "" in node
        children = [k for k in node if k != ""]
        if not children:
            return ""
        parts = [re.escape(k) + _emit(node[k]) for k in sorted(children)]
        body = parts[0] if len(parts) == 1 else "(?:" + "|".join(parts) + ")"
        if has_end:
            return f"(?:{body})?"
        return body

    # Increase recursion check only implicitly via iterative/shallow phrase depth (<=150).
    return re.compile(rf"(?<!\w)(?:{_emit(trie)})(?!\w)", flags=flags)


@dataclass(frozen=True, slots=True)
class CatalogEntry:
    canonical: str
    aliases: tuple[str, ...]


class CanonicalSkillMatcher:
    """Leftmost-longest deterministic IT skill extractor aligned with ai-service."""

    def __init__(self, entries: tuple[CatalogEntry, ...]) -> None:
        self.entries = entries
        self.canonical_names = tuple(entry.canonical for entry in entries)
        alias_to_canonical: dict[str, str] = {}
        for entry in entries:
            norm_canon = _normalize_skill_name(entry.canonical)
            alias_to_canonical[norm_canon] = norm_canon
            for alias in entry.aliases:
                alias_to_canonical[_normalize_skill_name(alias)] = norm_canon

        self._alias_to_canonical = alias_to_canonical
        general_aliases = [
            alias
            for alias in alias_to_canonical
            if alias not in _CONVENTIONAL_SHORT_ALIASES
        ]
        conventional_spellings = [
            spelling
            for alias in sorted(_CONVENTIONAL_SHORT_ALIASES)
            if alias in alias_to_canonical
            for spelling in _CONVENTIONAL_SHORT_ALIASES[alias]
        ]
        self._general_pattern = _compile_pattern(
            general_aliases, flags=re.IGNORECASE | re.UNICODE
        )
        self._conventional_pattern = _compile_pattern(
            conventional_spellings, flags=re.UNICODE
        )

    @classmethod
    def from_catalog_file(cls, catalog_path: Path) -> CanonicalSkillMatcher:
        payload = json.loads(Path(catalog_path).read_text(encoding="utf-8"))
        raw_skills = payload.get("skills")
        if not isinstance(raw_skills, list) or not raw_skills:
            raise ValueError(f"Invalid skill catalog: {catalog_path}")
        entries: list[CatalogEntry] = []
        for item in raw_skills:
            canonical = _normalize_skill_name(str(item["canonical"]))
            aliases = tuple(
                _normalize_skill_name(str(alias)) for alias in item.get("aliases", [])
            )
            entries.append(CatalogEntry(canonical=canonical, aliases=aliases))
        return cls(tuple(entries))

    def extract_canonical_skills(
        self, text: str, *, limit: int = 100
    ) -> tuple[str, ...]:
        """Extract deduplicated sorted canonical skill names from job text."""
        if not text.strip():
            return ()
        normalized = _normalize_text(text)
        candidates: list[tuple[int, int, str, str]] = []
        for pattern in (self._general_pattern, self._conventional_pattern):
            if pattern is None:
                continue
            for match in pattern.finditer(normalized):
                alias = _normalize_skill_name(match.group(0))
                canonical = self._alias_to_canonical.get(alias)
                if canonical is not None:
                    candidates.append(
                        (match.start(), match.end(), alias, canonical)
                    )

        candidates.sort(key=lambda item: (item[0], -(item[1] - item[0]), item[2], item[3]))
        selected: set[str] = set()
        last_end = -1
        for start, end, _alias, canonical in candidates:
            if start < last_end:
                continue
            selected.add(canonical)
            last_end = end
        return tuple(sorted(selected)[:limit])


def fetch_catalog_skill_map(
    client: SkillApiClient,
    *,
    admin_token: str,
) -> dict[str, int]:
    """Fetch all existing skills from GET /api/skills indexed by normalized name."""
    skill_map: dict[str, int] = {}
    page = 1
    while True:
        list_fn = getattr(client, "list_skills_page_as_admin", None)
        if callable(list_fn):
            items, total_pages = list_fn(page=page, size=100)
        else:
            items, total_pages = client.list_skills_page(
                token=admin_token, page=page, size=100
            )
        for row in items:
            raw_id = row.get("id")
            raw_norm = row.get("normalizedName") or row.get("name")
            if raw_id is not None and isinstance(raw_norm, str):
                skill_map[_normalize_skill_name(raw_norm)] = int(raw_id)
        if page >= max(1, total_pages):
            break
        page += 1
    return skill_map


def sync_catalog_skills(
    client: SkillApiClient,
    *,
    admin_token: str,
    matcher: CanonicalSkillMatcher,
    category: str = "IT",
    concurrency: int = 1,
) -> dict[str, int]:
    """Fetch existing skills via GET /api/skills and seed missing canonical entries."""
    skill_map = fetch_catalog_skill_map(client, admin_token=admin_token)
    missing_names = [
        canonical
        for canonical in matcher.canonical_names
        if _normalize_skill_name(canonical) not in skill_map
    ]
    if not missing_names:
        return skill_map

    need_refresh = False
    create_as_admin_fn = getattr(client, "create_skill_as_admin_auto", None)

    def _create_one(canonical: str) -> tuple[str, int | None, bool]:
        try:
            if callable(create_as_admin_fn):
                created = create_as_admin_fn(name=canonical, category=category)
            else:
                created = client.create_skill_as_admin(
                    token=admin_token, name=canonical, category=category
                )
            raw_id = created.get("id")
            return _normalize_skill_name(canonical), (None if raw_id is None else int(raw_id)), False
        except Exception as exc:
            msg = str(exc).lower()
            if "already exists" in msg or "400" in msg:
                return _normalize_skill_name(canonical), None, True
            raise

    if concurrency <= 1:
        for canonical in missing_names:
            key, sid, conflict = _create_one(canonical)
            if sid is not None:
                skill_map[key] = sid
            if conflict:
                need_refresh = True
    else:
        with ThreadPoolExecutor(max_workers=concurrency) as executor:
            futures = [executor.submit(_create_one, name) for name in missing_names]
            for fut in as_completed(futures):
                key, sid, conflict = fut.result()
                if sid is not None:
                    skill_map[key] = sid
                if conflict:
                    need_refresh = True

    if need_refresh:
        skill_map.update(fetch_catalog_skill_map(client, admin_token=admin_token))

    missing = [
        canonical
        for canonical in matcher.canonical_names
        if _normalize_skill_name(canonical) not in skill_map
    ]
    if missing:
        raise RuntimeError(
            f"Skill sync failed; still missing canonical skills in Backend: {missing}"
        )
    return skill_map
