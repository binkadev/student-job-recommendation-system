"""Deterministic, fixed-lexicon language detection for AI service V2."""

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
import re
import unicodedata

from .job_document import parse_job_document
from .schemas import LanguageCode


# Fixed natural-language evidence only. Technical and product names are
# intentionally absent so that an IT stack cannot decide a document's language.
ENGLISH_SIGNAL_WORDS = frozenset(
    {
        "a",
        "an",
        "and",
        "are",
        "as",
        "at",
        "be",
        "been",
        "but",
        "by",
        "for",
        "from",
        "has",
        "have",
        "if",
        "in",
        "is",
        "its",
        "not",
        "of",
        "on",
        "or",
        "our",
        "should",
        "that",
        "the",
        "their",
        "this",
        "to",
        "we",
        "when",
        "which",
        "who",
        "will",
        "with",
        "you",
        "your",
    }
)

# High-specificity resume and Job markers contribute two evidence points each.
# Inflections are explicit: there is no stemming, fuzzy match, or model lookup.
ENGLISH_RESUME_MARKER_WORDS = frozenset(
    {
        "build",
        "built",
        "degree",
        "design",
        "develop",
        "developed",
        "education",
        "experience",
        "knowledge",
        "maintain",
        "project",
        "projects",
        "qualifications",
        "responsibilities",
    }
)

# Role nouns are evidence only in these checked-in phrases; isolated domain
# nouns cannot make technical/title-only input confidently English.
ENGLISH_RESUME_MARKER_PHRASES = frozenset(
    {
        ("backend", "developer"),
        ("backend", "developers"),
        ("software", "engineer"),
        ("software", "engineers"),
    }
)

VIETNAMESE_SIGNAL_WORDS = frozenset(
    {
        # Accented function words.
        "bạn",
        "bằng",
        "các",
        "cho",
        "chúng",
        "có",
        "của",
        "đang",
        "để",
        "đó",
        "được",
        "hoặc",
        "không",
        "khi",
        "là",
        "làm",
        "mà",
        "một",
        "này",
        "như",
        "những",
        "phải",
        "sẽ",
        "theo",
        "tôi",
        "trong",
        "từ",
        "và",
        "về",
        "với",
        # Checked-in no-accent Vietnamese signals. Ambiguous English tokens
        # such as "can" and "to" are deliberately excluded.
        "ban",
        "bang",
        "cac",
        "cho",
        "chung",
        "co",
        "cong",
        "cua",
        "dang",
        "de",
        "do",
        "duoc",
        "hoac",
        "khong",
        "khi",
        "kiem",
        "kinh",
        "la",
        "lam",
        "lap",
        "ma",
        "mot",
        "nang",
        "nay",
        "nghiem",
        "nguoi",
        "nhom",
        "nhu",
        "nhung",
        "phai",
        "se",
        "theo",
        "tim",
        "trinh",
        "trong",
        "tu",
        "va",
        "ve",
        "viec",
        "vien",
        "voi",
    }
)

# These exact, contiguous resume phrases work with and without Vietnamese
# diacritics. Each distinct phrase contributes two evidence points.
VIETNAMESE_RESUME_MARKER_PHRASES = frozenset(
    {
        ("dự", "án"),
        ("du", "an"),
        ("kinh", "nghiệm"),
        ("kinh", "nghiem"),
        ("kỹ", "năng"),
        ("ky", "nang"),
        ("kỹ", "sư"),
        ("ky", "su"),
        ("phần", "mềm"),
        ("phan", "mem"),
        ("phát", "triển"),
        ("phat", "trien"),
    }
)

_URL_PATTERN = re.compile(
    r"(?<!\w)(?:[a-z][a-z0-9+.-]*://|mailto:|www\.)\S+",
    flags=re.IGNORECASE,
)
_EMAIL_PATTERN = re.compile(
    r"(?<![\w.+-])[\w.+-]+@[\w-]+(?:\.[\w-]+)*(?![\w-])",
    flags=re.UNICODE,
)
_LONG_NUMERIC_IDENTIFIER_PATTERN = re.compile(
    r"(?<!\w)\d(?:[-._/]*\d){5,}(?!\w)"
)
_WORD_PATTERN = re.compile(r"[^\W_]+", flags=re.UNICODE)
_CONFIDENCE_QUANTUM = Decimal("0.00000001")
_MIN_SIGNAL_COUNT = 2
_FULL_STRENGTH_SIGNAL_COUNT = 6
_MIXED_MINORITY_SHARE = Decimal("0.25")
_RESUME_MARKER_WEIGHT = 2


@dataclass(frozen=True, slots=True)
class LanguageDetection:
    """Language label, confidence, and auditable integer evidence points."""

    language_code: LanguageCode
    confidence: float
    english_signal_count: int
    vietnamese_signal_count: int


def _sanitize_language_evidence(text: str) -> str:
    normalized = unicodedata.normalize(
        "NFC",
        text.replace("\r\n", "\n").replace("\r", "\n"),
    ).casefold()
    without_urls = _URL_PATTERN.sub(" ", normalized)
    without_emails = _EMAIL_PATTERN.sub(" ", without_urls)
    return _LONG_NUMERIC_IDENTIFIER_PATTERN.sub(" ", without_emails)


def _public_confidence(value: Decimal) -> float:
    clamped = min(max(value, Decimal("0")), Decimal("1"))
    return float(clamped.quantize(_CONFIDENCE_QUANTUM, rounding=ROUND_HALF_UP))


def _count_distinct_phrase_hits(
    tokens: tuple[str, ...],
    phrases: frozenset[tuple[str, ...]],
) -> int:
    """Count each exact contiguous phrase at most once."""

    return sum(
        any(
            tokens[index : index + len(phrase)] == phrase
            for index in range(len(tokens) - len(phrase) + 1)
        )
        for phrase in phrases
    )


def detect_language(text: str) -> LanguageDetection:
    """Classify natural-language evidence as en, vi, mixed, or unknown.

    English evidence is the number of distinct fixed function-word hits plus
    two points per distinct fixed resume-marker word or phrase. Vietnamese
    evidence is the number of distinct fixed word hits plus two points per
    distinct fixed resume-marker phrase. Confidence is a deterministic
    coverage-and-balance heuristic, not a statistical probability.
    """

    if not isinstance(text, str):
        raise TypeError("Language detection text must be a string")

    evidence = _sanitize_language_evidence(text)
    tokens = tuple(_WORD_PATTERN.findall(evidence))
    unique_tokens = frozenset(tokens)
    english_count = (
        len(unique_tokens & ENGLISH_SIGNAL_WORDS)
        + _RESUME_MARKER_WEIGHT
        * (
            len(unique_tokens & ENGLISH_RESUME_MARKER_WORDS)
            + _count_distinct_phrase_hits(
                tokens,
                ENGLISH_RESUME_MARKER_PHRASES,
            )
        )
    )
    vietnamese_count = (
        len(unique_tokens & VIETNAMESE_SIGNAL_WORDS)
        + _RESUME_MARKER_WEIGHT
        * _count_distinct_phrase_hits(
            tokens,
            VIETNAMESE_RESUME_MARKER_PHRASES,
        )
    )
    total = english_count + vietnamese_count

    if total < _MIN_SIGNAL_COUNT:
        return LanguageDetection(
            language_code=LanguageCode.UNKNOWN,
            confidence=0.0,
            english_signal_count=english_count,
            vietnamese_signal_count=vietnamese_count,
        )

    total_decimal = Decimal(total)
    strength = min(
        total_decimal / Decimal(_FULL_STRENGTH_SIGNAL_COUNT),
        Decimal("1"),
    )
    dominant_count = max(english_count, vietnamese_count)
    minority_count = min(english_count, vietnamese_count)
    dominant_share = Decimal(dominant_count) / total_decimal
    minority_share = Decimal(minority_count) / total_decimal

    if (
        english_count >= _MIN_SIGNAL_COUNT
        and vietnamese_count >= _MIN_SIGNAL_COUNT
        and minority_share >= _MIXED_MINORITY_SHARE
    ):
        language_code = LanguageCode.MIXED
        confidence = Decimal("2") * minority_share * strength
    elif english_count and vietnamese_count and dominant_share < Decimal("0.65"):
        language_code = LanguageCode.MIXED
        confidence = Decimal("2") * minority_share * strength
    else:
        language_code = (
            LanguageCode.ENGLISH
            if english_count > vietnamese_count
            else LanguageCode.VIETNAMESE
        )
        confidence = dominant_share * strength

    return LanguageDetection(
        language_code=language_code,
        confidence=_public_confidence(confidence),
        english_signal_count=english_count,
        vietnamese_signal_count=vietnamese_count,
    )


def detect_job_language(text: str) -> LanguageDetection:
    """Detect a Job's language without headings or its SKILLS section."""

    job_document = parse_job_document(text)
    return detect_language(job_document.language_evidence_text)
