package com.tttn.jobrecommendation.integration;

import com.tttn.jobrecommendation.modules.skill.repository.SkillRepository;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class StudentSkillApiIT extends AbstractPostgresWebIntegrationTest {

    @Autowired
    private SkillRepository skillRepository;

    @Test
    void customSkillIsNormalizedPersistedAndReturnedByTheExistingSkillsApi() throws Exception {
        Student student = createStudent("custom-skill-student@example.test");
        String payload = """
                {"skills":[{"skillName":"  Next.js  ","category":"Frontend", "proficiencyLevel":"BEGINNER",
                "yearsOfExperience":0,"source":"MANUAL"}]}""";

        mockMvc.perform(put("/api/students/me/skills")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].skillName").value("Next.js"))
                .andExpect(jsonPath("$.data[0].normalizedName").value("next.js"))
                .andExpect(jsonPath("$.data[0].category").value("Frontend"))
                .andExpect(jsonPath("$.data[0].skillId").isNumber());

        assertThat(skillRepository.findByNormalizedName("next.js"))
                .isPresent()
                .get()
                .extracting(skill -> skill.getName())
                .isEqualTo("Next.js");

        mockMvc.perform(get("/api/students/me/skills")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].normalizedName").value("next.js"));
    }

    @Test
    void duplicateNormalizedCustomSkillsAndAmbiguousIdentifiersAreRejected() throws Exception {
        Student student = createStudent("custom-skill-duplicate@example.test");

        mockMvc.perform(put("/api/students/me/skills")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"skills":[
                                {"skillName":"Next.js","proficiencyLevel":"BEGINNER","source":"MANUAL"},
                                {"skillName":" next.js ","proficiencyLevel":"BEGINNER","source":"MANUAL"}]}""")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("BAD_REQUEST"));

        mockMvc.perform(put("/api/students/me/skills")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"skills":[{"skillId":1,"skillName":"Next.js","proficiencyLevel":"BEGINNER","source":"MANUAL"}]}""")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("BAD_REQUEST"));
    }
}
