"""Safe, resumable API-based bulk student registration and CV upload tool."""

from pathlib import Path

EMAIL_PREFIX = "n22dccn"
EMAIL_DOMAIN = "gmail.com"
DEFAULT_PASSWORD = "000000"
DEFAULT_BASE_URL = "http://127.0.0.1:8080"
DEFAULT_INPUT_DIR = Path(r"C:\Users\HP\Downloads\Tốt nghiệp\tltk tn\dataset\cv_pdf_output")
DEFAULT_RUNS_DIR = Path(__file__).resolve().parent / "runs"

# Matches Backend application.yml & CvServiceImpl limits exactly
MAX_CV_FILE_BYTES = 10_485_760
MAX_FILENAME_LENGTH = 255

DEFAULT_CONCURRENCY = 6
DEFAULT_TIMEOUT_SECONDS = 30.0
DEFAULT_MAX_RETRIES = 4
PDF_MAGIC_PREFIX = b"%PDF-"


def format_student_identity(index: int) -> tuple[str, str]:
    """Return (email, full_name) for 0-based index i using zero-padded 4+ digits."""
    if index < 0:
        raise ValueError(f"Index must be non-negative, got {index}")
    local_part = f"{EMAIL_PREFIX}{index:04d}"
    return f"{local_part}@{EMAIL_DOMAIN}", local_part
