package com.tttn.jobrecommendation.integration;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.company.dto.request.PublicCompanyFilterRequest;
import com.tttn.jobrecommendation.modules.company.dto.response.CompanyJobSummaryResponse;
import com.tttn.jobrecommendation.modules.company.dto.response.PublicCompanyDetailResponse;
import com.tttn.jobrecommendation.modules.company.dto.response.PublicCompanyResponse;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.company.service.PublicCompanyService;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RepositoryFilterIT extends AbstractPostgresIntegrationTest {

    @Autowired
    private PublicCompanyService publicCompanyService;

    private Company verifiedCompany;
    private Company pendingCompany;
    private Company blockedCompany;
    private Job activeJob;

    @BeforeEach
    void createCompanyAndJobFixtures() {
        verifiedCompany = createCompany(
                "verified-company@example.test",
                "Verified Company",
                CompanyStatus.VERIFIED
        );
        pendingCompany = createCompany(
                "pending-company@example.test",
                "Pending Company",
                CompanyStatus.PENDING
        );
        blockedCompany = createCompany(
                "blocked-company@example.test",
                "Blocked Company",
                CompanyStatus.BLOCKED
        );

        activeJob = createJob(verifiedCompany, "Active Job", JobStatus.ACTIVE);
        createJob(verifiedCompany, "Draft Job", JobStatus.DRAFT);
        createJob(verifiedCompany, "Closed Job", JobStatus.CLOSED);
        createJob(pendingCompany, "Hidden Active Job", JobStatus.ACTIVE);
    }

    @Test
    void publicListReturnsVerifiedCompaniesAndCountsOnlyActiveJobs() {
        PageResponse<PublicCompanyResponse> response = publicCompanyService.getCompanies(
                new PublicCompanyFilterRequest()
        );

        assertThat(response.getTotalItems()).isEqualTo(1);
        assertThat(response.getItems()).hasSize(1);

        PublicCompanyResponse company = response.getItems().get(0);
        assertThat(company.getId()).isEqualTo(verifiedCompany.getId());
        assertThat(company.getStatus()).isEqualTo(CompanyStatus.VERIFIED);
        assertThat(company.getOpenJobs()).isEqualTo(1L);
    }

    @Test
    void publicDetailReturnsOnlyActiveJobs() {
        PublicCompanyDetailResponse response = publicCompanyService.getCompany(verifiedCompany.getId());

        assertThat(response.getId()).isEqualTo(verifiedCompany.getId());
        assertThat(response.getStatus()).isEqualTo(CompanyStatus.VERIFIED);
        assertThat(response.getOpenJobs()).isEqualTo(1L);
        assertThat(response.getJobs())
                .extracting(CompanyJobSummaryResponse::getId)
                .containsExactly(activeJob.getId());
        assertThat(response.getJobs())
                .extracting(CompanyJobSummaryResponse::getStatus)
                .containsOnly(JobStatus.ACTIVE);
    }

    @Test
    void nonVerifiedCompanyDetailsAreNotPublic() {
        assertThatThrownBy(() -> publicCompanyService.getCompany(pendingCompany.getId()))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Company not found");
        assertThatThrownBy(() -> publicCompanyService.getCompany(blockedCompany.getId()))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Company not found");
    }
}
