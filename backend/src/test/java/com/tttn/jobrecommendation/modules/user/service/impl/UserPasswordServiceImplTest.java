package com.tttn.jobrecommendation.modules.user.service.impl;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.modules.user.dto.request.ChangePasswordRequest;
import com.tttn.jobrecommendation.modules.user.entity.User;
import com.tttn.jobrecommendation.modules.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserPasswordServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    private UserPasswordServiceImpl service;
    private User user;

    @BeforeEach
    void setUp() {
        service = new UserPasswordServiceImpl(userRepository, passwordEncoder);
        user = User.builder().id(7L).passwordHash("old-hash").build();
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
    }

    @Test
    void verifiesCurrentPasswordAndPersistsOnlyAnEncodedReplacement() {
        ChangePasswordRequest request = request("current-secret", "new-secret");
        when(passwordEncoder.matches("current-secret", "old-hash")).thenReturn(true);
        when(passwordEncoder.matches("new-secret", "old-hash")).thenReturn(false);
        when(passwordEncoder.encode("new-secret")).thenReturn("new-hash");

        service.changePassword(7L, request);

        assertThat(user.getPasswordHash()).isEqualTo("new-hash");
        verify(userRepository).save(user);
    }

    @Test
    void wrongCurrentPasswordReturnsStableErrorWithoutEncoding() {
        when(passwordEncoder.matches("wrong", "old-hash")).thenReturn(false);

        assertThatThrownBy(() -> service.changePassword(7L, request("wrong", "new-secret")))
                .isInstanceOfSatisfying(AppException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.INVALID_CURRENT_PASSWORD));

        verify(passwordEncoder, never()).encode(org.mockito.ArgumentMatchers.anyString());
        verify(userRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void equivalentNewPasswordIsRejected() {
        when(passwordEncoder.matches("current-secret", "old-hash")).thenReturn(true);
        when(passwordEncoder.matches("same-secret", "old-hash")).thenReturn(true);

        assertThatThrownBy(() -> service.changePassword(7L, request("current-secret", "same-secret")))
                .isInstanceOfSatisfying(AppException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.BAD_REQUEST));

        verify(userRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    private ChangePasswordRequest request(String currentPassword, String newPassword) {
        ChangePasswordRequest request = new ChangePasswordRequest();
        request.setCurrentPassword(currentPassword);
        request.setNewPassword(newPassword);
        return request;
    }
}
