# Request Tracing

## Purpose

`X-Request-Id` correlates one request across the client, Spring Boot Backend, and FastAPI AI Service. Both services include the same safe identifier in their completion logs, making it possible to follow a request without logging payloads or credentials.

The header is observability metadata, not an authentication token. It grants no access and must never replace JWT authentication or the Backend–AI `X-Internal-Api-Key`.

## Flow

```text
Client
  X-Request-Id: client.trace-123
        |
        v
Spring Boot Backend
  validates or generates the ID
  returns X-Request-Id to the client
  propagates X-Request-Id to AI calls
        |
        v
FastAPI AI Service
  validates or generates the ID
  returns X-Request-Id to the Backend
```

If the Backend AI client runs outside an inbound HTTP request, it generates a valid outbound request ID locally without leaving it in thread context.

## Validation

A supplied request ID is accepted only when it:

- is unchanged by trimming;
- contains 1–128 characters;
- contains only ASCII letters, digits, `.`, `_`, `:`, or `-`;
- matches `^[A-Za-z0-9._:-]{1,128}$`.

Missing, blank, oversized, Unicode, whitespace-containing, CR/LF-containing, or otherwise invalid values are replaced with a new canonical lowercase UUID such as `123e4567-e89b-12d3-a456-426614174000`. Invalid input is never echoed to the caller.

## Example

curl:

```bash
curl -i -H "X-Request-Id: support.case-123" http://localhost:8080/api/public/statistics
```

PowerShell:

```powershell
Invoke-WebRequest -Uri "http://localhost:8080/api/public/statistics" -Headers @{"X-Request-Id"="support.case-123"}
```

The response contains:

```text
X-Request-Id: support.case-123
```

Search Backend and AI logs for the exact value of `requestId`:

```text
requestId=support.case-123
```

Completion logs contain only `requestId`, HTTP method, URI path, response status, and duration in milliseconds. Query strings are excluded.

## Data that must never be logged

Request tracing must not log:

- `Authorization` headers or JWTs;
- cookies;
- passwords;
- `X-Internal-Api-Key` or environment secrets;
- request or response bodies;
- multipart content, uploaded bytes, or filenames;
- raw CV data;
- extracted or processed CV text;
- full Job text;
- recommendation explanations, matched skills, or other payload fields.

## Contract V2 business request ID

`X-Request-Id` is transport-level tracing metadata. The `requestId` field in the Contract V2 recommendation request is a separate business request identifier. They are not required to match, and tracing does not modify the existing Contract V2 field or response body.
