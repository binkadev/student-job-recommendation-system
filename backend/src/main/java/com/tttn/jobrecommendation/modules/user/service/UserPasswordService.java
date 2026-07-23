package com.tttn.jobrecommendation.modules.user.service;

import com.tttn.jobrecommendation.modules.user.dto.request.ChangePasswordRequest;

public interface UserPasswordService {

    void changePassword(Long userId, ChangePasswordRequest request);
}
