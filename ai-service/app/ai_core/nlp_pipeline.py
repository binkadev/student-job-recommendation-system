import spacy
from spacy.pipeline import EntityRuler
import re
import csv
import os

EMAIL_REGEX = re.compile(r'\S+@\S+\.\S+')
PHONE_REGEX = re.compile(r'\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b')
URL_REGEX = re.compile(r'https?://\S+|www\.\S+')

BANNED_ENTS = {"PERSON", "GPE", "LOC", "ORG", "DATE", "TIME", "MONEY"}
ALLOWED_POS = {"NOUN", "PROPN"}

class NLPPipeline:
    def __init__(self):
        self.nlp = spacy.load("en_core_web_sm")
        self._add_entity_ruler()
        
    def _add_entity_ruler(self):
        ruler = self.nlp.add_pipe("entity_ruler", before="ner", config={"phrase_matcher_attr": "LOWER"})
        patterns = []
        
        base_dir = os.path.dirname(__file__)
        skills_path = os.path.join(base_dir, "it_skills.csv")
        custom_path = os.path.join(base_dir, "custom_terms.csv")
        noisy_skills = {
            "james", "sherry", "june", "may", "february", "month", "months", "year", "years", 
            "in", "and", "for", "to", "of", "the", "a", "with", "now", "all",
            "anytown", "calif", "troy", "india", "everytown",
            "in design", "product launch", "training manual", "new software developers",
            "software engineers", "software engineer"
        }
        
        if os.path.exists(skills_path):
            with open(skills_path, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                next(reader, None) # skip header
                for row in reader:
                    if row:
                        term = row[0].strip().lower()
                        if term and term not in noisy_skills and not term.isnumeric():
                            patterns.append({"label": "SKILL", "pattern": term})
                            
        if os.path.exists(custom_path):
            with open(custom_path, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                next(reader, None)
                for row in reader:
                    if row:
                        term = row[0].strip().lower()
                        if term and term not in noisy_skills and not term.isnumeric():
                            patterns.append({"label": "CUSTOM_PHRASE", "pattern": term})
                            
        ruler.add_patterns(patterns)

    def denoise_pii(self, text: str) -> str:
        text = EMAIL_REGEX.sub(" ", text)
        text = PHONE_REGEX.sub(" ", text)
        text = URL_REGEX.sub(" ", text)
        text = text.replace('\n', '. ')
        return text
        
    def process(self, text: str):
        # PII Denoising
        denoised_text = self.denoise_pii(text)
        
        # CRITICAL FIX: Pass the original cased text to spaCy to preserve POS/NER accuracy.
        doc = self.nlp(denoised_text)
        
        # Merge entities
        with doc.retokenize() as retokenizer:
            for ent in doc.ents:
                if ent.label_ in ("SKILL", "CUSTOM_PHRASE"):
                    retokenizer.merge(ent)
                    
        processed_tokens = []
        skills = []
        
        for token in doc:
            if token.is_stop or token.is_punct or token.is_space:
                continue
                
            is_vip = token.ent_type_ in ("SKILL", "CUSTOM_PHRASE")
            
            # Heuristic to combat noisy single-word skills in the CSV
            is_strict_vip = False
            if is_vip:
                if len(token.text.split()) > 1:
                    is_strict_vip = True
                elif token.pos_ == "PROPN":
                    is_strict_vip = True
            
            if is_strict_vip:
                token_text = token.text.lower()
                processed_tokens.append(token_text)
                if token.ent_type_ == "SKILL" and token_text not in skills:
                    skills.append(token_text)
            else:
                if token.ent_type_ in BANNED_ENTS:
                    continue
                if token.pos_ not in ALLOWED_POS:
                    continue
                
                processed_tokens.append(token.lemma_.lower())
                
        processed_text = " ".join(processed_tokens)
        
        return {
            "processedText": processed_text,
            "skills": skills
        }

nlp_pipeline = NLPPipeline()
