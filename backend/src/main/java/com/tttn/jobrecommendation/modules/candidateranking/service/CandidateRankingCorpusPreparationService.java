package com.tttn.jobrecommendation.modules.candidateranking.service;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CvAnalysisStatus;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingV3Request;
import com.tttn.jobrecommendation.infrastructure.ai.job.JobTextContentHasher;
import com.tttn.jobrecommendation.infrastructure.ai.skill.SkillCatalogCanonicalizer;
import com.tttn.jobrecommendation.modules.application.repository.CandidateRankingApplicationRow;
import com.tttn.jobrecommendation.modules.application.repository.JobApplicationRepository;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingCandidateSnapshot;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingCorpusCounters;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingJobSnapshot;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingV3PreparationResult;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.entity.JobSkill;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.job.repository.JobSkillRepository;
import org.springframework.beans.factory.annotation.Autowired;
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

    @Autowired
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
        AiCandidateRankingV3Request.JobInput aiJob = JobTextContentHasher.hasFreshSnapshot(job)
                ? new AiCandidateRankingV3Request.JobInput(
                        job.getId(),
                        null,
                        jobSkills,
                        job.getProcessedText(),
                        job.getLanguageCode(),
                        job.getLanguageConfidence(),
                        job.getProcessingVersion()
                )
                : new AiCandidateRankingV3Request.JobInput(job.getId(), buildJobText(job, jobSkills), jobSkills);
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
                    || !"english-spacy-v1-skills-v1".equals(row.cvProcessingVersion())) { notReady++; continue; }
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
