"""Safe, resumable API-based bulk Company verification and Job CSV ingestion tool."""

from pathlib import Path

COMPANY_EMAIL_PREFIX = "ptithcm"
COMPANY_EMAIL_DOMAIN = "gmail.com"
DEFAULT_COMPANY_PASSWORD = "000000"

DEFAULT_ADMIN_EMAIL = "admin@example.com"
DEFAULT_ADMIN_PASSWORD = "123456"

DEFAULT_BASE_URL = "http://127.0.0.1:8080"
DEFAULT_CSV_PATH = Path(
    r"C:\Users\HP\Downloads\Tốt nghiệp\tltk tn\dataset\job\job.csv"
)
DEFAULT_SKILL_CATALOG_PATH = (
    Path(__file__).resolve().parents[2]
    / "ai-service"
    / "resources"
    / "skill_catalog.v1.json"
)
DEFAULT_RUNS_DIR = Path(__file__).resolve().parent / "runs"

# Backend CreateJobRequest / RegisterRequest / DB constraints
MAX_TITLE_AND_COMPANY_NAME_LENGTH = 255
MAX_LONG_TEXT_LENGTH = 10_000

# Approved default shared job fields
DEFAULT_LOCATION = "Ho Chi Minh City"
DEFAULT_JOB_TYPE = "FULL_TIME"
DEFAULT_WORKING_MODEL = "ONSITE"

DEFAULT_COMPANY_CONCURRENCY = 6
DEFAULT_JOB_CONCURRENCY = 8
DEFAULT_TIMEOUT_SECONDS = 30.0
DEFAULT_MAX_RETRIES = 4


def format_company_identity(index: int) -> tuple[str, str]:
    """Return (email, full_name) for 0-based company index i."""
    if index < 0:
        raise ValueError(f"Company index must be >= 0, got {index}")
    local_part = f"{COMPANY_EMAIL_PREFIX}{index:04d}"
    return f"{local_part}@{COMPANY_EMAIL_DOMAIN}", local_part
