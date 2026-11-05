package com.tttn.jobrecommendation.modules.student.service.impl;

import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.modules.student.dto.request.StudentProfileUpdateRequest;
import com.tttn.jobrecommendation.modules.student.dto.request.StudentUpdateRequest;
import com.tttn.jobrecommendation.modules.student.dto.response.StudentProfileResponse;
import com.tttn.jobrecommendation.modules.student.dto.response.StudentResponse;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.entity.StudentProfile;
import com.tttn.jobrecommendation.modules.student.mapper.StudentMapper;
import com.tttn.jobrecommendation.modules.student.repository.StudentProfileRepository;
import com.tttn.jobrecommendation.modules.student.repository.StudentRepository;
import com.tttn.jobrecommendation.modules.student.service.StudentService;
import com.tttn.jobrecommendation.modules.student.service.StudentProfileRevision;
import com.tttn.jobrecommendation.modules.student.dto.request.StudentProfileAggregateUpdateRequest;
import com.tttn.jobrecommendation.modules.student.dto.response.StudentProfileAggregateResponse;
import com.tttn.jobrecommendation.modules.skill.service.StudentSkillService;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import org.springframework.transaction.annotation.Isolation;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Locale;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class StudentServiceImpl implements StudentService {

    private final StudentRepository studentRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final StudentMapper studentMapper;
    private final StudentProfileRevision profileRevision;
    private final StudentSkillService studentSkillService;

    @Override
    @Transactional(readOnly = true)
    public StudentResponse getMe(Long userId) {
        Student student = getStudentByUserId(userId);
        StudentProfile profile = getProfileByStudent(student);
        return studentMapper.toStudentResponse(student, profile);
    }

    @Override
    @Transactional
    public StudentResponse updateMe(Long userId, StudentUpdateRequest request, Long revision) {
        profileRevision.claim(userId, revision);
        Student student = getStudentByUserId(userId);
        StudentProfile profile = getOrCreateProfile(student);

        applyBasic(student, profile, request);
        studentRepository.flush();
        return studentMapper.toStudentResponse(student, profile);
    }

    private void applyBasic(Student student, StudentProfile profile, StudentUpdateRequest request) {

        if (StringUtils.hasText(request.getFullName())) {
            student.getUser().setFullName(request.getFullName().trim());
        }

        if (request.getPhone() != null) {
            student.getUser().setPhone(trimToNull(request.getPhone()));
        }

        if (request.getMajor() != null) {
            student.setMajor(trimToNull(request.getMajor()));
        }

        if (request.getUniversity() != null) {
            student.setUniversity(trimToNull(request.getUniversity()));
        }

        if (request.getGraduationYear() != null) {
            student.setGraduationYear(request.getGraduationYear());
        }

        if (request.getLocation() != null) {
            student.setLocation(trimToNull(request.getLocation()));
        }

        if (request.getHeadline() != null) {
            profile.setHeadline(trimToNull(request.getHeadline()));
            updateProfileCompleteness(profile);
        }

    }

    @Override
    @Transactional(readOnly = true)
    public StudentProfileResponse getMyProfile(Long userId) {
        Student student = getStudentByUserId(userId);
        StudentProfile profile = getProfileByStudent(student);
        return studentMapper.toStudentProfileResponse(profile);
    }

    @Override
    @Transactional
    public StudentProfileResponse updateMyProfile(Long userId, StudentProfileUpdateRequest request, Long revision) {
        profileRevision.claim(userId, revision);
        Student student = getStudentByUserId(userId);
        StudentProfile profile = getOrCreateProfile(student);

        applyProfile(profile, request);
        studentRepository.flush();
        return studentMapper.toStudentProfileResponse(profile);
    }

    private void applyProfile(StudentProfile profile, StudentProfileUpdateRequest request) {

        if (request.getSummary() != null) {
            profile.setSummary(trimToNull(request.getSummary()));
        }

        if (request.getEducation() != null) {
            profile.setEducation(trimToNull(request.getEducation()));
        }

        if (request.getExperience() != null) {
            profile.setExperience(trimToNull(request.getExperience()));
        }

        if (request.getProjects() != null) {
            profile.setProjects(trimToNull(request.getProjects()));
        }

        if (request.getTargetPosition() != null) {
            profile.setTargetPosition(trimToNull(request.getTargetPosition()));
        }

        if (request.getPreferredLocation() != null) {
            profile.setPreferredLocation(trimToNull(request.getPreferredLocation()));
        }

        if (request.getPreferredJobType() != null) {
            profile.setPreferredJobType(request.getPreferredJobType());
        }

        updateSearchText(profile);
        updateProfileCompleteness(profile);

    }

    @Override
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public StudentProfileAggregateResponse getAggregate(Long userId) {
        return aggregateSnapshot(getStudentByUserId(userId));
    }

    @Override
    @Transactional
    public StudentProfileAggregateResponse updateAggregate(Long userId, StudentProfileAggregateUpdateRequest request) {
        profileRevision.claim(userId, request.getRevision());
        Student student = getStudentByUserId(userId);
        StudentProfile profile = getOrCreateProfile(student);
        if (request.getStudent() != null) applyBasic(student, profile, request.getStudent());
        if (request.getProfile() != null && hasProfileChanges(request.getProfile())) applyProfile(profile, request.getProfile());
        if (request.getClearFields() != null) {
            for (var field : request.getClearFields()) {
                switch (field) {
                    case graduationYear -> {
                        if (request.getStudent() != null && request.getStudent().getGraduationYear() != null)
                            throw new AppException(ErrorCode.BAD_REQUEST, "Cannot set and clear graduationYear together");
                        student.setGraduationYear(null);
                    }
                    case preferredJobType -> {
                        if (request.getProfile() != null && request.getProfile().getPreferredJobType() != null)
                            throw new AppException(ErrorCode.BAD_REQUEST, "Cannot set and clear preferredJobType together");
                        profile.setPreferredJobType(null);
                        updateProfileCompleteness(profile);
                    }
                }
            }
        }
        if (request.getManualSkills() != null) studentSkillService.updateManualSkills(userId, request.getManualSkills());
        studentRepository.flush();
        return aggregateSnapshot(student);
    }

    private StudentProfileAggregateResponse aggregateSnapshot(Student student) {
        StudentProfile profile = getProfileByStudent(student);
        return new StudentProfileAggregateResponse(student.getProfileRevision(), studentMapper.toStudentResponse(student, profile),
                studentMapper.toStudentProfileResponse(profile), studentSkillService.getMySkills(student.getUser().getId()));
    }

    private boolean hasProfileChanges(StudentProfileUpdateRequest request) {
        return Stream.of(request.getSummary(), request.getEducation(), request.getExperience(), request.getProjects(),
                request.getTargetPosition(), request.getPreferredLocation(), request.getPreferredJobType()).anyMatch(value -> value != null);
    }

    private Student getStudentByUserId(Long userId) {
        return studentRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Student profile not found"));
    }

    private StudentProfile getOrCreateProfile(Student student) {
        return studentProfileRepository.findByStudentId(student.getId())
                .orElseGet(() -> studentProfileRepository.save(StudentProfile.builder()
                        .student(student)
                        .profileCompleteness(0)
                        .build()));
    }

    private StudentProfile getProfileByStudent(Student student) {
        return studentProfileRepository.findByStudentId(student.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Student profile details not found"));
    }

    private void updateSearchText(StudentProfile profile) {
        String rawText = Stream.of(
                        profile.getSummary(),
                        profile.getEducation(),
                        profile.getExperience(),
                        profile.getProjects(),
                        profile.getTargetPosition()
                )
                .filter(StringUtils::hasText)
                .map(String::trim)
                .collect(Collectors.joining("\n"));

        profile.setRawText(rawText);
        profile.setProcessedText(normalizeText(rawText));
    }

    private void updateProfileCompleteness(StudentProfile profile) {
        int total = 8;
        int completed = 0;

        if (StringUtils.hasText(profile.getHeadline())) {
            completed++;
        }
        if (StringUtils.hasText(profile.getSummary())) {
            completed++;
        }
        if (StringUtils.hasText(profile.getEducation())) {
            completed++;
        }
        if (StringUtils.hasText(profile.getExperience())) {
            completed++;
        }
        if (StringUtils.hasText(profile.getProjects())) {
            completed++;
        }
        if (StringUtils.hasText(profile.getTargetPosition())) {
            completed++;
        }
        if (StringUtils.hasText(profile.getPreferredLocation())) {
            completed++;
        }
        if (profile.getPreferredJobType() != null) {
            completed++;
        }

        profile.setProfileCompleteness(completed * 100 / total);
    }

    private String normalizeText(String rawText) {
        if (!StringUtils.hasText(rawText)) {
            return null;
        }
        return rawText.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }
}
