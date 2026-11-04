package com.tttn.jobrecommendation.integration;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.company.entity.SavedCandidate;
import com.tttn.jobrecommendation.modules.company.repository.SavedCandidateRepository;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.entity.StudentProfile;
import com.tttn.jobrecommendation.modules.student.repository.StudentProfileRepository;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SavedCandidateApiIT extends AbstractPostgresWebIntegrationTest {

    @Autowired
    private SavedCandidateRepository savedCandidateRepository;

    @Autowired
    private StudentProfileRepository studentProfileRepository;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    private Company acme;
    private Company beta;
    private Student alice;
    private Student bob;
    private Job acmeJob;
    private Job betaJob;
    private CvFile aliceCv;
    private JobApplication aliceApplication;
    private JobApplication bobApplication;

    @BeforeEach
    void createFixtures() {
        acme = createCompany("saved-acme@example.test", "Saved Acme", CompanyStatus.VERIFIED);
        beta = createCompany("saved-beta@example.test", "Saved Beta", CompanyStatus.VERIFIED);

        alice = createStudent("alice.candidate@example.test");
        alice.getUser().setFullName("Alice Orbit");
        userRepository.saveAndFlush(alice.getUser());
        alice.setUniversity("Hanoi Technical University");
        alice.setMajor("Software Engineering");
        studentRepository.saveAndFlush(alice);
        studentProfileRepository.saveAndFlush(StudentProfile.builder()
                .student(alice)
                .headline("Backend Platform Engineer")
                .profileCompleteness(80)
                .build());

        bob = createStudent("bob.candidate@example.test");
        bob.getUser().setFullName("Bob Vector");
        userRepository.saveAndFlush(bob.getUser());
        bob.setUniversity("Saigon Data College");
        bob.setMajor("Data Science");
        studentRepository.saveAndFlush(bob);
        studentProfileRepository.saveAndFlush(StudentProfile.builder()
                .student(bob)
                .headline("Analytics Intern")
                .profileCompleteness(60)
                .build());

        acmeJob = createJob(acme, "Java Cloud Intern", JobStatus.ACTIVE);
        betaJob = createJob(beta, "Python Data Intern", JobStatus.ACTIVE);
        aliceCv = createCv(alice, "private-storage-name.pdf", true);
        aliceCv.setOriginalFileName("alice-public-resume.pdf");
        aliceCv.setFilePath(CV_STORAGE_DIRECTORY.resolve("secret-internal-alice.pdf").toString());
        aliceCv = cvFileRepository.saveAndFlush(aliceCv);
        aliceApplication = createApplication(alice, acmeJob, aliceCv, ApplicationStatus.PENDING);
        bobApplication = createApplication(bob, betaJob, null, ApplicationStatus.REVIEWED);
    }

    @Test
    void companyCanSaveCandidateFromOwnedApplicationWithSafeResponse() throws Exception {
        String response = mockMvc.perform(post("/api/companies/me/saved-candidates")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(acme.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "applicationId": %d,
                                  "note": " Strong backend profile "
                                }
                                """.formatted(aliceApplication.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.applicationId").value(aliceApplication.getId()))
                .andExpect(jsonPath("$.data.studentId").value(alice.getId()))
                .andExpect(jsonPath("$.data.studentName").value("Alice Orbit"))
                .andExpect(jsonPath("$.data.studentEmail").value("alice.candidate@example.test"))
                .andExpect(jsonPath("$.data.university").value("Hanoi Technical University"))
                .andExpect(jsonPath("$.data.major").value("Software Engineering"))
                .andExpect(jsonPath("$.data.headline").value("Backend Platform Engineer"))
                .andExpect(jsonPath("$.data.jobId").value(acmeJob.getId()))
                .andExpect(jsonPath("$.data.jobTitle").value("Java Cloud Intern"))
                .andExpect(jsonPath("$.data.cvFileId").value(aliceCv.getId()))
                .andExpect(jsonPath("$.data.cvFileName").value("alice-public-resume.pdf"))
                .andExpect(jsonPath("$.data.note").value("Strong backend profile"))
                .andExpect(jsonPath("$.data.savedAt").isNotEmpty())
                .andExpect(jsonPath("$.data.updatedAt").isNotEmpty())
                .andReturn()
                .getResponse()
                .getContentAsString();

        assertThat(response)
                .doesNotContain("filePath")
                .doesNotContain("storedFileName")
                .doesNotContain("private-storage-name.pdf")
                .doesNotContain("secret-internal-alice.pdf")
                .doesNotContain(CV_STORAGE_DIRECTORY.toString());
    }

    @Test
    void anotherCompanyApplicationCannotBeSaved() throws Exception {
        mockMvc.perform(post("/api/companies/me/saved-candidates")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(acme.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"applicationId\": %d}".formatted(bobApplication.getId())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("ACCESS_DENIED"));
    }

    @Test
    void arbitraryStudentIdIsRejected() throws Exception {
        mockMvc.perform(post("/api/companies/me/saved-candidates")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(acme.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "applicationId": %d,
                                  "studentId": %d
                                }
                                """.formatted(aliceApplication.getId(), bob.getId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("BAD_REQUEST"));

        assertThat(savedCandidateRepository.count()).isZero();
    }

    @Test
    void duplicateCompanyStudentSaveReturnsConflict() throws Exception {
        String body = "{\"applicationId\": %d}".formatted(aliceApplication.getId());
        mockMvc.perform(post("/api/companies/me/saved-candidates")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(acme.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/companies/me/saved-candidates")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(acme.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("SAVED_CANDIDATE_ALREADY_EXISTS"));
    }

    @Test
    void companyListsOnlyItsOwnSavedCandidates() throws Exception {
        saveCandidate(acme, aliceApplication, "acme note");
        saveCandidate(beta, bobApplication, "beta note");

        mockMvc.perform(get("/api/companies/me/saved-candidates")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(acme.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(1))
                .andExpect(jsonPath("$.data.items[0].studentId").value(alice.getId()))
                .andExpect(jsonPath("$.data.items[0].note").value("acme note"));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "alice orbit",
            "ALICE.CANDIDATE",
            "hanoi technical",
            "software engineering",
            "backend platform",
            "java cloud"
    })
    void keywordSearchesEverySupportedCandidateField(String keyword) throws Exception {
        saveCandidate(acme, aliceApplication, null);
        Job secondAcmeJob = createJob(acme, "Unrelated QA Intern", JobStatus.ACTIVE);
        JobApplication secondAcmeApplication = createApplication(
                bob,
                secondAcmeJob,
                null,
                ApplicationStatus.PENDING
        );
        saveCandidate(acme, secondAcmeApplication, null);

        mockMvc.perform(get("/api/companies/me/saved-candidates")
                        .param("keyword", keyword)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(acme.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(1))
                .andExpect(jsonPath("$.data.items[0].studentId").value(alice.getId()));
    }

    @Test
    void paginationIsOneBasedAndSortWhitelistIsEnforced() throws Exception {
        saveCandidate(acme, aliceApplication, null);
        Job secondAcmeJob = createJob(acme, "QA Intern", JobStatus.ACTIVE);
        JobApplication secondApplication = createApplication(bob, secondAcmeJob, null, ApplicationStatus.PENDING);
        SavedCandidate second = saveCandidate(acme, secondApplication, null);

        mockMvc.perform(get("/api/companies/me/saved-candidates")
                        .param("page", "2")
                        .param("size", "1")
                        .param("sort", "id,asc")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(acme.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.page").value(2))
                .andExpect(jsonPath("$.data.size").value(1))
                .andExpect(jsonPath("$.data.totalItems").value(2))
                .andExpect(jsonPath("$.data.totalPages").value(2))
                .andExpect(jsonPath("$.data.items[0].id").value(second.getId()));

        mockMvc.perform(get("/api/companies/me/saved-candidates")
                        .param("sort", "studentEmail,asc")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(acme.getUser())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("BAD_REQUEST"));
    }

    @Test
    void deleteOwnedRecordOnlyDeletesTheSavedCandidate() throws Exception {
        SavedCandidate savedCandidate = saveCandidate(acme, aliceApplication, null);

        mockMvc.perform(delete("/api/companies/me/saved-candidates/{id}", savedCandidate.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(acme.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").doesNotExist());

        assertThat(savedCandidateRepository.findById(savedCandidate.getId())).isEmpty();
        assertThat(jobApplicationRepository.findById(aliceApplication.getId())).isPresent();
        assertThat(studentRepository.findById(alice.getId())).isPresent();
        assertThat(cvFileRepository.findById(aliceCv.getId())).isPresent();
        assertThat(jobRepository.findById(acmeJob.getId())).isPresent();
    }

    @Test
    void deleteForeignRecordIsHiddenAsNotFound() throws Exception {
        SavedCandidate betaSavedCandidate = saveCandidate(beta, bobApplication, null);

        mockMvc.perform(delete("/api/companies/me/saved-candidates/{id}", betaSavedCandidate.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(acme.getUser())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value("SAVED_CANDIDATE_NOT_FOUND"));

        assertThat(savedCandidateRepository.findById(betaSavedCandidate.getId())).isPresent();
    }

    @Test
    void withdrawnApplicationRemainsSaveable() throws Exception {
        aliceApplication.setStatus(ApplicationStatus.WITHDRAWN);
        jobApplicationRepository.saveAndFlush(aliceApplication);

        mockMvc.perform(post("/api/companies/me/saved-candidates")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(acme.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"applicationId\": %d}".formatted(aliceApplication.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.studentId").value(alice.getId()));
    }

    @Test
    void listUsesAConstantSmallNumberOfQueries() throws Exception {
        saveCandidate(acme, aliceApplication, null);
        Job secondAcmeJob = createJob(acme, "Second Intern", JobStatus.ACTIVE);
        JobApplication secondApplication = createApplication(bob, secondAcmeJob, null, ApplicationStatus.PENDING);
        saveCandidate(acme, secondApplication, null);

        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
        statistics.clear();

        mockMvc.perform(get("/api/companies/me/saved-candidates")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(acme.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(2));

        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(6);
    }

    @Test
    void noteUpdatePersistsAndStaleDraftCannotOverwriteIt() throws Exception {
        SavedCandidate saved = saveCandidate(acme, aliceApplication, "original");
        String path = "/api/companies/me/saved-candidates/" + saved.getId() + "/note";
        mockMvc.perform(patch(path).header(HttpHeaders.AUTHORIZATION, bearerToken(acme.getUser()))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"note\":\" revised note \",\"revision\":0}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.note").value("revised note"))
                .andExpect(jsonPath("$.data.revision").value(1))
                .andExpect(jsonPath("$.data.applicationStatus").value("PENDING"));
        mockMvc.perform(patch(path).header(HttpHeaders.AUTHORIZATION, bearerToken(acme.getUser()))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"stale\",\"revision\":0}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("SAVED_CANDIDATE_REVISION_CONFLICT"));
        assertThat(savedCandidateRepository.findById(saved.getId()).orElseThrow().getNote()).isEqualTo("revised note");
        assertThat(jobApplicationRepository.findById(aliceApplication.getId()).orElseThrow().getStatus()).isEqualTo(ApplicationStatus.PENDING);
        mockMvc.perform(patch(path).header(HttpHeaders.AUTHORIZATION, bearerToken(acme.getUser()))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"  \",\"revision\":1}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.note").isEmpty());
    }

    @Test
    void noteCannotBeReadOrWrittenByForeignCompanyOrStudent() throws Exception {
        SavedCandidate saved = saveCandidate(acme, aliceApplication, "private note");
        String path = "/api/companies/me/saved-candidates/" + saved.getId() + "/note";
        mockMvc.perform(patch(path).header(HttpHeaders.AUTHORIZATION, bearerToken(beta.getUser()))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"foreign\",\"revision\":0}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.errorCode").value("SAVED_CANDIDATE_NOT_FOUND"));
        mockMvc.perform(patch(path).header(HttpHeaders.AUTHORIZATION, bearerToken(alice.getUser()))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"student\",\"revision\":0}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/companies/me/saved-candidates").header(HttpHeaders.AUTHORIZATION, bearerToken(alice.getUser())))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/companies/me/saved-candidates")).andExpect(status().isUnauthorized());
        assertThat(savedCandidateRepository.findById(saved.getId()).orElseThrow().getNote()).isEqualTo("private note");
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"note\":\"x\"}", "{\"note\":\"x\",\"revision\":-1}", "{\"note\":\"x\",\"revision\":0,\"studentId\":1}"})
    void invalidNoteRequestsDoNotMutate(String body) throws Exception {
        SavedCandidate saved = saveCandidate(acme, aliceApplication, "original");
        mockMvc.perform(patch("/api/companies/me/saved-candidates/{id}/note", saved.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(acme.getUser()))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
        assertThat(savedCandidateRepository.findById(saved.getId()).orElseThrow().getNote()).isEqualTo("original");
    }

    @Test
    void noteLengthIsValidatedBeforePersistence() throws Exception {
        SavedCandidate saved = saveCandidate(acme, aliceApplication, "original");
        mockMvc.perform(patch("/api/companies/me/saved-candidates/{id}/note", saved.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(acme.getUser()))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"" + "x".repeat(2001) + "\",\"revision\":0}"))
                .andExpect(status().isBadRequest());
        assertThat(savedCandidateRepository.findById(saved.getId()).orElseThrow().getRevision()).isZero();
    }

    @Test
    void filtersUseCurrentSourceApplicationAndLiteralNoteSearchBeforePagination() throws Exception {
        saveCandidate(acme, aliceApplication, "100% match_under_score");
        JobApplication second = createApplication(bob, acmeJob, null, ApplicationStatus.REVIEWED);
        saveCandidate(acme, second, "other");
        aliceApplication.setStatus(ApplicationStatus.REJECTED);
        jobApplicationRepository.saveAndFlush(aliceApplication);
        mockMvc.perform(get("/api/companies/me/saved-candidates")
                        .param("keyword", "% match_").param("applicationStatus", "REJECTED")
                        .param("jobId", acmeJob.getId().toString()).param("studentId", alice.getId().toString()).param("size", "1")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(acme.getUser())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalItems").value(1))
                .andExpect(jsonPath("$.data.items[0].applicationStatus").value("REJECTED"));
        mockMvc.perform(get("/api/companies/me/saved-candidates").param("jobId", betaJob.getId().toString())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(acme.getUser())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalItems").value(0));
    }

    @Test
    void blockedCompanyRetainsOwnedBookmarkManagementUnderExistingPolicy() throws Exception {
        acme.setStatus(CompanyStatus.BLOCKED); companyRepository.saveAndFlush(acme);
        mockMvc.perform(post("/api/companies/me/saved-candidates")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(acme.getUser()))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"applicationId\":" + aliceApplication.getId() + "}"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/companies/me/saved-candidates").header(HttpHeaders.AUTHORIZATION, bearerToken(acme.getUser())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalItems").value(1));
    }

    @Test
    void simultaneousSavesAndDeletesHaveStableResponses() throws Exception {
        String token = bearerToken(acme.getUser());
        try (var executor = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var barrier = new java.util.concurrent.CyclicBarrier(2);
            java.util.concurrent.Callable<Integer> save = () -> {
                barrier.await(10, java.util.concurrent.TimeUnit.SECONDS);
                return mockMvc.perform(post("/api/companies/me/saved-candidates").header(HttpHeaders.AUTHORIZATION, token)
                                .contentType(MediaType.APPLICATION_JSON).content("{\"applicationId\":" + aliceApplication.getId() + "}"))
                        .andReturn().getResponse().getStatus();
            };
            var first = executor.submit(save); var second = executor.submit(save);
            assertThat(java.util.List.of(first.get(15, java.util.concurrent.TimeUnit.SECONDS), second.get(15, java.util.concurrent.TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(200, 409);
            assertThat(savedCandidateRepository.count()).isEqualTo(1);
            Long id = savedCandidateRepository.findAll().getFirst().getId();
            java.util.concurrent.Callable<Integer> remove = () -> {
                barrier.await(10, java.util.concurrent.TimeUnit.SECONDS);
                return mockMvc.perform(delete("/api/companies/me/saved-candidates/{id}", id).header(HttpHeaders.AUTHORIZATION, token))
                        .andReturn().getResponse().getStatus();
            };
            var deleteFirst = executor.submit(remove); var deleteSecond = executor.submit(remove);
            assertThat(java.util.List.of(deleteFirst.get(15, java.util.concurrent.TimeUnit.SECONDS), deleteSecond.get(15, java.util.concurrent.TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(200, 404);
            assertThat(savedCandidateRepository.count()).isZero();
            assertThat(jobApplicationRepository.findById(aliceApplication.getId())).isPresent();
        }
    }

    @Test
    void v20UpgradePreservesEveryExistingBookmarkFieldAndInitializesRevision() {
        SavedCandidate saved = saveCandidate(acme, aliceApplication, "Private assessment before V20");
        String original = jdbcTemplate.queryForObject("select (to_jsonb(s) - 'revision')::text from saved_candidates s where id = ?", String.class, saved.getId());
        String schema = "saved_candidate_upgrade_" + java.util.UUID.randomUUID().toString().replace("-", "");
        String sourceSchema = jdbcTemplate.queryForObject("select current_schema()", String.class);
        try {
            var configuration = org.flywaydb.core.Flyway.configure()
                    .dataSource(POSTGRESQL.getJdbcUrl(), POSTGRESQL.getUsername(), POSTGRESQL.getPassword())
                    .schemas(schema).defaultSchema(schema).createSchemas(true);
            configuration.target("19").load().migrate();
            for (String table : java.util.List.of("users", "students", "companies", "jobs", "cv_files", "applications")) {
                jdbcTemplate.execute("insert into " + schema + "." + table + " select * from " + sourceSchema + "." + table);
            }
            String columns = "id,company_id,student_id,application_id,note,created_at,updated_at";
            jdbcTemplate.execute("insert into " + schema + ".saved_candidates (" + columns + ") select " + columns + " from " + sourceSchema + ".saved_candidates");
            configuration.target(org.flywaydb.core.api.MigrationVersion.LATEST).load().migrate();
            assertThat(jdbcTemplate.queryForObject("select (to_jsonb(s) - 'revision')::text from " + schema + ".saved_candidates s where id = ?", String.class, saved.getId())).isEqualTo(original);
            assertThat(jdbcTemplate.queryForObject("select revision from " + schema + ".saved_candidates where id = ?", Long.class, saved.getId())).isZero();
        } finally {
            jdbcTemplate.execute("drop schema if exists " + schema + " cascade");
        }
    }

    private SavedCandidate saveCandidate(Company company, JobApplication application, String note) {
        return savedCandidateRepository.saveAndFlush(SavedCandidate.builder()
                .company(company)
                .student(application.getStudent())
                .application(application)
                .note(note)
                .build());
    }
}
