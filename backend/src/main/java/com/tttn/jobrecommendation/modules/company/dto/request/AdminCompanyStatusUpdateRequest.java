package com.tttn.jobrecommendation.modules.company.dto.request;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminCompanyStatusUpdateRequest {

    @NotNull
    private CompanyStatus status;
}
