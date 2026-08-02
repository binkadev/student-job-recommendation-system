"""Deterministic English and Vietnamese preprocessing for AI service V2."""

from dataclasses import dataclass
import re
import unicodedata

from underthesea import word_tokenize

from .constants import ENGLISH_LANGUAGE_CONFIDENCE_THRESHOLD
from .job_document import parse_job_document
from .language_detector import LanguageDetection, detect_language
from .schemas import LanguageCode


ENGLISH_STOPWORDS = frozenset(
    {
        "a",
        "about",
        "all",
        "also",
        "an",
        "and",
        "are",
        "as",
        "at",
        "be",
        "been",
        "but",
        "by",
        "can",
        "for",
        "from",
        "has",
        "have",
        "if",
        "in",
        "is",
        "it",
        "its",
        "more",
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

VIETNAMESE_STOPWORDS = frozenset(
    {
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
_TOKEN_PATTERN = re.compile(
    r"(?<!\w)(?:asp\.net|node\.js|ci/cd|c\+\+|c#|\.net)(?!\w)"
    r"|[^\W_]+(?:[-'][^\W_]+)*",
    flags=re.IGNORECASE | re.UNICODE,
)
_VIETNAMESE_PROTECTED_TERMS = (
    "kiến trúc vi dịch vụ",
    "lập trình hướng đối tượng",
    "trí tuệ nhân tạo",
    "phát triển phần mềm",
    "phát triển ứng dụng",
    "kiểm thử phần mềm",
    "điện toán đám mây",
    "cơ sở dữ liệu",
    "học máy",
    "quản lý dự án",
    "kỹ sư phần mềm",
    "lập trình viên",
    "vi dịch vụ",
    "phát triển backend",
    "phát triển frontend",
    "asp.net",
    "spring boot",
    "node.js",
    "rest api",
    "ci/cd",
    "c++",
    "c#",
    ".net",
    "c",
    "r",
)
_VIETNAMESE_PROTECTED_PATTERN = re.compile(
    r"(?<!\w)(?:"
    + "|".join(
        re.escape(value)
        for value in sorted(
            _VIETNAMESE_PROTECTED_TERMS,
            key=lambda value: (-len(value), value),
        )
    )
    + r")(?!\w)",
    flags=re.IGNORECASE | re.UNICODE,
)
_TOKEN_HAS_LETTER_OR_NUMBER = re.compile(r"[^\W_]", flags=re.UNICODE)


class UnsupportedLanguageError(ValueError):
    """Raised when content is not confidently English in this phase."""

    def __init__(self, detection: LanguageDetection) -> None:
        self.language_code = detection.language_code
        self.confidence = detection.confidence
        super().__init__(
            "English preprocessing requires language=en with confidence "
            f">={ENGLISH_LANGUAGE_CONFIDENCE_THRESHOLD:.2f}; received "
            f"{detection.language_code.value} at {detection.confidence:.8f}"
        )


@dataclass(frozen=True, slots=True)
class EnglishPreprocessingResult:
    """Immutable English text prepared for whitespace-tokenized TF-IDF."""

    processed_text: str
    tokens: tuple[str, ...]
    language: LanguageDetection


@dataclass(frozen=True, slots=True)
class VietnamesePreprocessingResult:
    """Immutable Vietnamese text prepared for whitespace-tokenized TF-IDF."""

    processed_text: str
    tokens: tuple[str, ...]
    language: LanguageDetection


def _normalize_for_preprocessing(text: str) -> str:
    normalized = unicodedata.normalize(
        "NFC",
        text.replace("\r\n", "\n").replace("\r", "\n"),
    )
    without_urls = _URL_PATTERN.sub(" ", normalized)
    without_emails = _EMAIL_PATTERN.sub(" ", without_urls)
    return without_emails.casefold()


def tokenize_english(text: str) -> tuple[str, ...]:
    """Return deterministic tokens while preserving technical punctuation."""

    if not isinstance(text, str):
        raise TypeError("English preprocessing text must be a string")

    normalized = _normalize_for_preprocessing(text)
    return tuple(
        token
        for token in _TOKEN_PATTERN.findall(normalized)
        if token not in ENGLISH_STOPWORDS
    )


def _protect_vietnamese_terms(text: str) -> tuple[str, dict[str, str]]:
    replacements: dict[str, str] = {}
    prefix = "sjrprotectedtoken"
    while prefix in text:
        prefix += "x"

    def replace(match: re.Match[str]) -> str:
        placeholder = f"{prefix}{len(replacements):04d}"
        restored = " ".join(match.group(0).casefold().split()).replace(
            " ",
            "_",
        )
        replacements[placeholder] = restored
        return placeholder

    return _VIETNAMESE_PROTECTED_PATTERN.sub(replace, text), replacements


def tokenize_vietnamese(text: str) -> tuple[str, ...]:
    """Tokenize Vietnamese deterministically while preserving IT terms."""

    if not isinstance(text, str):
        raise TypeError("Vietnamese preprocessing text must be a string")

    normalized = _normalize_for_preprocessing(text)
    protected, replacements = _protect_vietnamese_terms(normalized)
    segmented = word_tokenize(protected)
    tokens: list[str] = []
    for segment in segmented:
        token = " ".join(segment.casefold().split())
        restored = replacements.get(token)
        if restored is not None:
            token = restored
        else:
            token = token.replace(" ", "_")
        token = unicodedata.normalize("NFC", token)
        if token in VIETNAMESE_STOPWORDS:
            continue
        if not _TOKEN_HAS_LETTER_OR_NUMBER.search(token):
            continue
        tokens.append(token)
    return tuple(tokens)


def preprocess_english(
    text: str,
    *,
    detection: LanguageDetection | None = None,
) -> EnglishPreprocessingResult:
    """Validate English language and produce deterministic TF-IDF text."""

    if not isinstance(text, str):
        raise TypeError("English preprocessing text must be a string")

    if detection is None:
        detection = detect_language(text)
    if (
        detection.language_code is not LanguageCode.ENGLISH
        or detection.confidence < ENGLISH_LANGUAGE_CONFIDENCE_THRESHOLD
    ):
        raise UnsupportedLanguageError(detection)

    tokens = tokenize_english(text)
    return EnglishPreprocessingResult(
        processed_text=" ".join(tokens),
        tokens=tokens,
        language=detection,
    )


def preprocess_english_job(
    text: str,
    *,
    detection: LanguageDetection | None = None,
) -> EnglishPreprocessingResult:
    """Parse a Job and preprocess only its non-SKILLS lexical content."""

    job_document = parse_job_document(text)
    return preprocess_english(job_document.similarity_text, detection=detection)


def preprocess_vietnamese(
    text: str,
    *,
    detection: LanguageDetection | None = None,
) -> VietnamesePreprocessingResult:
    """Validate Vietnamese language and produce deterministic TF-IDF text."""

    if not isinstance(text, str):
        raise TypeError("Vietnamese preprocessing text must be a string")

    if detection is None:
        detection = detect_language(text)
    if (
        detection.language_code is not LanguageCode.VIETNAMESE
        or detection.confidence < ENGLISH_LANGUAGE_CONFIDENCE_THRESHOLD
    ):
        raise UnsupportedLanguageError(detection)

    tokens = tokenize_vietnamese(text)
    return VietnamesePreprocessingResult(
        processed_text=" ".join(tokens),
        tokens=tokens,
        language=detection,
    )


def preprocess_vietnamese_job(
    text: str,
    *,
    detection: LanguageDetection | None = None,
) -> VietnamesePreprocessingResult:
    """Parse a Job and preprocess only its non-SKILLS Vietnamese content."""

    job_document = parse_job_document(text)
    return preprocess_vietnamese(
        job_document.similarity_text,
        detection=detection,
    )


def preprocess_supported(
    text: str,
) -> EnglishPreprocessingResult | VietnamesePreprocessingResult:
    """Preprocess one confidently English or Vietnamese document."""

    detection = detect_language(text)
    if (
        detection.language_code not in {
            LanguageCode.ENGLISH,
            LanguageCode.VIETNAMESE,
        }
        or detection.confidence < ENGLISH_LANGUAGE_CONFIDENCE_THRESHOLD
    ):
        raise UnsupportedLanguageError(detection)
    if detection.language_code is LanguageCode.ENGLISH:
        return preprocess_english(text, detection=detection)
    return preprocess_vietnamese(text, detection=detection)
