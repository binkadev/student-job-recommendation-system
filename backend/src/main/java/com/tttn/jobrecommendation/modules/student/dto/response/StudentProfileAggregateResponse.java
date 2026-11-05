package com.tttn.jobrecommendation.modules.student.dto.response;

import com.tttn.jobrecommendation.modules.skill.dto.response.StudentSkillResponse;
import java.util.List;

public record StudentProfileAggregateResponse(long revision, StudentResponse student, StudentProfileResponse profile, List<StudentSkillResponse> skills) {}
