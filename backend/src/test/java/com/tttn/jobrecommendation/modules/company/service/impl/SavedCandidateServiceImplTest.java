package com.tttn.jobrecommendation.modules.company.service.impl;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.application.repository.JobApplicationRepository;
import com.tttn.jobrecommendation.modules.company.dto.request.SaveCandidateRequest;
import com.tttn.jobrecommendation.modules.company.dto.response.SavedCandidateResponse;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.company.entity.SavedCandidate;
import com.tttn.jobrecommendation.modules.company.mapper.SavedCandidateMapper;
import com.tttn.jobrecommendation.modules.company.repository.CompanyRepository;
import com.tttn.jobrecommendation.modules.company.repository.SavedCandidateRepository;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.repository.StudentProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SavedCandidateServiceImplTest {

    @Mock
    private SavedCandidateRepository savedCandidateRepository;

    @Mock
    private CompanyRepository companyRepository;

    @Mock
    private JobApplicationRepository applicationRepository;

    @Mock
    private StudentProfileRepository studentProfileRepository;

    @Mock
    private SavedCandidateMapper savedCandidateMapper;

    private SavedCandidateServiceImpl savedCandidateService;
    private Company company;
    private Student applicationStudent;
    private JobApplication application;

    @BeforeEach
    void setUp() {
        savedCandidateService = new SavedCandidateServiceImpl(
                savedCandidateRepository,
                companyRepository,
                applicationRepository,
                studentProfileRepository,
                savedCandidateMapper
        );
        company = Company.builder().id(3L).build();
        applicationStudent = Student.builder().id(5L).build();
        Job job = Job.builder().id(6L).company(company).build();
        application = JobApplication.builder()
                .id(7L)
                .student(applicationStudent)
                .job(job)
                .build();
    }

    @Test
    void saveDerivesStudentFromOwnedApplication() {
        SaveCandidateRequest request = request(7L, "  recruiter note  ");
        SavedCandidateResponse response = SavedCandidateResponse.builder().id(11L).build();
        when(companyRepository.findByUserId(2L)).thenReturn(Optional.of(company));
        when(applicationRepository.findDetailedById(7L)).thenReturn(Optional.of(application));
        when(savedCandidateRepository.existsByCompanyIdAndStudentId(3L, 5L)).thenReturn(false);
        when(savedCandidateRepository.saveAndFlush(org.mockito.ArgumentMatchers.any()))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(studentProfileRepository.findByStudentId(5L)).thenReturn(Optional.empty());
        when(savedCandidateMapper.toSavedCandidateResponse(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.isNull()
        )).thenReturn(response);
        ArgumentCaptor<SavedCandidate> candidateCaptor = ArgumentCaptor.forClass(SavedCandidate.class);

        SavedCandidateResponse actual = savedCandidateService.saveCandidate(2L, request);

        verify(savedCandidateRepository).saveAndFlush(candidateCaptor.capture());
        SavedCandidate persisted = candidateCaptor.getValue();
        assertThat(persisted.getStudent()).isSameAs(applicationStudent);
        assertThat(persisted.getApplication()).isSameAs(application);
        assertThat(persisted.getCompany()).isSameAs(company);
        assertThat(persisted.getNote()).isEqualTo("recruiter note");
        assertThat(actual).isSameAs(response);
    }

    @Test
    void foreignCompanyApplicationIsDeniedBeforeSave() {
        Company foreignCompany = Company.builder().id(99L).build();
        application.getJob().setCompany(foreignCompany);
        when(companyRepository.findByUserId(2L)).thenReturn(Optional.of(company));
        when(applicationRepository.findDetailedById(7L)).thenReturn(Optional.of(application));

        assertThatThrownBy(() -> savedCandidateService.saveCandidate(2L, request(7L, null)))
                .isInstanceOfSatisfying(AppException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ACCESS_DENIED));

        verify(savedCandidateRepository, never()).saveAndFlush(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void duplicateCompanyStudentReturnsStableConflictCode() {
        when(companyRepository.findByUserId(2L)).thenReturn(Optional.of(company));
        when(applicationRepository.findDetailedById(7L)).thenReturn(Optional.of(application));
        when(savedCandidateRepository.existsByCompanyIdAndStudentId(3L, 5L)).thenReturn(true);

        assertThatThrownBy(() -> savedCandidateService.saveCandidate(2L, request(7L, null)))
                .isInstanceOfSatisfying(AppException.class, exception ->
                        assertThat(exception.getErrorCode())
                                .isEqualTo(ErrorCode.SAVED_CANDIDATE_ALREADY_EXISTS));
    }

    private SaveCandidateRequest request(Long applicationId, String note) {
        SaveCandidateRequest request = new SaveCandidateRequest();
        request.setApplicationId(applicationId);
        request.setNote(note);
        return request;
    }
}
