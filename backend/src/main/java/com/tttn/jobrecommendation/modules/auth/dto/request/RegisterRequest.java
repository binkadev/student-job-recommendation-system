package com.tttn.jobrecommendation.modules.auth.dto.request;

import com.tttn.jobrecommendation.common.enums.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RegisterRequest {

    @NotBlank
    @Email
    private String email;

    @NotBlank
    @Size(min = 6)
    private String password;

    @NotNull
    private UserRole role;

    @Size(max = 255)
    private String fullName;

    @Size(max = 50)
    private String phone;

    @Size(max = 255)
    private String companyName;
}
