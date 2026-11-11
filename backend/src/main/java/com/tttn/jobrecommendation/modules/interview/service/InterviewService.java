package com.tttn.jobrecommendation.modules.interview.service;

import com.tttn.jobrecommendation.common.enums.*;
import com.tttn.jobrecommendation.common.exception.*;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.application.repository.JobApplicationRepository;
import com.tttn.jobrecommendation.modules.company.repository.CompanyRepository;
import com.tttn.jobrecommendation.modules.student.repository.StudentRepository;
import com.tttn.jobrecommendation.modules.interview.dto.request.*;
import com.tttn.jobrecommendation.modules.interview.dto.response.InterviewResponse;
import com.tttn.jobrecommendation.modules.interview.entity.Interview;
import com.tttn.jobrecommendation.modules.interview.repository.InterviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.net.URI;
import java.time.LocalDateTime;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InterviewService {
    private final InterviewRepository interviews;
    private final JobApplicationRepository applications;
    private final CompanyRepository companies;
    private final StudentRepository students;

    @Transactional
    public InterviewResponse create(Long userId, CreateInterviewRequest request) {
        var company = companies.findByUserIdForUpdate(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Company not found"));
        var application = applications.findByIdForStatusUpdate(request.applicationId())
                .orElseThrow(() -> new ResourceNotFoundException("Application not found"));
        if (!application.getJob().getCompany().getId().equals(company.getId())) denied();
        if (company.getStatus() != CompanyStatus.VERIFIED) bad("Only verified companies can schedule interviews");
        if (!Set.of(ApplicationStatus.PENDING, ApplicationStatus.REVIEWED, ApplicationStatus.ACCEPTED).contains(application.getStatus()))
            bad("Application is no longer eligible for an interview");
        if (application.getStudent().getUser().getStatus() != UserStatus.ACTIVE) bad("Student is not eligible");
        if (!request.scheduledAt().isAfter(LocalDateTime.now())) bad("Interview must be in the future");
        if (request.meetingType() == MeetingType.ONLINE && !safeHttpUrl(request.locationOrLink()))
            bad("Online interviews require an absolute HTTP(S) URL without credentials or whitespace");
        var interview = Interview.builder().company(company).application(application)
                .student(application.getStudent()).job(application.getJob()).title(request.title().trim())
                .scheduledAt(request.scheduledAt()).durationMinutes(request.durationMinutes()).meetingType(request.meetingType())
                .locationOrLink(request.locationOrLink().trim()).notes(request.notes()).status(InterviewStatus.SCHEDULED).build();
        return InterviewResponse.from(interviews.saveAndFlush(interview));
    }

    public PageResponse<InterviewResponse> list(Long userId, boolean company, int page, int size) {
        var pageable = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "createdAt", "id"));
        Page<Interview> result;
        if (company) {
            Long id = companies.findByUserId(userId).orElseThrow(() -> new ResourceNotFoundException("Company not found")).getId();
            result = interviews.findByCompanyId(id, pageable);
        } else {
            Long id = students.findByUserId(userId).orElseThrow(() -> new ResourceNotFoundException("Student not found")).getId();
            result = interviews.findByStudentId(id, pageable);
        }
        return new PageResponse<>(result.map(InterviewResponse::from).getContent(), page, size, result.getTotalElements(), result.getTotalPages());
    }

    @Transactional
    public InterviewResponse update(Long userId, boolean company, Long id, UpdateInterviewStatusRequest request) {
        // Lock before authorization/state validation; the expected state is compared in the same transaction.
        var item = interviews.findByIdForUpdate(id).orElseThrow(() -> new ResourceNotFoundException("Interview not found"));
        Long ownerUserId = company ? item.getCompany().getUser().getId() : item.getStudent().getUser().getId();
        if (!ownerUserId.equals(userId)) denied();
        if (request.expectedStatus() != item.getStatus()) throw new AppException(ErrorCode.RECRUITMENT_STATE_CONFLICT);
        var current = item.getStatus(); var target = request.status();
        boolean legal = company
                ? ((current == InterviewStatus.SCHEDULED || current == InterviewStatus.CONFIRMED) && target == InterviewStatus.CANCELLED)
                    || (current == InterviewStatus.CONFIRMED && target == InterviewStatus.COMPLETED
                        && !item.getScheduledAt().plusMinutes(item.getDurationMinutes()).isAfter(LocalDateTime.now()))
                : current == InterviewStatus.SCHEDULED && (target == InterviewStatus.CONFIRMED || target == InterviewStatus.DECLINED)
                    && item.getScheduledAt().isAfter(LocalDateTime.now());
        if (!legal) bad("Invalid interview status transition");
        item.setStatus(target);
        return InterviewResponse.from(interviews.saveAndFlush(item));
    }

    private static boolean safeHttpUrl(String value) {
        if (value.codePoints().anyMatch(c -> Character.isWhitespace(c) || Character.isSpaceChar(c))) return false;
        try {
            URI uri = new URI(value);
            return ("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                    && uri.getHost() != null && uri.getRawUserInfo() == null && (uri.getPort() == -1 || uri.getPort() >= 1 && uri.getPort() <= 65535);
        } catch (java.net.URISyntaxException error) { return false; }
    }
    private static void bad(String message) { throw new AppException(ErrorCode.BAD_REQUEST, message); }
    private static void denied() { throw new AppException(ErrorCode.ACCESS_DENIED); }
}
