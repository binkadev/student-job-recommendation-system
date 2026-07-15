package com.tttn.jobrecommendation.modules.skill.controller;

import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.common.utils.SecurityUtils;
import com.tttn.jobrecommendation.modules.skill.dto.request.UpdateStudentSkillsRequest;
import com.tttn.jobrecommendation.modules.skill.dto.response.StudentSkillResponse;
import com.tttn.jobrecommendation.modules.skill.service.StudentSkillService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/students/me/skills")
@PreAuthorize("hasRole('STUDENT')")
@RequiredArgsConstructor
public class StudentSkillController {

    private final StudentSkillService studentSkillService;
    private final SecurityUtils securityUtils;

    @GetMapping
    public ApiResponse<List<StudentSkillResponse>> getMySkills() {
        return ApiResponse.success(studentSkillService.getMySkills(securityUtils.getCurrentUserId()));
    }

    @PutMapping
    public ApiResponse<List<StudentSkillResponse>> updateMySkills(
            @Valid @RequestBody UpdateStudentSkillsRequest request
    ) {
        return ApiResponse.success(
                "Student skills updated successfully",
                studentSkillService.updateMySkills(securityUtils.getCurrentUserId(), request)
        );
    }
}
