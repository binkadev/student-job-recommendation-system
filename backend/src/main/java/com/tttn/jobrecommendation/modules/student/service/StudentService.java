package com.tttn.jobrecommendation.modules.student.service;

import com.tttn.jobrecommendation.modules.student.dto.request.StudentProfileUpdateRequest;
import com.tttn.jobrecommendation.modules.student.dto.request.StudentUpdateRequest;
import com.tttn.jobrecommendation.modules.student.dto.response.StudentProfileResponse;
import com.tttn.jobrecommendation.modules.student.dto.response.StudentResponse;
import com.tttn.jobrecommendation.modules.student.dto.request.StudentProfileAggregateUpdateRequest;
import com.tttn.jobrecommendation.modules.student.dto.response.StudentProfileAggregateResponse;

public interface StudentService {

    StudentResponse getMe(Long userId);

    StudentResponse updateMe(Long userId, StudentUpdateRequest request, Long revision);

    StudentProfileResponse getMyProfile(Long userId);

    StudentProfileResponse updateMyProfile(Long userId, StudentProfileUpdateRequest request, Long revision);

    StudentProfileAggregateResponse getAggregate(Long userId);

    StudentProfileAggregateResponse updateAggregate(Long userId, StudentProfileAggregateUpdateRequest request);
}
