# Verification

- Wrapper: failed with `Cannot index into a null array` / `Cannot start maven from wrapper`.
- Fallback: Maven 3.9.12 with Java 21.0.11, `clean verify` exit 0 / BUILD SUCCESS.
- Tests: 34, failures 0, errors 0, skipped 0.
- Backend artifact: `backend-0.0.1-SNAPSHOT.jar`, SHA-256 `8406a4565e37356508df0e8d1814e3f6436e68d727df5fa4b767065e0d2c266d`.
- Benchmark runtime: Java 21.0.11. The first PATH-based Java 17 launch was rejected by bytecode version and is preserved in `backend.stderr.log`; no measurements used that process.
