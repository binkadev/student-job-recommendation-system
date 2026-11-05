package com.tttn.jobrecommendation.modules.student.service;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.modules.student.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class StudentProfileRevision {
    private final StudentRepository studentRepository;

    // First SQL write inside every aggregate/legacy transaction. PostgreSQL CAS
    // serializes same-student writers; a failed transaction also rolls back the revision.
    @Transactional(propagation = Propagation.MANDATORY)
    public void claim(Long userId, Long revision) {
        if (revision == null) throw new AppException(ErrorCode.PROFILE_REVISION_REQUIRED);
        if (studentRepository.advanceProfileRevision(userId, revision) == 0) {
            if (studentRepository.findByUserId(userId).isEmpty()) throw new ResourceNotFoundException("Student profile not found");
            throw new AppException(ErrorCode.PROFILE_REVISION_CONFLICT);
        }
    }

    public long current(Long userId) {
        return studentRepository.findByUserId(userId).orElseThrow(() -> new ResourceNotFoundException("Student profile not found")).getProfileRevision();
    }

    public static String etag(long revision) { return "\"" + revision + "\""; }

    public static Long parseIfMatch(String value) {
        if (value == null) throw new AppException(ErrorCode.PROFILE_REVISION_REQUIRED);
        if (!value.matches("\"(0|[1-9][0-9]*)\"")) throw new AppException(ErrorCode.BAD_REQUEST, "If-Match must contain one strong numeric profile revision ETag");
        try { return Long.parseLong(value.substring(1, value.length() - 1)); }
        catch (NumberFormatException exception) { throw new AppException(ErrorCode.BAD_REQUEST, "Invalid profile revision"); }
    }
}
