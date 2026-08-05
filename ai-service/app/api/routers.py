from fastapi import APIRouter, Depends, UploadFile, File
from app.api.auth import verify_internal_api_key
from app.schemas.schemas import (
    CvParseResponse, 
    RecommendationRequest, 
    RecommendationResponse,
    CandidateRankingRequest,
    CandidateRankingResponse
)
from app.services.cv_service import cv_service
from app.services.recommendation_service import recommendation_service

api_router = APIRouter()

@api_router.post("/internal/v2/cv/parse", response_model=CvParseResponse, dependencies=[Depends(verify_internal_api_key)])
async def parse_cv(file: UploadFile = File(...)):
    return await cv_service.parse_cv(file)

@api_router.post("/internal/v2/recommendations", response_model=RecommendationResponse, dependencies=[Depends(verify_internal_api_key)])
async def generate_recommendations(request: RecommendationRequest):
    return recommendation_service.recommend_jobs(request)

@api_router.post("/internal/v2/candidate-rankings", response_model=CandidateRankingResponse, dependencies=[Depends(verify_internal_api_key)])
async def rank_candidates(request: CandidateRankingRequest):
    return recommendation_service.rank_candidates(request)
