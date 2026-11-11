package com.tttn.jobrecommendation.modules.student.dto.request;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentCertificateItem {

    @NotBlank(message = "Certificate name must not be blank")
    @Size(max = 255)
    private String name;

    @Size(max = 255)
    private String issuer;

    @Size(max = 100)
    private String issuedAt;

    @Size(max = 100)
    private String expiresAt;

    @Size(max = 150)
    private String code;

    @Size(max = 500)
    @ValidHttpUrl
    private String url;

    @JsonAnySetter
    public void unknown(String field, Object value) {
        throw new IllegalArgumentException("Unsupported certificate field: " + field);
    }
}
