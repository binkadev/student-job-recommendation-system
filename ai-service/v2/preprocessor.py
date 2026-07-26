"""English-only deterministic preprocessing for AI service V2."""

from dataclasses import dataclass
import re
import unicodedata

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


def preprocess_english(text: str) -> EnglishPreprocessingResult:
    """Validate English language and produce deterministic TF-IDF text."""

    if not isinstance(text, str):
        raise TypeError("English preprocessing text must be a string")

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


def preprocess_english_job(text: str) -> EnglishPreprocessingResult:
    """Parse a Job and preprocess only its non-SKILLS lexical content."""

    job_document = parse_job_document(text)
    return preprocess_english(job_document.similarity_text)
