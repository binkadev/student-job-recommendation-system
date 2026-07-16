package com.tttn.jobrecommendation;

import com.tttn.jobrecommendation.modules.application.repository.JobApplicationRepository;
import com.tttn.jobrecommendation.modules.company.repository.CompanyRepository;
import com.tttn.jobrecommendation.modules.cv.repository.CvFileRepository;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.job.repository.JobSkillRepository;
import com.tttn.jobrecommendation.modules.job.repository.SavedJobRepository;
import com.tttn.jobrecommendation.modules.recommendation.repository.RecommendationResultRepository;
import com.tttn.jobrecommendation.modules.recommendation.repository.RecommendationRunRepository;
import com.tttn.jobrecommendation.modules.skill.repository.SkillRepository;
import com.tttn.jobrecommendation.modules.skill.repository.StudentSkillRepository;
import com.tttn.jobrecommendation.modules.student.repository.StudentProfileRepository;
import com.tttn.jobrecommendation.modules.student.repository.StudentRepository;
import com.tttn.jobrecommendation.modules.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest
@ActiveProfiles("no-db")
class JobRecommendationApplicationTests {

    @MockitoBean
    private UserRepository userRepository;

    @MockitoBean
    private StudentRepository studentRepository;

    @MockitoBean
    private StudentProfileRepository studentProfileRepository;

    @MockitoBean
    private CompanyRepository companyRepository;

    @MockitoBean
    private JobRepository jobRepository;

    @MockitoBean
    private JobSkillRepository jobSkillRepository;

    @MockitoBean
    private SavedJobRepository savedJobRepository;

    @MockitoBean
    private SkillRepository skillRepository;

    @MockitoBean
    private StudentSkillRepository studentSkillRepository;

    @MockitoBean
    private JobApplicationRepository jobApplicationRepository;

    @MockitoBean
    private CvFileRepository cvFileRepository;

    @MockitoBean
    private RecommendationRunRepository recommendationRunRepository;

    @MockitoBean
    private RecommendationResultRepository recommendationResultRepository;

    @Test
    void contextLoads() {
    }
}
