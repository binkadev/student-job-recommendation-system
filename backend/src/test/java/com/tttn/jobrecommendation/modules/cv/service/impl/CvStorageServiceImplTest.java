package com.tttn.jobrecommendation.modules.cv.service.impl;

import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.modules.cv.dto.response.CvFileDownload;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CvStorageServiceImplTest {

    @TempDir
    private Path storageDirectory;

    @Test
    void loadReturnsStreamingResourceAndStoredMetadata() throws Exception {
        byte[] contents = "%PDF-test-cv".getBytes();
        Files.write(storageDirectory.resolve("stored-resume.pdf"), contents);
        CvStorageServiceImpl storageService = new CvStorageServiceImpl(storageDirectory.toString());

        CvFileDownload download = storageService.load(cvFile(
                "stored-resume.pdf",
                "candidate-resume.pdf",
                "application/pdf"
        ));

        assertThat(download.resource()).isInstanceOf(InputStreamResource.class);
        try (InputStream inputStream = download.resource().getInputStream()) {
            assertThat(inputStream.readAllBytes()).isEqualTo(contents);
        }
        assertThat(download.contentType()).isEqualTo(MediaType.APPLICATION_PDF);
        assertThat(download.contentLength()).isEqualTo(contents.length);
        assertThat(download.originalFileName()).isEqualTo("candidate-resume.pdf");
    }

    @Test
    void responseIsInlineByDefaultAndAttachmentWhenRequested() {
        CvFileDownload download = new CvFileDownload(
                new InputStreamResource(InputStream.nullInputStream()),
                MediaType.APPLICATION_PDF,
                128L,
                "resume.pdf"
        );

        ResponseEntity<Resource> inline = download.toResponseEntity(false);
        ResponseEntity<Resource> attachment = download.toResponseEntity(true);

        assertThat(inline.getHeaders().getContentDisposition().isInline()).isTrue();
        assertThat(inline.getHeaders().getContentDisposition().getFilename()).isEqualTo("resume.pdf");
        assertThat(inline.getHeaders().getContentType()).isEqualTo(MediaType.APPLICATION_PDF);
        assertThat(inline.getHeaders().getContentLength()).isEqualTo(128L);

        assertThat(attachment.getHeaders().getContentDisposition().isAttachment()).isTrue();
        assertThat(attachment.getHeaders().getContentDisposition().getFilename()).isEqualTo("resume.pdf");
    }

    @Test
    void responseSanitizesOriginalFilenameBeforeWritingHeader() throws Exception {
        Files.writeString(storageDirectory.resolve("stored.pdf"), "test file");
        CvStorageServiceImpl storageService = new CvStorageServiceImpl(storageDirectory.toString());
        CvFileDownload download = storageService.load(cvFile(
                "stored.pdf",
                "../candidate\r\nX-Injected: true.pdf",
                "application/pdf"
        ));

        String responseFilename = download.toResponseEntity(false)
                .getHeaders()
                .getContentDisposition()
                .getFilename();

        assertThat(responseFilename)
                .isNotBlank()
                .doesNotContain("/", "\\", "\r", "\n");
    }

    @Test
    void loadRejectsPathThatEscapesConfiguredStorageDirectory() throws Exception {
        Path configuredStorageDirectory = Files.createDirectory(storageDirectory.resolve("storage"));
        Path outsideFile = storageDirectory.resolve("outside-cv.pdf");
        Files.writeString(outsideFile, "must not be returned");
        CvStorageServiceImpl storageService = new CvStorageServiceImpl(configuredStorageDirectory.toString());

        assertThatThrownBy(() -> storageService.load(cvFile(
                "../outside-cv.pdf",
                "outside-cv.pdf",
                "application/pdf"
        )))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("CV file not found");
    }

    @Test
    void loadTreatsMissingPhysicalFileAsNotFound() {
        CvStorageServiceImpl storageService = new CvStorageServiceImpl(storageDirectory.toString());

        assertThatThrownBy(() -> storageService.load(cvFile(
                "missing.pdf",
                "missing.pdf",
                "application/pdf"
        )))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("CV file not found");
    }

    @Test
    void deleteRemovesPhysicalFileAndAllowsAlreadyMissingFile() throws Exception {
        Path storedFile = storageDirectory.resolve("delete-me.pdf");
        Files.writeString(storedFile, "delete me");
        CvStorageServiceImpl storageService = new CvStorageServiceImpl(storageDirectory.toString());
        CvFile cvFile = cvFile("delete-me.pdf", "delete-me.pdf", "application/pdf");

        storageService.delete(cvFile);
        storageService.delete(cvFile);

        assertThat(storedFile).doesNotExist();
    }

    private CvFile cvFile(String storedFileName, String originalFileName, String contentType) {
        return CvFile.builder()
                .storedFileName(storedFileName)
                .originalFileName(originalFileName)
                .contentType(contentType)
                .build();
    }
}
