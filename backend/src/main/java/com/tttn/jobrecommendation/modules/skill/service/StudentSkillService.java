package com.tttn.jobrecommendation.modules.skill.service;

import com.tttn.jobrecommendation.modules.skill.dto.request.UpdateStudentSkillsRequest;
import com.tttn.jobrecommendation.modules.skill.dto.response.StudentSkillResponse;

import java.util.List;

public interface StudentSkillService {

    List<StudentSkillResponse> getMySkills(Long userId);

    List<StudentSkillResponse> updateMySkills(Long userId, UpdateStudentSkillsRequest request);
}
