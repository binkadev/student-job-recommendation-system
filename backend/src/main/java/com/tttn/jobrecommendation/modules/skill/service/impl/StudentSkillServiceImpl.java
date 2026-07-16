package com.tttn.jobrecommendation.modules.skill.service.impl;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.modules.skill.dto.request.StudentSkillItemRequest;
import com.tttn.jobrecommendation.modules.skill.dto.request.UpdateStudentSkillsRequest;
import com.tttn.jobrecommendation.modules.skill.dto.response.StudentSkillResponse;
import com.tttn.jobrecommendation.modules.skill.entity.Skill;
import com.tttn.jobrecommendation.modules.skill.entity.StudentSkill;
import com.tttn.jobrecommendation.modules.skill.mapper.StudentSkillMapper;
import com.tttn.jobrecommendation.modules.skill.repository.SkillRepository;
import com.tttn.jobrecommendation.modules.skill.repository.StudentSkillRepository;
import com.tttn.jobrecommendation.modules.skill.service.StudentSkillService;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StudentSkillServiceImpl implements StudentSkillService {

    private final StudentRepository studentRepository;
    private final SkillRepository skillRepository;
    private final StudentSkillRepository studentSkillRepository;
    private final StudentSkillMapper studentSkillMapper;

    @Override
    @Transactional(readOnly = true)
    public List<StudentSkillResponse> getMySkills(Long userId) {
        Student student = getStudentByUserId(userId);
        return studentSkillRepository.findByStudentIdOrderByIdAsc(student.getId())
                .stream()
                .map(studentSkillMapper::toStudentSkillResponse)
                .toList();
    }

    @Override
    @Transactional
    public List<StudentSkillResponse> updateMySkills(Long userId, UpdateStudentSkillsRequest request) {
        Student student = getStudentByUserId(userId);
        List<StudentSkillItemRequest> requestedSkills = request.getSkills();
        validateUniqueSkillIds(requestedSkills);

        Set<Long> requestedSkillIds = requestedSkills.stream()
                .map(StudentSkillItemRequest::getSkillId)
                .collect(Collectors.toSet());
        Map<Long, Skill> skillsById = skillRepository.findAllById(requestedSkillIds)
                .stream()
                .collect(Collectors.toMap(Skill::getId, Function.identity()));
        assertAllSkillsExist(requestedSkillIds, skillsById);

        List<StudentSkill> existingSkills = studentSkillRepository.findByStudentIdOrderByIdAsc(student.getId());
        Map<Long, StudentSkill> existingBySkillId = existingSkills.stream()
                .collect(Collectors.toMap(studentSkill -> studentSkill.getSkill().getId(), Function.identity()));

        List<StudentSkill> skillsToRemove = existingSkills.stream()
                .filter(studentSkill -> !requestedSkillIds.contains(studentSkill.getSkill().getId()))
                .toList();
        studentSkillRepository.deleteAll(skillsToRemove);

        List<StudentSkill> skillsToSave = requestedSkills.stream()
                .map(item -> toStudentSkill(student, item, skillsById.get(item.getSkillId()), existingBySkillId))
                .toList();
        studentSkillRepository.saveAll(skillsToSave);

        return studentSkillRepository.findByStudentIdOrderByIdAsc(student.getId())
                .stream()
                .map(studentSkillMapper::toStudentSkillResponse)
                .toList();
    }

    private StudentSkill toStudentSkill(
            Student student,
            StudentSkillItemRequest item,
            Skill skill,
            Map<Long, StudentSkill> existingBySkillId
    ) {
        StudentSkill studentSkill = existingBySkillId.getOrDefault(
                item.getSkillId(),
                StudentSkill.builder()
                        .student(student)
                        .skill(skill)
                        .build()
        );

        studentSkill.setStudent(student);
        studentSkill.setSkill(skill);
        studentSkill.setLevel(item.getProficiencyLevel());
        studentSkill.setYearsOfExperience(item.getYearsOfExperience());
        studentSkill.setSource(item.getSource());
        return studentSkill;
    }

    private void validateUniqueSkillIds(List<StudentSkillItemRequest> requestedSkills) {
        Set<Long> skillIds = new HashSet<>();
        for (StudentSkillItemRequest requestedSkill : requestedSkills) {
            Long skillId = requestedSkill.getSkillId();
            if (skillId == null) {
                throw new AppException(ErrorCode.BAD_REQUEST, "skillId is required");
            }
            if (!skillIds.add(skillId)) {
                throw new AppException(ErrorCode.BAD_REQUEST, "Duplicate skillId is not allowed");
            }
        }
    }

    private void assertAllSkillsExist(Set<Long> requestedSkillIds, Map<Long, Skill> skillsById) {
        for (Long requestedSkillId : requestedSkillIds) {
            if (!skillsById.containsKey(requestedSkillId)) {
                throw new ResourceNotFoundException("Skill not found: " + requestedSkillId);
            }
        }
    }

    private Student getStudentByUserId(Long userId) {
        return studentRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Student profile not found"));
    }
}
