package com.tttn.jobrecommendation.modules.auth.service;

import com.tttn.jobrecommendation.modules.auth.dto.request.LoginRequest;
import com.tttn.jobrecommendation.modules.auth.dto.request.RegisterRequest;
import com.tttn.jobrecommendation.modules.auth.dto.response.AuthUserResponse;
import com.tttn.jobrecommendation.modules.auth.dto.response.LoginResponse;

public interface AuthService {

    AuthUserResponse register(RegisterRequest request);

    LoginResponse login(LoginRequest request);

    AuthUserResponse getCurrentUser(Long userId);
}
