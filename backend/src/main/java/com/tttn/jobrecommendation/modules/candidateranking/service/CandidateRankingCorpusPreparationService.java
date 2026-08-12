package com.tttn.jobrecommendation.modules.candidateranking.service;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CvAnalysisStatus;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.utils.SkillNameNormalizer;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingRequest;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingV3Request;
import com.tttn.jobrecommendation.infrastructure.ai.skill.SkillCatalogCanonicalizer;
import com.tttn.jobrecommendation.modules.application.repository.CandidateRankingApplicationRow;
import com.tttn.jobrecommendation.modules.application.repository.JobApplicationRepository;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingCandidateSnapshot;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingCorpusCounters;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingJobSnapshot;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingPreparationResult;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingV3PreparationResult;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.entity.JobSkill;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.job.repository.JobSkillRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

@Service
public class CandidateRankingCorpusPreparationService {

    private final JobRepository jobRepository;
    private final JobSkillRepository jobSkillRepository;
    private final JobApplicationRepository applicationRepository;
    private final SkillCatalogCanonicalizer skillCatalogCanonicalizer;

    @org.springframework.beans.factory.annotation.Autowired
    public CandidateRankingCorpusPreparationService(
            JobRepository jobRepository, JobSkillRepository jobSkillRepository,
            JobApplicationRepository applicationRepository, SkillCatalogCanonicalizer skillCatalogCanonicalizer
    ) {
        this.jobRepository = jobRepository;
        this.jobSkillRepository = jobSkillRepository;
        this.applicationRepository = applicationRepository;
        this.skillCatalogCanonicalizer = skillCatalogCanonicalizer;
    }

    CandidateRankingCorpusPreparationService(
            JobRepository jobRepository, JobSkillRepository jobSkillRepository,
            JobApplicationRepository applicationRepository
    ) {
        this(jobRepository, jobSkillRepository, applicationRepository, new SkillCatalogCanonicalizer());
    }

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
                    row.cvExtractedText(),
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

    @Transactional(readOnly = true)
    public CandidateRankingV3PreparationResult prepareV3(Long companyId, Long jobId) {
        Job job = jobRepository.findByIdAndCompanyId(jobId, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found"));
        List<String> jobSkills = skillCatalogCanonicalizer.canonicalizeAllSorted(jobSkillRepository
                .findByJobIdOrderByIdAsc(job.getId()).stream().map(JobSkill::getSkill)
                .map(skill -> StringUtils.hasText(skill.getNormalizedName()) ? skill.getNormalizedName() : skill.getName()).toList());
        if (jobSkills.size() > 100) {
            throw new AppException(ErrorCode.CANDIDATE_RANKING_GENERATION_FAILED);
        }
        CandidateRankingJobSnapshot jobSnapshot = new CandidateRankingJobSnapshot(job.getId(), job.getTitle(),
                job.getDescription(), job.getRequirements(), jobSkills, job.getUpdatedAt());
        AiCandidateRankingV3Request.JobInput aiJob = new AiCandidateRankingV3Request.JobInput(
                job.getId(), buildJobText(job, jobSkills), jobSkills);
        List<CandidateRankingCandidateSnapshot> candidates = new ArrayList<>();
        int noCv = 0, notReady = 0, terminal = 0;
        List<CandidateRankingApplicationRow> rows = applicationRepository.findCandidateRankingRowsByJobId(job.getId());
        for (CandidateRankingApplicationRow row : rows) {
            if (!Objects.equals(job.getId(), row.jobId())) throw new IllegalStateException("Candidate ranking corpus contains an application for another job");
            if (row.cvId() != null && !Objects.equals(row.applicationStudentId(), row.cvStudentId())) throw new IllegalStateException("Submitted CV does not belong to the application student");
            if (isTerminal(row.applicationStatus())) { terminal++; continue; }
            if (!isEligibleStatus(row.applicationStatus())) throw new IllegalStateException("Candidate ranking corpus contains an unsupported application status");
            if (row.cvId() == null) { noCv++; continue; }
            if (row.cvAnalysisStatus() != CvAnalysisStatus.READY || !StringUtils.hasText(row.cvProcessedText())
                    || !StringUtils.hasText(row.cvLanguageCode()) || row.cvLanguageConfidence() == null
                    || row.cvLanguageConfidence().compareTo(java.math.BigDecimal.ZERO) < 0
                    || row.cvLanguageConfidence().compareTo(java.math.BigDecimal.ONE) > 0
                    || !"bilingual-nlp-v2-skills-v1".equals(row.cvProcessingVersion())) { notReady++; continue; }
            candidates.add(new CandidateRankingCandidateSnapshot(row.applicationId(), row.applicationStatus(), row.cvId(),
                    row.cvExtractedText(), row.cvProcessedText(), skillCatalogCanonicalizer.canonicalizeAllSorted(
                    row.cvExtractedSkills() == null ? List.of() : row.cvExtractedSkills()), row.cvAnalysisStatus(),
                    row.cvLanguageCode(), row.cvLanguageConfidence(), row.cvProcessingVersion(), row.cvAnalyzedAt()));
        }
        candidates.sort(Comparator.comparing(CandidateRankingCandidateSnapshot::applicationId));
        List<AiCandidateRankingV3Request.CandidateInput> inputs = candidates.stream().map(candidate ->
                new AiCandidateRankingV3Request.CandidateInput(candidate.applicationId(), candidate.cvId(),
                        candidate.processedText(), candidate.canonicalExtractedSkills(), candidate.languageCode(),
                        candidate.languageConfidence(), candidate.processingVersion())).toList();
        CandidateRankingCorpusCounters counters = new CandidateRankingCorpusCounters(rows.size(), candidates.size(), noCv, notReady, terminal);
        return new CandidateRankingV3PreparationResult(jobSnapshot, aiJob, candidates, inputs, counters,
                CandidateRankingInputFingerprint.computeV3(jobSnapshot, candidates));
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
