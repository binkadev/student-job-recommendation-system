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
import org.springframework.util.StringUtils;

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

        Student student = ensureStudent(studentUser);
        ensureStudentProfile(student);

        Company company = ensureCompany(companyUser);
        Map<String, Skill> skills = ensureSkills();
        ensureJobs(company, skills);
    }

    private User ensureUser(String email, String fullName, String phone, UserRole role) {
        String normalizedEmail = email.toLowerCase(Locale.ROOT);
        User user = userRepository.findByEmail(normalizedEmail)
                .orElseGet(() -> User.builder()
                        .email(normalizedEmail)
                        .build());

        user.setEmail(normalizedEmail);
        user.setFullName(fullName);
        user.setPhone(phone);
        user.setRole(role);
        user.setStatus(UserStatus.ACTIVE);

        if (!StringUtils.hasText(user.getPasswordHash())
                || !passwordEncoder.matches(DEMO_PASSWORD, user.getPasswordHash())) {
            user.setPasswordHash(passwordEncoder.encode(DEMO_PASSWORD));
        }

        return userRepository.save(user);
    }

    private Student ensureStudent(User user) {
        Student student = studentRepository.findByUserId(user.getId())
                .orElseGet(() -> Student.builder()
                        .user(user)
                        .build());

        student.setUser(user);
        student.setStudentCode("DEMO-STUDENT");
        student.setUniversity("Demo University");
        student.setMajor("Software Engineering");
        student.setGraduationYear(2026);
        student.setLocation(DEMO_LOCATION);
        return studentRepository.save(student);
    }

    private StudentProfile ensureStudentProfile(Student student) {
        StudentProfile profile = studentProfileRepository.findByStudentId(student.getId())
                .orElseGet(() -> StudentProfile.builder()
                        .student(student)
                        .build());

        profile.setStudent(student);
        profile.setHeadline("Backend Developer Intern");
        profile.setSummary("IT student interested in backend development");
        profile.setEducation("Software Engineering student");
        profile.setExperience("Built REST API projects using Java and Spring Boot");
        profile.setProjects("Student job recommendation system, ecommerce API");
        profile.setTargetPosition("Backend Developer Intern");
        profile.setPreferredLocation(DEMO_LOCATION);
        profile.setPreferredJobType(JobType.INTERNSHIP);
        profile.setPreferredWorkingModel(WorkingModel.HYBRID);
        profile.setRawText(DEMO_RAW_TEXT);
        profile.setProcessedText(DEMO_RAW_TEXT);
        profile.setProfileCompleteness(100);
        return studentProfileRepository.save(profile);
    }

    private Company ensureCompany(User user) {
        Company company = companyRepository.findByUserId(user.getId())
                .orElseGet(() -> Company.builder()
                        .user(user)
                        .build());

        company.setUser(user);
        company.setCompanyName("Demo Tech Company");
        company.setDescription("A software company hiring IT interns");
        company.setWebsiteUrl("https://example.com");
        company.setAddress(DEMO_LOCATION);
        company.setPhone("0900000000");
        company.setIndustry("Software Development");
        company.setStatus(CompanyStatus.VERIFIED);
        return companyRepository.save(company);
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
                    .orElseGet(Skill::new);

            skill.setName(seed.name());
            skill.setNormalizedName(normalizedName);
            skill.setCategory(seed.category());
            skills.put(seed.name(), skillRepository.save(skill));
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
                    .orElseGet(() -> Job.builder()
                            .company(company)
                            .title(seed.title())
                            .build());

            job.setCompany(company);
            job.setTitle(seed.title());
            job.setDescription(seed.title() + " role for IT students to work on real software projects with mentor support.");
            job.setRequirements("Required skills: " + String.join(", ", seed.skillNames()));
            job.setBenefits("Mentorship, code review, internship allowance, and real project experience.");
            job.setLocation(DEMO_LOCATION);
            job.setJobType(JobType.INTERNSHIP);
            job.setWorkingModel(seed.workingModel());
            job.setStatus(JobStatus.ACTIVE);
            job.setSalaryMin(BigDecimal.valueOf(2_000_000));
            job.setSalaryMax(BigDecimal.valueOf(5_000_000));
            job.setCurrency("VND");
            job.setDeadline(LocalDate.now().plusMonths(3));
            if (job.getPublishedAt() == null) {
                job.setPublishedAt(LocalDateTime.now());
            }
            job.setClosedAt(null);

            Job savedJob = jobRepository.save(job);
            ensureJobSkills(savedJob, seed.skillNames(), skills);
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
