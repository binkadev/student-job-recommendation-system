package com.tttn.jobrecommendation.modules.company.dto.response;

/** Internal download result; not serialized as a Company profile DTO. */
public record VerificationDocumentDownload(byte[] content, String mediaType, String extension) {}
