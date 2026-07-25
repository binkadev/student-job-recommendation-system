"""
nlp_processor.py — Bilingual (Vietnamese / English) NLP preprocessing module.

Design principles:
- IT technical terms are extracted BEFORE any tokenisation or stopword removal
  so they are never accidentally stripped (e.g. "Go", "R").
- underthesea word_tokenize is used for Vietnamese text; plain split() for English.
- All skill names are returned in their canonical casing (e.g. "Spring Boot",
  "React") regardless of how they appear in the source text.
"""

import re
from typing import List, Tuple

# ---------------------------------------------------------------------------
# Attempt to import underthesea; fall back gracefully if not installed.
# ---------------------------------------------------------------------------
try:
    from underthesea import word_tokenize as vi_word_tokenize
    _UNDERTHESEA_AVAILABLE = True
except ImportError:
    _UNDERTHESEA_AVAILABLE = False


# ---------------------------------------------------------------------------
# Vietnamese character detection regex
# ---------------------------------------------------------------------------
_VI_PATTERN = re.compile(
    r"[\u00C0-\u024F\u1EA0-\u1EF9]"
)


def _is_vietnamese(text: str) -> bool:
    """Return True if the text contains Vietnamese diacritic characters."""
    return bool(_VI_PATTERN.search(text))


# ---------------------------------------------------------------------------
# Stopwords — Vietnamese + English functional words
# ---------------------------------------------------------------------------
STOPWORDS: set = {
    # --- Vietnamese ---
    "và", "hoặc", "của", "các", "có", "để", "cho", "với", "từ", "là",
    "trong", "trên", "dưới", "tại", "những", "khi", "như", "một", "sẽ",
    "được", "rất", "bằng", "đã", "đang", "cần", "phải", "làm", "việc",
    "năm", "tháng", "kinh", "nghiệm", "kỹ", "năng", "yêu", "cầu",
    "trách", "nhiệm", "vị", "trí", "công", "ty", "nhân", "viên",
    "theo", "này", "đó", "về", "ra", "lên", "xuống", "vào", "giữa",
    "trước", "sau", "qua", "lại", "nên", "thì", "mà", "hay", "nếu",
    # --- English ---
    "and", "or", "of", "the", "a", "an", "to", "for", "with", "from",
    "is", "in", "on", "under", "at", "when", "as", "will", "be", "very",
    "experience", "work", "year", "month", "required", "must", "strong",
    "good", "knowledge", "understanding", "ability", "skill", "position",
    "company", "employee", "team", "using", "use", "development",
    "software", "have", "has", "been", "that", "this", "are", "was",
    "were", "not", "but", "also", "can", "we", "you", "our", "your",
    "their", "all", "it", "its", "by", "about", "than", "more",
}


# ---------------------------------------------------------------------------
# Skill alias map — lower-case key → canonical name
# ---------------------------------------------------------------------------
SKILL_ALIASES: dict = {
    # JavaScript / TypeScript
    "js": "JavaScript",
    "javascript": "JavaScript",
    "ts": "TypeScript",
    "typescript": "TypeScript",
    # React
    "reactjs": "React",
    "react.js": "React",
    "react js": "React",
    # Node
    "node.js": "NodeJS",
    "nodejs": "NodeJS",
    "node js": "NodeJS",
    # Vue
    "vuejs": "Vue",
    "vue.js": "Vue",
    "vue js": "Vue",
    # Next / Nuxt
    "nextjs": "Next.js",
    "next.js": "Next.js",
    "next js": "Next.js",
    "nuxtjs": "Nuxt.js",
    "nuxt.js": "Nuxt.js",
    # Express
    "expressjs": "Express",
    "express.js": "Express",
    # Spring
    "springboot": "Spring Boot",
    "spring-boot": "Spring Boot",
    "spring boot": "Spring Boot",
    # Database
    "postgres": "PostgreSQL",
    "mysql": "MySQL",
    "mongo": "MongoDB",
    "elasticsearch": "Elasticsearch",
    "elastic": "Elasticsearch",
    # Cloud / DevOps
    "aws": "AWS",
    "gcp": "Google Cloud",
    "google cloud platform": "Google Cloud",
    "k8s": "Kubernetes",
    "kube": "Kubernetes",
    "ci/cd": "CI/CD",
    "cicd": "CI/CD",
    # Languages
    "c#": "C#",
    "csharp": "C#",
    "c++": "C++",
    "cplusplus": "C++",
    "golang": "Go",
    "ruby on rails": "Rails",
    "ror": "Rails",
    # ML / AI
    "ml": "Machine Learning",
    "ai": "Artificial Intelligence",
    "tf": "TensorFlow",
    "tensorflow": "TensorFlow",
    "pytorch": "PyTorch",
    "scikit-learn": "Scikit-learn",
    "sklearn": "Scikit-learn",
    # Mobile
    "react native": "React Native",
    "flutter": "Flutter",
    # .NET
    ".net": ".NET",
    "dotnet": ".NET",
    "asp.net": "ASP.NET",
    # General
    "graphql": "GraphQL",
    "rest api": "REST API",
    "restful": "REST API",
    "rest": "REST API",
    "microservices": "Microservices",
    "git": "Git",
    "github": "Git",
    "gitlab": "Git",
}


# ---------------------------------------------------------------------------
# Comprehensive known IT skills set (canonical casing)
# ---------------------------------------------------------------------------
KNOWN_SKILLS: set = {
    # Backend
    "Java", "Spring Boot", "Spring", "Python", "Django", "FastAPI", "Flask",
    "NodeJS", "Express", "Go", "Golang", "Rust", "PHP", "Laravel",
    "Ruby", "Rails", "C#", ".NET", "ASP.NET", "C++", "C",
    # Frontend
    "React", "Angular", "Vue", "Svelte", "JavaScript", "TypeScript",
    "HTML", "CSS", "Sass", "Next.js", "Nuxt.js", "Redux", "jQuery",
    # Data / ML
    "TensorFlow", "PyTorch", "Keras", "Scikit-learn", "Pandas", "NumPy",
    "Spark", "Hadoop", "R", "MATLAB", "Machine Learning",
    "Artificial Intelligence", "Deep Learning", "NLP",
    # Database
    "SQL", "MySQL", "PostgreSQL", "MongoDB", "Redis", "Elasticsearch",
    "Cassandra", "Oracle", "SQLite", "DynamoDB",
    # DevOps / Cloud
    "Docker", "Kubernetes", "AWS", "Google Cloud", "Azure", "CI/CD",
    "Jenkins", "GitHub Actions", "Terraform", "Linux", "Nginx",
    # Mobile
    "Android", "iOS", "React Native", "Flutter", "Swift", "Kotlin",
    # General
    "Git", "REST API", "GraphQL", "Microservices", "Agile", "Scrum",
    "Kafka", "RabbitMQ", "gRPC", "WebSocket",
}


# ---------------------------------------------------------------------------
# Core helpers
# ---------------------------------------------------------------------------

def clean_text(text: str) -> str:
    """Collapse multiple whitespace characters into a single space."""
    return re.sub(r"\s+", " ", text).strip()


def _extract_alias_skills(text: str) -> List[str]:
    """
    Find all SKILL_ALIASES in the text using word-boundary-aware regex.
    Returns a list of canonical skill names (may contain duplicates across
    alias hits; deduplication happens later).
    """
    lower_text = text.lower()
    found = []
    # Sort aliases by descending length to prefer longer matches first
    # (e.g. "spring boot" before "spring")
    sorted_aliases = sorted(SKILL_ALIASES.keys(), key=len, reverse=True)
    for alias in sorted_aliases:
        pattern = r"(?<!\w)" + re.escape(alias) + r"(?!\w)"
        if re.search(pattern, lower_text):
            found.append(SKILL_ALIASES[alias])
    return found


def extract_entities(text: str) -> List[str]:
    """
    Extract IT skills from text using two strategies:
      1. Direct case-insensitive scan of KNOWN_SKILLS phrases.
      2. Alias lookup via SKILL_ALIASES.

    Returns a deduplicated list of canonical skill names.
    """
    found: set = set()
    lower_text = text.lower()

    # Strategy 1: scan KNOWN_SKILLS (multi-word aware, longest first)
    sorted_skills = sorted(KNOWN_SKILLS, key=len, reverse=True)
    for skill in sorted_skills:
        pattern = r"(?<!\w)" + re.escape(skill.lower()) + r"(?!\w)"
        if re.search(pattern, lower_text):
            found.add(skill)

    # Strategy 2: alias expansion
    for canonical in _extract_alias_skills(text):
        found.add(canonical)

    return sorted(found)  # deterministic ordering


def segment_text(text: str) -> str:
    """
    Tokenise text appropriately for language:
    - Vietnamese: use underthesea word_tokenize (handles multi-syllable words).
    - English: return as-is (standard split is sufficient).

    If underthesea is unavailable, falls back to the plain text.
    """
    if _is_vietnamese(text) and _UNDERTHESEA_AVAILABLE:
        try:
            return vi_word_tokenize(text, format="text")
        except Exception:
            # Graceful degradation if tokeniser fails
            return text
    return text


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def process_cv_text(raw_text: str) -> dict:
    """
    Full bilingual NLP pipeline for CV text.

    Pipeline:
        A. clean_text     — normalise whitespace
        B. extract_entities — extract IT skills BEFORE tokenisation
        C. segment_text   — Vietnamese-aware word segmentation
        D. tokenise       — split into tokens
        E. stopword filter — remove functional words
        F. rebuild        — join filtered tokens
        G. IT preservation — ensure skill tokens survive stopword removal
        H. return         — {processedText, skills}

    Returns:
        {
            "processedText": str,   # cleaned, stopword-filtered text
            "skills": List[str]     # canonical IT skill names
        }
    """
    # A — normalise whitespace
    cleaned = clean_text(raw_text)

    # B — extract skills BEFORE segmentation to preserve multi-word terms
    skill_list: List[str] = extract_entities(cleaned)

    # C — language-aware segmentation
    segmented = segment_text(cleaned)

    # D — tokenise
    tokens = segmented.split()

    # E — remove stopwords (case-insensitive)
    filtered_tokens = [t for t in tokens if t.lower() not in STOPWORDS]

    # F — rebuild processed text
    processed_text = " ".join(filtered_tokens)

    # G — IT preservation pass:
    # Single-word skills like "Go" or "R" might have been stripped as stopwords
    # or not appear in the segmented text. Append any missing skill tokens.
    existing_lower = processed_text.lower()
    extra_tokens: List[str] = []
    for skill in skill_list:
        # Only apply preservation to single-word skills (multi-word are safe)
        if " " not in skill and skill.lower() not in existing_lower:
            extra_tokens.append(skill)
    if extra_tokens:
        processed_text = (processed_text + " " + " ".join(extra_tokens)).strip()

    return {
        "processedText": processed_text,
        "skills": skill_list,
    }
