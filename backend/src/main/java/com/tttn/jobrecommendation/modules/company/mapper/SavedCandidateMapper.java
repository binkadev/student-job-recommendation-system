package com.tttn.jobrecommendation.modules.company.mapper;

import com.tttn.jobrecommendation.modules.company.dto.response.SavedCandidateResponse;
import com.tttn.jobrecommendation.modules.company.entity.SavedCandidate;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.student.entity.StudentProfile;
import org.springframework.stereotype.Component;

@Component
public class SavedCandidateMapper {

    public SavedCandidateResponse toSavedCandidateResponse(
            SavedCandidate savedCandidate,
            StudentProfile studentProfile
    ) {
        CvFile cvFile = savedCandidate.getApplication().getCvFile();
        return SavedCandidateResponse.builder()
                .id(savedCandidate.getId())
                .applicationId(savedCandidate.getApplication().getId())
                .studentId(savedCandidate.getStudent().getId())
                .studentName(savedCandidate.getStudent().getUser().getFullName())
                .studentEmail(savedCandidate.getStudent().getUser().getEmail())
                .university(savedCandidate.getStudent().getUniversity())
                .major(savedCandidate.getStudent().getMajor())
                .headline(studentProfile == null ? null : studentProfile.getHeadline())
                .jobId(savedCandidate.getApplication().getJob().getId())
                .jobTitle(savedCandidate.getApplication().getJob().getTitle())
                .cvFileId(cvFile == null ? null : cvFile.getId())
                .cvFileName(resolveOriginalFileName(cvFile))
                .note(savedCandidate.getNote())
                .savedAt(savedCandidate.getCreatedAt())
                .updatedAt(savedCandidate.getUpdatedAt())
                .build();
    }

    private String resolveOriginalFileName(CvFile cvFile) {
        if (cvFile == null) {
            return null;
        }
        return cvFile.getOriginalFileName() == null ? cvFile.getFileName() : cvFile.getOriginalFileName();
    }
}
