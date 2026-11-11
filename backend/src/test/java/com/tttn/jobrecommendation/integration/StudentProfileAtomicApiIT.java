package com.tttn.jobrecommendation.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tttn.jobrecommendation.common.enums.*;
import com.tttn.jobrecommendation.modules.skill.entity.Skill;
import com.tttn.jobrecommendation.modules.skill.entity.StudentSkill;
import com.tttn.jobrecommendation.modules.skill.repository.SkillRepository;
import com.tttn.jobrecommendation.modules.skill.repository.StudentSkillRepository;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.entity.StudentProfile;
import com.tttn.jobrecommendation.modules.student.repository.StudentProfileRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class StudentProfileAtomicApiIT extends AbstractPostgresWebIntegrationTest {
    private static final String URL = "/api/students/me/profile-aggregate";
    @Autowired ObjectMapper mapper;
    @Autowired StudentProfileRepository profiles;
    @Autowired SkillRepository skills;
    @Autowired StudentSkillRepository studentSkills;
    @Autowired PlatformTransactionManager transactionManager;

    private Student student(String name) {
        Student student = createStudent(name + "@example.test");
        student.setMajor("Existing major"); student.setGraduationYear(2026); studentRepository.saveAndFlush(student);
        profiles.saveAndFlush(StudentProfile.builder().student(student).summary("Existing summary").education("Line one\nLine two")
                .projects("Keep projects").headline("Existing headline").preferredJobType(JobType.INTERNSHIP)
                .gpa(new BigDecimal("3.50")).educationLevel("BACHELOR").profileCompleteness(50).build());
        return student;
    }
    private JsonNode snapshot(Student student) throws Exception {
        var result = mockMvc.perform(get(URL).header("Authorization", bearerToken(student.getUser()))).andExpect(status().isOk()).andReturn();
        return mapper.readTree(result.getResponse().getContentAsString()).path("data");
    }
    private org.springframework.test.web.servlet.ResultActions save(Student student, Object payload) throws Exception {
        return mockMvc.perform(put(URL).header("Authorization", bearerToken(student.getUser())).contentType("application/json").content(mapper.writeValueAsString(payload)));
    }
    private Map<String, Object> manual(String name, double years) {
        return Map.of("skillName", name, "proficiencyLevel", "INTERMEDIATE", "source", "MANUAL", "yearsOfExperience", years);
    }

    @Test void fullSaveIsAtomicReturnsCommittedSnapshotAndPreservesUnsupportedFields() throws Exception {
        Student student = student("full");
        var cv = createCv(student, "profile-independent.pdf", true);
        var response = save(student, Map.of("revision", 0, "student", Map.of("fullName", "Atomic Name", "phone", "012345", "headline", "New headline"),
                        "profile", Map.of("summary", "New summary", "experience", "New experience"), "manualSkills", List.of(manual("AtomicSkill", 1))))
                .andExpect(status().isOk()).andExpect(header().string("ETag", "\"1\""))
                .andExpect(jsonPath("$.data.revision").value(1)).andExpect(jsonPath("$.data.student.fullName").value("Atomic Name"))
                .andExpect(jsonPath("$.data.profile.summary").value("New summary")).andExpect(jsonPath("$.data.skills[0].skillName").value("AtomicSkill")).andReturn();
        assertThat(snapshot(student)).isEqualTo(mapper.readTree(response.getResponse().getContentAsString()).path("data"));
        var profile = profiles.findByStudentId(student.getId()).orElseThrow();
        assertThat(profile.getGpa()).isEqualByComparingTo("3.50"); assertThat(profile.getEducationLevel()).isEqualTo("BACHELOR");
        assertThat(profile.getEducation()).isEqualTo("Line one\nLine two"); assertThat(profile.getProjects()).isEqualTo("Keep projects");
        assertThat(profile.getRawText()).contains("New summary", "New experience", "Keep projects");
        assertThat(cvFileRepository.findById(cv.getId()).orElseThrow().getUpdatedAt()).isEqualTo(cv.getUpdatedAt());
    }

    @Test void invalidNestedFieldsNeverWriteAnySectionOrRevision() throws Exception {
        Student student = student("invalid"); var before = snapshot(student);
        save(student, Map.of("revision", 0, "student", Map.of("fullName", "Must not persist"), "profile", Map.of("summary", "x".repeat(5001))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("VALIDATION_ERROR"));
        assertThat(snapshot(student)).isEqualTo(before);
    }

    @Test void skillResolutionFailureRollsBackBasicsProfileAndRevision() throws Exception {
        Student student = student("missing-skill"); var before = snapshot(student);
        save(student, Map.of("revision", 0, "student", Map.of("fullName", "Must not persist"), "profile", Map.of("summary", "Must not persist"),
                        "manualSkills", List.of(Map.of("skillId", Long.MAX_VALUE, "proficiencyLevel", "BEGINNER", "source", "MANUAL"))))
                .andExpect(status().isNotFound());
        assertThat(snapshot(student)).isEqualTo(before);
    }

    @Test void realSkillDatabaseFailureRollsBackAlreadyFlushedFieldsAndNewCatalogEntry() throws Exception {
        Student student = student("db-failure"); var before = snapshot(student);
        jdbcTemplate.execute("ALTER TABLE student_skills ADD CONSTRAINT atomic_test_failure CHECK (years_of_experience <> 9.9)");
        try {
            save(student, Map.of("revision", 0, "student", Map.of("fullName", "Must rollback"), "profile", Map.of("summary", "Must rollback"),
                            "manualSkills", List.of(manual("Atomic doomed catalog", 9.9))))
                    .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.errorCode").value("INTERNAL_SERVER_ERROR"));
            assertThat(snapshot(student)).isEqualTo(before);
            assertThat(skills.findByNormalizedName("atomic doomed catalog")).isEmpty();
            assertThat(studentSkills.findByStudentIdOrderByIdAsc(student.getId())).isEmpty();
        } finally { jdbcTemplate.execute("ALTER TABLE student_skills DROP CONSTRAINT atomic_test_failure"); }
    }

    @Test void staleTabCannotOverwriteAndExplicitRetryWithFreshRevisionSucceeds() throws Exception {
        Student student = student("tabs");
        save(student, Map.of("revision", 0, "profile", Map.of("summary", "Tab A"))).andExpect(status().isOk());
        save(student, Map.of("revision", 0, "profile", Map.of("summary", "Tab B")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("PROFILE_REVISION_CONFLICT"));
        assertThat(snapshot(student).path("profile").path("summary").asText()).isEqualTo("Tab A");
        save(student, Map.of("revision", 1, "profile", Map.of("summary", "Tab B after review"))).andExpect(status().isOk()).andExpect(jsonPath("$.data.revision").value(2));
    }

    @Test void realConcurrentPostgresRequestsHaveOneWinnerAndOneConflict() throws Exception {
        Student student = student("concurrent"); CyclicBarrier start = new CyclicBarrier(2);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var tasks = List.of("First", "Second").stream().<java.util.concurrent.Callable<Integer>>map(name -> () -> {
                start.await(); return save(student, Map.of("revision", 0, "student", Map.of("fullName", name), "profile", Map.of("summary", name)))
                        .andReturn().getResponse().getStatus();
            }).toList();
            var results = pool.invokeAll(tasks);
            assertThat(List.of(results.get(0).get(), results.get(1).get())).containsExactlyInAnyOrder(200, 409);
        }
        var current = snapshot(student); assertThat(current.path("revision").asInt()).isEqualTo(1);
        assertThat(current.path("student").path("fullName").asText()).isEqualTo(current.path("profile").path("summary").asText());
    }

    @Test void legacyEndpointsKeepBodiesRequirePreconditionAndInvalidateStaleAggregate() throws Exception {
        Student student = student("legacy"); long revision = 0;
        for (String route : List.of("/api/students/me", "/api/students/me/profile", "/api/students/me/skills")) {
            String body = route.endsWith("skills") ? "{\"skills\":[]}" : "{}";
            mockMvc.perform(put(route).header("Authorization", bearerToken(student.getUser())).contentType("application/json").content(body))
                    .andExpect(status().is(428)).andExpect(jsonPath("$.errorCode").value("PROFILE_REVISION_REQUIRED"));
            mockMvc.perform(get(route).header("Authorization", bearerToken(student.getUser())))
                    .andExpect(status().isOk()).andExpect(header().string("ETag", "\"" + revision + "\""));
            mockMvc.perform(put(route).header("Authorization", bearerToken(student.getUser())).header("If-Match", "\"" + revision + "\"")
                            .contentType("application/json").content(body)).andExpect(status().isOk())
                    .andExpect(header().string("ETag", "\"" + (revision + 1) + "\"")).andExpect(jsonPath("$.data.revision").doesNotExist());
            mockMvc.perform(put(route).header("Authorization", bearerToken(student.getUser())).header("If-Match", "\"" + revision + "\"")
                            .contentType("application/json").content(body)).andExpect(status().isConflict());
            save(student, Map.of("revision", revision)).andExpect(status().isConflict());
            revision++;
        }
        assertThat(snapshot(student).path("revision").asLong()).isEqualTo(3);
    }

    @Test void legacyAndAggregateCompeteUsingTheSameAtomicRevisionGuard() throws Exception {
        Student student = student("legacy-race"); CyclicBarrier start = new CyclicBarrier(2);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var old = pool.submit(() -> { start.await(); return mockMvc.perform(put("/api/students/me/profile").header("Authorization", bearerToken(student.getUser()))
                    .header("If-Match", "\"0\"").contentType("application/json").content("{\"summary\":\"Legacy\"}")).andReturn().getResponse().getStatus(); });
            var modern = pool.submit(() -> { start.await(); return save(student, Map.of("revision", 0, "profile", Map.of("summary", "Aggregate"))).andReturn().getResponse().getStatus(); });
            assertThat(List.of(old.get(), modern.get())).containsExactlyInAnyOrder(200, 409);
        }
        assertThat(snapshot(student).path("revision").asLong()).isEqualTo(1);
    }

    @Test void manualReplacementPreservesNonManualRowsAndRejectsProvenanceOverride() throws Exception {
        Student student = student("sources");
        for (SkillSource source : SkillSource.values()) {
            Skill skill = skills.saveAndFlush(Skill.builder().name(source.name()).normalizedName(source.name().toLowerCase()).build());
            studentSkills.saveAndFlush(StudentSkill.builder().student(student).skill(skill).source(source).level(SkillLevel.ADVANCED).yearsOfExperience(null).build());
        }
        var original = studentSkills.findByStudentIdOrderByIdAsc(student.getId()).stream().filter(s -> s.getSource() != SkillSource.MANUAL).map(StudentSkill::getId).toList();
        save(student, Map.of("revision", 0, "manualSkills", List.of())).andExpect(status().isOk()).andExpect(jsonPath("$.data.skills.length()").value(2));
        assertThat(studentSkills.findByStudentIdOrderByIdAsc(student.getId())).extracting(StudentSkill::getId).containsExactlyElementsOf(original);
        var before = snapshot(student);
        save(student, Map.of("revision", 1, "manualSkills", List.of(Map.of("skillName", "CV_EXTRACTED", "source", "MANUAL", "proficiencyLevel", "BEGINNER"))))
                .andExpect(status().isBadRequest());
        save(student, Map.of("revision", 1, "manualSkills", List.of(Map.of("skillName", "Invented provenance", "source", "CV_EXTRACTED", "proficiencyLevel", "BEGINNER"))))
                .andExpect(status().isBadRequest());
        assertThat(snapshot(student)).isEqualTo(before);
        assertThat(studentSkills.findByStudentIdOrderByIdAsc(student.getId())).allSatisfy(s -> {
            assertThat(s.getLevel()).isEqualTo(SkillLevel.ADVANCED); assertThat(s.getYearsOfExperience()).isNull();
        });
    }

    @Test void omittedNullAndExplicitClearsAreDistinctAndUnrequestedDataSurvives() throws Exception {
        Student student = student("clears");
        save(student, mapper.readValue("{\"revision\":0,\"student\":{\"major\":null},\"profile\":{\"summary\":null}}", Map.class))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.student.major").value("Existing major")).andExpect(jsonPath("$.data.profile.summary").value("Existing summary"));
        save(student, Map.of("revision", 1, "student", Map.of("major", ""), "profile", Map.of("summary", ""), "clearFields", List.of("graduationYear", "preferredJobType")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.student.major").isEmpty()).andExpect(jsonPath("$.data.profile.summary").isEmpty())
                .andExpect(jsonPath("$.data.student.graduationYear").isEmpty()).andExpect(jsonPath("$.data.profile.preferredJobType").isEmpty());
        assertThat(snapshot(student).path("profile").path("projects").asText()).isEqualTo("Keep projects");
    }

    @Test void revisionOnlyMutationDoesNotRewriteUnrequestedProfileFieldsOrTimestamps() throws Exception {
        Student student = student("revision-only"); var before = snapshot(student);
        save(student, Map.of("revision", 0, "student", Map.of(), "profile", Map.of())).andExpect(status().isOk());
        var after = snapshot(student);
        assertThat(after.path("revision").asLong()).isEqualTo(1);
        assertThat(after.path("student")).isEqualTo(before.path("student"));
        assertThat(after.path("profile")).isEqualTo(before.path("profile"));
        assertThat(after.path("skills")).isEqualTo(before.path("skills"));
    }

    @Test void ownershipCannotBeInjectedAndWrongRolesCannotReadOrWrite() throws Exception {
        Student a = student("owner-a"); Student b = student("owner-b"); var before = snapshot(a);
        save(b, Map.of("revision", 0, "studentId", a.getId(), "profile", Map.of("summary", "Forged"))).andExpect(status().isBadRequest());
        save(b, Map.of("revision", 0, "student", Map.of("userId", a.getUser().getId()))).andExpect(status().isBadRequest());
        save(b, Map.of("revision", 0, "profile", Map.of("summary", "Only B"))).andExpect(status().isOk());
        assertThat(snapshot(a)).isEqualTo(before);
        for (UserRole role : List.of(UserRole.COMPANY, UserRole.ADMIN)) {
            var actor = createUser("denied-" + role + "@example.test", role);
            mockMvc.perform(get(URL).header("Authorization", bearerToken(actor))).andExpect(status().isForbidden());
            mockMvc.perform(put(URL).header("Authorization", bearerToken(actor)).contentType("application/json").content("{\"revision\":0}"))
                    .andExpect(status().isForbidden());
        }
    }

    @Test void concurrentStudentsCreatingSameCustomCatalogNameReuseOneSkill() throws Exception {
        Student a = student("catalog-a"), b = student("catalog-b"); CyclicBarrier start = new CyclicBarrier(2);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var futures = pool.invokeAll(List.of(a, b).stream().<java.util.concurrent.Callable<Integer>>map(s -> () -> {
                start.await(); return save(s, Map.of("revision", 0, "manualSkills", List.of(manual("Shared Atomic Skill", 0)))).andReturn().getResponse().getStatus();
            }).toList());
            assertThat(List.of(futures.get(0).get(), futures.get(1).get())).containsOnly(200);
        }
        assertThat(studentSkills.findByStudentIdOrderByIdAsc(a.getId()).getFirst().getSkill().getId())
                .isEqualTo(studentSkills.findByStudentIdOrderByIdAsc(b.getId()).getFirst().getSkill().getId());
    }

    @Test void malformedVersionsAndPreconditionsCannotBecomeUnconditionalWrites() throws Exception {
        Student student = student("versions"); var before = snapshot(student);
        for (String body : List.of("{}", "{\"revision\":null}", "{\"revision\":-1}", "{\"revision\":0.5}", "{\"revision\":\"0\"}",
                "{\"revision\":0,\"manualSkills\":[null]}", "{\"revision\":0,\"clearFields\":[\"unknown\"]}",
                "{\"revision\":0,\"student\":{\"graduationYear\":2026},\"clearFields\":[\"graduationYear\"]}")) {
            mockMvc.perform(put(URL).header("Authorization", bearerToken(student.getUser())).contentType("application/json").content(body)).andExpect(status().isBadRequest());
            assertThat(snapshot(student)).isEqualTo(before);
        }
        for (String tag : List.of("*", "W/\"0\"", "0", "\"0\",\"1\"", "\"9223372036854775808\"")) {
            mockMvc.perform(put("/api/students/me/profile").header("Authorization", bearerToken(student.getUser())).header("If-Match", tag)
                            .contentType("application/json").content("{\"summary\":\"Must not persist\"}")).andExpect(status().isBadRequest());
            assertThat(snapshot(student)).isEqualTo(before);
        }
    }

    @Test void unrelatedStaleUserTimestampWriteCannotUndoCommittedProfileFields() throws Exception {
        Student student = student("user-write");
        try (var pool = Executors.newSingleThreadExecutor()) {
            new TransactionTemplate(transactionManager).executeWithoutResult(transaction -> {
                var staleUser = userRepository.findById(student.getUser().getId()).orElseThrow();
                try {
                    assertThat(pool.submit(() -> save(student, Map.of("revision", 0, "student", Map.of("fullName", "Atomic new name", "phone", "0123456")))
                            .andReturn().getResponse().getStatus()).get()).isEqualTo(200);
                } catch (Exception e) { throw new AssertionError(e); }
                // Same stale entity write shape as login. DynamicUpdate prevents
                // unrelated password/status/timestamp writes from undoing profile fields.
                staleUser.setLastLoginAt(java.time.LocalDateTime.now()); userRepository.saveAndFlush(staleUser);
            });
        }
        assertThat(snapshot(student).path("student").path("fullName").asText()).isEqualTo("Atomic new name");
        assertThat(snapshot(student).path("student").path("phone").asText()).isEqualTo("0123456");
    }

    @Test void persistsAcademicWorkModelLinksCertificatesAndLanguagesAndPreservesOnOmittedUpdates() throws Exception {
        Student student = student("extensions-persist");
        var certificates = List.of(Map.of(
                "name", "AWS Certified Developer",
                "issuer", "Amazon Web Services",
                "issuedAt", "2026-01",
                "expiresAt", "2029-01",
                "code", "AWS-DEV-001",
                "url", "https://aws.amazon.com/verification"
        ));
        var languages = List.of(
                Map.of("name", "English", "level", "IELTS 7.5"),
                Map.of("name", "Japanese", "level", "JLPT N3")
        );

        save(student, Map.of(
                "revision", 0,
                "profile", Map.of(
                        "gpa", new BigDecimal("3.85"),
                        "educationLevel", "MASTER",
                        "preferredWorkingModel", "HYBRID",
                        "githubUrl", "https://github.com/student-dev",
                        "linkedinUrl", "https://linkedin.com/in/student-dev",
                        "portfolioUrl", "https://student-dev.example.com",
                        "certificates", certificates,
                        "languages", languages
                )
        ))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.revision").value(1))
                .andExpect(jsonPath("$.data.profile.gpa").value(3.85))
                .andExpect(jsonPath("$.data.profile.educationLevel").value("MASTER"))
                .andExpect(jsonPath("$.data.profile.preferredWorkingModel").value("HYBRID"))
                .andExpect(jsonPath("$.data.profile.githubUrl").value("https://github.com/student-dev"))
                .andExpect(jsonPath("$.data.profile.linkedinUrl").value("https://linkedin.com/in/student-dev"))
                .andExpect(jsonPath("$.data.profile.portfolioUrl").value("https://student-dev.example.com"))
                .andExpect(jsonPath("$.data.profile.certificates.length()").value(1))
                .andExpect(jsonPath("$.data.profile.certificates[0].name").value("AWS Certified Developer"))
                .andExpect(jsonPath("$.data.profile.languages.length()").value(2))
                .andExpect(jsonPath("$.data.profile.languages[0].name").value("English"));

        var stored = profiles.findByStudentId(student.getId()).orElseThrow();
        assertThat(stored.getGpa()).isEqualByComparingTo("3.85");
        assertThat(stored.getEducationLevel()).isEqualTo("MASTER");
        assertThat(stored.getPreferredWorkingModel()).isEqualTo(WorkingModel.HYBRID);
        assertThat(stored.getGithubUrl()).isEqualTo("https://github.com/student-dev");
        assertThat(stored.getLinkedinUrl()).isEqualTo("https://linkedin.com/in/student-dev");
        assertThat(stored.getPortfolioUrl()).isEqualTo("https://student-dev.example.com");
        assertThat(stored.getCertificatesJson()).contains("AWS Certified Developer");
        assertThat(stored.getLanguagesJson()).contains("IELTS 7.5", "JLPT N3");

        // Omitted fields remain unchanged on partial update
        save(student, Map.of("revision", 1, "profile", Map.of("summary", "Updated summary only")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.revision").value(2))
                .andExpect(jsonPath("$.data.profile.summary").value("Updated summary only"))
                .andExpect(jsonPath("$.data.profile.gpa").value(3.85))
                .andExpect(jsonPath("$.data.profile.educationLevel").value("MASTER"))
                .andExpect(jsonPath("$.data.profile.preferredWorkingModel").value("HYBRID"))
                .andExpect(jsonPath("$.data.profile.githubUrl").value("https://github.com/student-dev"))
                .andExpect(jsonPath("$.data.profile.certificates.length()").value(1))
                .andExpect(jsonPath("$.data.profile.languages.length()").value(2));

        // Empty structured lists represent intentionally empty collections
        save(student, Map.of("revision", 2, "profile", Map.of("certificates", List.of(), "languages", List.of())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.revision").value(3))
                .andExpect(jsonPath("$.data.profile.certificates").isEmpty())
                .andExpect(jsonPath("$.data.profile.languages").isEmpty())
                .andExpect(jsonPath("$.data.profile.gpa").value(3.85));

        var afterEmptyLists = profiles.findByStudentId(student.getId()).orElseThrow();
        assertThat(afterEmptyLists.getCertificatesJson()).isEqualTo("[]");
        assertThat(afterEmptyLists.getLanguagesJson()).isEqualTo("[]");
    }

    @Test void explicitClearFieldsClearsExtendedNullableFieldsAndRejectsSetAndClearConflicts() throws Exception {
        Student student = student("extensions-clear");
        save(student, Map.of(
                "revision", 0,
                "profile", Map.of(
                        "gpa", new BigDecimal("3.60"),
                        "educationLevel", "BACHELOR",
                        "preferredWorkingModel", "REMOTE",
                        "githubUrl", "https://github.com/clear-test",
                        "linkedinUrl", "https://linkedin.com/in/clear-test",
                        "portfolioUrl", "https://clear-test.example.com",
                        "certificates", List.of(Map.of("name", "Docker Associate")),
                        "languages", List.of(Map.of("name", "English", "level", "TOEIC 850"))
                )
        )).andExpect(status().isOk());

        var beforeConflicts = snapshot(student);
        for (Map<String, Object> conflictingPayload : List.of(
                Map.of("revision", 1, "profile", Map.of("gpa", new BigDecimal("3.90")), "clearFields", List.of("gpa")),
                Map.of("revision", 1, "profile", Map.of("educationLevel", "MASTER"), "clearFields", List.of("educationLevel")),
                Map.of("revision", 1, "profile", Map.of("preferredWorkingModel", "ONSITE"), "clearFields", List.of("preferredWorkingModel")),
                Map.of("revision", 1, "profile", Map.of("githubUrl", "https://github.com/other"), "clearFields", List.of("githubUrl")),
                Map.of("revision", 1, "profile", Map.of("linkedinUrl", "https://linkedin.com/in/other"), "clearFields", List.of("linkedinUrl")),
                Map.of("revision", 1, "profile", Map.of("portfolioUrl", "https://other.example.com"), "clearFields", List.of("portfolioUrl")),
                Map.of("revision", 1, "profile", Map.of("certificates", List.of()), "clearFields", List.of("certificates")),
                Map.of("revision", 1, "profile", Map.of("languages", List.of()), "clearFields", List.of("languages"))
        )) {
            save(student, conflictingPayload)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errorCode").value("BAD_REQUEST"));
            assertThat(snapshot(student)).isEqualTo(beforeConflicts);
        }

        save(student, Map.of(
                "revision", 1,
                "clearFields", List.of(
                        "gpa",
                        "educationLevel",
                        "preferredWorkingModel",
                        "githubUrl",
                        "linkedinUrl",
                        "portfolioUrl",
                        "certificates",
                        "languages"
                )
        ))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.revision").value(2))
                .andExpect(jsonPath("$.data.profile.gpa").isEmpty())
                .andExpect(jsonPath("$.data.profile.educationLevel").isEmpty())
                .andExpect(jsonPath("$.data.profile.preferredWorkingModel").isEmpty())
                .andExpect(jsonPath("$.data.profile.githubUrl").isEmpty())
                .andExpect(jsonPath("$.data.profile.linkedinUrl").isEmpty())
                .andExpect(jsonPath("$.data.profile.portfolioUrl").isEmpty())
                .andExpect(jsonPath("$.data.profile.certificates").isEmpty())
                .andExpect(jsonPath("$.data.profile.languages").isEmpty())
                .andExpect(jsonPath("$.data.profile.projects").value("Keep projects"));
    }

    @Test void validatesExtendedFieldsAndRejectsStaleRevisionOnExtendedUpdates() throws Exception {
        Student student = student("extensions-validation");
        var before = snapshot(student);

        for (Map<String, Object> invalidPayload : List.of(
                Map.of("revision", 0, "profile", Map.of("gpa", new BigDecimal("4.01"))),
                Map.of("revision", 0, "profile", Map.of("gpa", new BigDecimal("-0.01"))),
                Map.of("revision", 0, "profile", Map.of("gpa", new BigDecimal("3.555"))),
                Map.of("revision", 0, "profile", Map.of("educationLevel", "E".repeat(101))),
                Map.of("revision", 0, "profile", Map.of("githubUrl", "javascript:alert(1)")),
                Map.of("revision", 0, "profile", Map.of("linkedinUrl", "ftp://linkedin.com/in/student")),
                Map.of("revision", 0, "profile", Map.of("portfolioUrl", "not-a-valid-url")),
                Map.of("revision", 0, "profile", Map.of("githubUrl", "https://github.com/" + "a".repeat(490))),
                Map.of("revision", 0, "profile", Map.of("certificates", List.of(Map.of("name", "   ")))),
                Map.of("revision", 0, "profile", Map.of("certificates", List.of(Map.of("name", "Valid Name", "url", "javascript:evil()")))),
                Map.of("revision", 0, "profile", Map.of("languages", List.of(Map.of("name", "English", "level", "   "))))
        )) {
            save(student, invalidPayload)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errorCode").value("VALIDATION_ERROR"));
            assertThat(snapshot(student)).isEqualTo(before);
        }

        mockMvc.perform(put(URL)
                        .header("Authorization", bearerToken(student.getUser()))
                        .contentType("application/json")
                        .content("{\"revision\":0,\"profile\":{\"gpa\":\"3.50\"}}"))
                .andExpect(status().isBadRequest());
        assertThat(snapshot(student)).isEqualTo(before);

        save(student, Map.of(
                "revision", 0,
                "profile", Map.of(
                        "gpa", new BigDecimal("3.75"),
                        "preferredWorkingModel", "REMOTE",
                        "githubUrl", "https://github.com/committed"
                )
        )).andExpect(status().isOk()).andExpect(jsonPath("$.data.revision").value(1));

        save(student, Map.of(
                "revision", 0,
                "profile", Map.of(
                        "gpa", new BigDecimal("2.10"),
                        "githubUrl", "https://github.com/stale-writer"
                )
        )).andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("PROFILE_REVISION_CONFLICT"));

        var committed = snapshot(student);
        assertThat(committed.path("revision").asLong()).isEqualTo(1);
        assertThat(committed.path("profile").path("gpa").decimalValue()).isEqualByComparingTo("3.75");
        assertThat(committed.path("profile").path("githubUrl").asText()).isEqualTo("https://github.com/committed");
    }
}
