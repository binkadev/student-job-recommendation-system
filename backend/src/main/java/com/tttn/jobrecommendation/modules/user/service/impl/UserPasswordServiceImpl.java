package com.tttn.jobrecommendation.modules.user.service.impl;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.modules.user.dto.request.ChangePasswordRequest;
import com.tttn.jobrecommendation.modules.user.entity.User;
import com.tttn.jobrecommendation.modules.user.repository.UserRepository;
import com.tttn.jobrecommendation.modules.user.service.UserPasswordService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;

@Service
@RequiredArgsConstructor
public class UserPasswordServiceImpl implements UserPasswordService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest request) {
        validateEncoderSafeLength(request.getCurrentPassword());
        validateEncoderSafeLength(request.getNewPassword());

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new AppException(ErrorCode.INVALID_CURRENT_PASSWORD);
        }
        if (passwordEncoder.matches(request.getNewPassword(), user.getPasswordHash())) {
            throw new AppException(ErrorCode.BAD_REQUEST, "New password must differ from current password");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    private void validateEncoderSafeLength(String password) {
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Password must not exceed 72 UTF-8 bytes");
        }
    }
}
