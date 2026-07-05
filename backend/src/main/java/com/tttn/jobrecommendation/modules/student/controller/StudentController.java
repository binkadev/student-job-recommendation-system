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

@RestController
@RequestMapping("/api/students")
@PreAuthorize("hasRole('STUDENT')")
@RequiredArgsConstructor
public class StudentController {

    private final StudentService studentService;
    private final SecurityUtils securityUtils;

    @GetMapping("/me")
    public ApiResponse<StudentResponse> getMe() {
        return ApiResponse.success(studentService.getMe(securityUtils.getCurrentUserId()));
    }

    @PutMapping("/me")
    public ApiResponse<StudentResponse> updateMe(@Valid @RequestBody StudentUpdateRequest request) {
        return ApiResponse.success("Student updated successfully", studentService.updateMe(securityUtils.getCurrentUserId(), request));
    }

    @GetMapping("/me/profile")
    public ApiResponse<StudentProfileResponse> getMyProfile() {
        return ApiResponse.success(studentService.getMyProfile(securityUtils.getCurrentUserId()));
    }

    @PutMapping("/me/profile")
    public ApiResponse<StudentProfileResponse> updateMyProfile(@Valid @RequestBody StudentProfileUpdateRequest request) {
        return ApiResponse.success(
                "Student profile updated successfully",
                studentService.updateMyProfile(securityUtils.getCurrentUserId(), request)
        );
    }
}
