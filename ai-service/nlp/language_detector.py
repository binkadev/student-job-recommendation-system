"""Deterministic English-only language gate for the AI Service."""

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
import re
import unicodedata

from schemas.common import LanguageCode

from .job_document import parse_job_document


# Fixed natural-language English evidence only. Technical and product names
# are intentionally excluded so an IT skill list alone cannot pass as English.
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

# High-specificity English resume and Job markers contribute two evidence points.
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

ENGLISH_RESUME_MARKER_PHRASES = frozenset(
    {
        ("backend", "developer"),
        ("backend", "developers"),
        ("software", "engineer"),
        ("software", "engineers"),
    }
)

# Compact multilingual non-English function-word sentinel set used purely to
# reject non-English documents (never classified as a supported language).
_NON_ENGLISH_SENTINEL_WORDS = frozenset(
    {
        # French / Spanish / German / Italian / Portuguese high-frequency words
        "avec",
        "dans",
        "pour",
        "nous",
        "vous",
        "sont",
        "une",
        "des",
        "les",
        "est",
        "para",
        "con",
        "por",
        "los",
        "las",
        "una",
        "del",
        "que",
        "como",
        "pero",
        "und",
        "der",
        "die",
        "das",
        "mit",
        "für",
        "wir",
        "sie",
        "sind",
        "ein",
        "eine",
        "nicht",
        "auch",
        "oder",
        "von",
        "ist",
        "zur",
        "zum",
        "che",
        "della",
        "degli",
        "sono",
        "com",
        "uma",
        "não",
        "dos",
        "das",
        # Unaccented non-English tokens that do not collide with English words
        "kinh",
        "nghiem",
        "khong",
        "duoc",
        "nhung",
        "chúng",
        "không",
        "được",
        "những",
        "phát",
        "triển",
        "phần",
        "mềm",
        "với",
        "của",
        "các",
        "bằng",
        "cho",
        "tôi",
        "trong",
        "và",
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
_NON_ASCII_LETTER_PATTERN = re.compile(r"[^\x00-\x7f]")
_CONFIDENCE_QUANTUM = Decimal("0.00000001")
_MIN_SIGNAL_COUNT = 2
_FULL_STRENGTH_SIGNAL_COUNT = 6
_MIXED_MINORITY_SHARE = Decimal("0.25")
_RESUME_MARKER_WEIGHT = 2


@dataclass(frozen=True, slots=True)
class LanguageDetection:
    """English language label, confidence, and auditable integer evidence."""

    language_code: LanguageCode
    confidence: float
    english_signal_count: int
    non_english_signal_count: int


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
    """Classify natural-language evidence as en, mixed, or unknown.

    Only English is supported. Any document with strong non-ASCII script,
    non-English function words, or insufficient English evidence is classified
    as ``mixed`` or ``unknown`` so downstream CV parsing rejects it with
    ``422 UNSUPPORTED_LANGUAGE`` and Job scoring falls back to skill-only
    matching.
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

    non_ascii_tokens = {
        token
        for token in unique_tokens
        if any(char.isalpha() for char in token)
        and _NON_ASCII_LETTER_PATTERN.search(token) is not None
    }
    non_english_word_hits = unique_tokens & _NON_ENGLISH_SENTINEL_WORDS
    non_english_count = len(non_ascii_tokens | non_english_word_hits)

    total_signals = english_count + non_english_count
    if total_signals < _MIN_SIGNAL_COUNT or english_count == 0:
        return LanguageDetection(
            language_code=LanguageCode.UNKNOWN,
            confidence=0.0,
            english_signal_count=english_count,
            non_english_signal_count=non_english_count,
        )

    strength = min(
        Decimal(total_signals) / Decimal(_FULL_STRENGTH_SIGNAL_COUNT),
        Decimal("1"),
    )
    english_share = Decimal(english_count) / Decimal(total_signals)
    non_english_share = Decimal(non_english_count) / Decimal(total_signals)

    if non_english_count >= _MIN_SIGNAL_COUNT and non_english_share >= _MIXED_MINORITY_SHARE:
        if english_count >= _MIN_SIGNAL_COUNT and english_share >= _MIXED_MINORITY_SHARE:
            balance = Decimal("2") * min(english_share, non_english_share)
            return LanguageDetection(
                language_code=LanguageCode.MIXED,
                confidence=_public_confidence(strength * balance),
                english_signal_count=english_count,
                non_english_signal_count=non_english_count,
            )
        return LanguageDetection(
            language_code=LanguageCode.UNKNOWN,
            confidence=0.0,
            english_signal_count=english_count,
            non_english_signal_count=non_english_count,
        )

    if english_count < _MIN_SIGNAL_COUNT or non_english_count > english_count:
        return LanguageDetection(
            language_code=LanguageCode.UNKNOWN,
            confidence=0.0,
            english_signal_count=english_count,
            non_english_signal_count=non_english_count,
        )

    dominance = english_share - non_english_share
    return LanguageDetection(
        language_code=LanguageCode.ENGLISH,
        confidence=_public_confidence(strength * dominance),
        english_signal_count=english_count,
        non_english_signal_count=non_english_count,
    )


def detect_job_language(text: str) -> LanguageDetection:
    """Detect Job language from non-SKILLS lexical sections only."""

    job_document = parse_job_document(text)
    return detect_language(job_document.language_evidence_text)


__all__ = [
    "ENGLISH_RESUME_MARKER_PHRASES",
    "ENGLISH_RESUME_MARKER_WORDS",
    "ENGLISH_SIGNAL_WORDS",
    "LanguageDetection",
    "detect_job_language",
    "detect_language",
]
