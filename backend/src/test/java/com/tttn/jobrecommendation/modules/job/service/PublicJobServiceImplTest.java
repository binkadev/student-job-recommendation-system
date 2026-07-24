package com.tttn.jobrecommendation.modules.job.service;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.job.dto.request.PublicJobFilterRequest;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.entity.JobSkill;
import com.tttn.jobrecommendation.modules.job.mapper.PublicJobMapper;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.job.repository.JobSkillRepository;
import com.tttn.jobrecommendation.modules.skill.entity.Skill;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PublicJobServiceImplTest {

    @Mock
    private JobRepository jobRepository;

    @Mock
    private JobSkillRepository jobSkillRepository;

    @Test
    void listBatchLoadsSkillsOnceForTheWholePage() {
        Company company = Company.builder().id(1L).companyName("Company").status(CompanyStatus.VERIFIED).build();
        Job first = Job.builder().id(11L).company(company).title("First").status(JobStatus.ACTIVE).build();
        Job second = Job.builder().id(12L).company(company).title("Second").status(JobStatus.ACTIVE).build();
        JobSkill jobSkill = JobSkill.builder()
                .id(21L)
                .job(first)
                .skill(Skill.builder().id(31L).name("Java").build())
                .build();
        when(jobRepository.findAll(
                org.mockito.ArgumentMatchers.<Specification<Job>>any(),
                any(Pageable.class)
        )).thenReturn(new PageImpl<>(List.of(first, second)));
        when(jobSkillRepository.findByJobIdInOrderByJobIdAscIdAsc(List.of(11L, 12L)))
                .thenReturn(List.of(jobSkill));
        PublicJobServiceImpl service = new PublicJobServiceImpl(
                jobRepository,
                jobSkillRepository,
                new PublicJobMapper()
        );

        var result = service.getJobs(new PublicJobFilterRequest());

        assertThat(result.getItems()).hasSize(2);
        assertThat(result.getItems().get(0).getSkills()).hasSize(1);
        assertThat(result.getItems().get(1).getSkills()).isEmpty();
        verify(jobSkillRepository).findByJobIdInOrderByJobIdAscIdAsc(List.of(11L, 12L));
    }
}
