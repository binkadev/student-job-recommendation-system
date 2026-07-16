package com.tttn.jobrecommendation.modules.job.service;

import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.job.dto.response.SavedJobResponse;

public interface SavedJobService {

    SavedJobResponse saveJob(Long userId, Long jobId);

    PageResponse<SavedJobResponse> getMySavedJobs(Long userId, Integer page, Integer size);

    void removeSavedJob(Long userId, Long jobId);
}
