from typing import List
from app.ai_core.matching_engine import matching_engine
from app.schemas.schemas import (
    RecommendationRequest, 
    RecommendationResponse, 
    RecommendationResult,
    CandidateRankingRequest,
    CandidateRankingResponse,
    CandidateRankingResult
)

class RecommendationService:
    def recommend_jobs(self, request: RecommendationRequest) -> RecommendationResponse:
        cv_text = request.cv.text
        cv_skills = request.cv.skills
        
        job_texts = [job.text for job in request.jobs]
        job_skills_list = [job.skills for job in request.jobs]
        
        scores = matching_engine.recommend_jobs(cv_text, cv_skills, job_texts, job_skills_list)
        
        results = []
        for i, score_info in enumerate(scores):
            job = request.jobs[i]
            if score_info["score"] >= request.threshold:
                results.append(
                    RecommendationResult(
                        jobId=job.id,
                        score=score_info["score"],
                        textScore=score_info["textScore"],
                        skillScore=score_info["skillScore"],
                        matchedSkills=score_info["matchedSkills"],
                        missingSkills=score_info["missingSkills"]
                    )
                )
                
        # Sort by score DESC, then jobId ASC
        results.sort(key=lambda x: (-x.score, x.jobId))
        results = results[:request.limit]
        
        return RecommendationResponse(
            requestId=request.requestId,
            results=results
        )

    def rank_candidates(self, request: CandidateRankingRequest) -> CandidateRankingResponse:
        job_text = request.job.text
        job_skills = request.job.skills
        
        candidate_texts = [c.text for c in request.candidates]
        candidate_skills_list = [c.skills for c in request.candidates]
        
        scores = matching_engine.rank_candidates(job_text, job_skills, candidate_texts, candidate_skills_list)
        
        results = []
        for i, score_info in enumerate(scores):
            candidate = request.candidates[i]
            if score_info["score"] >= request.threshold:
                results.append(
                    CandidateRankingResult(
                        applicationId=candidate.applicationId,
                        cvId=candidate.cvId,
                        score=score_info["score"],
                        textScore=score_info["textScore"],
                        skillScore=score_info["skillScore"],
                        matchedSkills=score_info["matchedSkills"],
                        missingSkills=score_info["missingSkills"]
                    )
                )
                
        # Sort by score DESC, then applicationId ASC
        results.sort(key=lambda x: (-x.score, x.applicationId))
        results = results[:request.limit]
        
        return CandidateRankingResponse(
            requestId=request.requestId,
            results=results
        )

recommendation_service = RecommendationService()
