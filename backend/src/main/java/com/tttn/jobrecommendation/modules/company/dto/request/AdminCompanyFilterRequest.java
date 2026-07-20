package com.tttn.jobrecommendation.modules.company.dto.request;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminCompanyFilterRequest {

    @Size(max = 255)
    private String keyword;

    @Size(max = 255)
    private String companyName;

    @Size(max = 100)
    private String taxCode;

    @Size(max = 150)
    private String industry;

    private CompanyStatus status;

    @Min(1)
    private Integer page = 1;

    @Min(1)
    @Max(100)
    private Integer size = 10;

    @Size(max = 100)
    private String sort;
}
