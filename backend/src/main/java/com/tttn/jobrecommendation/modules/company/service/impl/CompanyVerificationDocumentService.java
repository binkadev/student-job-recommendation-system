package com.tttn.jobrecommendation.modules.company.service.impl;

import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.common.utils.SettingsRevision;
import com.tttn.jobrecommendation.modules.company.dto.response.CompanyVerificationDocumentStatus;
import com.tttn.jobrecommendation.modules.company.dto.response.VerificationDocumentDownload;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.company.repository.CompanyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class CompanyVerificationDocumentService {
    private final CompanyRepository companies;
    private final CompanyVerificationDocumentStorage storage;
    private final TransactionTemplate transaction;

    public CompanyVerificationDocumentService(CompanyRepository companies, CompanyVerificationDocumentStorage storage, PlatformTransactionManager manager) {
        this.companies = companies; this.storage = storage;
        transaction = new TransactionTemplate(manager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Transactional(readOnly = true)
    public CompanyVerificationDocumentStatus companyStatus(Long userId) {
        return status(companies.findByUserId(userId).orElseThrow(this::companyNotFound));
    }
    @Transactional(readOnly = true)
    public CompanyVerificationDocumentStatus adminStatus(Long companyId) {
        return status(companies.findById(companyId).orElseThrow(this::companyNotFound));
    }

    public CompanyVerificationDocumentStatus upload(Long userId, Long revision, MultipartFile file) {
        SettingsRevision.require(revision);
        // Check ownership and revision before reading/staging; repeat under the write lock below.
        var snapshot = companies.findByUserId(userId).orElseThrow(this::companyNotFound);
        SettingsRevision.match(snapshot.getAccountRevision(), revision);
        String newKey = storage.store(file);
        var cleanupManaged = new AtomicBoolean(false);
        var outcome = new AtomicInteger(TransactionSynchronization.STATUS_UNKNOWN);
        try {
            return transaction.execute(tx -> {
                Company company = companies.findByUserIdForUpdate(userId).orElseThrow(this::companyNotFound);
                SettingsRevision.match(company.getAccountRevision(), revision);
                String previousKey = company.getVerificationDocumentKey();
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override public void afterCompletion(int completion) {
                        outcome.set(completion);
                        if (completion == STATUS_COMMITTED) storage.deleteQuietly(previousKey);
                        else if (completion == STATUS_ROLLED_BACK) storage.deleteQuietly(newKey);
                        // Unknown outcome: retain both files rather than deleting a possibly committed document.
                    }
                });
                cleanupManaged.set(true);
                company.setVerificationDocumentKey(newKey);
                company.setAccountRevision(company.getAccountRevision() + 1);
                companies.saveAndFlush(company);
                return status(company);
            });
        } catch (RuntimeException ex) {
            if (!cleanupManaged.get()) storage.deleteQuietly(newKey);
            else if (outcome.get() == TransactionSynchronization.STATUS_UNKNOWN) {
                // A failed COMMIT may have rolled back on PostgreSQL. Reconcile from a fresh read;
                // if the database cannot confirm the result, retain both private files for safety.
                try {
                    var persisted = companies.findByUserId(userId);
                    if (persisted.isEmpty() || !newKey.equals(persisted.get().getVerificationDocumentKey())) storage.deleteQuietly(newKey);
                } catch (RuntimeException unavailable) { /* Never delete a possibly committed file on an uncertain DB outcome. */ }
            }
            throw ex;
        }
    }

    // Hold the same row lock as replacement until the bounded private bytes have been read.
    @Transactional
    public VerificationDocumentDownload companyDownload(Long userId) {
        return storage.load(companies.findByUserIdForUpdate(userId).orElseThrow(this::companyNotFound).getVerificationDocumentKey());
    }
    @Transactional
    public VerificationDocumentDownload adminDownload(Long companyId) {
        return storage.load(companies.findByIdForUpdate(companyId).orElseThrow(this::companyNotFound).getVerificationDocumentKey());
    }
    private CompanyVerificationDocumentStatus status(Company company) {
        return new CompanyVerificationDocumentStatus(company.getVerificationDocumentKey() != null, company.getAccountRevision());
    }
    private ResourceNotFoundException companyNotFound() { return new ResourceNotFoundException("Company profile not found"); }
}
