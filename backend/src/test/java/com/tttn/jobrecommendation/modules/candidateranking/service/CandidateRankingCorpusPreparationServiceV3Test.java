package com.tttn.jobrecommendation.modules.candidateranking.service;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CvAnalysisStatus;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.infrastructure.ai.skill.SkillCatalogCanonicalizer;
import com.tttn.jobrecommendation.modules.application.repository.CandidateRankingApplicationRow;
import com.tttn.jobrecommendation.modules.application.repository.JobApplicationRepository;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.entity.JobSkill;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.job.repository.JobSkillRepository;
import com.tttn.jobrecommendation.modules.skill.entity.Skill;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CandidateRankingCorpusPreparationServiceV3Test {
    private static final long COMPANY=1L, JOB=2L;
    @Test
    void acceptsSubmittedReadySnapshotsWithoutExtractedTextAndCountsAllExclusions() {
        Fixture f=fixture(List.of(skill("JS"),skill("javascript"),skill("Spring Boot")));
        when(f.apps.findCandidateRankingRowsByJobId(JOB)).thenReturn(List.of(
                row(10L,ApplicationStatus.PENDING,110L,null,"processed",List.of("JS","javascript"),"mixed",new BigDecimal(".01"),"bilingual-nlp-v2-skills-v1",CvAnalysisStatus.READY),
                row(11L,ApplicationStatus.REVIEWED,111L," ","processed",List.of("Spring Boot"),"unknown",BigDecimal.ONE,"bilingual-nlp-v2-skills-v1",CvAnalysisStatus.READY),
                row(12L,ApplicationStatus.ACCEPTED,null,null,null,null,null,null,null,null),
                row(13L,ApplicationStatus.REJECTED,113L,"x","processed",List.of(),"en",BigDecimal.ONE,"bilingual-nlp-v2-skills-v1",CvAnalysisStatus.READY),
                row(14L,ApplicationStatus.WITHDRAWN,null,null,null,null,null,null,null,null),
                row(15L,ApplicationStatus.PENDING,null,null,null,null,null,null,null,null),
                row(16L,ApplicationStatus.PENDING,116L,"x"," ",List.of(),"en",BigDecimal.ONE,"bilingual-nlp-v2-skills-v1",CvAnalysisStatus.READY),
                row(17L,ApplicationStatus.PENDING,117L,"x","processed",List.of(),null,BigDecimal.ONE,"bilingual-nlp-v2-skills-v1",CvAnalysisStatus.READY),
                row(18L,ApplicationStatus.PENDING,118L,"x","processed",List.of(),"en",new BigDecimal("1.1"),"bilingual-nlp-v2-skills-v1",CvAnalysisStatus.READY),
                row(19L,ApplicationStatus.PENDING,119L,"x","processed",List.of(),"en",BigDecimal.ONE,"wrong",CvAnalysisStatus.READY)
        ));
        var result=f.service.prepareV3(COMPANY,JOB);
        assertThat(result.aiJobInput().skills()).containsExactly("javascript","spring boot");
        assertThat(result.eligibleCandidateSnapshots()).extracting(c->c.applicationId()).containsExactly(10L,11L);
        assertThat(result.aiCandidateInputs().getFirst().processedText()).isEqualTo("processed");
        assertThat(result.aiCandidateInputs().getFirst().skills()).containsExactly("javascript");
        assertThat(result.counters().totalApplicationsScanned()).isEqualTo(10);
        assertThat(result.counters().eligibleCandidates()).isEqualTo(2);
        assertThat(result.counters().skippedTerminalStatus()).isEqualTo(3);
        assertThat(result.counters().skippedNoCv()).isEqualTo(1);
        assertThat(result.counters().skippedNotReady()).isEqualTo(4);
    }
    @Test
    void rejectsForeignJobAndEnforcesCanonicalJobSkillBoundWithoutTruncation() {
        Fixture foreign=fixture(List.of()); when(foreign.jobs.findByIdAndCompanyId(JOB,COMPANY)).thenReturn(Optional.empty());
        assertThatThrownBy(()->foreign.service.prepareV3(COMPANY,JOB)).isInstanceOf(ResourceNotFoundException.class);
        List<JobSkill> oneHundred=new ArrayList<>();for(int i=0;i<99;i++)oneHundred.add(skill("unknown-"+i));oneHundred.add(skill("js"));oneHundred.add(skill("javascript"));
        Fixture valid=fixture(oneHundred);when(valid.apps.findCandidateRankingRowsByJobId(JOB)).thenReturn(List.of());
        assertThat(valid.service.prepareV3(COMPANY,JOB).aiJobInput().skills()).hasSize(100).contains("javascript");
        List<JobSkill> oneHundredOne=new ArrayList<>();for(int i=0;i<101;i++)oneHundredOne.add(skill("unknown-"+i));
        Fixture invalid=fixture(oneHundredOne);
        assertThatThrownBy(()->invalid.service.prepareV3(COMPANY,JOB)).isInstanceOf(AppException.class);
    }
    private Fixture fixture(List<JobSkill> skills){JobRepository jobs=mock(JobRepository.class);JobSkillRepository jobSkills=mock(JobSkillRepository.class);JobApplicationRepository apps=mock(JobApplicationRepository.class);Job job=Job.builder().id(JOB).company(Company.builder().id(COMPANY).build()).title("Backend").updatedAt(LocalDateTime.now()).build();when(jobs.findByIdAndCompanyId(JOB,COMPANY)).thenReturn(Optional.of(job));when(jobSkills.findByJobIdOrderByIdAsc(JOB)).thenReturn(skills);return new Fixture(new CandidateRankingCorpusPreparationService(jobs,jobSkills,apps,new SkillCatalogCanonicalizer()),jobs,apps);}
    private JobSkill skill(String name){return JobSkill.builder().skill(Skill.builder().name(name).normalizedName(name).build()).build();}
    private CandidateRankingApplicationRow row(Long id,ApplicationStatus status,Long cvId,String extracted,String processed,List<String> skills,String language,BigDecimal confidence,String version,CvAnalysisStatus analysis){return new CandidateRankingApplicationRow(id,status,9L,JOB,cvId,cvId==null?null:9L,extracted,processed,skills,analysis,language,confidence,version,LocalDateTime.of(2026,1,1,0,0));}
    private record Fixture(CandidateRankingCorpusPreparationService service,JobRepository jobs,JobApplicationRepository apps){}
}
