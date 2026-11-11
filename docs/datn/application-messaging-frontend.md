# W3-C2B: Application-scoped messaging Frontend

Baseline: master `c50f440909c644f93a2bcb962447c5e31ea4f0ac` (merged V25 Backend). Branch: `feat/datn-w3c2b-application-messaging-frontend`. Dedicated worktree: `.worktrees/datn-w3c2b-application-messaging-frontend`.

## Supported UI and entry points

The existing `/candidate/messages`, `/candidate/messages/:conversationId`, `/recruiter/messages`, and `/recruiter/messages/:conversationId` routes now render the API-backed shared workspace. Existing protected/role routes remain unchanged; Admin has no messaging workspace. The page itself also requires the matching authenticated role.

Student Application cards/detail/status views expose **Nhắn tin**, including REJECTED/WITHDRAWN history. The authorized recruiter Application detail replaces unsupported **Liên hệ** with the same explicit in-app action. Rendering an Application or conversation list never creates a conversation. Clicking re-fetches that exact Application through the role-owned detail endpoint, verifies its ID, then creates/reuses its conversation and navigates to the returned ID. No public Student directory, email delivery or unrelated-account launcher is introduced.

Files: shared `frontend/src/features/messaging/{messagingApi.ts,useMessagingQuery.ts,MessageLauncher.tsx}`; the existing CandidateMessagesPage, CandidateApplicationsPage and RecruiterCandidatesPage; focused messaging API/component/route tests. The obsolete unsupported-messaging assertions are updated to require denial of an unverified session; unrelated unsupported-capability assertions remain intact.

## Exact transport mapping

All requests use the existing Axios `httpClient`, JWT interceptors and ApiResponse envelope. No Backend, auth, notifications, schema or AI code changes.

| Action | Backend API / exact payload |
|---|---|
| List conversations | GET `/api/conversations?page=1&size=10` |
| Resolve Student Application on click | GET `/api/students/me/applications/{applicationId}` |
| Resolve Company Application on click | GET `/api/companies/me/applications/{applicationId}` |
| Create/reuse | POST `/api/conversations`, `{ "applicationId": 9 }` |
| History | GET `/api/conversations/{id}/messages?page=1&size=10` |
| Send | POST `/api/conversations/{id}/messages`, `{ "content": "original text" }` |
| Mark incoming read | PATCH `/api/conversations/{id}/read`, no body |

The DTOs mirror all ConversationResponse, MessageResponse and MarkReadResponse fields from the [V25 contract](../api-contract.md#application-scoped-private-messaging-v25). Sender/participant fields are never sent. Failed envelopes, malformed pages, unexpected conversation/Application identities and malformed mutation results do not produce fabricated success/empty lists.

There is no `GET /api/conversations/{id}`. Detail deep links resolve metadata by scanning only the authenticated account's conversation pages, 100 records per request, sequentially and abortably. Lookup stops at the first match or the initial totalPages snapshot, so later list growth cannot prolong it indefinitely. No global/shared cache or unrelated endpoint lookup is used. Concurrent activity can move offset pages; a missing result offers an explicit lookup reload. Lookup latency grows with the number of owned conversation pages.

## Message and read semantics

Conversation ordering is Backend latest-activity descending; history preserves Backend oldest-first createdAt/id ordering. Pagination is real HTTP pagination, not client slicing. **Đến trang mới nhất** re-fetches page 1 for the current page count and then the latest page if needed, without downloading all message history. A successful send confirms the returned message, clears the draft, then refreshes the latest page. The confirmed response remains visible if the later history refresh fails; it is not duplicated when present in the loaded page.

Content must be nonblank, at most 5000 UTF-16 code units (`String.length`), and contain no NUL. Validation does not trim or rewrite submitted content. Message bodies render as escaped React text with preserved whitespace and long-token wrapping. There is no HTML rendering, attachment control, content logging or message/draft persistence in localStorage/sessionStorage.

Send/create/read share the established mutation hook's synchronous busy latch and abort/unmount/session guards. Parallel clicks cannot enqueue duplicate mutations. A send failure or malformed/uncertain response retains the draft, does not claim delivery, and never automatically retries. The user must deliberately refresh history (which opens the latest page after an uncertain send), inspect it, and explicitly enable a new send. A failed refresh cannot unlock resending. This reduces accidental duplicates but cannot provide exactly-once delivery: V25 has no client message idempotency key.

GET history never marks read. **Đánh dấu đã đọc** is explicit, bodyless and scoped to the conversation. The Backend selects incoming unread messages, including other pages. Its markedCount is only the number changed by that operation, not an account unread total. A successful PATCH refreshes the visible page; the UI never locally marks outbound messages read for their recipient. Incoming/outgoing labels and read receipts reflect confirmed DTOs only. No presence, typing, global unread count, polling, push or realtime delivery is claimed.

## Session, privacy and errors

The page/launcher keys include authenticated user ID, role and in-memory session version; the page also keys by path. `useSessionAlive`, abort controllers and existing httpClient session ownership reject late results after logout, account switch or unmount. Navigation to a different/unknown conversation remounts the workspace and drops prior private content/drafts. Application lookup is followed by another session-alive check before the create POST. There is no cross-account cache. JWTs are never placed in UI keys/logs, and localStorage never determines ownership. Backend remains authoritative.

Loading, confirmed empty pages and failures are distinct. 401 requests login again, 403 reports no access, 404/missing owned metadata reports not found, 400 reports invalid input, and network failures offer manual recovery. Authorization/missing-resource send/read failures hide the previous history and compose controls. A history GET failure exposes no message content from that failed load and blocks sending until a successful refresh. Existing role guards deny cross-role routes before loading an inbox.

Timestamps use the existing `formatWallTime` presentation of local date/time fields. No `Z` is appended and no UTC conversion is invented. Backend LocalDateTime lacks explicit timezone metadata; users in different zones cannot infer an absolute instant from it.

## Focused verification

Commands run from `frontend/` (PowerShell):

```powershell
npx.cmd vitest run src/features/messaging src/pages/UnsupportedCapabilities.test.tsx src/pages/candidate/CandidateApplicationLifecycle.test.tsx src/pages/candidate/ApplicationEntryPoints.test.tsx src/pages/recruiter/RecruiterCandidateEvaluation.test.tsx src/pages/recruiter/RecruiterWorkspace.test.tsx src/features/recruiting src/services/api/httpClient.test.ts src/services/auth/authSession.test.ts src/app/providers/AuthProvider.test.tsx
npx.cmd tsc -b --pretty false
npx.cmd eslint src/features/messaging src/pages/candidate/CandidateMessagesPage.tsx src/pages/candidate/CandidateApplicationsPage.tsx src/pages/recruiter/RecruiterCandidatesPage.tsx src/pages/UnsupportedCapabilities.test.tsx
npm.cmd run build
```

Results: **188 distinct focused tests passed**, zero failures/skips: 41 messaging workspace/entry-point cases, 13 messaging API boundary cases, 8 real-router messaging/role cases, plus 126 existing relevant recruiting/Application/session/unsupported regressions. The combined focused run passed 186 tests; after adding Company read/send and uncertain-send latest-page cases, only MessagingPage.test.tsx was rerun (41/41). Initial testing caught and corrected an ambiguous timestamp test query; assertions were scoped to the incoming message. Scoped ESLint is clean after removing the obsolete contact-only unsupportedToast helper. TypeScript passed, and the production build (including TypeScript) ran once and passed.

Tests cover both roles' paginated lists, abortable owner-only metadata lookup, chronological/latest history, exact payloads, confirmed-only rendering, duplicate suppression, uncertain draft retention/no retries, manual recovery, bodyless recipient read and authoritative refresh, HTML escaping, blank/oversized/Unicode/NUL inputs, session switches and late GET/POST results, 401/403/404, historical Application launchers, actual route guards and unrelated unsupported features. HTTP is mocked only in unit/component tests. No Backend, migration, AI or Playwright suite was run. Browser/network E2E of this Frontend remains a separate work package; these tests do not establish live end-to-end evidence.

Existing worktrees/uncommitted changes, local services and demo database were preserved. Dependencies came from the existing lockfile without changes; generated logs, node_modules and build artifacts are excluded from the commit. Core Smoke PRIMARY/FALLBACK remains an independent pre-existing issue; neither assertions nor AI scoring were touched. Password recovery remains excluded.
