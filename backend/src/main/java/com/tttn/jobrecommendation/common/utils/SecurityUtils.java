package com.tttn.jobrecommendation.common.utils;

import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.security.CustomUserDetails;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class SecurityUtils {

    public Long getCurrentUserId() {
        return getCurrentUserDetails().getId();
    }

    public UserRole getCurrentUserRole() {
        return getCurrentUserDetails().getUser().getRole();
    }

    public Long getCurrentUserIdOrNull() {
        CustomUserDetails userDetails = getCurrentUserDetailsOrNull();
        return userDetails == null ? null : userDetails.getId();
    }

    public UserRole getCurrentUserRoleOrNull() {
        CustomUserDetails userDetails = getCurrentUserDetailsOrNull();
        return userDetails == null ? null : userDetails.getUser().getRole();
    }

    private CustomUserDetails getCurrentUserDetails() {
        CustomUserDetails userDetails = getCurrentUserDetailsOrNull();
        if (userDetails == null) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        return userDetails;
    }

    private CustomUserDetails getCurrentUserDetailsOrNull() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
                || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof CustomUserDetails userDetails)) {
            return null;
        }

        return userDetails;
    }
}
