package com.tttn.jobrecommendation.modules.statistics.service.impl;

import com.tttn.jobrecommendation.modules.statistics.dto.response.PublicStatisticsResponse;
import com.tttn.jobrecommendation.modules.statistics.repository.PublicStatisticsCountProjection;
import com.tttn.jobrecommendation.modules.statistics.repository.PublicStatisticsRepository;
import com.tttn.jobrecommendation.modules.statistics.service.PublicStatisticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Service
@RequiredArgsConstructor
public class PublicStatisticsServiceImpl implements PublicStatisticsService {

    private final PublicStatisticsRepository publicStatisticsRepository;

    @Override
    @Transactional(readOnly = true)
    public PublicStatisticsResponse getStatistics() {
        PublicStatisticsCountProjection counts = publicStatisticsRepository.getStatistics(LocalDate.now());
        return new PublicStatisticsResponse(
                counts.getTotalJobs(),
                counts.getTotalCompanies(),
                counts.getTotalStudents(),
                counts.getTotalApplications()
        );
    }
}
