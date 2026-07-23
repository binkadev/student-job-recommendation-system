package com.tttn.jobrecommendation.modules.student.service.impl;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.modules.student.dto.request.SavedSearchRequest;
import com.tttn.jobrecommendation.modules.student.dto.response.SavedSearchResponse;
import com.tttn.jobrecommendation.modules.student.entity.SavedSearch;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.mapper.SavedSearchMapper;
import com.tttn.jobrecommendation.modules.student.repository.SavedSearchRepository;
import com.tttn.jobrecommendation.modules.student.repository.StudentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SavedSearchServiceImplTest {

    @Mock
    private SavedSearchRepository savedSearchRepository;

    @Mock
    private StudentRepository studentRepository;

    @Mock
    private SavedSearchMapper savedSearchMapper;

    private SavedSearchServiceImpl service;
    private Student student;

    @BeforeEach
    void setUp() {
        service = new SavedSearchServiceImpl(savedSearchRepository, studentRepository, savedSearchMapper);
        student = Student.builder().id(5L).build();
        when(studentRepository.findByUserId(3L)).thenReturn(Optional.of(student));
    }

    @Test
    void createDerivesOwnershipAndNormalizesText() {
        SavedSearchRequest request = request("  Java roles  ");
        request.setKeyword("  Spring  ");
        request.setLocation("   ");
        SavedSearchResponse mapped = SavedSearchResponse.builder().id(8L).build();
        when(savedSearchRepository.existsByStudentIdAndNameIgnoreCase(5L, "Java roles")).thenReturn(false);
        when(savedSearchRepository.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(savedSearchMapper.toSavedSearchResponse(any())).thenReturn(mapped);
        ArgumentCaptor<SavedSearch> captor = ArgumentCaptor.forClass(SavedSearch.class);

        SavedSearchResponse result = service.createSavedSearch(3L, request);

        verify(savedSearchRepository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getStudent()).isSameAs(student);
        assertThat(captor.getValue().getName()).isEqualTo("Java roles");
        assertThat(captor.getValue().getKeyword()).isEqualTo("Spring");
        assertThat(captor.getValue().getLocation()).isNull();
        assertThat(result).isSameAs(mapped);
    }

    @Test
    void duplicateNameReturnsStableConflictBeforeInsert() {
        when(savedSearchRepository.existsByStudentIdAndNameIgnoreCase(5L, "Java roles")).thenReturn(true);

        assertThatThrownBy(() -> service.createSavedSearch(3L, request("Java roles")))
                .isInstanceOfSatisfying(AppException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.SAVED_SEARCH_ALREADY_EXISTS));

        verify(savedSearchRepository, never()).saveAndFlush(any());
    }

    @Test
    void foreignOrAbsentIdentifierUsesSameNotFoundCode() {
        when(savedSearchRepository.findByIdAndStudentId(99L, 5L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.deleteSavedSearch(3L, 99L))
                .isInstanceOfSatisfying(AppException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.SAVED_SEARCH_NOT_FOUND));
    }

    private SavedSearchRequest request(String name) {
        SavedSearchRequest request = new SavedSearchRequest();
        request.setName(name);
        return request;
    }
}
