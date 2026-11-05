package com.tttn.jobrecommendation.modules.job.service;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import org.springframework.stereotype.Component;

import java.util.Set;

@Component
public class JobModerationPolicy {
    private static final Set<JobStatus> ADMIN_TARGETS = Set.of(JobStatus.ACTIVE, JobStatus.REJECTED, JobStatus.EXPIRED);
    private static final Set<JobStatus> RETURN_TO_DRAFT = Set.of(
            JobStatus.PENDING_APPROVAL, JobStatus.REJECTED, JobStatus.CLOSED, JobStatus.EXPIRED);

    public void assertCreation(UserRole role, CompanyStatus companyStatus, JobStatus target) {
        assertRoleAndTarget(role, target);
        if (target != JobStatus.DRAFT && target != JobStatus.PENDING_APPROVAL) {
            throw new AppException(ErrorCode.BAD_REQUEST, "Create a draft or submit a job for review first");
        }
        assertVerifiedForPublication(companyStatus, target);
    }

    public void assertEditable(JobStatus status) {
        if (status != JobStatus.DRAFT) {
            throw new AppException(ErrorCode.BAD_REQUEST, "Return the job to draft before editing its content");
        }
    }

    public void assertTransition(UserRole role, CompanyStatus companyStatus, JobStatus from, JobStatus target) {
        assertRoleAndTarget(role, target);
        assertVerifiedForPublication(companyStatus, target);
        boolean common = target == JobStatus.CLOSED
                || (from == JobStatus.DRAFT && target == JobStatus.DRAFT)
                || (from == JobStatus.PENDING_APPROVAL && target == JobStatus.PENDING_APPROVAL)
                || (from == JobStatus.DRAFT && target == JobStatus.PENDING_APPROVAL)
                || (RETURN_TO_DRAFT.contains(from) && target == JobStatus.DRAFT);
        boolean admin = role == UserRole.ADMIN && (
                (from == JobStatus.PENDING_APPROVAL && (target == JobStatus.ACTIVE || target == JobStatus.REJECTED))
                || (from == JobStatus.ACTIVE && target == JobStatus.EXPIRED)
                || (from == target && ADMIN_TARGETS.contains(target)));
        if (!common && !admin) {
            throw new AppException(ErrorCode.BAD_REQUEST, "Invalid job status transition");
        }
    }

    private void assertRoleAndTarget(UserRole role, JobStatus target) {
        if ((role != UserRole.ADMIN && role != UserRole.COMPANY)
                || (role == UserRole.COMPANY && ADMIN_TARGETS.contains(target))) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Only an administrator can approve, reject or expire a job");
        }
    }

    private void assertVerifiedForPublication(CompanyStatus companyStatus, JobStatus target) {
        if ((target == JobStatus.ACTIVE || target == JobStatus.PENDING_APPROVAL) && companyStatus != CompanyStatus.VERIFIED) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Company must be verified before submitting or publishing a job");
        }
    }
}
