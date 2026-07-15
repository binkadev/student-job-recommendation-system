package com.tttn.jobrecommendation.modules.auth.service.impl;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.common.enums.UserStatus;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.common.security.JwtTokenProvider;
import com.tttn.jobrecommendation.modules.auth.dto.request.LoginRequest;
import com.tttn.jobrecommendation.modules.auth.dto.request.RegisterRequest;
import com.tttn.jobrecommendation.modules.auth.dto.response.AuthUserResponse;
import com.tttn.jobrecommendation.modules.auth.dto.response.LoginResponse;
import com.tttn.jobrecommendation.modules.auth.mapper.AuthMapper;
import com.tttn.jobrecommendation.modules.auth.service.AuthService;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.company.repository.CompanyRepository;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.entity.StudentProfile;
import com.tttn.jobrecommendation.modules.student.repository.StudentProfileRepository;
import com.tttn.jobrecommendation.modules.student.repository.StudentRepository;
import com.tttn.jobrecommendation.modules.user.entity.User;
import com.tttn.jobrecommendation.modules.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private static final String TOKEN_TYPE = "Bearer";

    private final UserRepository userRepository;
    private final StudentRepository studentRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final CompanyRepository companyRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuthMapper authMapper;

    @Override
    @Transactional
    public AuthUserResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.getEmail());
        if (userRepository.existsByEmail(email)) {
            throw new AppException(ErrorCode.EMAIL_ALREADY_EXISTS);
        }

        if (request.getRole() == UserRole.ADMIN) {
            throw new AppException(ErrorCode.BAD_REQUEST, "Admin users cannot self-register");
        }

        User user = User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .fullName(resolveFullName(request))
                .phone(trimToNull(request.getPhone()))
                .role(request.getRole())
                .status(UserStatus.ACTIVE)
                .build();

        User savedUser = userRepository.save(user);
        createRoleProfile(savedUser, request);

        return authMapper.toAuthUserResponse(savedUser);
    }

    @Override
    @Transactional
    public LoginResponse login(LoginRequest request) {
        String email = normalizeEmail(request.getEmail());
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.INVALID_CREDENTIALS));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new AppException(ErrorCode.INVALID_CREDENTIALS);
        }

        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new AppException(ErrorCode.ACCOUNT_DISABLED);
        }

        user.setLastLoginAt(LocalDateTime.now());
        User savedUser = userRepository.save(user);
        String token = jwtTokenProvider.generateToken(savedUser);

        return LoginResponse.builder()
                .token(token)
                .tokenType(TOKEN_TYPE)
                .expiresIn(jwtTokenProvider.getExpirationMs())
                .user(authMapper.toAuthUserResponse(savedUser))
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public AuthUserResponse getCurrentUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return authMapper.toAuthUserResponse(user);
    }

    private void createRoleProfile(User user, RegisterRequest request) {
        if (user.getRole() == UserRole.STUDENT) {
            Student student = studentRepository.save(Student.builder()
                    .user(user)
                    .build());

            studentProfileRepository.save(StudentProfile.builder()
                    .student(student)
                    .profileCompleteness(0)
                    .build());
        }

        if (user.getRole() == UserRole.COMPANY) {
            companyRepository.save(Company.builder()
                    .user(user)
                    .companyName(resolveCompanyName(request, user))
                    .phone(trimToNull(request.getPhone()))
                    .status(CompanyStatus.VERIFIED)
                    .build());
        }
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private String resolveFullName(RegisterRequest request) {
        if (StringUtils.hasText(request.getFullName())) {
            return request.getFullName().trim();
        }

        String email = normalizeEmail(request.getEmail());
        int atIndex = email.indexOf('@');
        if (atIndex > 0) {
            return email.substring(0, atIndex);
        }
        return email;
    }

    private String resolveCompanyName(RegisterRequest request, User user) {
        if (StringUtils.hasText(request.getCompanyName())) {
            return request.getCompanyName().trim();
        }
        return user.getFullName();
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }
}
