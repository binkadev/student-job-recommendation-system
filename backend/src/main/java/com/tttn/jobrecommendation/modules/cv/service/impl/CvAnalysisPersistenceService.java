package com.tttn.jobrecommendation.modules.cv.service.impl;

import com.tttn.jobrecommendation.common.enums.CvAnalysisStatus;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCvParseResponse;
import com.tttn.jobrecommendation.modules.cv.dto.response.CvAnalysisResponse;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.cv.repository.CvFileRepository;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CvAnalysisPersistenceService {

    private final StudentRepository studentRepository;
    private final CvFileRepository cvFileRepository;
    private final CvAnalysisFailureMessageSanitizer failureMessageSanitizer;

    @Transactional(readOnly = true)
    public CvAnalysisResponse getAnalysis(Long userId, Long cvId) {
        Student student = getStudent(userId);
        return toResponse(getOwnedCv(cvId, student));
    }

    @Transactional(readOnly = true)
    public void rejectExtractedDataUpdate(Long userId, Long cvId) {
        Student student = getStudent(userId);
        getOwnedCv(cvId, student);
        throw new AppException(ErrorCode.FEATURE_NOT_SUPPORTED);
    }

    @Transactional
    public CvFile markProcessing(Long userId, Long cvId) {
        Student student = getStudent(userId);
        CvFile cvFile = getOwnedCv(cvId, student);

        cvFile.setAnalysisStatus(CvAnalysisStatus.PROCESSING);
        cvFile.setProcessedText(null);
        cvFile.setExtractedSkills(List.of());
        cvFile.setAnalysisError(null);
        cvFile.setLanguageCode(null);
        cvFile.setLanguageConfidence(null);
        cvFile.setProcessingVersion(null);
        cvFile.setAnalysisWarnings(List.of());
        cvFile.setAnalyzedAt(null);
        cvFileRepository.saveAndFlush(cvFile);
        return cvFile;
    }

    @Transactional
    public CvAnalysisResponse saveParsedAnalysis(Long userId, Long cvId, AiCvParseResponse parsed) {
        Student student = getStudent(userId);
        CvFile cvFile = getOwnedCv(cvId, student);

        cvFile.setExtractedText(parsed.rawText());
        cvFile.setProcessedText(parsed.processedText());
        cvFile.setExtractedSkills(List.copyOf(parsed.skills()));
        cvFile.setAnalysisStatus(CvAnalysisStatus.READY);
        cvFile.setAnalysisError(null);
        cvFile.setLanguageCode(parsed.languageCode());
        cvFile.setLanguageConfidence(BigDecimal.valueOf(parsed.languageConfidence()));
        cvFile.setProcessingVersion(parsed.processingVersion());
        cvFile.setAnalysisWarnings(List.copyOf(parsed.warnings()));
        cvFile.setAnalyzedAt(LocalDateTime.now());
        cvFileRepository.saveAndFlush(cvFile);
        return toResponse(cvFile);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markFailed(Long userId, Long cvId, Throwable failure) {
        Student student = getStudent(userId);
        CvFile cvFile = getOwnedCv(cvId, student);

        cvFile.setAnalysisStatus(CvAnalysisStatus.FAILED);
        cvFile.setProcessedText(null);
        cvFile.setExtractedSkills(List.of());
        cvFile.setAnalysisError(failureMessageSanitizer.sanitize(failure));
        cvFile.setLanguageCode(null);
        cvFile.setLanguageConfidence(null);
        cvFile.setProcessingVersion(null);
        cvFile.setAnalysisWarnings(List.of());
        cvFile.setAnalyzedAt(null);
        cvFileRepository.saveAndFlush(cvFile);
    }

    private CvAnalysisResponse toResponse(CvFile cvFile) {
        return CvAnalysisResponse.builder()
                .cvId(cvFile.getId())
                .extractedText(cvFile.getExtractedText())
                .processedText(cvFile.getProcessedText())
                .skills(copyOrEmpty(cvFile.getExtractedSkills()))
                .status(cvFile.getAnalysisStatus())
                .analysisError(cvFile.getAnalysisError())
                .languageCode(cvFile.getLanguageCode())
                .languageConfidence(cvFile.getLanguageConfidence())
                .processingVersion(cvFile.getProcessingVersion())
                .warnings(copyOrEmpty(cvFile.getAnalysisWarnings()))
                .analyzedAt(cvFile.getAnalyzedAt())
                .uploadedAt(cvFile.getUploadedAt())
                .updatedAt(cvFile.getUpdatedAt())
                .build();
    }

    private Student getStudent(Long userId) {
        return studentRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Student profile not found"));
    }

    private CvFile getOwnedCv(Long cvId, Student student) {
        return cvFileRepository.findByIdAndStudentId(cvId, student.getId())
                .orElseThrow(() -> new ResourceNotFoundException("CV file not found"));
    }

    private List<String> copyOrEmpty(List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
