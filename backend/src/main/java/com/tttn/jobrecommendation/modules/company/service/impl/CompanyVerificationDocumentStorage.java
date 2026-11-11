package com.tttn.jobrecommendation.modules.company.service.impl;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.modules.company.dto.response.VerificationDocumentDownload;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import javax.imageio.stream.MemoryCacheImageInputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.channels.Channels;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.Arrays;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@Component
public class CompanyVerificationDocumentStorage {
    public static final int MAX_BYTES = 5 * 1024 * 1024;
    private static final Logger log = LoggerFactory.getLogger(CompanyVerificationDocumentStorage.class);
    private static final Pattern KEY = Pattern.compile("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\\.(pdf|png|jpg)");
    private final Path root;

    public CompanyVerificationDocumentStorage(
            @Value("${app.upload.company-verification.storage-dir:${user.home}/.sjrs/private/company-verification}") String directory,
            @Value("${app.upload.cv.storage-dir}") String cvDirectory) {
        Path configured = Path.of(directory);
        this.root = configured.toAbsolutePath().normalize();
        Path cvRoot = Path.of(cvDirectory).toAbsolutePath().normalize();
        Path repository = null;
        for (Path candidate = Path.of("").toAbsolutePath().normalize(); candidate != null; candidate = candidate.getParent()) {
            if (Files.exists(candidate.resolve(".git"), LinkOption.NOFOLLOW_LINKS)) { repository = candidate; break; }
        }
        if (!configured.isAbsolute() || (repository != null && root.startsWith(repository)) || root.startsWith(cvRoot) || cvRoot.startsWith(root))
            throw new IllegalArgumentException("Verification storage must be an absolute private directory outside the application repository and CV storage");
    }

    public String store(MultipartFile file) {
        byte[] bytes;
        try (var input = file.getInputStream()) {
            if (file.getSize() > MAX_BYTES) throw new AppException(ErrorCode.UPLOAD_TOO_LARGE);
            bytes = input.readNBytes(MAX_BYTES + 1);
        } catch (IOException ex) { throw storageError(); }
        if (bytes.length > MAX_BYTES) throw new AppException(ErrorCode.UPLOAD_TOO_LARGE);
        String extension = detect(bytes);
        String key = UUID.randomUUID() + "." + extension;
        boolean created = false;
        try {
            ensureRoot(true);
            Path target = resolve(key);
            try (var output = Files.newByteChannel(target, Set.of(StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE, LinkOption.NOFOLLOW_LINKS), permissions(root, false))) {
                created = true;
                var buffer = java.nio.ByteBuffer.wrap(bytes);
                while (buffer.hasRemaining()) output.write(buffer);
            }
            ensureRoot(false);
            return key;
        } catch (IOException | RuntimeException ex) {
            if (created) deleteQuietly(key);
            throw storageError();
        }
    }

    public VerificationDocumentDownload load(String key) {
        Path path = resolve(key);
        try {
            ensureRoot(false);
            if (!Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)) throw unavailable();
            byte[] bytes;
            try (var channel = Files.newByteChannel(path, Set.of(StandardOpenOption.READ, LinkOption.NOFOLLOW_LINKS));
                 var input = Channels.newInputStream(channel)) {
                bytes = input.readNBytes(MAX_BYTES + 1);
            }
            ensureRoot(false);
            if (bytes.length > MAX_BYTES) throw unavailable();
            String extension;
            try { extension = detect(bytes); } catch (AppException ex) { throw unavailable(); }
            if (!key.endsWith("." + extension)) throw unavailable();
            String type = switch (extension) { case "pdf" -> "application/pdf"; case "png" -> "image/png"; default -> "image/jpeg"; };
            return new VerificationDocumentDownload(bytes, type, extension);
        } catch (IOException ex) { throw unavailable(); }
    }

    /** Cleanup never changes a committed DB result or follows an untrusted reference. */
    public void deleteQuietly(String key) {
        if (key == null || !KEY.matcher(key).matches()) return;
        try { ensureRoot(false); Files.deleteIfExists(resolve(key)); }
        catch (IOException | RuntimeException ex) { log.warn("Private verification document cleanup deferred; operator reconciliation may be needed"); }
    }

    private Path resolve(String key) {
        if (key == null || !KEY.matcher(key).matches()) throw unavailable();
        return root.resolve(key);
    }

    private void ensureRoot(boolean create) throws IOException {
        Path current = root.getRoot();
        for (Path part : root) {
            current = current.resolve(part);
            if (create && !Files.exists(current, LinkOption.NOFOLLOW_LINKS)) {
                try { Files.createDirectory(current, permissions(current.getParent(), true)); } catch (FileAlreadyExistsException ignored) { /* Concurrent directory creation; verify below. */ }
            }
            if (Files.isSymbolicLink(current) || !Files.isDirectory(current, LinkOption.NOFOLLOW_LINKS)
                    || !current.toRealPath().equals(current.toAbsolutePath().normalize()))
                throw new IOException("Unsafe private storage directory");
        }
    }

    private java.nio.file.attribute.FileAttribute<?>[] permissions(Path parent, boolean directory) throws IOException {
        if (!Files.getFileStore(parent).supportsFileAttributeView("posix")) return new java.nio.file.attribute.FileAttribute<?>[0];
        return new java.nio.file.attribute.FileAttribute<?>[]{java.nio.file.attribute.PosixFilePermissions.asFileAttribute(
                java.nio.file.attribute.PosixFilePermissions.fromString(directory ? "rwx------" : "rw-------"))};
    }

    private String detect(byte[] bytes) {
        if (bytes.length == 0) throw invalid();
        String header = new String(bytes, 0, Math.min(bytes.length, 9), StandardCharsets.US_ASCII);
        if (header.matches("%PDF-(1\\.[0-7]|2\\.0)[\\r\\n]")) {
            String tail = new String(bytes, Math.max(0, bytes.length - 1024), Math.min(bytes.length, 1024), StandardCharsets.ISO_8859_1);
            var trailer = Pattern.compile("(?s).*startxref[\\t\\r\\n ]+([0-9]+)[\\t\\r\\n ]+%%EOF[\\t\\r\\n ]*").matcher(tail);
            if (!trailer.matches()) throw invalid();
            try {
                long offset = Long.parseLong(trailer.group(1));
                if (offset < 9 || offset >= bytes.length) throw invalid();
                String xref = new String(bytes, (int) offset, Math.min(512, bytes.length - (int) offset), StandardCharsets.ISO_8859_1);
                if (xref.matches("(?s)xref[\\t\\r\\n ].*") || xref.matches("(?s)[0-9]+[\\t\\r\\n ]+[0-9]+[\\t\\r\\n ]+obj\\b.*?/Type[\\t\\r\\n ]*/XRef\\b.*")) return "pdf";
            } catch (NumberFormatException ex) { throw invalid(); }
            throw invalid();
        }
        boolean png = bytes.length >= 20 && Arrays.equals(Arrays.copyOf(bytes, 8), new byte[]{(byte)137,80,78,71,13,10,26,10});
        if (png && !Arrays.equals(Arrays.copyOfRange(bytes, bytes.length - 12, bytes.length), new byte[]{0,0,0,0,73,69,78,68,(byte)174,66,96,(byte)130})) throw invalid();
        boolean jpeg = bytes.length >= 4 && (bytes[0] & 255) == 255 && (bytes[1] & 255) == 216 && (bytes[2] & 255) == 255
                && (bytes[bytes.length - 2] & 255) == 255 && (bytes[bytes.length - 1] & 255) == 217;
        if (!png && !jpeg) throw invalid();
        try (var input = new MemoryCacheImageInputStream(new ByteArrayInputStream(bytes))) {
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw invalid();
            var reader = readers.next();
            try {
                reader.setInput(input);
                long pixels = (long) reader.getWidth(0) * reader.getHeight(0);
                if (pixels <= 0 || pixels > 25_000_000 || reader.read(0) == null) throw invalid();
            } finally { reader.dispose(); }
        } catch (IOException | IllegalArgumentException ex) { throw invalid(); }
        return png ? "png" : "jpg";
    }
    private AppException invalid() { return new AppException(ErrorCode.BAD_REQUEST, "Use a nonempty PDF, PNG or JPEG verification document (images up to 25 megapixels)"); }
    private AppException storageError() { return new AppException(ErrorCode.INTERNAL_SERVER_ERROR, "Verification document storage is unavailable"); }
    private ResourceNotFoundException unavailable() { return new ResourceNotFoundException("Verification document not found"); }
}
