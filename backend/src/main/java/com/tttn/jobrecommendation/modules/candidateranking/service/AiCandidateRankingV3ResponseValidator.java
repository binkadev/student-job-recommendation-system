package com.tttn.jobrecommendation.modules.candidateranking.service;

import com.tttn.jobrecommendation.common.enums.RecommendationRankingTier;
import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingV3Response;
import com.tttn.jobrecommendation.infrastructure.ai.skill.SkillCatalogCanonicalizer;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingCandidateSnapshot;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingV3PreparationResult;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.ValidatedCandidateRankingV3Response;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Component
class AiCandidateRankingV3ResponseValidator {
    static final String ALGORITHM = "tfidf-cosine-hybrid";
    static final String VERSION = "bilingual-candidate-ranking-v3";
    private static final BigDecimal TEXT_WEIGHT = new BigDecimal("0.65");
    private static final BigDecimal SKILL_WEIGHT = new BigDecimal("0.35");
    private final SkillCatalogCanonicalizer canonicalizer;
    AiCandidateRankingV3ResponseValidator(SkillCatalogCanonicalizer canonicalizer) { this.canonicalizer = canonicalizer; }

    ValidatedCandidateRankingV3Response validate(UUID requestId, BigDecimal threshold, int primaryLimit, int fallbackLimit,
                                                   CandidateRankingV3PreparationResult preparation, AiCandidateRankingV3Response response) {
        if (requestId == null || threshold == null || threshold.compareTo(BigDecimal.ZERO) < 0 || threshold.compareTo(BigDecimal.ONE) > 0
                || primaryLimit < 0 || fallbackLimit < 0 || primaryLimit + fallbackLimit < 1 || primaryLimit + fallbackLimit > 100
                || preparation == null || response == null || !requestId.equals(response.requestId())
                || !ALGORITHM.equals(response.algorithm()) || !VERSION.equals(response.algorithmVersion()) || response.results() == null
                || response.results().size() > primaryLimit + fallbackLimit) throw invalid();
        Map<Long, CandidateRankingCandidateSnapshot> candidates = new HashMap<>();
        for (CandidateRankingCandidateSnapshot candidate : preparation.eligibleCandidateSnapshots()) {
            if (candidate == null || candidate.applicationId() == null || candidates.putIfAbsent(candidate.applicationId(), candidate) != null) throw invalid();
        }
        List<String> jobSkills = preparation.jobSnapshot().canonicalSkills();
        Set<Long> seen = new HashSet<>(); List<Raw> raw = new ArrayList<>(); int primary = 0, fallback = 0;
        for (AiCandidateRankingV3Response.Result result : response.results()) {
            Raw value = validateResult(result, candidates, jobSkills, seen, threshold); raw.add(value);
            if (value.tier == RecommendationRankingTier.PRIMARY) primary++; else fallback++;
        }
        if (primary > primaryLimit || fallback > fallbackLimit) throw invalid();
        raw.sort(Comparator.comparing(Raw::tier).thenComparing(Raw::ranking, Comparator.reverseOrder()).thenComparing(Raw::applicationId));
        List<ValidatedCandidateRankingV3Response.Result> values = new ArrayList<>(); int p=0,f=0;
        for (int i=0;i<raw.size();i++) { Raw r=raw.get(i); int tr=r.tier==RecommendationRankingTier.PRIMARY ? ++p : ++f;
            values.add(new ValidatedCandidateRankingV3Response.Result(r.applicationId,r.cvId,r.tier,persist(r.ranking),persist(r.overall),persist(r.text),persist(r.skill),r.strategy,r.matched,r.missing,reason(r),i+1,tr,r.processingVersion,r.analyzedAt)); }
        return new ValidatedCandidateRankingV3Response(ALGORITHM, VERSION, values);
    }
    private Raw validateResult(AiCandidateRankingV3Response.Result result, Map<Long,CandidateRankingCandidateSnapshot> candidates,
                               List<String> jobSkills, Set<Long> seen, BigDecimal threshold) {
        if (result==null||result.applicationId()==null||result.applicationId()<=0||!seen.add(result.applicationId())||result.cvId()==null||result.cvId()<=0||result.rankingTier()==null||result.scoringStrategy()==null) throw invalid();
        CandidateRankingCandidateSnapshot c=candidates.get(result.applicationId()); if(c==null||!result.cvId().equals(c.cvId()))throw invalid();
        BigDecimal ranking=score(result.rankingScore()), skill=score(result.skillScore()); if(ranking.compareTo(threshold)<0)throw invalid();
        evidence(result.matchedSkills(),result.missingSkills(),jobSkills,new HashSet<>(c.canonicalExtractedSkills()));
        BigDecimal expected=jobSkills.isEmpty()?BigDecimal.ZERO.setScale(8):BigDecimal.valueOf(result.matchedSkills().size()).divide(BigDecimal.valueOf(jobSkills.size()),8,RoundingMode.HALF_UP); exact(skill,expected);
        if(result.rankingTier()==RecommendationRankingTier.PRIMARY){if(result.scoringStrategy()!=RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID||result.textScore()==null||result.overallScore()==null)throw invalid(); BigDecimal text=score(result.textScore()),overall=score(result.overallScore()); exact(ranking,overall); if(jobSkills.isEmpty()){exact(skill,BigDecimal.ZERO);exact(overall,text);}else{BigDecimal formula=TEXT_WEIGHT.multiply(text).add(SKILL_WEIGHT.multiply(skill)).setScale(8,RoundingMode.HALF_UP);if(overall.subtract(formula).abs().compareTo(new BigDecimal("0.00000001"))>0)throw invalid();}return new Raw(result.applicationId(),result.cvId(),result.rankingTier(),ranking,overall,text,skill,result.scoringStrategy(),List.copyOf(result.matchedSkills()),List.copyOf(result.missingSkills()),c.processingVersion(),c.analyzedAt());}
        if(result.scoringStrategy()!=RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED||result.textScore()!=null||result.overallScore()!=null)throw invalid();exact(ranking,skill);if(jobSkills.isEmpty())exact(skill,BigDecimal.ZERO);return new Raw(result.applicationId(),result.cvId(),result.rankingTier(),ranking,null,null,skill,result.scoringStrategy(),List.copyOf(result.matchedSkills()),List.copyOf(result.missingSkills()),c.processingVersion(),c.analyzedAt());
    }
    private void evidence(List<String> matched,List<String> missing,List<String> job,Set<String> cv){skills(matched);skills(missing);List<String> em=job.stream().filter(cv::contains).toList(), en=job.stream().filter(x->!cv.contains(x)).toList();if(!matched.equals(em)||!missing.equals(en))throw invalid();}
    private void skills(List<String> values){if(values==null||values.size()>100)throw invalid();String prev=null;for(String v:values){if(!StringUtils.hasText(v)||v.length()>150||!v.equals(canonicalizer.canonicalize(v))||(prev!=null&&prev.compareTo(v)>=0))throw invalid();prev=v;}}
    private BigDecimal score(BigDecimal v){if(v==null||v.compareTo(BigDecimal.ZERO)<0||v.compareTo(BigDecimal.ONE)>0||v.scale()>8)throw invalid();return v;}
    private void exact(BigDecimal a,BigDecimal e){if(a.compareTo(e)!=0)throw invalid();}
    private BigDecimal persist(BigDecimal v){return v==null?null:v.setScale(5,RoundingMode.HALF_UP);}
    private String reason(Raw r){return r.tier==RecommendationRankingTier.PRIMARY?"Candidate and Job text plus canonical skills were evaluated.":"Cross-language match is based on canonical skill overlap.";}
    private AppException invalid(){return new AppException(ErrorCode.AI_SERVICE_INVALID_RESPONSE);}
    private record Raw(Long applicationId,Long cvId,RecommendationRankingTier tier,BigDecimal ranking,BigDecimal overall,BigDecimal text,BigDecimal skill,RecommendationScoringStrategy strategy,List<String> matched,List<String> missing,String processingVersion,java.time.LocalDateTime analyzedAt){}
}
