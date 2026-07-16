package com.tttn.jobrecommendation.infrastructure.seed;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.JobType;
import com.tttn.jobrecommendation.common.enums.SkillImportance;
import com.tttn.jobrecommendation.common.enums.SkillLevel;
import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.common.enums.UserStatus;
import com.tttn.jobrecommendation.common.enums.WorkingModel;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.company.repository.CompanyRepository;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.entity.JobSkill;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.job.repository.JobSkillRepository;
import com.tttn.jobrecommendation.modules.skill.entity.Skill;
import com.tttn.jobrecommendation.modules.skill.repository.SkillRepository;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.entity.StudentProfile;
import com.tttn.jobrecommendation.modules.student.repository.StudentProfileRepository;
import com.tttn.jobrecommendation.modules.student.repository.StudentRepository;
import com.tttn.jobrecommendation.modules.user.entity.User;
import com.tttn.jobrecommendation.modules.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Component
@Profile("dev")
@RequiredArgsConstructor
public class DataSeeder implements ApplicationRunner {

    private static final String DEMO_PASSWORD = "123456";
    private static final String DEMO_LOCATION = "Ho Chi Minh City";
    private static final String DEMO_RAW_TEXT = "backend developer intern java spring boot postgresql rest api docker git";

    private final UserRepository userRepository;
    private final StudentRepository studentRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final CompanyRepository companyRepository;
    private final SkillRepository skillRepository;
    private final JobRepository jobRepository;
    private final JobSkillRepository jobSkillRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        ensureUser("admin@example.com", "Demo Admin", null, UserRole.ADMIN);
        User studentUser = ensureUser("student@example.com", "Demo Student", null, UserRole.STUDENT);
        User companyUser = ensureUser("company@example.com", "Demo Tech Company", "0900000000", UserRole.COMPANY);

        Map<String, Skill> skills = ensureSkills();

        if (studentUser.getRole() == UserRole.STUDENT) {
            Student student = ensureStudent(studentUser);
            ensureStudentProfile(student);
        }

        if (companyUser.getRole() == UserRole.COMPANY) {
            Company company = ensureCompany(companyUser);
            ensureJobs(company, skills);
        }
    }

    private User ensureUser(String email, String fullName, String phone, UserRole role) {
        String normalizedEmail = email.toLowerCase(Locale.ROOT);
        return userRepository.findByEmail(normalizedEmail)
                .orElseGet(() -> userRepository.save(User.builder()
                        .email(normalizedEmail)
                        .fullName(fullName)
                        .phone(phone)
                        .role(role)
                        .status(UserStatus.ACTIVE)
                        .passwordHash(passwordEncoder.encode(DEMO_PASSWORD))
                        .build()));
    }

    private Student ensureStudent(User user) {
        return studentRepository.findByUserId(user.getId())
                .orElseGet(() -> studentRepository.save(Student.builder()
                        .user(user)
                        .studentCode("DEMO-STUDENT")
                        .university("Demo University")
                        .major("Software Engineering")
                        .graduationYear(2026)
                        .location(DEMO_LOCATION)
                        .build()));
    }

    private StudentProfile ensureStudentProfile(Student student) {
        return studentProfileRepository.findByStudentId(student.getId())
                .orElseGet(() -> studentProfileRepository.save(StudentProfile.builder()
                        .student(student)
                        .headline("Backend Developer Intern")
                        .summary("IT student interested in backend development")
                        .education("Software Engineering student")
                        .experience("Built REST API projects using Java and Spring Boot")
                        .projects("Student job recommendation system, ecommerce API")
                        .targetPosition("Backend Developer Intern")
                        .preferredLocation(DEMO_LOCATION)
                        .preferredJobType(JobType.INTERNSHIP)
                        .preferredWorkingModel(WorkingModel.HYBRID)
                        .rawText(DEMO_RAW_TEXT)
                        .processedText(DEMO_RAW_TEXT)
                        .profileCompleteness(100)
                        .build()));
    }

    private Company ensureCompany(User user) {
        return companyRepository.findByUserId(user.getId())
                .orElseGet(() -> companyRepository.save(Company.builder()
                        .user(user)
                        .companyName("Demo Tech Company")
                        .description("A software company hiring IT interns")
                        .websiteUrl("https://example.com")
                        .address(DEMO_LOCATION)
                        .phone("0900000000")
                        .industry("Software Development")
                        .status(CompanyStatus.VERIFIED)
                        .build()));
    }

    private Map<String, Skill> ensureSkills() {
        List<SkillSeed> skillSeeds = List.of(
                new SkillSeed("Java", "Backend"),
                new SkillSeed("Spring Boot", "Backend"),
                new SkillSeed("React", "Frontend"),
                new SkillSeed("Next.js", "Frontend"),
                new SkillSeed("PostgreSQL", "Database"),
                new SkillSeed("MySQL", "Database"),
                new SkillSeed("Docker", "DevOps"),
                new SkillSeed("Git", "Tool"),
                new SkillSeed("REST API", "Backend"),
                new SkillSeed("HTML", "Frontend"),
                new SkillSeed("CSS", "Frontend"),
                new SkillSeed("JavaScript", "Frontend"),
                new SkillSeed("TypeScript", "Frontend")
        );

        Map<String, Skill> skills = new LinkedHashMap<>();
        for (SkillSeed seed : skillSeeds) {
            String normalizedName = normalize(seed.name());
            Skill skill = skillRepository.findByNormalizedName(normalizedName)
                    .orElseGet(() -> skillRepository.save(Skill.builder()
                            .name(seed.name())
                            .normalizedName(normalizedName)
                            .category(seed.category())
                            .build()));
            skills.put(seed.name(), skill);
        }
        return skills;
    }

    private void ensureJobs(Company company, Map<String, Skill> skills) {
        List<JobSeed> jobSeeds = List.of(
                new JobSeed("Backend Developer Intern", WorkingModel.HYBRID,
                        List.of("Java", "Spring Boot", "PostgreSQL", "REST API", "Git")),
                new JobSeed("Java Spring Boot Intern", WorkingModel.HYBRID,
                        List.of("Java", "Spring Boot", "MySQL", "REST API")),
                new JobSeed("Frontend Developer Intern", WorkingModel.REMOTE,
                        List.of("React", "Next.js", "HTML", "CSS", "JavaScript", "TypeScript")),
                new JobSeed("Fullstack Developer Intern", WorkingModel.HYBRID,
                        List.of("Java", "Spring Boot", "React", "PostgreSQL", "REST API")),
                new JobSeed("Data Analyst Intern", WorkingModel.ONSITE,
                        List.of("PostgreSQL", "MySQL")),
                new JobSeed("Tester Intern", WorkingModel.ONSITE,
                        List.of("Git")),
                new JobSeed("DevOps Intern", WorkingModel.HYBRID,
                        List.of("Docker", "Git")),
                new JobSeed("Mobile Developer Intern", WorkingModel.HYBRID,
                        List.of("Java", "Git", "REST API")),
                new JobSeed("Database Intern", WorkingModel.ONSITE,
                        List.of("PostgreSQL", "MySQL")),
                new JobSeed("Web Developer Intern", WorkingModel.REMOTE,
                        List.of("HTML", "CSS", "JavaScript", "React"))
        );

        for (JobSeed seed : jobSeeds) {
            Job job = jobRepository.findFirstByCompanyIdAndTitleOrderByIdAsc(company.getId(), seed.title())
                    .orElseGet(() -> jobRepository.save(Job.builder()
                            .company(company)
                            .title(seed.title())
                            .description(seed.title() + " role for IT students to work on real software projects with mentor support.")
                            .requirements("Required skills: " + String.join(", ", seed.skillNames()))
                            .benefits("Mentorship, code review, internship allowance, and real project experience.")
                            .location(DEMO_LOCATION)
                            .jobType(JobType.INTERNSHIP)
                            .workingModel(seed.workingModel())
                            .status(JobStatus.ACTIVE)
                            .salaryMin(BigDecimal.valueOf(2_000_000))
                            .salaryMax(BigDecimal.valueOf(5_000_000))
                            .currency("VND")
                            .deadline(LocalDate.now().plusMonths(3))
                            .publishedAt(LocalDateTime.now())
                            .build()));

            ensureJobSkills(job, seed.skillNames(), skills);
        }
    }

    private void ensureJobSkills(Job job, List<String> skillNames, Map<String, Skill> skills) {
        for (String skillName : skillNames) {
            Skill skill = skills.get(skillName);
            if (skill == null || jobSkillRepository.existsByJobIdAndSkillId(job.getId(), skill.getId())) {
                continue;
            }

            jobSkillRepository.save(JobSkill.builder()
                    .job(job)
                    .skill(skill)
                    .importance(SkillImportance.REQUIRED)
                    .minLevel(SkillLevel.BEGINNER)
                    .build());
        }
    }

    private String normalize(String value) {
        return value.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    private record SkillSeed(String name, String category) {
    }

    private record JobSeed(String title, WorkingModel workingModel, List<String> skillNames) {
    }
}
