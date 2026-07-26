# Synthetic CV fixtures

`english_cv.pdf` and `english_cv.docx` are deterministic, synthetic English
CVs used only by the AI service test suite. They contain no personal or
production data.

Both fixtures contain this text:

```text
Software Engineer
Java, Spring Boot, PostgreSQL
Developed REST APIs and microservices
Built CI/CD pipelines
3 years experience
```

The PDF uses a built-in Helvetica font. The DOCX is a minimal Office Open XML
archive. Archive timestamps and document metadata are fixed so regeneration
is byte-for-byte stable.

Tests exercise the real locked `pdfplumber` and `python-docx` decoders.

SHA-256:

- `english_cv.pdf`:
  `8e25e3ee1c6d43c13e711ed557b9e3514eab186ec5f9f75dc435bd7f40b6a355`
- `english_cv.docx`:
  `57d7b01f2053391f6a2e1fc3d0f01534dc788ed0a59fb0399b7530479bce67db`

`vietnamese_cv.pdf` and `vietnamese_cv.docx` are deterministic, synthetic
Vietnamese CVs with no personal or production data. Both decode to:

```text
Kỹ sư phần mềm
Có kinh nghiệm phát triển REST API và kiến trúc vi dịch vụ bằng
Java, Spring Boot và PostgreSQL.
Đã xây dựng quy trình CI/CD và triển khai ứng dụng bằng Docker.
Ba năm kinh nghiệm phát triển hệ thống backend.
```

The Vietnamese PDF embeds Arial TrueType text and uses a fixed PDF trailer
identifier. The DOCX uses fixed archive timestamps and metadata-free XML.
Tests exercise the real locked `pdfplumber` and `python-docx` decoders.

SHA-256:

- `vietnamese_cv.pdf`:
  `f0c1f81723c3d7bee6fb2ec9d3c8a4807c8e2030057cc62d8f52f097838b952f`
- `vietnamese_cv.docx`:
  `1c8be80cfde9485056a865e679a72c5babe3ade6c72a85417d4e0d2638310ffd`
