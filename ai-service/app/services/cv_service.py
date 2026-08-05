from fastapi import UploadFile
from app.ai_core.extractors import extract_text
from app.ai_core.nlp_pipeline import nlp_pipeline
from app.schemas.schemas import CvParseResponse

class CvService:
    async def parse_cv(self, file: UploadFile) -> CvParseResponse:
        raw_text = await extract_text(file)
        
        result = nlp_pipeline.process(raw_text)
        
        return CvParseResponse(
            rawText=raw_text,
            processedText=result["processedText"],
            skills=result["skills"],
            warnings=[]
        )

cv_service = CvService()
