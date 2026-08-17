package com.tttn.jobrecommendation.modules.candidateranking.service;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CvAnalysisStatus;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.common.utils.SkillNameNormalizer;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingRequest;
import com.tttn.jobrecommendation.modules.application.repository.CandidateRankingApplicationRow;
import com.tttn.jobrecommendation.modules.application.repository.JobApplicationRepository;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingCandidateSnapshot;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingCorpusCounters;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingJobSnapshot;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingPreparationResult;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.entity.JobSkill;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.job.repository.JobSkillRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class CandidateRankingCorpusPreparationService {

    private final JobRepository jobRepository;
    private final JobSkillRepository jobSkillRepository;
    private final JobApplicationRepository applicationRepository;

    /**
     * Prepares a detached corpus for a company id already resolved from authentication.
     * Foreign and absent jobs intentionally use the same resource-not-found boundary.
     */
    @Transactional(readOnly = true)
    public CandidateRankingPreparationResult prepare(Long companyId, Long jobId) {
        Job job = jobRepository.findByIdAndCompanyId(jobId, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found"));

        List<String> jobSkills = canonicalJobSkills(
                jobSkillRepository.findByJobIdOrderByIdAsc(job.getId())
        );
        CandidateRankingJobSnapshot jobSnapshot = new CandidateRankingJobSnapshot(
                job.getId(),
                job.getTitle(),
                job.getDescription(),
                job.getRequirements(),
                jobSkills,
                job.getUpdatedAt()
        );
        AiCandidateRankingRequest.JobInput aiJobInput = new AiCandidateRankingRequest.JobInput(
                job.getId(),
                buildJobText(job, jobSkills),
                jobSkills
        );

        List<CandidateRankingApplicationRow> rows =
                applicationRepository.findCandidateRankingRowsByJobId(job.getId());
        List<CandidateRankingCandidateSnapshot> eligibleCandidates = new ArrayList<>();
        int skippedNoCv = 0;
        int skippedNotReady = 0;
        int skippedTerminalStatus = 0;

        for (CandidateRankingApplicationRow row : rows) {
            if (!Objects.equals(job.getId(), row.jobId())) {
                throw new IllegalStateException("Candidate ranking corpus contains an application for another job");
            }
            if (row.cvId() != null && !Objects.equals(row.applicationStudentId(), row.cvStudentId())) {
                throw new IllegalStateException("Submitted CV does not belong to the application student");
            }
            if (isTerminal(row.applicationStatus())) {
                skippedTerminalStatus++;
                continue;
            }
            if (!isEligibleStatus(row.applicationStatus())) {
                throw new IllegalStateException("Candidate ranking corpus contains an unsupported application status");
            }
            if (row.cvId() == null) {
                skippedNoCv++;
                continue;
            }
            if (row.cvAnalysisStatus() != CvAnalysisStatus.READY
                    || !StringUtils.hasText(row.cvExtractedText())
                    || !StringUtils.hasText(row.cvProcessedText())) {
                skippedNotReady++;
                continue;
            }

            eligibleCandidates.add(new CandidateRankingCandidateSnapshot(
                    row.applicationId(),
                    row.applicationStatus(),
                    row.cvId(),
                    row.cvProcessedText(),
                    canonicalSkills(row.cvExtractedSkills()),
                    row.cvAnalysisStatus(),
                    row.cvProcessingVersion(),
                    row.cvAnalyzedAt()
            ));
        }

        eligibleCandidates.sort(Comparator.comparing(CandidateRankingCandidateSnapshot::applicationId));
        List<AiCandidateRankingRequest.CandidateInput> aiCandidateInputs = eligibleCandidates.stream()
                .map(candidate -> new AiCandidateRankingRequest.CandidateInput(
                        candidate.applicationId(),
                        candidate.cvId(),
                        candidate.extractedText(),
                        candidate.canonicalExtractedSkills()
                ))
                .toList();
        CandidateRankingCorpusCounters counters = new CandidateRankingCorpusCounters(
                rows.size(),
                eligibleCandidates.size(),
                skippedNoCv,
                skippedNotReady,
                skippedTerminalStatus
        );

        return new CandidateRankingPreparationResult(
                jobSnapshot,
                aiJobInput,
                eligibleCandidates,
                aiCandidateInputs,
                counters,
                CandidateRankingInputFingerprint.compute(jobSnapshot, eligibleCandidates)
        );
    }

    String buildJobText(Job job, List<String> canonicalSkills) {
        return """
                TITLE:
                %s

                DESCRIPTION:
                %s

                REQUIREMENTS:
                %s

                SKILLS:
                %s""".formatted(
                normalizeSection(job.getTitle()),
                normalizeSection(job.getDescription()),
                normalizeSection(job.getRequirements()),
                String.join(", ", canonicalSkills)
        );
    }

    private List<String> canonicalJobSkills(List<JobSkill> jobSkills) {
        return jobSkills.stream()
                .map(JobSkill::getSkill)
                .map(skill -> StringUtils.hasText(skill.getNormalizedName())
                        ? skill.getNormalizedName()
                        : skill.getName())
                .map(SkillNameNormalizer::normalize)
                .filter(StringUtils::hasText)
                .distinct()
                .sorted()
                .toList();
    }

    private List<String> canonicalSkills(List<String> skills) {
        if (skills == null || skills.isEmpty()) {
            return List.of();
        }
        return skills.stream()
                .map(SkillNameNormalizer::normalize)
                .filter(StringUtils::hasText)
                .distinct()
                .sorted()
                .toList();
    }

    private boolean isEligibleStatus(ApplicationStatus status) {
        return status == ApplicationStatus.PENDING || status == ApplicationStatus.REVIEWED;
    }

    private boolean isTerminal(ApplicationStatus status) {
        return status == ApplicationStatus.ACCEPTED
                || status == ApplicationStatus.REJECTED
                || status == ApplicationStatus.WITHDRAWN;
    }

    private String normalizeSection(String value) {
        return value == null ? "" : value.strip();
    }
}
