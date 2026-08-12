package com.tttn.jobrecommendation.integration;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ApplicationReapplyApiIT extends AbstractPostgresWebIntegrationTest {

    @Test
    void rejectedApplicationCanBeReappliedAsNewPendingHistoryRecord() throws Exception {
        Student student = createStudent("reapply-api-student@example.test");
        Company company = createCompany("reapply-api-company@example.test", "Reapply API", CompanyStatus.VERIFIED);
        Job job = createJob(company, "Reapply API Job", JobStatus.ACTIVE);
        JobApplication rejected = createApplication(student, job, null, ApplicationStatus.REJECTED);
        rejected.setCoverLetter("first letter");
        rejected = jobApplicationRepository.saveAndFlush(rejected);
        Long rejectedId = rejected.getId();

        mockMvc.perform(post("/api/jobs/{jobId}/apply", job.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"coverLetter\":\"second letter\"}")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.id").isNotEmpty());

        var history = jobApplicationRepository.findByStudentIdAndJobIdOrderByAppliedAtDescIdDesc(
                student.getId(), job.getId());
        assertThat(history).hasSize(2);
        assertThat(history).anyMatch(application -> application.getId().equals(rejectedId)
                && application.getStatus() == ApplicationStatus.REJECTED
                && "first letter".equals(application.getCoverLetter()));
        assertThat(history).anyMatch(application -> application.getStatus() == ApplicationStatus.PENDING
                && "second letter".equals(application.getCoverLetter()));

        mockMvc.perform(get("/api/students/me/applications")
                        .param("jobId", job.getId().toString())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2));
    }

    @Test
    void activeApplicationAndWithdrawnLatestHistoryBlockReapplicationWithDistinctErrors() throws Exception {
        Student student = createStudent("reapply-blocked-student@example.test");
        Company company = createCompany("reapply-blocked-company@example.test", "Blocked API", CompanyStatus.VERIFIED);
        Job activeJob = createJob(company, "Active application job", JobStatus.ACTIVE);
        Job withdrawnJob = createJob(company, "Withdrawn application job", JobStatus.ACTIVE);
        createApplication(student, activeJob, null, ApplicationStatus.PENDING);
        createApplication(student, withdrawnJob, null, ApplicationStatus.WITHDRAWN);

        mockMvc.perform(post("/api/jobs/{jobId}/apply", activeJob.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("APPLICATION_ALREADY_ACTIVE"));

        mockMvc.perform(post("/api/jobs/{jobId}/apply", withdrawnJob.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        "Reapplication is only allowed after the latest application was rejected"
                ));
    }
}
