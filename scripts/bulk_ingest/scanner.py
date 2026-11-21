"""Deterministic PDF scanner and preflight validator."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
from pathlib import Path
import re
from typing import Sequence

from . import (
    MAX_CV_FILE_BYTES,
    MAX_FILENAME_LENGTH,
    PDF_MAGIC_PREFIX,
    format_student_identity,
)

_FILENAME_SANITIZE_PATTERN = re.compile(r"[^A-Za-z0-9._-]")
_HASH_CHUNK_BYTES = 65_536


@dataclass(frozen=True, slots=True)
class ScannedPdf:
    """One deterministically indexed local PDF candidate."""

    idx: int
    email: str
    full_name: str
    rel_path: str
    abs_path: str
    sanitized_name: str
    file_size: int
    sha256: str
    validation_error: str | None = None

    @property
    def is_valid(self) -> bool:
        return self.validation_error is None


@dataclass(frozen=True, slots=True)
class ScanSummary:
    """Preflight inventory metrics over scanned PDFs."""

    items: tuple[ScannedPdf, ...]
    total_files: int
    valid_files: int
    invalid_files: int
    total_bytes: int


def sanitize_cv_filename(filename: str) -> str:
    """Mirror Backend CvServiceImpl.sanitizeFileName replacement rule."""
    basename = Path(filename).name
    return _FILENAME_SANITIZE_PATTERN.sub("_", basename)


def inspect_pdf_file(path: Path) -> tuple[int, str, str | None]:
    """Return (file_size, sha256, validation_error) by streaming the file once."""
    try:
        stat = path.stat()
    except OSError as exc:
        return 0, "", f"UNREADABLE_FILE: {exc}"

    file_size = stat.st_size
    if file_size <= 0:
        return 0, "", "EMPTY_FILE: file size is 0 bytes"
    if file_size > MAX_CV_FILE_BYTES:
        return (
            file_size,
            "",
            f"FILE_TOO_LARGE: {file_size} bytes exceeds {MAX_CV_FILE_BYTES} limit",
        )

    sanitized_name = sanitize_cv_filename(path.name)
    if not sanitized_name or len(sanitized_name) > MAX_FILENAME_LENGTH:
        return (
            file_size,
            "",
            f"FILENAME_TOO_LONG: sanitized length {len(sanitized_name)} > {MAX_FILENAME_LENGTH}",
        )

    digest = hashlib.sha256()
    header = b""
    try:
        with path.open("rb") as stream:
            first_chunk = stream.read(_HASH_CHUNK_BYTES)
            header = first_chunk[: len(PDF_MAGIC_PREFIX)]
            if header != PDF_MAGIC_PREFIX:
                return (
                    file_size,
                    "",
                    "INVALID_PDF_HEADER: missing %PDF- magic bytes",
                )
            digest.update(first_chunk)
            while chunk := stream.read(_HASH_CHUNK_BYTES):
                digest.update(chunk)
    except OSError as exc:
        return file_size, "", f"UNREADABLE_FILE: {exc}"

    return file_size, digest.hexdigest(), None


def scan_pdf_directory(
    input_dirs: Sequence[Path],
    *,
    start_index: int = 0,
) -> ScanSummary:
    """Scan one or more directories recursively and index PDFs deterministically."""
    if not input_dirs:
        raise ValueError("At least one input directory is required")
    if start_index < 0:
        raise ValueError("start_index must be >= 0")

    resolved_roots: list[Path] = []
    for raw_dir in input_dirs:
        root = Path(raw_dir).expanduser().resolve()
        if not root.exists():
            raise FileNotFoundError(f"Input directory does not exist: {root}")
        if not root.is_dir():
            raise NotADirectoryError(f"Input path is not a directory: {root}")
        resolved_roots.append(root)

    multi_root = len(resolved_roots) > 1
    candidates: list[tuple[str, str, Path]] = []
    for root_idx, root in enumerate(resolved_roots):
        for candidate in root.rglob("*"):
            if not candidate.is_file():
                continue
            if candidate.suffix.casefold() != ".pdf":
                continue
            rel = candidate.relative_to(root).as_posix()
            rel_key = f"dir{root_idx}/{rel}" if multi_root else rel
            candidates.append((rel_key.casefold(), rel_key, candidate))

    candidates.sort(key=lambda entry: (entry[0], entry[1]))

    scanned: list[ScannedPdf] = []
    valid_count = 0
    invalid_count = 0
    total_bytes = 0

    for offset, (_, rel_key, path) in enumerate(candidates):
        idx = start_index + offset
        email, full_name = format_student_identity(idx)
        sanitized_name = sanitize_cv_filename(path.name)
        file_size, sha256_hex, validation_error = inspect_pdf_file(path)
        total_bytes += file_size
        if validation_error is None:
            valid_count += 1
        else:
            invalid_count += 1
        scanned.append(
            ScannedPdf(
                idx=idx,
                email=email,
                full_name=full_name,
                rel_path=rel_key,
                abs_path=str(path),
                sanitized_name=sanitized_name,
                file_size=file_size,
                sha256=sha256_hex,
                validation_error=validation_error,
            )
        )

    return ScanSummary(
        items=tuple(scanned),
        total_files=len(scanned),
        valid_files=valid_count,
        invalid_files=invalid_count,
        total_bytes=total_bytes,
    )
