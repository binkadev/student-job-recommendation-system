package com.tttn.jobrecommendation.modules.skill.service.impl;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.skill.dto.request.SkillFilterRequest;
import com.tttn.jobrecommendation.modules.skill.dto.request.SkillRequest;
import com.tttn.jobrecommendation.modules.skill.dto.response.SkillResponse;
import com.tttn.jobrecommendation.modules.skill.entity.Skill;
import com.tttn.jobrecommendation.modules.skill.mapper.SkillMapper;
import com.tttn.jobrecommendation.modules.skill.repository.SkillRepository;
import com.tttn.jobrecommendation.modules.skill.service.SkillService;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class SkillServiceImpl implements SkillService {

    private final SkillRepository skillRepository;
    private final SkillMapper skillMapper;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<SkillResponse> getSkills(SkillFilterRequest request) {
        int pageNumber = request.getPage() == null ? 1 : request.getPage();
        int pageSize = request.getSize() == null ? 20 : request.getSize();
        Pageable pageable = PageRequest.of(
                Math.max(pageNumber, 1) - 1,
                Math.min(Math.max(pageSize, 1), 100),
                Sort.by(Sort.Direction.ASC, "name")
        );

        Page<Skill> page = skillRepository.findAll(buildSpecification(request), pageable);
        List<SkillResponse> items = page.getContent().stream()
                .map(skillMapper::toSkillResponse)
                .toList();

        return new PageResponse<>(
                items,
                page.getNumber() + 1,
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public SkillResponse getSkill(Long id) {
        return skillMapper.toSkillResponse(getSkillById(id));
    }

    @Override
    @Transactional
    public SkillResponse createSkill(SkillRequest request) {
        String normalizedName = normalize(request.getName());
        if (skillRepository.existsByNormalizedName(normalizedName)) {
            throw new AppException(ErrorCode.BAD_REQUEST, "Skill already exists");
        }

        Skill skill = Skill.builder()
                .name(request.getName().trim())
                .normalizedName(normalizedName)
                .category(trimToNull(request.getCategory()))
                .description(trimToNull(request.getDescription()))
                .build();

        return skillMapper.toSkillResponse(skillRepository.save(skill));
    }

    @Override
    @Transactional
    public SkillResponse updateSkill(Long id, SkillRequest request) {
        Skill skill = getSkillById(id);
        String normalizedName = normalize(request.getName());
        skillRepository.findByNormalizedName(normalizedName)
                .filter(existingSkill -> !existingSkill.getId().equals(id))
                .ifPresent(existingSkill -> {
                    throw new AppException(ErrorCode.BAD_REQUEST, "Skill already exists");
                });

        skill.setName(request.getName().trim());
        skill.setNormalizedName(normalizedName);
        skill.setCategory(trimToNull(request.getCategory()));
        skill.setDescription(trimToNull(request.getDescription()));

        return skillMapper.toSkillResponse(skillRepository.save(skill));
    }

    private Specification<Skill> buildSpecification(SkillFilterRequest request) {
        return (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (StringUtils.hasText(request.getKeyword())) {
                String keyword = "%" + request.getKeyword().trim().toLowerCase(Locale.ROOT) + "%";
                predicates.add(criteriaBuilder.or(
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("name")), keyword),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("normalizedName")), keyword)
                ));
            }

            if (StringUtils.hasText(request.getCategory())) {
                predicates.add(criteriaBuilder.equal(
                        criteriaBuilder.lower(root.get("category")),
                        request.getCategory().trim().toLowerCase(Locale.ROOT)
                ));
            }

            return criteriaBuilder.and(predicates.toArray(new Predicate[0]));
        };
    }

    private Skill getSkillById(Long id) {
        return skillRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Skill not found"));
    }

    private String normalize(String value) {
        return value.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }
}
