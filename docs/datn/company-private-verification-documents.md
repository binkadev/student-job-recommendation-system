# Private company verification documents

Company profile DTOs and Public/Admin listings do not include document references or submission metadata. The existing `companies.verification_document_url` column contains an internal UUID storage key, not a URL. `Company.verificationDocumentKey` is ignored by JSON serialization. This feature does not approve a company or change its verification status.

## Authenticated API

| Method | Path | Role | Response |
| --- | --- | --- | --- |
| GET | `/api/companies/me/verification-document` | COMPANY, JWT-derived owner | Private submission status and ETag |
| PUT | `/api/companies/me/verification-document` | COMPANY, JWT-derived owner | Upload/replace; status and new ETag |
| GET | `/api/companies/me/verification-document/file` | COMPANY, JWT-derived owner | Attachment |
| GET | `/api/admin/companies/{companyId}/verification-document` | ADMIN | Private submission status and ETag |
| GET | `/api/admin/companies/{companyId}/verification-document/file` | ADMIN | Attachment |

The PUT accepts `multipart/form-data` with exactly one `file` part, no extra files or form/query parameters. Send the captured strong numeric `If-Match` ETag from the Company profile or private status GET. Missing precondition returns 428, malformed precondition 400, stale revision 409. The document and profile use the same persisted `account_revision`; successful upload increments it once. There is no Admin upload endpoint and no external document URL input.

JSON responses retain `ApiResponse<T>` with `data: {"submitted": true, "revision": 1}` (or `submitted: false` before submission). Submission indicates that the Company has a stored document reference; a missing or unsafe physical file returns 404 on download. No original filename, storage key, path or direct document URL is returned. Metadata and attachments use `Cache-Control: no-store`; attachments include `X-Content-Type-Options: nosniff` and a fixed download filename such as `verification-document.pdf`.

## File and storage rules

- Limit: 5 MiB (5,242,880 bytes), enforced on both declared size and bounded actual stream reads. Empty files are rejected.
- Actual PDF, PNG or JPEG bytes determine the stored type/extension; client filenames and Content-Type are not trusted. PDF header, final trailer and xref pointer are checked. PNG signature/final IEND and JPEG signature/final EOI are checked; images must decode and have at most 25 million pixels to bound decompression memory. Invalid files return 400; oversized files return 413.
- `APP_COMPANY_VERIFICATION_STORAGE_DIR` configures an absolute private directory. Default: `${user.home}/.sjrs/private/company-verification`. It must be outside the application repository, separate from CV storage, and must not be published by a web server/static asset mapping. New POSIX directories/files use owner-only permissions; on Windows keep the directory under a private account/service ACL.
- Storage keys are server-generated UUIDs with a detected extension. Resolution accepts only this exact key format; external URLs, absolute paths and traversal strings are rejected. All directory components are checked for symlinks/junctions, and files are opened with `NOFOLLOW_LINKS`. Private directories are controlled by the Backend service account.
- Download reads at most 5 MiB under the Company row lock before returning bytes, preventing replacement cleanup from racing an already selected document. No static resource handler or unauthenticated document endpoint is registered. CV storage code is unchanged.

## Replacement and failure behavior

The file is validated/staged before a short dedicated database transaction. The transaction locks the JWT-owned Company row, checks the captured revision again and flushes the new internal key. Transaction completion deletes the previous file only after confirmed commit, or deletes the staged replacement after confirmed rollback. A failed commit with unknown outcome is reconciled against the current database reference before deleting any staged file; if the DB cannot confirm the result, both files are retained.

Read/storage failures leave the prior reference and revision unchanged. Cleanup errors do not invalidate a successful committed document or remove the prior file on a failed replacement. They produce a generic operator log without paths/keys. A process crash, filesystem deletion failure or an unconfirmed commit outcome can leave an orphan in the private directory; operator reconciliation must compare opaque keys with committed DB references before removing unreferenced files. No background deletion process or document removal API is introduced here.

## Focused verification

Integration tests use isolated PostgreSQL Testcontainers and a temporary private directory. They cover actual byte signatures, size limits, owner/Admin authorization, metadata isolation, safe attachment headers, path traversal/junction refusal, replacement and concurrent writes, shared profile/document revision, rollback/commit/storage failure cleanup, and unchanged Company status. The manual demo database is not accessed.
