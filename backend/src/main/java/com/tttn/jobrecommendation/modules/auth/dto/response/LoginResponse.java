package com.tttn.jobrecommendation.modules.auth.dto.response;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class LoginResponse {

    private String token;
    private String tokenType;
    private long expiresIn;
    private AuthUserResponse user;
}
