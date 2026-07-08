package com.tttn.jobrecommendation.modules.skill.controller;

import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.skill.dto.request.SkillFilterRequest;
import com.tttn.jobrecommendation.modules.skill.dto.request.SkillRequest;
import com.tttn.jobrecommendation.modules.skill.dto.response.SkillResponse;
import com.tttn.jobrecommendation.modules.skill.service.SkillService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/skills")
@RequiredArgsConstructor
public class SkillController {

    private final SkillService skillService;

    @GetMapping
    @PreAuthorize("hasAnyRole('STUDENT', 'COMPANY', 'ADMIN')")
    public ApiResponse<PageResponse<SkillResponse>> getSkills(@Valid @ModelAttribute SkillFilterRequest request) {
        return ApiResponse.success(skillService.getSkills(request));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('STUDENT', 'COMPANY', 'ADMIN')")
    public ApiResponse<SkillResponse> getSkill(@PathVariable Long id) {
        return ApiResponse.success(skillService.getSkill(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<SkillResponse>> createSkill(@Valid @RequestBody SkillRequest request) {
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success("Skill created successfully", skillService.createSkill(request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<SkillResponse> updateSkill(
            @PathVariable Long id,
            @Valid @RequestBody SkillRequest request
    ) {
        return ApiResponse.success("Skill updated successfully", skillService.updateSkill(id, request));
    }
}
