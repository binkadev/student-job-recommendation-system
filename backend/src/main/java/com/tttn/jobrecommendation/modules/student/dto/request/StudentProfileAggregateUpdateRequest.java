package com.tttn.jobrecommendation.modules.student.dto.request;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonSetter;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.AccessLevel;
import com.tttn.jobrecommendation.modules.skill.dto.request.StudentSkillItemRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;
import java.util.List;
import java.util.Set;

@Getter
@Setter
public class StudentProfileAggregateUpdateRequest {
    @NotNull @PositiveOrZero @Setter(AccessLevel.NONE) private Long revision;
    @Valid private BasicFields student;
    @Valid private ProfileFields profile;
    @Size(max = 200) private List<@NotNull @Valid StudentSkillItemRequest> manualSkills;
    private Set<@NotNull ClearField> clearFields = Set.of();

    public enum ClearField { graduationYear, preferredJobType }

    @JsonSetter("revision")
    public void readRevision(JsonNode value) {
        if (value == null || value.isNull()) { revision = null; return; }
        if (!value.isIntegralNumber() || !value.canConvertToLong()) throw new IllegalArgumentException("revision must be an integer");
        revision = value.longValue();
    }

    @Getter @Setter
    public static class BasicFields extends StudentUpdateRequest {
        @JsonAnySetter public void unknown(String field, Object value) { throw new IllegalArgumentException("Unsupported student field: " + field); }
    }
    @Getter @Setter
    public static class ProfileFields extends StudentProfileUpdateRequest {
        @JsonAnySetter public void unknown(String field, Object value) { throw new IllegalArgumentException("Unsupported profile field: " + field); }
    }
    @JsonAnySetter public void unknown(String field, Object value) { throw new IllegalArgumentException("Unsupported field: " + field); }
}
