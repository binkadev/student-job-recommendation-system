package com.tttn.jobrecommendation.modules.company.service.impl;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.common.utils.PageableUtils;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.application.repository.JobApplicationRepository;
import com.tttn.jobrecommendation.modules.company.dto.request.SaveCandidateRequest;
import com.tttn.jobrecommendation.modules.company.dto.request.SavedCandidateFilterRequest;
import com.tttn.jobrecommendation.modules.company.dto.response.SavedCandidateResponse;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.company.entity.SavedCandidate;
import com.tttn.jobrecommendation.modules.company.mapper.SavedCandidateMapper;
import com.tttn.jobrecommendation.modules.company.repository.CompanyRepository;
import com.tttn.jobrecommendation.modules.company.repository.SavedCandidateRepository;
import com.tttn.jobrecommendation.modules.company.service.SavedCandidateService;
import com.tttn.jobrecommendation.modules.student.entity.StudentProfile;
import com.tttn.jobrecommendation.modules.student.repository.StudentProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SavedCandidateServiceImpl implements SavedCandidateService {

    private static final Map<String, String> ALLOWED_SORTS = Map.of(
            "id", "id",
            "createdAt", "createdAt",
            "updatedAt", "updatedAt"
    );

    private final SavedCandidateRepository savedCandidateRepository;
    private final CompanyRepository companyRepository;
    private final JobApplicationRepository applicationRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final SavedCandidateMapper savedCandidateMapper;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<SavedCandidateResponse> getMySavedCandidates(
            Long userId,
            SavedCandidateFilterRequest request
    ) {
        Company company = getCompanyByUserId(userId);
        Pageable pageable = PageableUtils.createPageable(
                request.getPage(),
                request.getSize(),
                request.getSort(),
                "createdAt",
                Sort.Direction.DESC,
                ALLOWED_SORTS
        );

        Page<SavedCandidate> savedCandidates = savedCandidateRepository.findAll(
                buildSpecification(company.getId(), request.getKeyword()),
                pageable
        );
        Map<Long, StudentProfile> profilesByStudentId = getProfilesByStudentId(savedCandidates.getContent());
        List<SavedCandidateResponse> items = savedCandidates.getContent()
                .stream()
                .map(candidate -> savedCandidateMapper.toSavedCandidateResponse(
                        candidate,
                        profilesByStudentId.get(candidate.getStudent().getId())
                ))
                .toList();

        return new PageResponse<>(
                items,
                savedCandidates.getNumber() + 1,
                savedCandidates.getSize(),
                savedCandidates.getTotalElements(),
                savedCandidates.getTotalPages()
        );
    }

    @Override
    @Transactional
    public SavedCandidateResponse saveCandidate(Long userId, SaveCandidateRequest request) {
        Company company = getCompanyByUserId(userId);
        JobApplication application = applicationRepository.findDetailedById(request.getApplicationId())
                .orElseThrow(() -> new ResourceNotFoundException("Application not found"));

        if (!application.getJob().getCompany().getId().equals(company.getId())) {
            throw new AppException(ErrorCode.ACCESS_DENIED);
        }

        Long studentId = application.getStudent().getId();
        if (savedCandidateRepository.existsByCompanyIdAndApplicationId(company.getId(), application.getId())) {
            throw new AppException(ErrorCode.SAVED_CANDIDATE_ALREADY_EXISTS);
        }

        SavedCandidate savedCandidate = SavedCandidate.builder()
                .company(company)
                .student(application.getStudent())
                .application(application)
                .note(trimToNull(request.getNote()))
                .build();

        try {
            savedCandidate = savedCandidateRepository.saveAndFlush(savedCandidate);
        } catch (DataIntegrityViolationException exception) {
            throw new AppException(ErrorCode.SAVED_CANDIDATE_ALREADY_EXISTS);
        }

        StudentProfile profile = studentProfileRepository.findByStudentId(studentId).orElse(null);
        return savedCandidateMapper.toSavedCandidateResponse(savedCandidate, profile);
    }

    @Override
    @Transactional
    public void deleteSavedCandidate(Long userId, Long savedCandidateId) {
        Company company = getCompanyByUserId(userId);
        SavedCandidate savedCandidate = savedCandidateRepository.findByIdAndCompanyId(
                        savedCandidateId,
                        company.getId()
                )
                .orElseThrow(() -> new AppException(ErrorCode.SAVED_CANDIDATE_NOT_FOUND));
        savedCandidateRepository.delete(savedCandidate);
    }

    private Specification<SavedCandidate> buildSpecification(Long companyId, String rawKeyword) {
        return (root, query, criteriaBuilder) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            predicates.add(criteriaBuilder.equal(root.get("company").get("id"), companyId));

            if (StringUtils.hasText(rawKeyword)) {
                String keyword = likeValue(rawKeyword);
                var profileHeadline = query.subquery(Long.class);
                var profileRoot = profileHeadline.from(StudentProfile.class);
                profileHeadline.select(profileRoot.get("student").get("id"))
                        .where(
                                criteriaBuilder.equal(
                                        profileRoot.get("student").get("id"),
                                        root.get("student").get("id")
                                ),
                                criteriaBuilder.like(criteriaBuilder.lower(profileRoot.get("headline")), keyword)
                        );

                predicates.add(criteriaBuilder.or(
                        criteriaBuilder.like(
                                criteriaBuilder.lower(root.get("student").get("user").get("fullName")),
                                keyword
                        ),
                        criteriaBuilder.like(
                                criteriaBuilder.lower(root.get("student").get("user").get("email")),
                                keyword
                        ),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("student").get("university")), keyword),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("student").get("major")), keyword),
                        criteriaBuilder.like(
                                criteriaBuilder.lower(root.get("application").get("job").get("title")),
                                keyword
                        ),
                        criteriaBuilder.exists(profileHeadline)
                ));
            }

            return criteriaBuilder.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }

    private Map<Long, StudentProfile> getProfilesByStudentId(List<SavedCandidate> savedCandidates) {
        if (savedCandidates.isEmpty()) {
            return Map.of();
        }

        List<Long> studentIds = savedCandidates.stream()
                .map(candidate -> candidate.getStudent().getId())
                .toList();
        return studentProfileRepository.findByStudentIdIn(studentIds)
                .stream()
                .collect(Collectors.toMap(profile -> profile.getStudent().getId(), Function.identity()));
    }

    private Company getCompanyByUserId(Long userId) {
        return companyRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Company profile not found"));
    }

    private String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String likeValue(String value) {
        return "%" + value.trim().toLowerCase(Locale.ROOT) + "%";
    }
}
