"""
test_nlp.py — Unit tests for nlp_processor helper functions.

Note: normalize_skill was removed during the stateless refactoring.
      extract_entities() now returns List[str] directly (not a dict).
"""

import pytest
from nlp_processor import extract_entities, clean_text


def test_extract_entities():
    text = "I have 3 years of experience in Java and spring boot. I also know js and ReactJS."
    skills = extract_entities(text)
    assert isinstance(skills, list)
    assert "Java" in skills
    assert "Spring Boot" in skills
    assert "JavaScript" in skills
    assert "React" in skills


def test_clean_text():
    text = "  Hello    World  "
    assert clean_text(text) == "Hello World"
