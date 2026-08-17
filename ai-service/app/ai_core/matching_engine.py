from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from typing import List, Dict, Any
from app.ai_core.nlp_pipeline import nlp_pipeline

class MatchingEngine:
    def __init__(self):
        self.vectorizer = TfidfVectorizer(
            ngram_range=(1, 1),
            sublinear_tf=True,
            lowercase=True
        )

    def calculate_skill_score(self, cv_skills: List[str], job_skills: List[str]) -> float:
        if not job_skills:
            return 1.0
        
        cv_set = set(cv_skills)
        job_set = set(job_skills)
        
        intersection = cv_set.intersection(job_set)
        return len(intersection) / len(job_set)

    def get_matched_missing_skills(self, cv_skills: List[str], job_skills: List[str]):
        cv_set = set(cv_skills)
        job_set = set(job_skills)
        matched = list(cv_set.intersection(job_set))
        missing = list(job_set - cv_set)
        
        return sorted(matched), sorted(missing)

    def recommend_jobs(self, cv_text: str, cv_skills: List[str], job_texts: List[str], job_skills_list: List[List[str]]) -> List[Dict[str, Any]]:
        if not job_texts:
            return []
            
        processed_job_texts = [nlp_pipeline.process(text)["processedText"] for text in job_texts]
        corpus = [cv_text] + processed_job_texts
        tfidf_matrix = self.vectorizer.fit_transform(corpus)
        
        cv_vec = tfidf_matrix[0:1]
        job_vecs = tfidf_matrix[1:]
        
        text_scores = cosine_similarity(cv_vec, job_vecs).flatten()
        
        results = []
        for i in range(len(job_texts)):
            text_score = float(text_scores[i])
            job_skills = job_skills_list[i]
            
            skill_score = self.calculate_skill_score(cv_skills, job_skills)
            hybrid_score = (0.65 * text_score) + (0.35 * skill_score)
            
            matched, missing = self.get_matched_missing_skills(cv_skills, job_skills)
            
            results.append({
                "score": hybrid_score,
                "textScore": text_score,
                "skillScore": skill_score,
                "matchedSkills": matched,
                "missingSkills": missing
            })
            
        return results
        
    def rank_candidates(self, job_text: str, job_skills: List[str], candidate_texts: List[str], candidate_skills_list: List[List[str]]) -> List[Dict[str, Any]]:
        if not candidate_texts:
            return []
            
        processed_job_text = nlp_pipeline.process(job_text)["processedText"]
        tfidf_matrix = self.vectorizer.fit_transform(candidate_texts)
        job_vec = self.vectorizer.transform([processed_job_text])
        
        text_scores = cosine_similarity(job_vec, tfidf_matrix).flatten()
        
        results = []
        for i in range(len(candidate_texts)):
            text_score = float(text_scores[i])
            candidate_skills = candidate_skills_list[i]
            
            skill_score = self.calculate_skill_score(candidate_skills, job_skills)
            hybrid_score = (0.65 * text_score) + (0.35 * skill_score)
            
            matched, missing = self.get_matched_missing_skills(candidate_skills, job_skills)
            
            results.append({
                "score": hybrid_score,
                "textScore": text_score,
                "skillScore": skill_score,
                "matchedSkills": matched,
                "missingSkills": missing
            })
            
        return results

matching_engine = MatchingEngine()
