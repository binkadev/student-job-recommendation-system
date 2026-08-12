package com.tttn.jobrecommendation.infrastructure.ai.skill;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SkillCatalogCanonicalizerTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Test
    void packagedCatalogIsByteAndSemanticParityWithAiCatalog() throws Exception {
        Path repository = repositoryRoot();
        Path aiCatalog = repository.resolve("ai-service/resources/skill_catalog.v1.json");
        Path backendCatalog = repository.resolve("backend/src/main/resources/ai/skill_catalog.v1.json");
        assertThat(aiCatalog).exists();
        assertThat(backendCatalog).exists();

        byte[] aiBytes = Files.readAllBytes(aiCatalog);
        byte[] backendBytes = Files.readAllBytes(backendCatalog);
        assertThat(sha256(aiBytes)).isEqualTo(sha256(backendBytes));

        JsonNode ai = OBJECT_MAPPER.readTree(aiBytes);
        JsonNode backend = OBJECT_MAPPER.readTree(backendBytes);
        assertThat(ai.path("catalogVersion").asText()).isEqualTo(backend.path("catalogVersion").asText());
        assertThat(canonicalEntries(ai)).isEqualTo(canonicalEntries(backend));
        assertThat(aliasMappings(ai)).isEqualTo(aliasMappings(backend));
    }

    @Test
    void exhaustivelyResolvesEveryCanonicalAndAliasFromPackagedCatalog() throws Exception {
        SkillCatalogCanonicalizer canonicalizer = new SkillCatalogCanonicalizer();
        JsonNode catalog = OBJECT_MAPPER.readTree(Files.readAllBytes(
                repositoryRoot().resolve("ai-service/resources/skill_catalog.v1.json")
        ));
        assertThat(canonicalizer.catalogVersion()).isEqualTo("skills-v1");
        for (JsonNode entry : catalog.withArray("skills")) {
            String canonical = entry.path("canonical").asText();
            assertThat(canonicalizer.canonicalize(canonical)).isEqualTo(canonical);
            for (JsonNode alias : entry.withArray("aliases")) {
                assertThat(canonicalizer.canonicalize(alias.asText())).isEqualTo(canonical);
            }
        }
    }

    @Test
    void canonicalizesCompleteSetsWithDeterministicOrderingAndUnknownValues() {
        SkillCatalogCanonicalizer canonicalizer = new SkillCatalogCanonicalizer();
        assertThat(canonicalizer.canonicalizeAllSorted(List.of(
                "Java", "  spring   boot ", "JAVA", "Kỹ năng mới"
        ))).containsExactly("java", "kỹ năng mới", "spring boot");
        assertThat(canonicalizer.canonicalize("TRÍ TUỆ NHÂN TẠO"))
                .isEqualTo("artificial intelligence");
        assertThat(canonicalizer.canonicalize("Cafe\u0301"))
                .isEqualTo("café");
    }

    @Test
    void rejectsMalformedAndInvalidCatalogs() {
        assertInvalid("{\"catalogVersion\":\"skills-v1\",\"skills\":[{\"canonical\":\"java\",\"aliases\":[\"java\"]},{\"canonical\":\"spring\",\"aliases\":[\"java\",\"spring\"]}]}");
        assertInvalid("{\"catalogVersion\":\"skills-v1\",\"skills\":[{\"canonical\":\"java\",\"aliases\":[\"java\",\"java\"]}]}");
        assertInvalid("{\"catalogVersion\":\"wrong\",\"skills\":[{\"canonical\":\"java\",\"aliases\":[\"java\"]}]}");
        assertInvalid("{\"catalogVersion\":\"skills-v1\",\"skills\":[{\"canonical\":\" \",\"aliases\":[\" \"]}]}");
        String overlong = "a".repeat(151);
        assertInvalid("{\"catalogVersion\":\"skills-v1\",\"skills\":[{\"canonical\":\"%s\",\"aliases\":[\"%s\"]}]}".formatted(overlong, overlong));
        assertInvalid("{\"catalogVersion\":\"skills-v1\",\"catalogVersion\":\"skills-v1\",\"skills\":[]}");
    }

    private void assertInvalid(String document) {
        assertThatThrownBy(() -> SkillCatalogCanonicalizer.fromJson(document))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private Path repositoryRoot() {
        Path current = Path.of("").toAbsolutePath();
        while (current != null) {
            if (Files.isRegularFile(current.resolve("ai-service/resources/skill_catalog.v1.json"))
                    && Files.isRegularFile(current.resolve("backend/src/main/resources/ai/skill_catalog.v1.json"))) {
                return current;
            }
            current = current.getParent();
        }
        throw new AssertionError("Repository skill catalogs are required for parity testing");
    }

    private String sha256(byte[] bytes) throws NoSuchAlgorithmException {
        return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }

    private List<String> canonicalEntries(JsonNode catalog) {
        List<String> result = new ArrayList<>();
        for (JsonNode entry : catalog.withArray("skills")) {
            result.add(entry.path("canonical").asText());
        }
        return result;
    }

    private Map<String, String> aliasMappings(JsonNode catalog) {
        Map<String, String> result = new LinkedHashMap<>();
        for (JsonNode entry : catalog.withArray("skills")) {
            String canonical = entry.path("canonical").asText();
            for (JsonNode alias : entry.withArray("aliases")) {
                result.put(alias.asText(), canonical);
            }
        }
        return result;
    }
}
