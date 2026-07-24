package com.tttn.jobrecommendation.modules.company.controller;

import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.common.utils.SecurityUtils;
import com.tttn.jobrecommendation.modules.company.dto.request.SaveCandidateRequest;
import com.tttn.jobrecommendation.modules.company.dto.request.SavedCandidateFilterRequest;
import com.tttn.jobrecommendation.modules.company.dto.response.SavedCandidateResponse;
import com.tttn.jobrecommendation.modules.company.service.SavedCandidateService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/companies/me/saved-candidates")
@PreAuthorize("hasRole('COMPANY')")
@RequiredArgsConstructor
public class SavedCandidateController {

    private final SavedCandidateService savedCandidateService;
    private final SecurityUtils securityUtils;

    @GetMapping
    public ApiResponse<PageResponse<SavedCandidateResponse>> getMySavedCandidates(
            @Valid @ModelAttribute SavedCandidateFilterRequest request
    ) {
        return ApiResponse.success(savedCandidateService.getMySavedCandidates(
                securityUtils.getCurrentUserId(),
                request
        ));
    }

    @PostMapping
    public ApiResponse<SavedCandidateResponse> saveCandidate(@Valid @RequestBody SaveCandidateRequest request) {
        return ApiResponse.success(
                "Candidate saved successfully",
                savedCandidateService.saveCandidate(securityUtils.getCurrentUserId(), request)
        );
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteSavedCandidate(@PathVariable Long id) {
        savedCandidateService.deleteSavedCandidate(securityUtils.getCurrentUserId(), id);
        return ApiResponse.success("Saved candidate deleted successfully", null);
    }
}
