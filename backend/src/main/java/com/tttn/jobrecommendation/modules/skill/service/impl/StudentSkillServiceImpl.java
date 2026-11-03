package com.tttn.jobrecommendation.modules.skill.service.impl;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.common.utils.SkillNameNormalizer;
import com.tttn.jobrecommendation.modules.skill.dto.request.StudentSkillItemRequest;
import com.tttn.jobrecommendation.modules.skill.dto.request.UpdateStudentSkillsRequest;
import com.tttn.jobrecommendation.modules.skill.dto.response.StudentSkillResponse;
import com.tttn.jobrecommendation.modules.skill.entity.Skill;
import com.tttn.jobrecommendation.modules.skill.entity.StudentSkill;
import com.tttn.jobrecommendation.modules.skill.mapper.StudentSkillMapper;
import com.tttn.jobrecommendation.modules.skill.repository.SkillRepository;
import com.tttn.jobrecommendation.modules.skill.repository.StudentSkillRepository;
import com.tttn.jobrecommendation.modules.skill.service.StudentSkillService;
import com.tttn.jobrecommendation.modules.skill.service.SkillCatalogService;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.repository.StudentRepository;
import com.tttn.jobrecommendation.modules.student.service.StudentProfileRevision;
import com.tttn.jobrecommendation.common.enums.SkillSource;
import org.springframework.transaction.annotation.Propagation;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

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
    private final SkillCatalogService skillCatalogService;
    private final StudentProfileRevision profileRevision;

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
    public List<StudentSkillResponse> updateMySkills(Long userId, UpdateStudentSkillsRequest request, Long revision) {
        profileRevision.claim(userId, revision);
        Student student = getStudentByUserId(userId);
        return replaceSkills(student, request.getSkills(), false);
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public List<StudentSkillResponse> updateManualSkills(Long userId, List<StudentSkillItemRequest> requestedSkills) {
        if (requestedSkills.stream().anyMatch(item -> item.getSource() != SkillSource.MANUAL))
            throw new AppException(ErrorCode.BAD_REQUEST, "manualSkills may contain only MANUAL skills");
        return replaceSkills(getStudentByUserId(userId), requestedSkills, true);
    }

    private List<StudentSkillResponse> replaceSkills(Student student, List<StudentSkillItemRequest> requestedSkills, boolean manualOnly) {
        List<PendingSkillItem> pendingItems = requestedSkills.stream()
                .map(this::resolveExistingSkill)
                .toList();
        validateUniqueSkills(pendingItems);
        List<ResolvedSkillItem> resolvedItems = pendingItems.stream()
                .map(this::materializeSkill)
                .toList();

        Set<Long> requestedSkillIds = resolvedItems.stream()
                .map(resolved -> resolved.skill().getId())
                .collect(Collectors.toSet());
        Map<Long, Skill> skillsById = skillRepository.findAllById(requestedSkillIds)
                .stream()
                .collect(Collectors.toMap(Skill::getId, Function.identity()));
        assertAllSkillsExist(requestedSkillIds, skillsById);

        List<StudentSkill> existingSkills = studentSkillRepository.findByStudentIdOrderByIdAsc(student.getId());
        Map<Long, StudentSkill> existingBySkillId = existingSkills.stream()
                .collect(Collectors.toMap(studentSkill -> studentSkill.getSkill().getId(), Function.identity()));

        if (manualOnly && existingSkills.stream().anyMatch(skill -> skill.getSource() != SkillSource.MANUAL && requestedSkillIds.contains(skill.getSkill().getId())))
            throw new AppException(ErrorCode.BAD_REQUEST, "A non-MANUAL skill cannot be replaced by a manual skill");

        List<StudentSkill> skillsToRemove = existingSkills.stream()
                .filter(skill -> !manualOnly || skill.getSource() == SkillSource.MANUAL)
                .filter(studentSkill -> !requestedSkillIds.contains(studentSkill.getSkill().getId()))
                .toList();
        studentSkillRepository.deleteAll(skillsToRemove);

        List<StudentSkill> skillsToSave = resolvedItems.stream()
                .map(item -> toStudentSkill(student, item.request(), skillsById.get(item.skill().getId()), existingBySkillId))
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
                skill.getId(),
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

    private PendingSkillItem resolveExistingSkill(StudentSkillItemRequest item) {
        boolean hasSkillId = item.getSkillId() != null;
        boolean hasSkillName = item.getSkillName() != null;
        if (hasSkillId == hasSkillName) {
            throw new AppException(ErrorCode.BAD_REQUEST, "Exactly one of skillId or skillName is required");
        }

        if (hasSkillId) {
            Skill skill = skillRepository.findById(item.getSkillId())
                    .orElseThrow(() -> new ResourceNotFoundException("Skill not found: " + item.getSkillId()));
            return new PendingSkillItem(item, skill, null, null, null);
        }

        String name = normalizeDisplayName(item.getSkillName());
        String normalizedName = SkillNameNormalizer.normalize(name);
        if (!StringUtils.hasText(normalizedName)) {
            throw new AppException(ErrorCode.BAD_REQUEST, "skillName must not be blank");
        }
        String category = normalizeCategory(item.getCategory());
        return new PendingSkillItem(
                item,
                skillCatalogService.findByNormalizedName(normalizedName).orElse(null),
                name,
                normalizedName,
                category
        );
    }

    private ResolvedSkillItem materializeSkill(PendingSkillItem pendingItem) {
        Skill skill = pendingItem.existingSkill() == null
                ? createOrReuseSkill(
                        pendingItem.displayName(),
                        pendingItem.normalizedName(),
                        pendingItem.category()
                )
                : pendingItem.existingSkill();
        return new ResolvedSkillItem(pendingItem.request(), skill);
    }

    private Skill createOrReuseSkill(String name, String normalizedName, String category) {
        return skillCatalogService.create(name, normalizedName, category);
    }

    private String normalizeDisplayName(String skillName) {
        String displayName = skillName == null ? "" : skillName.strip().replaceAll("\\s+", " ");
        if (!StringUtils.hasText(displayName)) {
            throw new AppException(ErrorCode.BAD_REQUEST, "skillName must not be blank");
        }
        if (displayName.length() > 150) {
            throw new AppException(ErrorCode.BAD_REQUEST, "skillName must not exceed 150 characters");
        }
        return displayName;
    }

    private String normalizeCategory(String category) {
        if (!StringUtils.hasText(category)) {
            return null;
        }
        String normalizedCategory = category.strip();
        if (normalizedCategory.length() > 100) {
            throw new AppException(ErrorCode.BAD_REQUEST, "category must not exceed 100 characters");
        }
        return normalizedCategory;
    }

    private void validateUniqueSkills(List<PendingSkillItem> pendingItems) {
        Set<String> skillKeys = new HashSet<>();
        for (PendingSkillItem pendingItem : pendingItems) {
            String skillKey = pendingItem.existingSkill() == null
                    ? "name:" + pendingItem.normalizedName()
                    : "id:" + pendingItem.existingSkill().getId();
            if (!skillKeys.add(skillKey)) {
                throw new AppException(ErrorCode.BAD_REQUEST, "Duplicate skill is not allowed");
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

    private record ResolvedSkillItem(StudentSkillItemRequest request, Skill skill) {
    }

    private record PendingSkillItem(
            StudentSkillItemRequest request,
            Skill existingSkill,
            String displayName,
            String normalizedName,
            String category
    ) {
    }
}
