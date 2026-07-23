package com.tttn.jobrecommendation.modules.company.service;

import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.company.dto.request.SaveCandidateRequest;
import com.tttn.jobrecommendation.modules.company.dto.request.SavedCandidateFilterRequest;
import com.tttn.jobrecommendation.modules.company.dto.response.SavedCandidateResponse;

public interface SavedCandidateService {

    PageResponse<SavedCandidateResponse> getMySavedCandidates(Long userId, SavedCandidateFilterRequest request);

    SavedCandidateResponse saveCandidate(Long userId, SaveCandidateRequest request);

    void deleteSavedCandidate(Long userId, Long savedCandidateId);
}
