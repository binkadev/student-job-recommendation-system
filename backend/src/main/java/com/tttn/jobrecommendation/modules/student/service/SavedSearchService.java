package com.tttn.jobrecommendation.modules.student.service;

import com.tttn.jobrecommendation.modules.student.dto.request.SavedSearchRequest;
import com.tttn.jobrecommendation.modules.student.dto.response.SavedSearchResponse;

import java.util.List;

public interface SavedSearchService {

    List<SavedSearchResponse> getMySavedSearches(Long userId);

    SavedSearchResponse createSavedSearch(Long userId, SavedSearchRequest request);

    SavedSearchResponse updateSavedSearch(Long userId, Long savedSearchId, SavedSearchRequest request);

    void deleteSavedSearch(Long userId, Long savedSearchId);
}
