package com.tttn.jobrecommendation.modules.student.mapper;

import com.tttn.jobrecommendation.modules.student.dto.response.SavedSearchResponse;
import com.tttn.jobrecommendation.modules.student.entity.SavedSearch;
import org.springframework.stereotype.Component;

@Component
public class SavedSearchMapper {

    public SavedSearchResponse toSavedSearchResponse(SavedSearch savedSearch) {
        return SavedSearchResponse.builder()
                .id(savedSearch.getId())
                .name(savedSearch.getName())
                .keyword(savedSearch.getKeyword())
                .location(savedSearch.getLocation())
                .jobType(savedSearch.getJobType())
                .workingModel(savedSearch.getWorkingModel())
                .createdAt(savedSearch.getCreatedAt())
                .updatedAt(savedSearch.getUpdatedAt())
                .build();
    }
}
