"""Unit tests for deterministic PDF scanning, Unicode paths, and validation."""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.bulk_ingest import MAX_CV_FILE_BYTES, format_student_identity
import scripts.bulk_ingest.scanner as scanner_module
from scripts.bulk_ingest.scanner import (
    inspect_pdf_file,
    sanitize_cv_filename,
    scan_pdf_directory,
)

_MINIMAL_PDF = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"


def test_format_student_identity_zero_padded_and_beyond_10000() -> None:
    assert format_student_identity(0) == ("n22dccn0000@gmail.com", "n22dccn0000")
    assert format_student_identity(42) == ("n22dccn0042@gmail.com", "n22dccn0042")
    assert format_student_identity(5432) == ("n22dccn5432@gmail.com", "n22dccn5432")
    assert format_student_identity(10000) == ("n22dccn10000@gmail.com", "n22dccn10000")


def test_scan_handles_vietnamese_unicode_spaces_and_nested_sorting(tmp_path: Path) -> None:
    root = tmp_path / "Tốt nghiệp" / "tltk tn" / "cv_pdf_output"
    sub_b = root / "Nhóm B"
    sub_a = root / "nhóm a"
    sub_b.mkdir(parents=True)
    sub_a.mkdir(parents=True)

    (root / "ignore.txt").write_text("not a pdf", encoding="utf-8")
    (sub_b / "CV Nguyễn Văn B.pdf").write_bytes(_MINIMAL_PDF)
    (sub_a / "01 First File.PDF").write_bytes(_MINIMAL_PDF)
    (root / "a_root.pdf").write_bytes(_MINIMAL_PDF)

    summary = scan_pdf_directory([root], start_index=0)

    assert summary.total_files == 3
    assert summary.valid_files == 3
    assert summary.invalid_files == 0
    assert [item.rel_path for item in summary.items] == [
        "a_root.pdf",
        "nhóm a/01 First File.PDF",
        "Nhóm B/CV Nguyễn Văn B.pdf",
    ]
    assert [item.email for item in summary.items] == [
        "n22dccn0000@gmail.com",
        "n22dccn0001@gmail.com",
        "n22dccn0002@gmail.com",
    ]
    assert summary.items[2].sanitized_name == "CV_Nguy_n_V_n_B.pdf"


def test_scan_flags_invalid_pdf_header_empty_and_oversized(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = tmp_path / "cvs"
    root.mkdir()
    (root / "01_valid.pdf").write_bytes(_MINIMAL_PDF)
    (root / "02_empty.pdf").write_bytes(b"")
    (root / "03_not_pdf.pdf").write_bytes(b"NOT_A_PDF_DOCUMENT")
    (root / "04_too_big.pdf").write_bytes(b"%PDF-" + b"0" * MAX_CV_FILE_BYTES)
    long_file = root / ("05_" + "a" * 24 + ".pdf")
    long_file.write_bytes(_MINIMAL_PDF)

    summary = scan_pdf_directory([root], start_index=5)

    assert summary.total_files == 5
    assert summary.valid_files == 2
    assert summary.invalid_files == 3
    assert summary.items[0].idx == 5
    assert summary.items[0].is_valid
    assert summary.items[1].validation_error and "EMPTY_FILE" in summary.items[1].validation_error
    assert summary.items[2].validation_error and "INVALID_PDF_HEADER" in summary.items[2].validation_error
    assert summary.items[3].validation_error and "FILE_TOO_LARGE" in summary.items[3].validation_error

    monkeypatch.setattr(scanner_module, "MAX_FILENAME_LENGTH", 20)
    _, _, long_err = inspect_pdf_file(long_file)
    assert long_err is not None and "FILENAME_TOO_LONG" in long_err


def test_scan_supports_multiple_input_dirs_without_collision(tmp_path: Path) -> None:
    dir_a = tmp_path / "batch1"
    dir_b = tmp_path / "batch2"
    dir_a.mkdir()
    dir_b.mkdir()
    (dir_a / "resume.pdf").write_bytes(_MINIMAL_PDF)
    (dir_b / "resume.pdf").write_bytes(_MINIMAL_PDF)

    summary = scan_pdf_directory([dir_a, dir_b])

    assert [item.rel_path for item in summary.items] == [
        "dir0/resume.pdf",
        "dir1/resume.pdf",
    ]


def test_sanitize_cv_filename_matches_backend_regex() -> None:
    assert sanitize_cv_filename("CV (2026) - Trần Anh.pdf") == "CV__2026__-_Tr_n_Anh.pdf"
    with pytest.raises(ValueError):
        format_student_identity(-1)
