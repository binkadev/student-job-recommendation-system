package com.tttn.jobrecommendation.modules.skill.service;

import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.skill.dto.request.SkillFilterRequest;
import com.tttn.jobrecommendation.modules.skill.dto.request.SkillRequest;
import com.tttn.jobrecommendation.modules.skill.dto.response.SkillResponse;

public interface SkillService {

    PageResponse<SkillResponse> getSkills(SkillFilterRequest request);

    SkillResponse getSkill(Long id);

    SkillResponse createSkill(SkillRequest request);

    SkillResponse updateSkill(Long id, SkillRequest request);
}
