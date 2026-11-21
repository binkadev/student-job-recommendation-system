"""SQLite-backed Incremental Document Frequency (DF) state store.

Maintains exact global corpus statistics without re-scanning or re-processing
unchanged documents:
- ``meta``: global ``total_docs`` (N), ``nlp_model_hash``, sync watermarks
- ``doc_index``: per-document ``(doc_key, doc_type, content_hash, terms_blob)``
- ``term_df``: exact global ``term -> document_frequency`` counts

Every INSERT, UPDATE, and DELETE mutates ``total_docs`` and ``term_df`` via
exact delta arithmetic inside an ACID SQLite transaction.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import sqlite3
import zlib


SCHEMA_VERSION = "1"
BOOTSTRAP_DOC_TYPES = frozenset({"bootstrap_cv", "bootstrap_job"})
LIVE_DOC_TYPES = frozenset({"cv", "job"})


@dataclass(frozen=True, slots=True)
class DeltaStats:
    """Summary of one incremental update batch."""

    inserted: int = 0
    updated: int = 0
    unchanged: int = 0
    deleted: int = 0


def extract_unique_ngrams(
    processed_text: str,
    *,
    ngram_range: tuple[int, int] = (1, 1),
) -> frozenset[str]:
    """Extract the exact unique n-gram set matching whitespace CountVectorizer."""

    tokens = processed_text.split()
    if not tokens:
        return frozenset()

    min_n, max_n = ngram_range
    if min_n < 1 or max_n < min_n:
        raise ValueError("ngram_range must satisfy 1 <= min_n <= max_n")

    terms: set[str] = set()
    token_count = len(tokens)
    for n in range(min_n, max_n + 1):
        if n > token_count:
            break
        if n == 1:
            terms.update(tokens)
        else:
            for index in range(token_count - n + 1):
                terms.add(" ".join(tokens[index : index + n]))
    return frozenset(terms)


def compute_content_hash(text: str) -> str:
    """Deterministic SHA-256 content fingerprint for change detection."""

    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _compress_terms(terms: frozenset[str]) -> bytes:
    payload = json.dumps(sorted(terms), separators=(",", ":")).encode("utf-8")
    return zlib.compress(payload, level=6)


def _decompress_terms(blob: bytes) -> frozenset[str]:
    raw = zlib.decompress(blob).decode("utf-8")
    return frozenset(json.loads(raw))


class IncrementalDfStore:
    """Persistent ACID state store for global Incremental DF counters."""

    def __init__(self, state_path: Path) -> None:
        self.state_path = Path(state_path)
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(self.state_path))
        self._conn.execute("PRAGMA journal_mode=WAL;")
        self._conn.execute("PRAGMA synchronous=NORMAL;")
        self._ensure_schema()

    def close(self) -> None:
        self._conn.close()

    def __enter__(self) -> IncrementalDfStore:
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    def _ensure_schema(self) -> None:
        with self._conn:
            self._conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS meta (
                    key   TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS doc_index (
                    doc_key      TEXT PRIMARY KEY,
                    doc_type     TEXT NOT NULL,
                    content_hash TEXT NOT NULL,
                    terms_blob   BLOB NOT NULL,
                    updated_at   TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_doc_index_type
                    ON doc_index (doc_type);
                CREATE TABLE IF NOT EXISTS term_df (
                    term TEXT PRIMARY KEY,
                    df   INTEGER NOT NULL CHECK (df > 0)
                );
                """
            )
            self._conn.execute(
                "INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', ?)",
                (SCHEMA_VERSION,),
            )
            self._conn.execute(
                "INSERT OR IGNORE INTO meta (key, value) VALUES ('total_docs', '0')"
            )

    def reset(self, *, nlp_model_hash: str) -> None:
        """Clear all indexed documents and counters for a clean rebuild."""

        with self._conn:
            self._conn.execute("DELETE FROM doc_index")
            self._conn.execute("DELETE FROM term_df")
            self._conn.execute("DELETE FROM meta")
            self._conn.executemany(
                "INSERT INTO meta (key, value) VALUES (?, ?)",
                [
                    ("schema_version", SCHEMA_VERSION),
                    ("total_docs", "0"),
                    ("nlp_model_hash", nlp_model_hash),
                ],
            )

    def get_meta(self, key: str, default: str | None = None) -> str | None:
        row = self._conn.execute(
            "SELECT value FROM meta WHERE key = ?",
            (key,),
        ).fetchone()
        return default if row is None else str(row[0])

    def set_meta(self, key: str, value: str) -> None:
        with self._conn:
            self._conn.execute(
                "INSERT INTO meta (key, value) VALUES (?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (key, value),
            )

    def total_docs(self) -> int:
        return int(self.get_meta("total_docs", "0") or "0")

    def count_by_doc_types(self, doc_types: Iterable[str]) -> int:
        types = tuple(doc_types)
        if not types:
            return 0
        placeholders = ",".join("?" for _ in types)
        row = self._conn.execute(
            f"SELECT COUNT(*) FROM doc_index WHERE doc_type IN ({placeholders})",
            types,
        ).fetchone()
        return int(row[0]) if row is not None else 0

    def get_content_hash(self, doc_key: str) -> str | None:
        row = self._conn.execute(
            "SELECT content_hash FROM doc_index WHERE doc_key = ?",
            (doc_key,),
        ).fetchone()
        return None if row is None else str(row[0])

    def list_doc_keys(self, *, doc_type: str) -> set[str]:
        rows = self._conn.execute(
            "SELECT doc_key FROM doc_index WHERE doc_type = ?",
            (doc_type,),
        ).fetchall()
        return {str(row[0]) for row in rows}

    def upsert_document(
        self,
        *,
        doc_key: str,
        doc_type: str,
        content_hash: str,
        processed_text: str,
        updated_at: str,
        ngram_range: tuple[int, int] = (1, 1),
    ) -> str:
        """Apply an atomic INSERT or UPDATE delta for one document.

        Returns ``'inserted'``, ``'updated'``, or ``'unchanged'``.
        """

        new_terms = extract_unique_ngrams(
            processed_text,
            ngram_range=ngram_range,
        )
        if not new_terms:
            deleted = self.delete_document(doc_key)
            return "deleted" if deleted else "unchanged"

        existing = self._conn.execute(
            "SELECT content_hash, terms_blob FROM doc_index WHERE doc_key = ?",
            (doc_key,),
        ).fetchone()

        if existing is not None and str(existing[0]) == content_hash:
            return "unchanged"

        with self._conn:
            if existing is None:
                self._apply_term_deltas(added=new_terms, removed=frozenset())
                self._conn.execute(
                    "INSERT INTO doc_index "
                    "(doc_key, doc_type, content_hash, terms_blob, updated_at) "
                    "VALUES (?, ?, ?, ?, ?)",
                    (
                        doc_key,
                        doc_type,
                        content_hash,
                        _compress_terms(new_terms),
                        updated_at,
                    ),
                )
                self._adjust_total_docs(1)
                return "inserted"

            old_terms = _decompress_terms(bytes(existing[1]))
            added = new_terms - old_terms
            removed = old_terms - new_terms
            self._apply_term_deltas(added=added, removed=removed)
            self._conn.execute(
                "UPDATE doc_index "
                "SET doc_type = ?, content_hash = ?, terms_blob = ?, updated_at = ? "
                "WHERE doc_key = ?",
                (
                    doc_type,
                    content_hash,
                    _compress_terms(new_terms),
                    updated_at,
                    doc_key,
                ),
            )
            return "updated"

    def delete_document(self, doc_key: str) -> bool:
        """Subtract one removed/deactivated document from global DF counters."""

        existing = self._conn.execute(
            "SELECT terms_blob FROM doc_index WHERE doc_key = ?",
            (doc_key,),
        ).fetchone()
        if existing is None:
            return False

        old_terms = _decompress_terms(bytes(existing[0]))
        with self._conn:
            self._apply_term_deltas(added=frozenset(), removed=old_terms)
            self._conn.execute(
                "DELETE FROM doc_index WHERE doc_key = ?",
                (doc_key,),
            )
            self._adjust_total_docs(-1)
        return True

    def delete_by_doc_types(self, doc_types: Iterable[str]) -> int:
        """Remove all documents of the given doc_types cleanly."""

        deleted = 0
        for doc_type in tuple(doc_types):
            for doc_key in sorted(self.list_doc_keys(doc_type=doc_type)):
                if self.delete_document(doc_key):
                    deleted += 1
        return deleted

    def read_term_df(self) -> dict[str, int]:
        """Return the complete exact global ``term -> df`` dictionary."""

        rows = self._conn.execute(
            "SELECT term, df FROM term_df WHERE df > 0 ORDER BY term ASC"
        ).fetchall()
        return {str(term): int(df) for term, df in rows}

    def _adjust_total_docs(self, delta: int) -> None:
        current = self.total_docs()
        updated = current + delta
        if updated < 0:
            raise RuntimeError("total_docs counter underflowed below 0")
        self._conn.execute(
            "INSERT INTO meta (key, value) VALUES ('total_docs', ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (str(updated),),
        )

    def _apply_term_deltas(
        self,
        *,
        added: frozenset[str],
        removed: frozenset[str],
    ) -> None:
        if added:
            self._conn.executemany(
                "INSERT INTO term_df (term, df) VALUES (?, 1) "
                "ON CONFLICT(term) DO UPDATE SET df = df + 1",
                [(term,) for term in added],
            )
        if removed:
            self._conn.executemany(
                "DELETE FROM term_df WHERE term = ? AND df <= 1",
                [(term,) for term in removed],
            )
            self._conn.executemany(
                "UPDATE term_df SET df = df - 1 WHERE term = ? AND df > 1",
                [(term,) for term in removed],
            )

    def verify_integrity(self) -> Mapping[str, int]:
        """Verify stored total_docs matches doc_index row count."""

        actual_docs = int(
            self._conn.execute("SELECT COUNT(*) FROM doc_index").fetchone()[0]
        )
        stored_docs = self.total_docs()
        if actual_docs != stored_docs:
            raise RuntimeError(
                f"State store total_docs ({stored_docs}) != doc_index count ({actual_docs})"
            )
        vocab_size = int(
            self._conn.execute("SELECT COUNT(*) FROM term_df").fetchone()[0]
        )
        return {"totalDocs": actual_docs, "rawVocabSize": vocab_size}


__all__ = [
    "BOOTSTRAP_DOC_TYPES",
    "DeltaStats",
    "IncrementalDfStore",
    "LIVE_DOC_TYPES",
    "SCHEMA_VERSION",
    "compute_content_hash",
    "extract_unique_ngrams",
]
