package com.tttn.jobrecommendation.modules.user.service.impl;

import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.common.enums.UserStatus;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.common.utils.PageableUtils;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.company.repository.CompanyRepository;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.entity.StudentProfile;
import com.tttn.jobrecommendation.modules.student.repository.StudentProfileRepository;
import com.tttn.jobrecommendation.modules.student.repository.StudentRepository;
import com.tttn.jobrecommendation.modules.user.dto.request.AdminUserFilterRequest;
import com.tttn.jobrecommendation.modules.user.dto.request.AdminUserStatusUpdateRequest;
import com.tttn.jobrecommendation.modules.user.dto.response.AdminUserDetailResponse;
import com.tttn.jobrecommendation.modules.user.dto.response.AdminUserResponse;
import com.tttn.jobrecommendation.modules.user.entity.User;
import com.tttn.jobrecommendation.modules.user.mapper.AdminUserMapper;
import com.tttn.jobrecommendation.modules.user.repository.UserRepository;
import com.tttn.jobrecommendation.modules.user.service.AdminUserService;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
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

@Service
@RequiredArgsConstructor
public class AdminUserServiceImpl implements AdminUserService {

    private static final Map<String, String> ALLOWED_SORTS = Map.of(
            "id", "id",
            "email", "email",
            "fullName", "fullName",
            "role", "role",
            "status", "status",
            "lastLoginAt", "lastLoginAt",
            "createdAt", "createdAt",
            "updatedAt", "updatedAt"
    );

    private final UserRepository userRepository;
    private final StudentRepository studentRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final CompanyRepository companyRepository;
    private final AdminUserMapper adminUserMapper;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<AdminUserResponse> getUsers(AdminUserFilterRequest request) {
        Pageable pageable = PageableUtils.createPageable(
                request.getPage(),
                request.getSize(),
                request.getSort(),
                "createdAt",
                Sort.Direction.DESC,
                ALLOWED_SORTS
        );

        Page<User> users = userRepository.findAll(buildSpecification(request), pageable);
        List<AdminUserResponse> items = users.getContent()
                .stream()
                .map(adminUserMapper::toAdminUserResponse)
                .toList();

        return new PageResponse<>(
                items,
                users.getNumber() + 1,
                users.getSize(),
                users.getTotalElements(),
                users.getTotalPages()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public AdminUserDetailResponse getUser(Long id) {
        User user = getUserById(id);
        Student student = null;
        StudentProfile studentProfile = null;
        Company company = null;

        if (user.getRole() == UserRole.STUDENT) {
            student = studentRepository.findByUserId(user.getId()).orElse(null);
            if (student != null) {
                studentProfile = studentProfileRepository.findByStudentId(student.getId()).orElse(null);
            }
        }

        if (user.getRole() == UserRole.COMPANY) {
            company = companyRepository.findByUserId(user.getId()).orElse(null);
        }

        return adminUserMapper.toAdminUserDetailResponse(user, student, studentProfile, company);
    }

    @Override
    @Transactional
    public AdminUserResponse updateStatus(Long id, AdminUserStatusUpdateRequest request, Long currentAdminUserId) {
        if (id.equals(currentAdminUserId) && request.getStatus() != UserStatus.ACTIVE) {
            throw new AppException(ErrorCode.BAD_REQUEST, "Admin cannot block or inactivate own account");
        }

        User user = getUserById(id);
        user.setStatus(request.getStatus());
        return adminUserMapper.toAdminUserResponse(userRepository.save(user));
    }

    private Specification<User> buildSpecification(AdminUserFilterRequest request) {
        return (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (request.getRole() != null) {
                predicates.add(criteriaBuilder.equal(root.get("role"), request.getRole()));
            }

            if (StringUtils.hasText(request.getFullName())) {
                predicates.add(criteriaBuilder.like(
                        criteriaBuilder.lower(root.get("fullName")),
                        likeValue(request.getFullName())
                ));
            }

            if (StringUtils.hasText(request.getKeyword())) {
                String keyword = likeValue(request.getKeyword());
                predicates.add(criteriaBuilder.or(
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("fullName")), keyword),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("email")), keyword),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("phone")), keyword)
                ));
            }

            if (request.getStatus() != null) {
                predicates.add(criteriaBuilder.equal(root.get("status"), request.getStatus()));
            }

            return criteriaBuilder.and(predicates.toArray(new Predicate[0]));
        };
    }

    private User getUserById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private String likeValue(String value) {
        return "%" + value.trim().toLowerCase(Locale.ROOT) + "%";
    }
}
