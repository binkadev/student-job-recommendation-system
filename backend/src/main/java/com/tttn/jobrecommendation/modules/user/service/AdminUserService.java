package com.tttn.jobrecommendation.modules.user.service;

import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.user.dto.request.AdminUserFilterRequest;
import com.tttn.jobrecommendation.modules.user.dto.request.AdminUserStatusUpdateRequest;
import com.tttn.jobrecommendation.modules.user.dto.response.AdminUserDetailResponse;
import com.tttn.jobrecommendation.modules.user.dto.response.AdminUserResponse;

public interface AdminUserService {

    PageResponse<AdminUserResponse> getUsers(AdminUserFilterRequest request);

    AdminUserDetailResponse getUser(Long id);

    AdminUserResponse updateStatus(Long id, AdminUserStatusUpdateRequest request, Long currentAdminUserId);
}
