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
    @Test
    void rejectsRootIdentityScoreAndTierSemanticAttacks() {
        assertInvalid(new AiCandidateRankingV3Response(UUID.randomUUID(),"tfidf-cosine-hybrid","bilingual-candidate-ranking-v3",List.of()));
        assertInvalid(new AiCandidateRankingV3Response(requestId,"wrong","bilingual-candidate-ranking-v3",List.of()));
        assertInvalid(new AiCandidateRankingV3Response(requestId,"tfidf-cosine-hybrid","wrong",List.of()));
        assertInvalid(new AiCandidateRankingV3Response(requestId,"tfidf-cosine-hybrid","bilingual-candidate-ranking-v3",null));
        assertInvalid(response(primary(99L)));
        assertInvalid(response(new AiCandidateRankingV3Response.Result(10L,110L,null,new BigDecimal(".61"),new BigDecimal(".61"),new BigDecimal(".4"),BigDecimal.ONE,RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,List.of("java","spring boot"),List.of())));
        assertInvalid(response(new AiCandidateRankingV3Response.Result(10L,110L,RecommendationRankingTier.PRIMARY,new BigDecimal(".61"),new BigDecimal(".61"),new BigDecimal(".4"),BigDecimal.ONE,null,List.of("java","spring boot"),List.of())));
        assertInvalid(response(new AiCandidateRankingV3Response.Result(10L,110L,RecommendationRankingTier.PRIMARY,new BigDecimal("-.1"),new BigDecimal("-.1"),new BigDecimal(".4"),BigDecimal.ONE,RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,List.of("java","spring boot"),List.of())));
        assertInvalid(response(new AiCandidateRankingV3Response.Result(10L,110L,RecommendationRankingTier.PRIMARY,new BigDecimal(".61"),new BigDecimal(".61"),new BigDecimal("1.1"),BigDecimal.ONE,RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,List.of("java","spring boot"),List.of())));
        assertInvalid(response(new AiCandidateRankingV3Response.Result(10L,110L,RecommendationRankingTier.FALLBACK,new BigDecimal("1"),null,new BigDecimal(".1"),BigDecimal.ONE,RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED,List.of("java","spring boot"),List.of())));
        assertInvalid(response(new AiCandidateRankingV3Response.Result(10L,110L,RecommendationRankingTier.FALLBACK,new BigDecimal("1"),BigDecimal.ONE,null,BigDecimal.ONE,RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED,List.of("java","spring boot"),List.of())));
        assertInvalid(response(new AiCandidateRankingV3Response.Result(10L,110L,RecommendationRankingTier.FALLBACK,new BigDecimal(".9"),null,null,BigDecimal.ONE,RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED,List.of("java","spring boot"),List.of())));
        assertInvalid(response(new AiCandidateRankingV3Response.Result(10L,110L,RecommendationRankingTier.PRIMARY,new BigDecimal(".610000001"),new BigDecimal(".610000001"),new BigDecimal(".4"),BigDecimal.ONE,RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,List.of("java","spring boot"),List.of())));
    }
    @Test
    void rejectsResultCountIdentityAndEveryScoreRangeAttack() {
        assertInvalid(response(List.of(primary(10L),primary(20L),primary(30L),primary(40L),primary(10L))));
        assertInvalid(response(List.of(primary(10L),primary(20L),primary(30L))));
        assertInvalid(response(List.of(fallback(10L,"1"),fallback(20L,"1"),fallback(30L,"1"))));
        assertInvalid(response(java.util.Collections.singletonList(null)));
        assertInvalid(response(List.of(primary(10L),primary(10L))));
        assertInvalid(response(new AiCandidateRankingV3Response.Result(10L,999L,RecommendationRankingTier.PRIMARY,new BigDecimal(".61"),new BigDecimal(".61"),new BigDecimal(".4"),BigDecimal.ONE,RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,List.of("java","spring boot"),List.of())));
        assertInvalid(response(new AiCandidateRankingV3Response.Result(0L,110L,RecommendationRankingTier.PRIMARY,new BigDecimal(".61"),new BigDecimal(".61"),new BigDecimal(".4"),BigDecimal.ONE,RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,List.of("java","spring boot"),List.of())));
        assertInvalid(response(new AiCandidateRankingV3Response.Result(10L,0L,RecommendationRankingTier.PRIMARY,new BigDecimal(".61"),new BigDecimal(".61"),new BigDecimal(".4"),BigDecimal.ONE,RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,List.of("java","spring boot"),List.of())));
        assertInvalid(response(new AiCandidateRankingV3Response.Result(10L,110L,RecommendationRankingTier.PRIMARY,new BigDecimal(".61"),new BigDecimal(".61"),new BigDecimal("-.1"),BigDecimal.ONE,RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,List.of("java","spring boot"),List.of())));
        assertInvalid(response(new AiCandidateRankingV3Response.Result(10L,110L,RecommendationRankingTier.PRIMARY,new BigDecimal(".61"),new BigDecimal("1.1"),new BigDecimal(".4"),BigDecimal.ONE,RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,List.of("java","spring boot"),List.of())));
        assertInvalid(response(new AiCandidateRankingV3Response.Result(10L,110L,RecommendationRankingTier.PRIMARY,new BigDecimal(".61"),new BigDecimal(".61"),new BigDecimal(".4"),new BigDecimal("-0.1"),RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,List.of("java","spring boot"),List.of())));
        assertInvalid(response(new AiCandidateRankingV3Response.Result(10L,110L,RecommendationRankingTier.PRIMARY,new BigDecimal(".61"),new BigDecimal(".61"),new BigDecimal(".4"),new BigDecimal("1.1"),RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,List.of("java","spring boot"),List.of())));
        assertInvalidThreshold(response(primary(10L)),new BigDecimal(".61000001"));
        assertInvalid(response(new AiCandidateRankingV3Response.Result(10L,110L,RecommendationRankingTier.PRIMARY,new BigDecimal("1"),new BigDecimal("1"),new BigDecimal(".4"),BigDecimal.ONE,RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED,List.of("java","spring boot"),List.of())));
        assertInvalid(response(new AiCandidateRankingV3Response.Result(10L,110L,RecommendationRankingTier.FALLBACK,BigDecimal.ONE,null,null,BigDecimal.ONE,RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,List.of("java","spring boot"),List.of())));
    }
    @Test
    void validatesThresholdAndRejectsEvidenceFormulaAndZeroSkillAttacks() {
        assertThat(validator.validate(requestId,new BigDecimal(".61"),2,2,preparation(),response(primary(10L))).results()).hasSize(1);
        var zero = new AiCandidateRankingV3Response.Result(10L,110L,RecommendationRankingTier.FALLBACK,BigDecimal.ZERO,null,null,BigDecimal.ZERO,RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED,List.of(),List.of());
        assertThat(validator.validate(requestId,BigDecimal.ZERO,2,2,zeroPreparation(),response(zero)).results()).hasSize(1);
        assertThatThrownBy(()->validator.validate(requestId,new BigDecimal(".1"),2,2,zeroPreparation(),response(zero))).isInstanceOf(AppException.class);
        assertInvalid(response(new AiCandidateRankingV3Response.Result(10L,110L,RecommendationRankingTier.FALLBACK,new BigDecimal(".5"),null,null,new BigDecimal(".5"),RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED,null,List.of())));
        assertInvalid(response(new AiCandidateRankingV3Response.Result(10L,110L,RecommendationRankingTier.FALLBACK,new BigDecimal(".5"),null,null,new BigDecimal(".5"),RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED,List.of("java","java"),List.of())));
        assertInvalid(response(new AiCandidateRankingV3Response.Result(10L,110L,RecommendationRankingTier.FALLBACK,new BigDecimal(".5"),null,null,new BigDecimal(".5"),RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED,List.of("spring boot"),List.of("java"))));
        assertInvalid(response(new AiCandidateRankingV3Response.Result(10L,110L,RecommendationRankingTier.FALLBACK,new BigDecimal(".5"),null,null,new BigDecimal(".5"),RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED,List.of("Java"),List.of("spring boot"))));
        assertInvalid(response(new AiCandidateRankingV3Response.Result(10L,110L,RecommendationRankingTier.PRIMARY,new BigDecimal(".62"),new BigDecimal(".62"),new BigDecimal(".4"),BigDecimal.ONE,RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,List.of("java","spring boot"),List.of())));
        assertThat(validator.validate(requestId,BigDecimal.ZERO,2,2,preparation(),response(new AiCandidateRankingV3Response.Result(10L,110L,RecommendationRankingTier.PRIMARY,new BigDecimal(".61000001"),new BigDecimal(".61000001"),new BigDecimal(".4"),BigDecimal.ONE,RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,List.of("java","spring boot"),List.of()))).results()).hasSize(1);
        var zeroPrimary = new AiCandidateRankingV3Response.Result(10L,110L,RecommendationRankingTier.PRIMARY,new BigDecimal(".4"),new BigDecimal(".4"),new BigDecimal(".4"),BigDecimal.ZERO,RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,List.of(),List.of());
        assertThat(validator.validate(requestId,BigDecimal.ZERO,2,2,zeroPreparation(),response(zeroPrimary)).results()).hasSize(1);
        assertThatThrownBy(()->validator.validate(requestId,BigDecimal.ZERO,2,2,zeroPreparation(),response(new AiCandidateRankingV3Response.Result(10L,110L,RecommendationRankingTier.PRIMARY,new BigDecimal(".4"),new BigDecimal(".40000001"),new BigDecimal(".4"),BigDecimal.ZERO,RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,List.of(),List.of())))).isInstanceOf(AppException.class);
    }
    private AiCandidateRankingV3Response.Result primary(long id){return new AiCandidateRankingV3Response.Result(id,id+100,RecommendationRankingTier.PRIMARY,new BigDecimal("0.61000000"),new BigDecimal("0.61000000"),new BigDecimal("0.40000000"),new BigDecimal("1.00000000"),RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,List.of("java","spring boot"),List.of());}
    private AiCandidateRankingV3Response.Result fallback(long id,String score){return new AiCandidateRankingV3Response.Result(id,id+100,RecommendationRankingTier.FALLBACK,new BigDecimal(score),null,null,new BigDecimal(score),RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED,List.of("java","spring boot"),List.of());}
    private AiCandidateRankingV3Response response(AiCandidateRankingV3Response.Result result){return new AiCandidateRankingV3Response(requestId,"tfidf-cosine-hybrid","bilingual-candidate-ranking-v3",List.of(result));}
    private AiCandidateRankingV3Response response(List<AiCandidateRankingV3Response.Result> results){return new AiCandidateRankingV3Response(requestId,"tfidf-cosine-hybrid","bilingual-candidate-ranking-v3",results);}
    private void assertInvalid(AiCandidateRankingV3Response response){assertThatThrownBy(()->validator.validate(requestId,BigDecimal.ZERO,2,2,preparation(),response)).isInstanceOf(AppException.class);}
    private void assertInvalidThreshold(AiCandidateRankingV3Response response,BigDecimal threshold){assertThatThrownBy(()->validator.validate(requestId,threshold,2,2,preparation(),response)).isInstanceOf(AppException.class);}
    private CandidateRankingV3PreparationResult preparation(){
        List<CandidateRankingCandidateSnapshot> candidates=List.of(10L,20L,30L,40L).stream().map(id->new CandidateRankingCandidateSnapshot(id,ApplicationStatus.PENDING,id+100,"ignored","processed",List.of("java","spring boot"),CvAnalysisStatus.READY,"en",BigDecimal.ONE,"bilingual-nlp-v2-skills-v1",LocalDateTime.now())).toList();
        var job=new CandidateRankingJobSnapshot(1L,"job","","",List.of("java","spring boot"),LocalDateTime.now());
        return new CandidateRankingV3PreparationResult(job,new AiCandidateRankingV3Request.JobInput(1L,"job",job.canonicalSkills()),candidates,List.of(),new CandidateRankingCorpusCounters(4,4,0,0,0),"a".repeat(64));
    }
    private CandidateRankingV3PreparationResult zeroPreparation(){
        var candidate=new CandidateRankingCandidateSnapshot(10L,ApplicationStatus.PENDING,110L,"ignored","processed",List.of("java"),CvAnalysisStatus.READY,"en",BigDecimal.ONE,"bilingual-nlp-v2-skills-v1",LocalDateTime.now());
        var job=new CandidateRankingJobSnapshot(1L,"job","","",List.of(),LocalDateTime.now());
        return new CandidateRankingV3PreparationResult(job,new AiCandidateRankingV3Request.JobInput(1L,"job",List.of()),List.of(candidate),List.of(),new CandidateRankingCorpusCounters(1,1,0,0,0),"a".repeat(64));
    }
}
