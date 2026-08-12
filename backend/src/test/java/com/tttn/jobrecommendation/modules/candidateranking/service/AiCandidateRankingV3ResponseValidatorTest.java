package com.tttn.jobrecommendation.modules.candidateranking.service;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CvAnalysisStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationRankingTier;
import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingV3Request;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingV3Response;
import com.tttn.jobrecommendation.infrastructure.ai.skill.SkillCatalogCanonicalizer;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingCandidateSnapshot;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingCorpusCounters;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingJobSnapshot;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingV3PreparationResult;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AiCandidateRankingV3ResponseValidatorTest {
    private final UUID requestId = UUID.randomUUID();
    private final AiCandidateRankingV3ResponseValidator validator = new AiCandidateRankingV3ResponseValidator(new SkillCatalogCanonicalizer());

    @Test
    void ordersIndependentTiersAndRejectsCrossTierLimitOrEvidenceAttacks() {
        var response = new AiCandidateRankingV3Response(requestId, "tfidf-cosine-hybrid", "bilingual-candidate-ranking-v3", List.of(
                fallback(40L, "1.00000000"), primary(30L), fallback(10L, "1.00000000"), primary(20L)
        ));
        var validated = validator.validate(requestId, BigDecimal.ZERO, 2, 2, preparation(), response);
        assertThat(validated.results()).extracting(r -> r.applicationId()).containsExactly(20L, 30L, 10L, 40L);
        assertThat(validated.results()).extracting(r -> r.tierRankPosition()).containsExactly(1,2,1,2);
        assertThat(validated.results().get(2).overallScore()).isNull();
        assertThatThrownBy(() -> validator.validate(requestId, BigDecimal.ZERO, 1, 2, preparation(), response)).isInstanceOf(AppException.class);
        var bad = new AiCandidateRankingV3Response(requestId,"tfidf-cosine-hybrid","bilingual-candidate-ranking-v3",List.of(
                new AiCandidateRankingV3Response.Result(10L,110L,RecommendationRankingTier.FALLBACK,new BigDecimal("1"),null,null,new BigDecimal("1"),RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED,List.of("Java"),List.of())
        ));
        assertThatThrownBy(() -> validator.validate(requestId,BigDecimal.ZERO,2,2,preparation(),bad)).isInstanceOf(AppException.class);
    }
    private AiCandidateRankingV3Response.Result primary(long id){return new AiCandidateRankingV3Response.Result(id,id+100,RecommendationRankingTier.PRIMARY,new BigDecimal("0.61000000"),new BigDecimal("0.61000000"),new BigDecimal("0.40000000"),new BigDecimal("1.00000000"),RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,List.of("java","spring boot"),List.of());}
    private AiCandidateRankingV3Response.Result fallback(long id,String score){return new AiCandidateRankingV3Response.Result(id,id+100,RecommendationRankingTier.FALLBACK,new BigDecimal(score),null,null,new BigDecimal(score),RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED,List.of("java","spring boot"),List.of());}
    private CandidateRankingV3PreparationResult preparation(){
        List<CandidateRankingCandidateSnapshot> candidates=List.of(10L,20L,30L,40L).stream().map(id->new CandidateRankingCandidateSnapshot(id,ApplicationStatus.PENDING,id+100,"ignored","processed",List.of("java","spring boot"),CvAnalysisStatus.READY,"en",BigDecimal.ONE,"bilingual-nlp-v2-skills-v1",LocalDateTime.now())).toList();
        var job=new CandidateRankingJobSnapshot(1L,"job","","",List.of("java","spring boot"),LocalDateTime.now());
        return new CandidateRankingV3PreparationResult(job,new AiCandidateRankingV3Request.JobInput(1L,"job",job.canonicalSkills()),candidates,List.of(),new CandidateRankingCorpusCounters(4,4,0,0,0),"a".repeat(64));
    }
}
