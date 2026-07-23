package com.tttn.jobrecommendation.modules.student.controller;

import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.common.utils.SecurityUtils;
import com.tttn.jobrecommendation.modules.student.dto.request.SavedSearchRequest;
import com.tttn.jobrecommendation.modules.student.dto.response.SavedSearchResponse;
import com.tttn.jobrecommendation.modules.student.service.SavedSearchService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/students/me/saved-searches")
@PreAuthorize("hasRole('STUDENT')")
@RequiredArgsConstructor
public class SavedSearchController {

    private final SavedSearchService savedSearchService;
    private final SecurityUtils securityUtils;

    @GetMapping
    public ApiResponse<List<SavedSearchResponse>> getMySavedSearches() {
        return ApiResponse.success(savedSearchService.getMySavedSearches(securityUtils.getCurrentUserId()));
    }

    @PostMapping
    public ApiResponse<SavedSearchResponse> createSavedSearch(@Valid @RequestBody SavedSearchRequest request) {
        return ApiResponse.success(
                "Saved search created successfully",
                savedSearchService.createSavedSearch(securityUtils.getCurrentUserId(), request)
        );
    }

    @PutMapping("/{savedSearchId}")
    public ApiResponse<SavedSearchResponse> updateSavedSearch(
            @PathVariable Long savedSearchId,
            @Valid @RequestBody SavedSearchRequest request
    ) {
        return ApiResponse.success(
                "Saved search updated successfully",
                savedSearchService.updateSavedSearch(
                        securityUtils.getCurrentUserId(),
                        savedSearchId,
                        request
                )
        );
    }

    @DeleteMapping("/{savedSearchId}")
    public ApiResponse<Void> deleteSavedSearch(@PathVariable Long savedSearchId) {
        savedSearchService.deleteSavedSearch(securityUtils.getCurrentUserId(), savedSearchId);
        return ApiResponse.success("Saved search deleted successfully", null);
    }
}
