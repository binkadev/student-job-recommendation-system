package com.tttn.jobrecommendation.modules.student.entity;

import com.tttn.jobrecommendation.common.enums.JobType;
import com.tttn.jobrecommendation.common.enums.WorkingModel;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "student_profiles")
public class StudentProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false, unique = true)
    private Student student;

    @Column(name = "headline", length = 255)
    private String headline;

    @Column(name = "summary", columnDefinition = "TEXT")
    private String summary;

    @Column(name = "education", columnDefinition = "TEXT")
    private String education;

    @Column(name = "experience", columnDefinition = "TEXT")
    private String experience;

    @Column(name = "projects", columnDefinition = "TEXT")
    private String projects;

    @Column(name = "target_position", length = 255)
    private String targetPosition;

    @Column(name = "education_level", length = 100)
    private String educationLevel;

    @Column(name = "gpa", precision = 3, scale = 2)
    private BigDecimal gpa;

    @Enumerated(EnumType.STRING)
    @Column(name = "preferred_job_type", length = 50)
    private JobType preferredJobType;

    @Enumerated(EnumType.STRING)
    @Column(name = "preferred_working_model", length = 50)
    private WorkingModel preferredWorkingModel;

    @Column(name = "preferred_location", length = 255)
    private String preferredLocation;

    @Column(name = "raw_text", columnDefinition = "TEXT")
    private String rawText;

    @Column(name = "processed_text", columnDefinition = "TEXT")
    private String processedText;

    @Column(name = "profile_completeness", nullable = false)
    private Integer profileCompleteness;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
