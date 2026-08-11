package com.tttn.jobrecommendation.infrastructure.ai.skill;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.StreamReadFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Pattern;

/**
 * V3-only canonicalization backed by the checked-in AI skill catalog. This deliberately does
 * not replace the syntactic V2 {@code SkillNameNormalizer}.
 */
@Component
public class SkillCatalogCanonicalizer {

    public static final String CATALOG_VERSION = "skills-v1";
    private static final String RESOURCE_PATH = "/ai/skill_catalog.v1.json";
    private static final int MAX_SKILL_LENGTH = 150;
    private static final Pattern WHITESPACE = Pattern.compile("\\s+", Pattern.UNICODE_CHARACTER_CLASS);

    private final Map<String, String> aliasToCanonical;
    private final Set<String> canonicalSkills;

    public SkillCatalogCanonicalizer() {
        this(loadClasspathCatalog());
    }

    private SkillCatalogCanonicalizer(Catalog catalog) {
        this.aliasToCanonical = catalog.aliasToCanonical();
        this.canonicalSkills = catalog.canonicalSkills();
    }

    public String catalogVersion() {
        return CATALOG_VERSION;
    }

    public Set<String> canonicalSkills() {
        return canonicalSkills;
    }

    public Map<String, String> aliasToCanonical() {
        return aliasToCanonical;
    }

    public String canonicalize(String skill) {
        String normalized = normalize(skill);
        return aliasToCanonical.getOrDefault(normalized, normalized);
    }

    public Set<String> canonicalizeAll(Collection<String> skills) {
        Objects.requireNonNull(skills, "skills must not be null");
        Set<String> canonicalized = new LinkedHashSet<>();
        for (String skill : skills) {
            canonicalized.add(canonicalize(skill));
        }
        return Collections.unmodifiableSet(canonicalized);
    }

    public List<String> canonicalizeAllSorted(Collection<String> skills) {
        return List.copyOf(new TreeSet<>(canonicalizeAll(skills)));
    }

    public static SkillCatalogCanonicalizer fromJson(String catalogJson) {
        Objects.requireNonNull(catalogJson, "catalogJson must not be null");
        try {
            ObjectMapper mapper = JsonMapper.builder()
                    .enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
                    .build();
            return new SkillCatalogCanonicalizer(parseCatalog(mapper.readTree(catalogJson)));
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Invalid skill catalog JSON", exception);
        }
    }

    public static String normalize(String skill) {
        if (skill == null) {
            throw new IllegalArgumentException("skill must not be null");
        }
        if (skill.length() > MAX_SKILL_LENGTH) {
            throw new IllegalArgumentException("skill must contain at most 150 characters");
        }

        String normalized = Normalizer.normalize(skill, Normalizer.Form.NFC);
        normalized = caseFold(normalized);
        normalized = WHITESPACE.matcher(normalized).replaceAll(" ").trim();
        normalized = Normalizer.normalize(normalized, Normalizer.Form.NFC);
        if (normalized.isBlank()) {
            throw new IllegalArgumentException("skill must contain a non-whitespace character");
        }
        if (normalized.length() > MAX_SKILL_LENGTH) {
            throw new IllegalArgumentException("skill must contain at most 150 characters");
        }
        return normalized;
    }

    private static Catalog loadClasspathCatalog() {
        try (InputStream stream = SkillCatalogCanonicalizer.class.getResourceAsStream(RESOURCE_PATH)) {
            if (stream == null) {
                throw new IllegalStateException("Missing packaged skill catalog " + RESOURCE_PATH);
            }
            return new CatalogReader().read(stream);
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to load packaged skill catalog", exception);
        }
    }

    private static String caseFold(String value) {
        // Java has no full Unicode casefold. These mappings cover casefold differences from ROOT
        // lowercasing relevant to deterministic alias matching, including the common sharp-s case.
        return value.toLowerCase(Locale.ROOT)
                .replace("ß", "ss")
                .replace("ς", "σ");
    }

    private static Catalog parseCatalog(JsonNode root) {
        requireObjectWithExactFields(root, Set.of("catalogVersion", "skills"), "root");
        requireText(root.get("catalogVersion"), "root.catalogVersion");
        if (!CATALOG_VERSION.equals(root.get("catalogVersion").textValue())) {
            throw new IllegalArgumentException("Unsupported skill catalog version");
        }
        JsonNode skills = root.get("skills");
        if (!skills.isArray() || skills.isEmpty()) {
            throw new IllegalArgumentException("root.skills must be a non-empty array");
        }

        Map<String, String> aliases = new LinkedHashMap<>();
        Set<String> canonicals = new TreeSet<>();
        for (int index = 0; index < skills.size(); index++) {
            JsonNode entry = skills.get(index);
            String path = "root.skills[" + index + "]";
            requireObjectWithExactFields(entry, Set.of("canonical", "aliases"), path);
            String canonical = requireNormalizedValue(entry.get("canonical"), path + ".canonical");
            if (!canonicals.add(canonical)) {
                throw new IllegalArgumentException("Duplicate canonical skill " + canonical);
            }
            JsonNode aliasesNode = entry.get("aliases");
            if (!aliasesNode.isArray() || aliasesNode.isEmpty()) {
                throw new IllegalArgumentException(path + ".aliases must be a non-empty array");
            }
            Set<String> entryAliases = new LinkedHashSet<>();
            for (int aliasIndex = 0; aliasIndex < aliasesNode.size(); aliasIndex++) {
                String alias = requireNormalizedValue(
                        aliasesNode.get(aliasIndex), path + ".aliases[" + aliasIndex + "]"
                );
                if (!entryAliases.add(alias)) {
                    throw new IllegalArgumentException("Duplicate alias " + alias);
                }
                String previous = aliases.putIfAbsent(alias, canonical);
                if (previous != null) {
                    throw new IllegalArgumentException("Alias collision for " + alias);
                }
            }
            if (!entryAliases.contains(canonical)) {
                throw new IllegalArgumentException("Canonical skill must be present in aliases: " + canonical);
            }
        }
        return new Catalog(
                Collections.unmodifiableMap(new LinkedHashMap<>(aliases)),
                Collections.unmodifiableSet(new TreeSet<>(canonicals))
        );
    }

    private static void requireObjectWithExactFields(JsonNode node, Set<String> expected, String path) {
        if (node == null || !node.isObject()) {
            throw new IllegalArgumentException(path + " must be an object");
        }
        Set<String> fields = new TreeSet<>();
        node.fieldNames().forEachRemaining(fields::add);
        if (!fields.equals(expected)) {
            throw new IllegalArgumentException(path + " has unsupported or missing fields");
        }
    }

    private static void requireText(JsonNode value, String path) {
        if (value == null || !value.isTextual()) {
            throw new IllegalArgumentException(path + " must be a string");
        }
    }

    private static String requireNormalizedValue(JsonNode value, String path) {
        requireText(value, path);
        String supplied = value.textValue();
        String normalized = normalize(supplied);
        if (!supplied.equals(normalized)) {
            throw new IllegalArgumentException(path + " must already be normalized");
        }
        return normalized;
    }

    private record Catalog(Map<String, String> aliasToCanonical, Set<String> canonicalSkills) {
    }

    private static final class CatalogReader {
        private Catalog read(InputStream stream) throws IOException {
            ObjectMapper mapper = JsonMapper.builder()
                    .enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
                    .build();
            return parseCatalog(mapper.readTree(stream));
        }
    }
}
