from pydantic import BaseModel, Field
from typing import List, Optional

class CvParseResponse(BaseModel):
    rawText: str
    processedText: str
    skills: List[str]
    languageCode: str = "en"
    languageConfidence: float = 1.0
    processingVersion: str = "v2.0"
    warnings: List[str] = Field(default_factory=list)

class CvInfo(BaseModel):
    id: int
    text: str
    skills: List[str]

class JobInfo(BaseModel):
    id: int
    text: str
    skills: List[str]

class RecommendationRequest(BaseModel):
    requestId: str
    cv: CvInfo
    jobs: List[JobInfo]
    threshold: float = 0.1
    limit: int = 20

class RecommendationResult(BaseModel):
    jobId: int
    score: float
    textScore: float
    skillScore: float
    scoringStrategy: str = "SAME_LANGUAGE_HYBRID"
    matchedSkills: List[str]
    missingSkills: List[str]

class RecommendationResponse(BaseModel):
    requestId: str
    algorithm: str = "tfidf-cosine-hybrid"
    algorithmVersion: str = "v2.0"
    processingVersion: str = "v2.0"
    results: List[RecommendationResult]

class CandidateInfo(BaseModel):
    applicationId: int
    cvId: int
    text: str
    skills: List[str]

class CandidateRankingRequest(BaseModel):
    requestId: str
    job: JobInfo
    candidates: List[CandidateInfo]
    threshold: float = 0.1
    limit: int = 20

class CandidateRankingResult(BaseModel):
    applicationId: int
    cvId: int
    score: float
    textScore: float
    skillScore: float
    scoringStrategy: str = "SAME_LANGUAGE_HYBRID"
    matchedSkills: List[str]
    missingSkills: List[str]

class CandidateRankingResponse(BaseModel):
    requestId: str
    algorithm: str = "tfidf-cosine-hybrid"
    algorithmVersion: str = "v2.0"
    processingVersion: str = "v2.0"
    results: List[CandidateRankingResult]
