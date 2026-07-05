package com.tttn.jobrecommendation.modules.auth.mapper;

import com.tttn.jobrecommendation.modules.auth.dto.response.AuthUserResponse;
import com.tttn.jobrecommendation.modules.user.entity.User;
import org.springframework.stereotype.Component;

@Component
public class AuthMapper {

    public AuthUserResponse toAuthUserResponse(User user) {
        return AuthUserResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .role(user.getRole())
                .status(user.getStatus())
                .lastLoginAt(user.getLastLoginAt())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
