package com.tttn.jobrecommendation.modules.student.controller;

import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.common.utils.SecurityUtils;
import com.tttn.jobrecommendation.modules.student.dto.request.StudentProfileUpdateRequest;
import com.tttn.jobrecommendation.modules.student.dto.request.StudentUpdateRequest;
import com.tttn.jobrecommendation.modules.student.dto.response.StudentProfileResponse;
import com.tttn.jobrecommendation.modules.student.dto.response.StudentResponse;
import com.tttn.jobrecommendation.modules.student.service.StudentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import jakarta.servlet.http.HttpServletResponse;
import com.tttn.jobrecommendation.modules.student.service.StudentProfileRevision;
import com.tttn.jobrecommendation.modules.student.dto.request.StudentProfileAggregateUpdateRequest;
import com.tttn.jobrecommendation.modules.student.dto.response.StudentProfileAggregateResponse;

@RestController
@RequestMapping("/api/students")
@PreAuthorize("hasRole('STUDENT')")
@RequiredArgsConstructor
public class StudentController {

    private final StudentService studentService;
    private final SecurityUtils securityUtils;
    private final StudentProfileRevision profileRevision;

    @GetMapping("/me")
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ApiResponse<StudentResponse> getMe(HttpServletResponse response) {
        var data = studentService.getMe(securityUtils.getCurrentUserId());
        response.setHeader("ETag", StudentProfileRevision.etag(profileRevision.current(securityUtils.getCurrentUserId())));
        return ApiResponse.success(data);
    }

    @PutMapping("/me")
    public ApiResponse<StudentResponse> updateMe(@Valid @RequestBody StudentUpdateRequest request,
            @RequestHeader(value = "If-Match", required = false) String ifMatch, HttpServletResponse response) {
        long revision = StudentProfileRevision.parseIfMatch(ifMatch);
        var data = studentService.updateMe(securityUtils.getCurrentUserId(), request, revision);
        response.setHeader("ETag", StudentProfileRevision.etag(revision + 1));
        return ApiResponse.success("Student updated successfully", data);
    }

    @GetMapping("/me/profile")
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ApiResponse<StudentProfileResponse> getMyProfile(HttpServletResponse response) {
        var data = studentService.getMyProfile(securityUtils.getCurrentUserId());
        response.setHeader("ETag", StudentProfileRevision.etag(profileRevision.current(securityUtils.getCurrentUserId())));
        return ApiResponse.success(data);
    }

    @PutMapping("/me/profile")
    public ApiResponse<StudentProfileResponse> updateMyProfile(@Valid @RequestBody StudentProfileUpdateRequest request,
            @RequestHeader(value = "If-Match", required = false) String ifMatch, HttpServletResponse response) {
        long revision = StudentProfileRevision.parseIfMatch(ifMatch);
        var data = studentService.updateMyProfile(securityUtils.getCurrentUserId(), request, revision);
        response.setHeader("ETag", StudentProfileRevision.etag(revision + 1));
        return ApiResponse.success(
                "Student profile updated successfully",
                data
        );
    }

    @GetMapping("/me/profile-aggregate")
    public ApiResponse<StudentProfileAggregateResponse> getAggregate(HttpServletResponse response) {
        var data = studentService.getAggregate(securityUtils.getCurrentUserId());
        response.setHeader("ETag", StudentProfileRevision.etag(data.revision()));
        return ApiResponse.success(data);
    }

    @PutMapping("/me/profile-aggregate")
    public ApiResponse<StudentProfileAggregateResponse> updateAggregate(@Valid @RequestBody StudentProfileAggregateUpdateRequest request,
            HttpServletResponse response) {
        var data = studentService.updateAggregate(securityUtils.getCurrentUserId(), request);
        response.setHeader("ETag", StudentProfileRevision.etag(data.revision()));
        return ApiResponse.success("Student profile saved atomically", data);
    }
}
