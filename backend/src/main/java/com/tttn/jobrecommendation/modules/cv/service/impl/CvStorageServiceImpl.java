package com.tttn.jobrecommendation.modules.cv.service.impl;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.modules.cv.dto.response.CvFileDownload;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.cv.service.CvStorageService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.InvalidMediaTypeException;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.LinkOption;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.attribute.BasicFileAttributes;

@Service
public class CvStorageServiceImpl implements CvStorageService {

    private static final String DEFAULT_DOWNLOAD_FILE_NAME = "cv-file";

    private final Path storageRoot;

    public CvStorageServiceImpl(@Value("${app.upload.cv.storage-dir}") String storageDir) {
        this.storageRoot = Path.of(storageDir).toAbsolutePath().normalize();
    }

    @Override
    public CvFileDownload load(CvFile cvFile) {
        Path storedFile = resolveStoredFile(cvFile);

        try {
            BasicFileAttributes attributes = Files.readAttributes(
                    storedFile,
                    BasicFileAttributes.class,
                    LinkOption.NOFOLLOW_LINKS
            );
            if (!attributes.isRegularFile() || attributes.isSymbolicLink()) {
                throw cvFileNotFound();
            }

            if (!Files.isReadable(storedFile)) {
                throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR, "Failed to read CV file");
            }

            Path realStorageRoot = storageRoot.toRealPath();
            Path realStoredFile = storedFile.toRealPath();
            if (!realStoredFile.startsWith(realStorageRoot)) {
                throw cvFileNotFound();
            }

            MediaType contentType = resolveContentType(cvFile.getContentType());
            long contentLength = Files.size(realStoredFile);
            String originalFileName = sanitizeOriginalFileName(cvFile);
            InputStreamResource resource = new InputStreamResource(Files.newInputStream(realStoredFile));
            return new CvFileDownload(resource, contentType, contentLength, originalFileName);
        } catch (NoSuchFileException exception) {
            throw cvFileNotFound();
        } catch (IOException exception) {
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR, "Failed to read CV file");
        }
    }

    @Override
    public void delete(CvFile cvFile) {
        Path storedFile = resolveStoredFile(cvFile);

        try {
            BasicFileAttributes attributes = Files.readAttributes(
                    storedFile,
                    BasicFileAttributes.class,
                    LinkOption.NOFOLLOW_LINKS
            );
            if (!attributes.isRegularFile() || attributes.isSymbolicLink()) {
                throw cvFileNotFound();
            }

            Path realStorageRoot = storageRoot.toRealPath();
            Path realStoredFile = storedFile.toRealPath();
            if (!realStoredFile.startsWith(realStorageRoot)) {
                throw cvFileNotFound();
            }

            Files.deleteIfExists(storedFile);
        } catch (NoSuchFileException exception) {
            // The physical file is already absent, so stale database metadata can still be removed.
        } catch (IOException exception) {
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR, "Failed to delete CV file");
        }
    }

    private Path resolveStoredFile(CvFile cvFile) {
        if (cvFile == null || !StringUtils.hasText(cvFile.getStoredFileName())) {
            throw cvFileNotFound();
        }

        try {
            Path storedFileName = Path.of(cvFile.getStoredFileName());
            Path storedFile = storageRoot.resolve(storedFileName).normalize();
            if (storedFileName.isAbsolute() || !storedFile.startsWith(storageRoot)) {
                throw cvFileNotFound();
            }
            return storedFile;
        } catch (InvalidPathException exception) {
            throw cvFileNotFound();
        }
    }

    private MediaType resolveContentType(String contentType) {
        if (!StringUtils.hasText(contentType)) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }

        try {
            return MediaType.parseMediaType(contentType);
        } catch (InvalidMediaTypeException exception) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
    }

    private String sanitizeOriginalFileName(CvFile cvFile) {
        String originalFileName = StringUtils.hasText(cvFile.getOriginalFileName())
                ? cvFile.getOriginalFileName()
                : cvFile.getFileName();
        if (!StringUtils.hasText(originalFileName)) {
            return DEFAULT_DOWNLOAD_FILE_NAME;
        }

        String normalizedSeparators = originalFileName.replace('\\', '/');
        int lastSeparator = normalizedSeparators.lastIndexOf('/');
        String baseName = normalizedSeparators.substring(lastSeparator + 1);
        String sanitized = baseName.replaceAll("[^A-Za-z0-9._-]", "_");
        if (!StringUtils.hasText(sanitized) || ".".equals(sanitized) || "..".equals(sanitized)) {
            return DEFAULT_DOWNLOAD_FILE_NAME;
        }
        return sanitized;
    }

    private ResourceNotFoundException cvFileNotFound() {
        return new ResourceNotFoundException("CV file not found");
    }
}
