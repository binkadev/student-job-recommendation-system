# W3-C2A: Application-scoped messaging Backend

Baseline: master `37e9d86f2cfe8db3df50911b038d5b6599644940`. Branch: `feat/datn-w3c2a-application-messaging-backend`.

## Scope and allocation

V24 is the released interviews/invitations migration. V25 is allocated to messaging, superseding the historical Wave 0 V26 reservation; W2-C password recovery is excluded. V1-V24 and existing recruiting/AI/authentication/Frontend behavior are unchanged. No Frontend messaging integration or browser E2E is claimed here.

## Contract and privacy

The five endpoints, exact DTO fields, validation, errors and ordering are documented in [API contract](../api-contract.md#application-scoped-private-messaging-v25). New tables/constraints/indexes are described in [schema](../database-schema.md#v25-application-scoped-private-messaging).

Only the persisted Application's Student and Job's Company may access its private conversation. Roles and user identity come from the current authenticated principal. Admin has no messaging override. Request DTOs explicitly reject unknown fields, so client participant/sender spoofing is rejected. Responses contain only conversation identifiers/timestamps and authorized message fields. No entity serialization, CV/contact/storage metadata, message previews on lists or raw content logging is added; request/response records containing message content have redacted toString methods. Existing authentication rejects disabled/locked users.

Terminal and historical Applications retain create/read/send access for their participants; verification/job status changes do not destroy history or silently change Application lifecycle. Separate Application rows, including reapplications, have separate conversations. No recruitment state, CV analysis or notification is mutated by messaging.

## Concurrency and read state

Creation locks the existing Application before checking for/reusing a conversation, with UNIQUE application_id as a database backstop. Send/read lock the Conversation row. All mutations are transactional. New message creation time is assigned after locking, at PostgreSQL microsecond precision and at least the prior lastMessageAt. Insert and metadata update commit or roll back together. Timestamp ties use message ID for chronological ordering.

Read marks only unread messages from the other exact participant in the selected conversation, including messages outside the current history page. It leaves outbound messages and other conversations untouched. Repeating returns zero; a later send remains unread. Concurrent reads/sends are serialized by the same lock. Reads do not update lastMessageAt. GET has no read-state side effects.

No If-Match is needed for append-only send/reuse/idempotent read. Lists use bounded offset pagination; a new send can move a conversation across pages, so clients must refresh after activity. No websocket, attachment, editing/deletion, notification producer, retention policy or abuse-rate limiter is introduced.

## Focused verification

PostgreSQL 17 Testcontainers only, synthetic users and disposable schemas; no manual/demo DB, credentials, services or existing worktrees are used or changed. Race tests hold a real database row lock until both HTTP transactions are waiting, then release it. HTTP-level tests use MockMvc with the real JWT filter, Spring Security, services and PostgreSQL (not browser/network E2E).

Command (PowerShell, backend directory):

```powershell
.\mvnw.cmd -B -ntp test failsafe:integration-test failsafe:verify '-Dtest=JobRecommendationApplicationTests' '-Dit.test=ApplicationMessagingApiIT,ApplicationMessagingMigrationIT,DatabaseMigrationIT,DatabaseAiContractV2MigrationIT,DatabaseRecommendationRankingV3MigrationIT,RecruitingWorkflowMigrationIT,ApplicationLifecycleApiIT'
```

Results: **31 distinct focused tests passed**, zero failures/errors/skips: 15 messaging API, 2 V25 migration/constraints, 6 Application lifecycle, 5 existing latest-migration/backfill/schema checks, 2 existing V24 recruiting migration tests, and 1 no-db Spring context test. The initial command passed 29 PostgreSQL tests + 1 no-db test. After adding NUL rejection and a Unicode/redacted-log-record boundary case, only the messaging API class was rerun (15/15 passed) with:

```powershell
.\mvnw.cmd -B -ntp test-compile failsafe:integration-test failsafe:verify '-Dit.test=ApplicationMessagingApiIT'
```

Both executions reported BUILD SUCCESS (Java 21). Fresh V1-V25 migrations and Hibernate validate succeeded on PostgreSQL 17. A populated V24 schema upgraded to V25 with all eight existing business-table snapshots unchanged; Flyway validation and a second no-op migrate passed. Intermediate V14/V16 backfill checks and the explicit populated V23-to-V24 upgrade passed. No old migration file was changed. Initial sandbox network restrictions prevented Maven dependency access; the authorized network/Docker execution above succeeded.

New tests cover V24 populated upgrade with unchanged JSON business-row snapshots, schema constraints/indexes/defaults, same-Application singleton/concurrent creation, separate histories, RBAC including Admin denial, owner-filtered counts/pages, deterministic message ordering, blank/oversized/NUL/forged bodies, Unicode limits and redacted content records, concurrent sends, non-regressing metadata, incoming-only read/idempotence/read-send races, corrupt tuple fail-closed behavior and unchanged recruiting rows across all Application states. Existing latest migration expectations advance to V25; intermediate V14/V16 and explicit V23-to-V24 tests are preserved. The no-db test mocks only the two new repositories.

Core Smoke PRIMARY/FALLBACK is a known independent issue and is not run or modified. No full regression, AI, Frontend or Playwright suite is run for this Backend task.
