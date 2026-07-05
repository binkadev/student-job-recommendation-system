package com.tttn.jobrecommendation.modules.cv.service.impl;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.modules.cv.dto.response.CvFileResponse;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.cv.mapper.CvFileMapper;
import com.tttn.jobrecommendation.modules.cv.repository.CvFileRepository;
import com.tttn.jobrecommendation.modules.cv.service.CvService;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CvServiceImpl implements CvService {

    private static final Set<String> SUPPORTED_CONTENT_TYPES = Set.of(
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    private static final String OCTET_STREAM = "application/octet-stream";
    private static final String RELATIVE_CV_PATH_PREFIX = "uploads/cvs";

    private final CvFileRepository cvFileRepository;
    private final StudentRepository studentRepository;
    private final CvFileMapper cvFileMapper;

    @Value("${app.upload.cv.storage-dir}")
    private String storageDir;

    @Value("${app.upload.cv.max-file-size-bytes}")
    private long maxFileSizeBytes;

    @Override
    @Transactional
    public CvFileResponse uploadCv(Long userId, MultipartFile file, boolean active) {
        Student student = getStudentByUserId(userId);
        validateFile(file);

        String originalFileName = sanitizeFileName(file.getOriginalFilename());
        String extension = getExtension(originalFileName);
        String storedFileName = student.getId() + "_" + UUID.randomUUID() + extension;
        Path storagePath = Paths.get(storageDir).toAbsolutePath().normalize();
        Path targetPath = storagePath.resolve(storedFileName).normalize();

        if (!targetPath.startsWith(storagePath)) {
            throw new AppException(ErrorCode.BAD_REQUEST, "Invalid file path");
        }

        try {
            Files.createDirectories(storagePath);
            file.transferTo(targetPath);
        } catch (IOException exception) {
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR, "Failed to store CV file");
        }

        if (active) {
            cvFileRepository.deactivateActiveCvFiles(student.getId());
        }

        String relativeFilePath = RELATIVE_CV_PATH_PREFIX + "/" + storedFileName;
        CvFile cvFile = CvFile.builder()
                .student(student)
                .fileName(originalFileName)
                .originalFileName(originalFileName)
                .storedFileName(storedFileName)
                .fileUrl(relativeFilePath)
                .filePath(relativeFilePath)
                .contentType(resolveContentType(file, extension))
                .fileSize(file.getSize())
                .extractedText(null)
                .processedText(null)
                .active(active)
                .build();

        return cvFileMapper.toCvFileResponse(cvFileRepository.save(cvFile));
    }

    @Override
    @Transactional(readOnly = true)
    public List<CvFileResponse> getMyCvFiles(Long userId) {
        Student student = getStudentByUserId(userId);
        return cvFileRepository.findByStudentIdOrderByUploadedAtDesc(student.getId())
                .stream()
                .map(cvFileMapper::toCvFileResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public CvFileResponse getActiveCv(Long userId) {
        Student student = getStudentByUserId(userId);
        return cvFileRepository.findFirstByStudentIdAndActiveTrueOrderByUploadedAtDesc(student.getId())
                .map(cvFileMapper::toCvFileResponse)
                .orElse(null);
    }

    private Student getStudentByUserId(Long userId) {
        return studentRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Student profile not found"));
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new AppException(ErrorCode.BAD_REQUEST, "CV file must not be empty");
        }

        if (file.getSize() > maxFileSizeBytes) {
            throw new AppException(ErrorCode.BAD_REQUEST, "CV file exceeds maximum allowed size");
        }

        String originalFileName = sanitizeFileName(file.getOriginalFilename());
        String extension = getExtension(originalFileName);
        if (!extension.equals(".pdf") && !extension.equals(".docx")) {
            throw new AppException(ErrorCode.BAD_REQUEST, "Only PDF and DOCX files are supported");
        }

        String contentType = file.getContentType();
        if (StringUtils.hasText(contentType)
                && !OCTET_STREAM.equalsIgnoreCase(contentType)
                && !SUPPORTED_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new AppException(ErrorCode.BAD_REQUEST, "Only PDF and DOCX files are supported");
        }
    }

    private String sanitizeFileName(String fileName) {
        if (!StringUtils.hasText(fileName)) {
            throw new AppException(ErrorCode.BAD_REQUEST, "CV file name is required");
        }

        String cleanFileName = Paths.get(fileName).getFileName().toString();
        return cleanFileName.replaceAll("[^A-Za-z0-9._-]", "_");
    }

    private String getExtension(String fileName) {
        int extensionIndex = fileName.lastIndexOf('.');
        if (extensionIndex < 0) {
            return "";
        }
        return fileName.substring(extensionIndex).toLowerCase(Locale.ROOT);
    }

    private String resolveContentType(MultipartFile file, String extension) {
        if (StringUtils.hasText(file.getContentType()) && !OCTET_STREAM.equalsIgnoreCase(file.getContentType())) {
            return file.getContentType();
        }
        return extension.equals(".pdf")
                ? "application/pdf"
                : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
}
