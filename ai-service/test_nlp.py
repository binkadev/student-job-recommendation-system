import pytest
from nlp_processor import normalize_skill, extract_entities, clean_text

def test_normalize_skill():
    assert normalize_skill("js") == "JavaScript"
    assert normalize_skill("JS") == "JavaScript"
    assert normalize_skill("Reactjs") == "React"
    assert normalize_skill("Unknown") == "Unknown"

def test_extract_entities():
    text = "I have 3 years of experience in Java and spring boot. I also know js and ReactJS."
    entities = extract_entities(text)
    skills = entities["skills"]
    assert "Java" in skills
    assert "Spring Boot" in skills
    assert "JavaScript" in skills
    assert "React" in skills

def test_clean_text():
    text = "  Hello    World  "
    assert clean_text(text) == "Hello World"
