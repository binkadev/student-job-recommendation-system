package com.tttn.jobrecommendation.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.company.service.impl.CompanyVerificationDocumentStorage;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.ResultActions;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.List;
import java.util.Map;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class CompanyVerificationDocumentApiIT extends AbstractPostgresWebIntegrationTest {
    private static final String URL = "/api/companies/me/verification-document";
    private static final int MAX = 5 * 1024 * 1024;
    private static final byte[] PDF = pdf(0);
    private static final Path TEMP = temporaryRoot();
    private static final Path PRIVATE = TEMP.resolve("documents");
    @Autowired private ObjectMapper mapper;

    @DynamicPropertySource static void privateStorage(DynamicPropertyRegistry registry) {
        registry.add("app.upload.company-verification.storage-dir", PRIVATE::toString);
    }
    @BeforeEach void clearPrivateStorage() throws IOException { clean(TEMP); Files.createDirectories(TEMP); }
    @AfterAll static void removePrivateStorage() throws IOException { clean(TEMP); }

    @ParameterizedTest @ValueSource(strings = {"pdf", "png", "jpg"})
    void uploadsActualSignaturesAndDownloadsPrivatelyWithSafeHeaders(String extension) throws Exception {
        var company = createCompany("document-owner@example.test", "Owner", CompanyStatus.PENDING);
        String token = bearerToken(company.getUser());
        mockMvc.perform(get(URL).header(HttpHeaders.AUTHORIZATION, token)).andExpect(status().isOk())
                .andExpect(header().string("ETag", "\"0\""))
                .andExpect(jsonPath("$.data.submitted").value(false));
        byte[] bytes = fileBytes(extension);
        upload(company, 0, bytes).andExpect(status().isOk()).andExpect(header().string("ETag", "\"1\""))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.data.submitted").value(true)).andExpect(jsonPath("$.data.revision").value(1));
        String key = key(company);
        assertThat(key).matches("[a-f0-9-]{36}\\." + extension);
        assertThat(PRIVATE.resolve(key)).hasBinaryContent(bytes);
        assertThat(companyRepository.findById(company.getId()).orElseThrow().getStatus()).isEqualTo(CompanyStatus.PENDING);
        var download = mockMvc.perform(get(URL + "/file").header(HttpHeaders.AUTHORIZATION, token)).andExpect(status().isOk())
                .andExpect(content().bytes(bytes)).andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"verification-document." + extension + "\""))
                .andReturn().getResponse();
        assertThat(download.getContentType()).isEqualTo(extension.equals("pdf") ? "application/pdf" : extension.equals("png") ? "image/png" : "image/jpeg");
        assertThat(download.getHeader(HttpHeaders.CONTENT_DISPOSITION)).doesNotContain(key, "client", "../");
        var admin = createUser("document-admin@example.test", UserRole.ADMIN);
        mockMvc.perform(get(adminUrl(company)).header(HttpHeaders.AUTHORIZATION, bearerToken(admin)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.submitted").value(true));
        mockMvc.perform(get(adminUrl(company) + "/file").header(HttpHeaders.AUTHORIZATION, bearerToken(admin)))
                .andExpect(status().isOk()).andExpect(content().bytes(bytes)).andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"));
    }

    @Test void rejectsStorageConfigurationThatOverlapsCvOrRepositoryOrUsesRelativePath() {
        assertThatThrownBy(() -> new CompanyVerificationDocumentStorage("relative-documents", TEMP.resolve("cv").toString()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new CompanyVerificationDocumentStorage(PRIVATE.toString(), PRIVATE.resolve("cv").toString()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new CompanyVerificationDocumentStorage(PRIVATE.resolve("documents").toString(), PRIVATE.toString()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new CompanyVerificationDocumentStorage(Path.of("").toAbsolutePath().resolve("private-documents").toString(), TEMP.resolve("cv").toString()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test void rejectsUnauthenticatedWrongRoleAndForeignCompanyReadsAndWrites() throws Exception {
        var owner = createCompany("document-owner@example.test", "Owner", CompanyStatus.VERIFIED);
        var other = createCompany("document-other@example.test", "Other", CompanyStatus.VERIFIED);
        var student = createStudent("document-student@example.test").getUser();
        var admin = createUser("document-admin@example.test", UserRole.ADMIN);
        upload(owner, 0, PDF).andExpect(status().isOk());
        for (String path : List.of(URL, URL + "/file", adminUrl(owner), adminUrl(owner) + "/file"))
            mockMvc.perform(get(path)).andExpect(status().isUnauthorized());
        mockMvc.perform(multipart(URL).file(file(PDF)).with(request -> { request.setMethod("PUT"); return request; }).header(HttpHeaders.IF_MATCH, "\"0\""))
                .andExpect(status().isUnauthorized());
        for (var denied : List.of(student, admin)) {
            mockMvc.perform(get(URL).header(HttpHeaders.AUTHORIZATION, bearerToken(denied))).andExpect(status().isForbidden());
            mockMvc.perform(get(URL + "/file").header(HttpHeaders.AUTHORIZATION, bearerToken(denied))).andExpect(status().isForbidden());
            mockMvc.perform(multipart(URL).file(file(PDF)).with(request -> { request.setMethod("PUT"); return request; })
                    .header(HttpHeaders.AUTHORIZATION, bearerToken(denied)).header(HttpHeaders.IF_MATCH, "\"0\""))
                    .andExpect(status().isForbidden());
        }
        for (var denied : List.of(student, owner.getUser(), other.getUser())) {
            mockMvc.perform(get(adminUrl(owner)).header(HttpHeaders.AUTHORIZATION, bearerToken(denied))).andExpect(status().isForbidden());
            mockMvc.perform(get(adminUrl(owner) + "/file").header(HttpHeaders.AUTHORIZATION, bearerToken(denied))).andExpect(status().isForbidden());
        }
        mockMvc.perform(get(URL).param("companyId", owner.getId().toString()).header(HttpHeaders.AUTHORIZATION, bearerToken(other.getUser())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.submitted").value(false));
        mockMvc.perform(get(URL + "/file").param("companyId", owner.getId().toString()).header(HttpHeaders.AUTHORIZATION, bearerToken(other.getUser())))
                .andExpect(status().isNotFound());
        assertThat(key(other)).isNull();
    }

    @ParameterizedTest @ValueSource(strings = {"", "not a PDF", "%PDF-1.4\ntruncated", "%PDF-1.4\n<html>fake PDF</html>\n%%EOF", "%PDF-1.4\nstartxref\n9999999\n%%EOF", "<html>fake image</html>", "\u0089PNG\r\n\u001a\ntruncated"})
    void rejectsEmptyOrInvalidSignatures(String invalid) throws Exception {
        var company = createCompany("document-invalid@example.test", "Invalid", CompanyStatus.PENDING);
        upload(company, 0, invalid.getBytes(StandardCharsets.ISO_8859_1)).andExpect(status().isBadRequest());
        assertThat(key(company)).isNull(); assertThat(fileCount()).isZero();
        assertThat(companyRepository.findById(company.getId()).orElseThrow().getAccountRevision()).isZero();
    }

    @Test void rejectsOversizedFilesAndAcceptsExactlyFiveMiB() throws Exception {
        var company = createCompany("document-size@example.test", "Size", CompanyStatus.PENDING);
        upload(company, 0, new byte[MAX + 1]).andExpect(status().isPayloadTooLarge());
        assertThat(fileCount()).isZero(); assertThat(key(company)).isNull();
        byte[] exact = pdf(MAX);
        assertThat(exact).hasSize(MAX);
        upload(company, 0, exact).andExpect(status().isOk());
        assertThat(PRIVATE.resolve(key(company))).hasSize(MAX);
        MockMultipartFile lyingSize = new MockMultipartFile("file", "fake.pdf", "application/pdf", new byte[MAX + 1]) {
            @Override public long getSize() { return 1; }
        };
        mockMvc.perform(multipart(URL).file(lyingSize).with(request -> { request.setMethod("PUT"); return request; })
                .header(HttpHeaders.AUTHORIZATION, bearerToken(company.getUser())).header(HttpHeaders.IF_MATCH, "\"1\""))
                .andExpect(status().isPayloadTooLarge());
        assertThat(fileCount()).isEqualTo(1);
    }

    @Test void rejectsMissingMultipleAndExternalUrlParts() throws Exception {
        var company = createCompany("document-parts@example.test", "Parts", CompanyStatus.PENDING);
        var request = multipart(URL).with(req -> { req.setMethod("PUT"); return req; })
                .header(HttpHeaders.AUTHORIZATION, bearerToken(company.getUser())).header(HttpHeaders.IF_MATCH, "\"0\"");
        mockMvc.perform(request).andExpect(status().isBadRequest());
        mockMvc.perform(multipart(URL).file(file(PDF)).file(file(PDF)).with(req -> { req.setMethod("PUT"); return req; })
                .header(HttpHeaders.AUTHORIZATION, bearerToken(company.getUser())).header(HttpHeaders.IF_MATCH, "\"0\""))
                .andExpect(status().isBadRequest());
        mockMvc.perform(multipart(URL).file(file(PDF)).param("verificationDocumentUrl", "https://example.test/private.pdf").with(req -> { req.setMethod("PUT"); return req; })
                .header(HttpHeaders.AUTHORIZATION, bearerToken(company.getUser())).header(HttpHeaders.IF_MATCH, "\"0\""))
                .andExpect(status().isBadRequest());
        assertThat(fileCount()).isZero();
    }

    @ParameterizedTest @EnumSource(CompanyStatus.class)
    void replacementKeepsStatusAndProfileAndRemovesOnlyCommittedPreviousFile(CompanyStatus state) throws Exception {
        var company = createCompany("document-replace@example.test", "Preserved", state);
        company.setCompanySize("51-200"); company.setLogoUrl("https://example.test/logo.png"); company.setCoverImageUrl("https://example.test/cover.png");
        companyRepository.saveAndFlush(company);
        String before = businessData(company);
        upload(company, 0, PDF).andExpect(status().isOk()); String previous = key(company);
        upload(company, 1, fileBytes("png")).andExpect(status().isOk()); String replacement = key(company);
        assertThat(replacement).isNotEqualTo(previous); assertThat(PRIVATE.resolve(previous)).doesNotExist();
        assertThat(PRIVATE.resolve(replacement)).exists(); assertThat(fileCount()).isEqualTo(1);
        assertThat(businessData(company)).isEqualTo(before);
        assertThat(companyRepository.findById(company.getId()).orElseThrow().getStatus()).isEqualTo(state);
        // An ordinary profile update must also preserve the private reference.
        mockMvc.perform(put("/api/companies/me").header(HttpHeaders.AUTHORIZATION, bearerToken(company.getUser())).header(HttpHeaders.IF_MATCH, "\"2\"")
                        .contentType("application/json").content("{\"description\":\"Updated description\"}"))
                .andExpect(status().isOk());
        assertThat(key(company)).isEqualTo(replacement);
    }

    @Test void missingMalformedAndStaleIfMatchKeepTheValidFile() throws Exception {
        var company = createCompany("document-etag@example.test", "ETag", CompanyStatus.PENDING);
        for (String etag : List.of("missing", "*", "W/\"0\"")) {
            var request = multipart(URL).file(file(PDF)).with(req -> { req.setMethod("PUT"); return req; }).header(HttpHeaders.AUTHORIZATION, bearerToken(company.getUser()));
            if (!etag.equals("missing")) request.header(HttpHeaders.IF_MATCH, etag);
            mockMvc.perform(request).andExpect(status().is(etag.equals("missing") ? 428 : 400));
        }
        upload(company, 0, PDF).andExpect(status().isOk()); String valid = key(company);
        upload(company, 0, fileBytes("png")).andExpect(status().isConflict());
        assertThat(key(company)).isEqualTo(valid); assertThat(PRIVATE.resolve(valid)).hasBinaryContent(PDF);
        assertThat(fileCount()).isEqualTo(1);
    }

    @Test void documentReplacementAndProfileUpdatesShareTheSameRevision() throws Exception {
        var company = createCompany("document-shared-revision@example.test", "Shared revision", CompanyStatus.PENDING);
        String token = bearerToken(company.getUser());
        upload(company, 0, PDF).andExpect(status().isOk()); String valid = key(company);
        mockMvc.perform(put("/api/companies/me").header(HttpHeaders.AUTHORIZATION, token).header(HttpHeaders.IF_MATCH, "\"0\"")
                        .contentType("application/json").content("{\"description\":\"Stale draft\"}"))
                .andExpect(status().isConflict());
        mockMvc.perform(put("/api/companies/me").header(HttpHeaders.AUTHORIZATION, token).header(HttpHeaders.IF_MATCH, "\"1\"")
                        .contentType("application/json").content("{\"description\":\"Confirmed profile\"}"))
                .andExpect(status().isOk()).andExpect(header().string("ETag", "\"2\""));
        upload(company, 1, fileBytes("png")).andExpect(status().isConflict());
        assertThat(key(company)).isEqualTo(valid); assertThat(fileCount()).isEqualTo(1);
        assertThat(companyRepository.findById(company.getId()).orElseThrow().getDescription()).isEqualTo("Confirmed profile");
    }

    @Test void concurrentReplacementHasOneWinnerAndNoOrphans() throws Exception {
        var company = createCompany("document-concurrent@example.test", "Race", CompanyStatus.PENDING);
        upload(company, 0, PDF).andExpect(status().isOk());
        var start = new CountDownLatch(1); byte[] png = fileBytes("png"), jpg = fileBytes("jpg");
        try (var pool = Executors.newFixedThreadPool(2)) {
            var futures = List.of(png, jpg).stream().map(bytes -> pool.submit(() -> { start.await(); return upload(company, 1, bytes).andReturn().getResponse().getStatus(); })).toList();
            start.countDown();
            assertThat(List.of(futures.get(0).get(10, TimeUnit.SECONDS), futures.get(1).get(10, TimeUnit.SECONDS))).containsExactlyInAnyOrder(200, 409);
        }
        assertThat(fileCount()).isEqualTo(1); assertThat(PRIVATE.resolve(key(company))).exists();
        assertThat(companyRepository.findById(company.getId()).orElseThrow().getAccountRevision()).isEqualTo(2);
    }

    @Test void databaseFlushFailureRollsBackAndCleansOnlyStagedReplacement() throws Exception {
        var company = createCompany("document-db-failure@example.test", "Failure", CompanyStatus.PENDING);
        upload(company, 0, PDF).andExpect(status().isOk()); String valid = key(company);
        jdbcTemplate.execute("ALTER TABLE companies ADD CONSTRAINT test_document_failure CHECK (verification_document_url = '" + valid + "')");
        try { upload(company, 1, fileBytes("png")).andExpect(status().isInternalServerError()); }
        finally { jdbcTemplate.execute("ALTER TABLE companies DROP CONSTRAINT test_document_failure"); }
        assertOldFile(company, valid);
    }

    @Test void databaseCommitFailureReconcilesAndPreservesThePreviousFile() throws Exception {
        var company = createCompany("document-commit-failure@example.test", "Failure", CompanyStatus.PENDING);
        upload(company, 0, PDF).andExpect(status().isOk()); String valid = key(company);
        jdbcTemplate.execute("CREATE FUNCTION reject_test_document_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic commit failure'; END $$");
        jdbcTemplate.execute("CREATE CONSTRAINT TRIGGER test_document_commit_failure AFTER UPDATE ON companies DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reject_test_document_commit()");
        try { upload(company, 1, fileBytes("png")).andExpect(status().isInternalServerError()); }
        finally { jdbcTemplate.execute("DROP TRIGGER test_document_commit_failure ON companies"); jdbcTemplate.execute("DROP FUNCTION reject_test_document_commit()"); }
        assertOldFile(company, valid);
    }

    @Test void storageAndReadFailuresDoNotLosePreviouslyValidDocument() throws Exception {
        var company = createCompany("document-storage-failure@example.test", "Failure", CompanyStatus.PENDING);
        upload(company, 0, PDF).andExpect(status().isOk()); String valid = key(company);
        Path held = TEMP.resolve("held"); Files.move(PRIVATE, held); Files.writeString(PRIVATE, "not a directory");
        try { upload(company, 1, fileBytes("png")).andExpect(status().isInternalServerError()); }
        finally { Files.delete(PRIVATE); Files.move(held, PRIVATE); }
        assertOldFile(company, valid);
        MockMultipartFile brokenInput = new MockMultipartFile("file", "broken.pdf", "application/pdf", PDF) {
            @Override public InputStream getInputStream() throws IOException { throw new IOException("synthetic read failure"); }
        };
        mockMvc.perform(multipart(URL).file(brokenInput).with(req -> { req.setMethod("PUT"); return req; })
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(company.getUser())).header(HttpHeaders.IF_MATCH, "\"1\""))
                .andExpect(status().isInternalServerError());
        assertOldFile(company, valid);
    }

    @ParameterizedTest @ValueSource(strings = {"../outside.pdf", "/etc/passwd", "C:\\Windows\\win.ini", "https://example.test/private.pdf", "12345678-1234-1234-1234-123456789abc.pdf/../other.pdf"})
    void unsafeDatabaseReferencesNeverResolveOutsidePrivateRoot(String reference) throws Exception {
        var company = createCompany("document-path@example.test", "Path", CompanyStatus.PENDING);
        jdbcTemplate.update("update companies set verification_document_url = ? where id = ?", reference, company.getId());
        mockMvc.perform(get(URL + "/file").header(HttpHeaders.AUTHORIZATION, bearerToken(company.getUser())))
                .andExpect(status().isNotFound());
        assertThat(fileCount()).isZero();
    }

    @Test void refusesSymlinkOrJunctionStorageRootWithoutReadingOrWritingItsTarget() throws Exception {
        var company = createCompany("document-link@example.test", "Link", CompanyStatus.PENDING);
        String key = "12345678-1234-1234-1234-123456789abc.pdf";
        Path outside = TEMP.resolve("outside"); Files.createDirectories(outside); Files.write(outside.resolve(key), PDF);
        jdbcTemplate.update("update companies set verification_document_url = ? where id = ?", key, company.getId());
        if (System.getProperty("os.name").toLowerCase().contains("windows")) {
            var process = new ProcessBuilder("cmd", "/c", "mklink", "/J", PRIVATE.toString(), outside.toString()).redirectErrorStream(true).start();
            String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            assertThat(process.waitFor()).as(output).isZero();
        } else Files.createSymbolicLink(PRIVATE, outside);
        try {
            mockMvc.perform(get(URL + "/file").header(HttpHeaders.AUTHORIZATION, bearerToken(company.getUser())))
                    .andExpect(status().isNotFound());
            upload(company, 0, PDF).andExpect(status().isInternalServerError());
            assertThat(outside.resolve(key)).hasBinaryContent(PDF);
            try (var files = Files.list(outside)) { assertThat(files.count()).isEqualTo(1); }
        } finally { Files.delete(PRIVATE); }
    }

    @Test void publicOwnerAndAdminProfileResponsesNeverExposeDocumentReferenceOrMetadata() throws Exception {
        var company = createCompany("document-private@example.test", "Private", CompanyStatus.VERIFIED);
        upload(company, 0, PDF).andExpect(status().isOk());
        var admin = createUser("document-private-admin@example.test", UserRole.ADMIN);
        for (String path : List.of("/api/companies/me", "/api/public/companies", "/api/public/companies/" + company.getId(), "/api/admin/companies", "/api/admin/companies/" + company.getId())) {
            var request = get(path);
            if (path.startsWith("/api/admin")) request.header(HttpHeaders.AUTHORIZATION, bearerToken(admin));
            if (path.equals("/api/companies/me")) request.header(HttpHeaders.AUTHORIZATION, bearerToken(company.getUser()));
            String json = mockMvc.perform(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
            assertThat(json).doesNotContain(key(company), PRIVATE.toString(), "verificationDocument", "submitted");
        }
        String json = mockMvc.perform(get(URL).header(HttpHeaders.AUTHORIZATION, bearerToken(company.getUser()))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        var fields = mapper.readTree(json).path("data");
        assertThat(fields.size()).isEqualTo(2); assertThat(fields.has("submitted")).isTrue(); assertThat(fields.has("revision")).isTrue();
        assertThat(json).doesNotContain(key(company), PRIVATE.toString());
    }

    private void assertOldFile(Company company, String key) throws Exception {
        assertThat(key(company)).isEqualTo(key); assertThat(fileCount()).isEqualTo(1);
        assertThat(PRIVATE.resolve(key)).hasBinaryContent(PDF);
        assertThat(companyRepository.findById(company.getId()).orElseThrow().getAccountRevision()).isEqualTo(1);
        mockMvc.perform(get(URL + "/file").header(HttpHeaders.AUTHORIZATION, bearerToken(company.getUser()))).andExpect(status().isOk()).andExpect(content().bytes(PDF));
    }
    private ResultActions upload(Company company, long revision, byte[] bytes) throws Exception {
        return mockMvc.perform(multipart(URL).file(file(bytes)).with(req -> { req.setMethod("PUT"); return req; })
                .header(HttpHeaders.AUTHORIZATION, bearerToken(company.getUser())).header(HttpHeaders.IF_MATCH, "\"" + revision + "\""));
    }
    private MockMultipartFile file(byte[] bytes) { return new MockMultipartFile("file", "../../client-secret.exe", "text/html", bytes); }
    private String key(Company company) { return companyRepository.findById(company.getId()).orElseThrow().getVerificationDocumentKey(); }
    private String adminUrl(Company company) { return "/api/admin/companies/" + company.getId() + "/verification-document"; }
    private long fileCount() throws IOException { if (!Files.isDirectory(PRIVATE)) return 0; try (var files = Files.list(PRIVATE)) { return files.count(); } }
    private String businessData(Company company) { return jdbcTemplate.queryForObject("select (to_jsonb(c) - 'verification_document_url' - 'account_revision' - 'updated_at')::text from companies c where id = ?", String.class, company.getId()); }
    private static byte[] pdf(int length) {
        String prefix = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
        int pagesOffset = prefix.length();
        prefix += "2 0 obj\n<< /Type /Pages /Count 0 /Kids [] >>\nendobj\n";
        int padding = 0;
        for (int attempt = 0; attempt < 4; attempt++) {
            String body = prefix + " ".repeat(padding);
            String document = body + "xref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n" + String.format(java.util.Locale.ROOT, "%010d 00000 n \n", pagesOffset)
                    + "trailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n" + body.length() + "\n%%EOF\n";
            if (length == 0 || document.length() == length) return document.getBytes(StandardCharsets.US_ASCII);
            padding += length - document.length();
        }
        throw new AssertionError("Could not build exact-size PDF fixture");
    }
    private byte[] fileBytes(String extension) throws IOException {
        if (extension.equals("pdf")) return PDF;
        var output = new ByteArrayOutputStream(); ImageIO.write(new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB), extension.equals("jpg") ? "jpeg" : extension, output); return output.toByteArray();
    }
    private static Path temporaryRoot() { try { return Files.createTempDirectory("sjrs-verification-test-"); } catch (IOException ex) { throw new ExceptionInInitializerError(ex); } }
    private static void clean(Path directory) throws IOException {
        if (!Files.exists(directory, LinkOption.NOFOLLOW_LINKS)) return;
        Files.walkFileTree(directory, new SimpleFileVisitor<>() {
            @Override public FileVisitResult visitFile(Path path, BasicFileAttributes attributes) throws IOException { Files.delete(path); return FileVisitResult.CONTINUE; }
            @Override public FileVisitResult postVisitDirectory(Path path, IOException ex) throws IOException { if (ex != null) throw ex; Files.delete(path); return FileVisitResult.CONTINUE; }
        });
    }
}
