package com.tttn.jobrecommendation.modules.student.service.impl;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.modules.student.dto.request.SavedSearchRequest;
import com.tttn.jobrecommendation.modules.student.dto.response.SavedSearchResponse;
import com.tttn.jobrecommendation.modules.student.entity.SavedSearch;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.mapper.SavedSearchMapper;
import com.tttn.jobrecommendation.modules.student.repository.SavedSearchRepository;
import com.tttn.jobrecommendation.modules.student.repository.StudentRepository;
import com.tttn.jobrecommendation.modules.student.service.SavedSearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SavedSearchServiceImpl implements SavedSearchService {

    private final SavedSearchRepository savedSearchRepository;
    private final StudentRepository studentRepository;
    private final SavedSearchMapper savedSearchMapper;

    @Override
    @Transactional(readOnly = true)
    public List<SavedSearchResponse> getMySavedSearches(Long userId) {
        Student student = getStudentByUserId(userId);
        return savedSearchRepository.findByStudentIdOrderByUpdatedAtDescIdDesc(student.getId())
                .stream()
                .map(savedSearchMapper::toSavedSearchResponse)
                .toList();
    }

    @Override
    @Transactional
    public SavedSearchResponse createSavedSearch(Long userId, SavedSearchRequest request) {
        Student student = getStudentByUserId(userId);
        String name = request.getName().trim();
        if (savedSearchRepository.existsByStudentIdAndNameIgnoreCase(student.getId(), name)) {
            throw new AppException(ErrorCode.SAVED_SEARCH_ALREADY_EXISTS);
        }

        SavedSearch savedSearch = SavedSearch.builder()
                .student(student)
                .name(name)
                .keyword(trimToNull(request.getKeyword()))
                .location(trimToNull(request.getLocation()))
                .jobType(request.getJobType())
                .workingModel(request.getWorkingModel())
                .build();
        return savedSearchMapper.toSavedSearchResponse(saveWithDuplicateHandling(savedSearch));
    }

    @Override
    @Transactional
    public SavedSearchResponse updateSavedSearch(
            Long userId,
            Long savedSearchId,
            SavedSearchRequest request
    ) {
        Student student = getStudentByUserId(userId);
        SavedSearch savedSearch = savedSearchRepository.findByIdAndStudentId(savedSearchId, student.getId())
                .orElseThrow(() -> new AppException(ErrorCode.SAVED_SEARCH_NOT_FOUND));
        String name = request.getName().trim();
        if (savedSearchRepository.existsByStudentIdAndNameIgnoreCaseAndIdNot(
                student.getId(),
                name,
                savedSearch.getId()
        )) {
            throw new AppException(ErrorCode.SAVED_SEARCH_ALREADY_EXISTS);
        }

        savedSearch.setName(name);
        savedSearch.setKeyword(trimToNull(request.getKeyword()));
        savedSearch.setLocation(trimToNull(request.getLocation()));
        savedSearch.setJobType(request.getJobType());
        savedSearch.setWorkingModel(request.getWorkingModel());
        return savedSearchMapper.toSavedSearchResponse(saveWithDuplicateHandling(savedSearch));
    }

    @Override
    @Transactional
    public void deleteSavedSearch(Long userId, Long savedSearchId) {
        Student student = getStudentByUserId(userId);
        SavedSearch savedSearch = savedSearchRepository.findByIdAndStudentId(savedSearchId, student.getId())
                .orElseThrow(() -> new AppException(ErrorCode.SAVED_SEARCH_NOT_FOUND));
        savedSearchRepository.delete(savedSearch);
    }

    private SavedSearch saveWithDuplicateHandling(SavedSearch savedSearch) {
        try {
            return savedSearchRepository.saveAndFlush(savedSearch);
        } catch (DataIntegrityViolationException exception) {
            throw new AppException(ErrorCode.SAVED_SEARCH_ALREADY_EXISTS);
        }
    }

    private Student getStudentByUserId(Long userId) {
        return studentRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Student profile not found"));
    }

    private String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
