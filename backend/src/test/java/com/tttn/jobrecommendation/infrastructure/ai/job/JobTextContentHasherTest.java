package com.tttn.jobrecommendation.infrastructure.ai.job;

import com.tttn.jobrecommendation.modules.job.entity.Job;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class JobTextContentHasherTest {

    @Test
    void sha256MatchesGoldenCrossLanguageVectorsIdenticalToPython() {
        assertThat(JobTextContentHasher.sha256(
                "  Senior Java Engineer \r\n",
                "\r\nBuild APIs\r\nwith Spring Boot.  ",
                "  3+ years Java\r\n "
        )).isEqualTo("ca95c77f1ec528fa92a6a490ec4a56ee4af6f96ce7dc54d69c0a19ff6bc27766");

        String nullReqHash = JobTextContentHasher.sha256("Backend Intern", "Work on services.", null);
        String blankReqHash = JobTextContentHasher.sha256("Backend Intern", "Work on services.", "  \r\n\t ");
        assertThat(nullReqHash)
                .isEqualTo("826dcbba00114e433a8cef49d659cab1cce305b2a7f1a2e66db83d4feeb2a951")
                .isEqualTo(blankReqHash);

        assertThat(JobTextContentHasher.sha256(
                "AI Engineer \u2014 NLP",
                "Build pipelines with C++ & .NET\u00a0modules.",
                "English & Python"
        )).isEqualTo("bffb34b089f7a28aeaaddbd0753d4d2e454ada5ab497bebc36bd41adfb5c097c");
    }

    @Test
    void hasFreshSnapshotValidatesVersionLanguageHashAndEnglishProcessedText() {
        String title = "Java Engineer";
        String description = "Build microservices";
        String requirements = "Spring Boot";
        String hash = JobTextContentHasher.sha256(title, description, requirements);

        Job freshEnglish = Job.builder()
                .id(1L).title(title).description(description).requirements(requirements)
                .processedText("java_engineer build microservice spring_boot")
                .languageCode("en")
                .languageConfidence(new BigDecimal("0.92"))
                .processingVersion(JobTextContentHasher.PROCESSING_VERSION)
                .contentHash(hash)
                .build();
        assertThat(JobTextContentHasher.hasFreshSnapshot(freshEnglish)).isTrue();

        Job freshVietnamese = Job.builder()
                .id(2L).title(title).description(description).requirements(requirements)
                .processedText(null)
                .languageCode("vi")
                .languageConfidence(new BigDecimal("0.95"))
                .processingVersion(JobTextContentHasher.PROCESSING_VERSION)
                .contentHash(hash)
                .build();
        assertThat(JobTextContentHasher.hasFreshSnapshot(freshVietnamese)).isTrue();

        Job staleHash = Job.builder()
                .id(3L).title("Updated Java Engineer").description(description).requirements(requirements)
                .processedText("java_engineer")
                .languageCode("en")
                .languageConfidence(new BigDecimal("0.92"))
                .processingVersion(JobTextContentHasher.PROCESSING_VERSION)
                .contentHash(hash)
                .build();
        assertThat(JobTextContentHasher.hasFreshSnapshot(staleHash)).isFalse();

        Job blankEnglishProcessedText = Job.builder()
                .id(4L).title(title).description(description).requirements(requirements)
                .processedText(" ")
                .languageCode("en")
                .languageConfidence(new BigDecimal("0.92"))
                .processingVersion(JobTextContentHasher.PROCESSING_VERSION)
                .contentHash(hash)
                .build();
        assertThat(JobTextContentHasher.hasFreshSnapshot(blankEnglishProcessedText)).isFalse();

        Job oldVersion = Job.builder()
                .id(5L).title(title).description(description).requirements(requirements)
                .processedText("java_engineer")
                .languageCode("en")
                .languageConfidence(new BigDecimal("0.92"))
                .processingVersion("legacy-v0")
                .contentHash(hash)
                .build();
        assertThat(JobTextContentHasher.hasFreshSnapshot(oldVersion)).isFalse();
    }
}
