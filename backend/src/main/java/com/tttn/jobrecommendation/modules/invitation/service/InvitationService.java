package com.tttn.jobrecommendation.modules.invitation.service;

import com.tttn.jobrecommendation.common.enums.*;
import com.tttn.jobrecommendation.common.exception.*;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.application.repository.JobApplicationRepository;
import com.tttn.jobrecommendation.modules.company.repository.CompanyRepository;
import com.tttn.jobrecommendation.modules.company.repository.SavedCandidateRepository;
import com.tttn.jobrecommendation.modules.student.repository.StudentRepository;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.invitation.dto.request.*;
import com.tttn.jobrecommendation.modules.invitation.dto.response.InvitationResponse;
import com.tttn.jobrecommendation.modules.invitation.entity.JobInvitation;
import com.tttn.jobrecommendation.modules.invitation.repository.JobInvitationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InvitationService {
    private final JobInvitationRepository invitations;
    private final JobApplicationRepository applications;
    private final CompanyRepository companies;
    private final StudentRepository students;
    private final SavedCandidateRepository savedCandidates;
    private final JobRepository jobs;

    @Transactional
    public InvitationResponse create(Long userId, CreateInvitationRequest request) {
        // Match moderation lock order: Company then Job; status/deadline checks remain atomic with creation.
        var company = companies.findByUserIdForUpdate(userId).orElseThrow(() -> new ResourceNotFoundException("Company not found"));
        var job = jobs.findByIdForUpdate(request.jobId()).orElseThrow(() -> new ResourceNotFoundException("Job not found"));
        if (!job.getCompany().getId().equals(company.getId())) denied();
        if (company.getStatus() != CompanyStatus.VERIFIED || job.getStatus() != JobStatus.ACTIVE
                || job.getDeadline() != null && job.getDeadline().isBefore(LocalDate.now())) bad("Job is not open for invitations");
        var student = students.findById(request.studentId()).orElseThrow(() -> new ResourceNotFoundException("Student not found"));
        if (!applications.existsByStudentIdAndJobCompanyId(student.getId(), company.getId())
                && !savedCandidates.existsByCompanyIdAndStudentId(company.getId(), student.getId())) denied();
        if (student.getUser().getStatus() != UserStatus.ACTIVE) bad("Student is not eligible");
        if (invitations.existsByCompanyIdAndStudentIdAndJobIdAndStatus(company.getId(), student.getId(), job.getId(), InvitationStatus.PENDING))
            throw new AppException(ErrorCode.INVITATION_ALREADY_PENDING);
        var item = JobInvitation.builder().company(company).student(student).job(job)
                .message(request.message()).status(InvitationStatus.PENDING).build();
        try { return InvitationResponse.from(invitations.saveAndFlush(item)); }
        catch (DataIntegrityViolationException error) {
            for (Throwable cause = error; cause != null; cause = cause.getCause()) {
                if (cause instanceof org.hibernate.exception.ConstraintViolationException constraint
                        && "uk_job_invitations_pending".equals(constraint.getConstraintName()))
                    throw new AppException(ErrorCode.INVITATION_ALREADY_PENDING);
            }
            throw error;
        }
    }

    public PageResponse<InvitationResponse> list(Long userId, boolean company, int page, int size) {
        var pageable = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "createdAt", "id"));
        Page<JobInvitation> result;
        if (company) {
            Long id = companies.findByUserId(userId).orElseThrow(() -> new ResourceNotFoundException("Company not found")).getId();
            result = invitations.findByCompanyId(id, pageable);
        } else {
            Long id = students.findByUserId(userId).orElseThrow(() -> new ResourceNotFoundException("Student not found")).getId();
            result = invitations.findByStudentId(id, pageable);
        }
        return new PageResponse<>(result.map(InvitationResponse::from).getContent(), page, size, result.getTotalElements(), result.getTotalPages());
    }

    @Transactional
    public InvitationResponse update(Long userId, boolean company, Long id, UpdateInvitationStatusRequest request) {
        var item = invitations.findByIdForUpdate(id).orElseThrow(() -> new ResourceNotFoundException("Invitation not found"));
        Long ownerUserId = company ? item.getCompany().getUser().getId() : item.getStudent().getUser().getId();
        if (!ownerUserId.equals(userId)) denied();
        if (request.expectedStatus() != item.getStatus()) throw new AppException(ErrorCode.RECRUITMENT_STATE_CONFLICT);
        boolean legal = item.getStatus() == InvitationStatus.PENDING && (company
                ? request.status() == InvitationStatus.CANCELLED
                : request.status() == InvitationStatus.ACCEPTED || request.status() == InvitationStatus.DECLINED);
        if (!legal) bad("Invalid invitation status transition");
        item.setStatus(request.status());
        return InvitationResponse.from(invitations.saveAndFlush(item));
    }
    private static void bad(String message) { throw new AppException(ErrorCode.BAD_REQUEST, message); }
    private static void denied() { throw new AppException(ErrorCode.ACCESS_DENIED); }
}
