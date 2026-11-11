package com.tttn.jobrecommendation.modules.company.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CompanyUpdateRequest {

    @Size(max = 255)
    private String companyName;

    @Size(max = 100)
    private String taxCode;

    @Size(max = 5000)
    private String description;

    @Size(max = 500)
    private String website;

    @Size(max = 5000)
    private String address;

    @Size(max = 50)
    private String phone;

    @Size(max = 150)
    private String industry;

    /** Null/omitted keeps the saved value; an empty string clears it. */
    @Size(max = 100)
    private String companySize;

    /** Absolute HTTP(S), no credentials or whitespace; empty string clears it. */
    @Size(max = 500)
    @ValidLogoUrl
    private String logoUrl;

    /** Same URL rules as logoUrl; null/omitted preserves, empty string clears. */
    @Size(max = 500)
    @ValidLogoUrl
    private String coverImageUrl;
}
