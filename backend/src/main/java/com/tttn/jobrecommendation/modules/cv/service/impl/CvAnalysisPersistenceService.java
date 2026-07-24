package com.tttn.jobrecommendation.modules.cv.service.impl;

import com.tttn.jobrecommendation.common.enums.CvAnalysisStatus;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.common.utils.SkillNameNormalizer;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCvParseResponse;
import com.tttn.jobrecommendation.modules.cv.dto.request.UpdateCvExtractedDataRequest;
import com.tttn.jobrecommendation.modules.cv.dto.response.CvAnalysisResponse;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.cv.repository.CvFileRepository;
import com.tttn.jobrecommendation.modules.skill.entity.StudentSkill;
import com.tttn.jobrecommendation.modules.skill.repository.StudentSkillRepository;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CvAnalysisPersistenceService {

    private final StudentRepository studentRepository;
    private final CvFileRepository cvFileRepository;
    private final StudentSkillRepository studentSkillRepository;

    @Transactional(readOnly = true)
    public CvAnalysisResponse getAnalysis(Long userId, Long cvId) {
        Student student = getStudent(userId);
        return toResponse(getOwnedCv(cvId, student), student.getId());
    }

    @Transactional(readOnly = true)
    public CvFile getFileForReanalysis(Long userId, Long cvId) {
        Student student = getStudent(userId);
        return getOwnedCv(cvId, student);
    }

    @Transactional
    public CvAnalysisResponse updateExtractedData(
            Long userId,
            Long cvId,
            UpdateCvExtractedDataRequest request
    ) {
        if (request.getExtractedText() == null && request.getProcessedText() == null) {
            throw new AppException(ErrorCode.BAD_REQUEST, "At least one extracted-data field is required");
        }

        Student student = getStudent(userId);
        CvFile cvFile = getOwnedCv(cvId, student);
        if (request.getExtractedText() != null) {
            cvFile.setExtractedText(trimToNull(request.getExtractedText()));
        }
        if (request.getProcessedText() != null) {
            cvFile.setProcessedText(trimToNull(request.getProcessedText()));
        }
        cvFileRepository.saveAndFlush(cvFile);
        return toResponse(cvFile, student.getId());
    }

    @Transactional
    public CvAnalysisResponse saveParsedAnalysis(Long userId, Long cvId, AiCvParseResponse parsed) {
        Student student = getStudent(userId);
        CvFile cvFile = getOwnedCv(cvId, student);
        if (parsed.rawText() != null) {
            cvFile.setExtractedText(parsed.rawText());
        }
        cvFile.setProcessedText(parsed.processedText());
        cvFileRepository.saveAndFlush(cvFile);
        return toResponse(cvFile, student.getId());
    }

    private CvAnalysisResponse toResponse(CvFile cvFile, Long studentId) {
        List<String> normalizedSkills = studentSkillRepository.findByStudentIdOrderByIdAsc(studentId)
                .stream()
                .map(StudentSkill::getSkill)
                .map(skill -> StringUtils.hasText(skill.getNormalizedName())
                        ? skill.getNormalizedName()
                        : skill.getName())
                .map(SkillNameNormalizer::normalize)
                .filter(StringUtils::hasText)
                .distinct()
                .sorted()
                .toList();

        return CvAnalysisResponse.builder()
                .cvId(cvFile.getId())
                .extractedText(cvFile.getExtractedText())
                .processedText(cvFile.getProcessedText())
                .skills(normalizedSkills)
                .status(StringUtils.hasText(cvFile.getProcessedText())
                        ? CvAnalysisStatus.READY
                        : CvAnalysisStatus.NOT_READY)
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

    private String trimToNull(String value) {
        String trimmed = value.strip();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
