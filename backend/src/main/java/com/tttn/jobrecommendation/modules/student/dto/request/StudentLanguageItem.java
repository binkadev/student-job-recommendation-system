package com.tttn.jobrecommendation.modules.student.dto.request;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentLanguageItem {

    @NotBlank(message = "Language name must not be blank")
    @Size(max = 100)
    private String name;

    @NotBlank(message = "Language level must not be blank")
    @Size(max = 100)
    private String level;

    @JsonAnySetter
    public void unknown(String field, Object value) {
        throw new IllegalArgumentException("Unsupported language field: " + field);
    }
}
