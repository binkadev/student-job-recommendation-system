package com.tttn.jobrecommendation.modules.candidateranking.mapper;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.candidateranking.dto.response.CandidateRankingResultResponse;
import com.tttn.jobrecommendation.modules.candidateranking.entity.CandidateRankingResult;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.user.entity.User;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CandidateRankingMapperTest {

    private final CandidateRankingMapper mapper = new CandidateRankingMapper();

    @Test
    void resultMappingPreservesPersistedScoreRankReasonAndSkillOrder() {
        User user = User.builder().id(5L).fullName("Candidate Name").email("candidate@example.test").build();
        Student student = Student.builder().id(6L).user(user).build();
        LocalDateTime appliedAt = LocalDateTime.of(2026, 8, 1, 8, 30);
        JobApplication application = JobApplication.builder()
                .id(7L)
                .student(student)
                .status(ApplicationStatus.REVIEWED)
                .appliedAt(appliedAt)
                .build();
        CvFile cvFile = CvFile.builder().id(8L).fileName("public-cv.pdf").build();
        List<String> matched = new ArrayList<>(List.of("spring boot", "java"));
        List<String> missing = new ArrayList<>(List.of("docker", "kubernetes"));
        CandidateRankingResult entity = CandidateRankingResult.builder()
                .id(9L)
                .application(application)
                .cvFile(cvFile)
                .score(new BigDecimal("0.54321"))
                .textScore(null)
                .skillScore(new BigDecimal("0.54321"))
                .scoringStrategy(RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED)
                .matchedSkills(matched)
                .missingSkills(missing)
                .reason("Persisted reason")
                .rankPosition(17)
                .createdAt(LocalDateTime.of(2026, 8, 1, 10, 0))
                .build();

        CandidateRankingResultResponse response = mapper.toResultResponse(entity);
        matched.add("changed");
        missing.clear();

        assertThat(response.score()).isEqualByComparingTo("0.54321");
        assertThat(response.textScore()).isNull();
        assertThat(response.rankPosition()).isEqualTo(17);
        assertThat(response.reason()).isEqualTo("Persisted reason");
        assertThat(response.matchedSkills()).containsExactly("spring boot", "java");
        assertThat(response.missingSkills()).containsExactly("docker", "kubernetes");
        assertThat(response.cvFileName()).isEqualTo("public-cv.pdf");
        assertThatThrownBy(() -> response.matchedSkills().add("nope"))
                .isInstanceOf(UnsupportedOperationException.class);
    }
}
