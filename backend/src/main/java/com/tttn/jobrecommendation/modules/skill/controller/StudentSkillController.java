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
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import jakarta.servlet.http.HttpServletResponse;
import com.tttn.jobrecommendation.modules.student.service.StudentProfileRevision;

@RestController
@RequestMapping("/api/students/me/skills")
@PreAuthorize("hasRole('STUDENT')")
@RequiredArgsConstructor
public class StudentSkillController {

    private final StudentSkillService studentSkillService;
    private final SecurityUtils securityUtils;
    private final StudentProfileRevision profileRevision;

    @GetMapping
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ApiResponse<List<StudentSkillResponse>> getMySkills(HttpServletResponse response) {
        var data = studentSkillService.getMySkills(securityUtils.getCurrentUserId());
        response.setHeader("ETag", StudentProfileRevision.etag(profileRevision.current(securityUtils.getCurrentUserId())));
        return ApiResponse.success(data);
    }

    @PutMapping
    public ApiResponse<List<StudentSkillResponse>> updateMySkills(
            @Valid @RequestBody UpdateStudentSkillsRequest request,
            @RequestHeader(value = "If-Match", required = false) String ifMatch, HttpServletResponse response
    ) {
        long revision = StudentProfileRevision.parseIfMatch(ifMatch);
        var data = studentSkillService.updateMySkills(securityUtils.getCurrentUserId(), request, revision);
        response.setHeader("ETag", StudentProfileRevision.etag(revision + 1));
        return ApiResponse.success(
                "Student skills updated successfully",
                data
        );
    }
}
