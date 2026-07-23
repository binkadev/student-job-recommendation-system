package com.tttn.jobrecommendation.integration;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.JobType;
import com.tttn.jobrecommendation.common.enums.WorkingModel;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.student.entity.SavedSearch;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.repository.SavedSearchRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SavedSearchApiIT extends AbstractPostgresWebIntegrationTest {

    @Autowired
    private SavedSearchRepository savedSearchRepository;

    private Student alice;
    private Student bob;

    @BeforeEach
    void createFixtures() {
        alice = createStudent("saved-search-alice@example.test");
        bob = createStudent("saved-search-bob@example.test");
    }

    @Test
    void studentCanCreateListReplaceAndDeleteOwnSavedSearch() throws Exception {
        String response = mockMvc.perform(post("/api/students/me/saved-searches")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(alice.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "  Java internships in HCM  ",
                                  "keyword": "  Java  ",
                                  "location": " Ho Chi Minh City ",
                                  "jobType": "INTERNSHIP",
                                  "workingModel": "ONSITE"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Java internships in HCM"))
                .andExpect(jsonPath("$.data.keyword").value("Java"))
                .andExpect(jsonPath("$.data.location").value("Ho Chi Minh City"))
                .andExpect(jsonPath("$.data.jobType").value("INTERNSHIP"))
                .andExpect(jsonPath("$.data.workingModel").value("ONSITE"))
                .andExpect(jsonPath("$.data.createdAt").isNotEmpty())
                .andExpect(jsonPath("$.data.updatedAt").isNotEmpty())
                .andReturn().getResponse().getContentAsString();

        SavedSearch savedSearch = savedSearchRepository.findAll().getFirst();
        assertThat(savedSearch.getStudent().getId()).isEqualTo(alice.getId());
        assertThat(response)
                .doesNotContain("studentId")
                .doesNotContain("userId")
                .doesNotContain("password");

        mockMvc.perform(get("/api/students/me/saved-searches")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(alice.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].id").value(savedSearch.getId()));

        mockMvc.perform(put("/api/students/me/saved-searches/{id}", savedSearch.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(alice.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Remote backend roles",
                                  "keyword": "Spring",
                                  "location": null,
                                  "jobType": "FULL_TIME",
                                  "workingModel": "REMOTE"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Remote backend roles"))
                .andExpect(jsonPath("$.data.keyword").value("Spring"))
                .andExpect(jsonPath("$.data.location").doesNotExist())
                .andExpect(jsonPath("$.data.jobType").value("FULL_TIME"))
                .andExpect(jsonPath("$.data.workingModel").value("REMOTE"));

        mockMvc.perform(delete("/api/students/me/saved-searches/{id}", savedSearch.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(alice.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(savedSearchRepository.count()).isZero();
    }

    @Test
    void ownershipIsDerivedAndForeignRecordsAreHidden() throws Exception {
        SavedSearch bobSearch = saveSearch(bob, "Bob only");

        mockMvc.perform(post("/api/students/me/saved-searches")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(alice.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Injected",
                                  "studentId": %d,
                                  "userId": %d
                                }
                                """.formatted(bob.getId(), bob.getUser().getId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("BAD_REQUEST"));

        mockMvc.perform(get("/api/students/me/saved-searches")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(alice.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));

        mockMvc.perform(put("/api/students/me/saved-searches/{id}", bobSearch.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(alice.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Takeover\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value("SAVED_SEARCH_NOT_FOUND"));

        mockMvc.perform(delete("/api/students/me/saved-searches/{id}", bobSearch.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(alice.getUser())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value("SAVED_SEARCH_NOT_FOUND"));
        assertThat(savedSearchRepository.findById(bobSearch.getId())).isPresent();
    }

    @Test
    void duplicateNamesAreCaseInsensitivePerStudentButAllowedAcrossStudents() throws Exception {
        createThroughApi(alice, "Java Roles").andExpect(status().isOk());
        createThroughApi(alice, "java roles")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("SAVED_SEARCH_ALREADY_EXISTS"));
        createThroughApi(bob, "JAVA ROLES").andExpect(status().isOk());

        assertThat(savedSearchRepository.count()).isEqualTo(2);
    }

    @Test
    void validationRejectsEmptyNamesUnknownEnumsAndNonStudentCallers() throws Exception {
        mockMvc.perform(post("/api/students/me/saved-searches")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(alice.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"   \",\"jobType\":\"NOT_A_TYPE\"}"))
                .andExpect(status().isBadRequest());

        Company company = createCompany("saved-search-company@example.test", "Company", CompanyStatus.VERIFIED);
        mockMvc.perform(get("/api/students/me/saved-searches")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(company.getUser())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("ACCESS_DENIED"));
    }

    @Test
    void deletingSavedSearchDoesNotAffectStudentOrJobData() throws Exception {
        Company company = createCompany("saved-search-job@example.test", "Jobs", CompanyStatus.VERIFIED);
        Job job = createJob(company, "Independent Job", JobStatus.ACTIVE);
        SavedSearch savedSearch = saveSearch(alice, "Disposable");

        mockMvc.perform(delete("/api/students/me/saved-searches/{id}", savedSearch.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(alice.getUser())))
                .andExpect(status().isOk());

        assertThat(studentRepository.findById(alice.getId())).isPresent();
        assertThat(jobRepository.findById(job.getId())).isPresent();
    }

    private org.springframework.test.web.servlet.ResultActions createThroughApi(Student student, String name)
            throws Exception {
        return mockMvc.perform(post("/api/students/me/saved-searches")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "name": "%s",
                          "jobType": "%s",
                          "workingModel": "%s"
                        }
                        """.formatted(name, JobType.INTERNSHIP, WorkingModel.HYBRID)));
    }

    private SavedSearch saveSearch(Student student, String name) {
        return savedSearchRepository.saveAndFlush(SavedSearch.builder()
                .student(student)
                .name(name)
                .build());
    }
}
