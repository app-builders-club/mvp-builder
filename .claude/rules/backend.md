---
paths:
  - "**/prisma/**"
  - "**/server/**"
  - "**/trpc/**"
  - "**/api/**"
  - "**/*.py"
  - "**/manage.py"
  - "**/requirements*.txt"
  - "**/pyproject.toml"
  - "**/Pipfile"
---

# Backend Standards

## Stack Decisions

### Database ORM
- **TypeScript/Node** → Prisma. Always singleton pattern for PrismaClient.
- **Python** → SQLAlchemy (FastAPI) / Django ORM (Django)

### Validation
- **TypeScript** → Zod. No exceptions. Validate env variables, API inputs, config files, form data.
- **Python** → Pydantic (FastAPI) / Django REST Framework serializers (Django)

### API Layer
- **TypeScript full-stack (both ends controlled)** → tRPC
- **External clients / public API / mixed languages** → REST + OpenAPI via `trpc-to-openapi`
- **Python** → FastAPI with automatic OpenAPI / Django REST Framework

### Logging
- **Node.js** → Pino. Never `console.log` in production code.
- **Python** → structlog or logging with JSON formatter.

### Testing
- **TypeScript** → Vitest. Never Jest for new projects.
- **Python** → pytest.

## API Design

### Resource Naming
- URIs represent nouns (resources), never verbs (actions)
  - ✅ `GET /users`, `POST /orders`
  - ❌ `GET /getUsers`, `POST /createOrder`
- Plural nouns for collections: `/users/123`, not `/user/123`
- Hierarchy for relationships, maximum 2 levels deep
  - ✅ `GET /users/123/orders`
  - ❌ `GET /users/123/orders/456/items/789` — use `GET /orders/456/items` instead

### HTTP Method Semantics

| Method | Action | Safe | Idempotent | Body |
|--------|--------|------|------------|------|
| GET | Read | Yes | Yes | No |
| POST | Create | No | No | Yes |
| PUT | Replace | No | Yes | Yes |
| PATCH | Update (partial) | No | No* | Yes |
| DELETE | Remove | No | Yes | Optional |

- Safe = never modifies server state
- Idempotent = multiple identical requests produce same result
- PATCH idempotency depends on payload semantics — design explicitly

### Response Envelope

All successful list responses use envelope structure:
```json
{
  "data": [ ... ],
  "meta": {
    "pagination": { "next_cursor": "...", "has_more": true }
  }
}
```

- Single-resource responses return the resource directly (not wrapped)
- List responses always wrapped — never return bare array
- Pagination metadata lives in `meta`, never mixed into `data`
- Never return `{ success: true }` wrappers — HTTP status codes convey success

### Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": [{ "field": "email", "issue": "invalid format" }]
  }
}
```
- Always return consistent envelope — never raw strings or status-only responses
- Use machine-readable `code` for client logic, `message` for display
- Include `details` array for field-level validation errors
- Never return `200 OK` for errors — use proper 4xx/5xx status codes
- Never leak internal exceptions, stack traces, or SQL errors to clients in production

### HTTP Status Codes

Use standard codes for their defined purpose:
- `200 OK` — successful GET, PUT, PATCH
- `201 Created` — successful POST that created a resource
- `204 No Content` — successful DELETE or operation with no response body
- `304 Not Modified` — conditional GET when cached copy is valid
- `400 Bad Request` — malformed request syntax
- `401 Unauthorized` — authentication missing or invalid
- `403 Forbidden` — authenticated but lacks permission
- `404 Not Found` — resource does not exist
- `409 Conflict` — request conflicts with current state (version mismatch, duplicate)
- `422 Unprocessable Entity` — syntactically valid but semantically invalid
- `429 Too Many Requests` — rate limit exceeded
- `500 Internal Server Error` — unhandled server exception
- `503 Service Unavailable` — temporary outage, overload

### Pagination
- Cursor-based for feeds and real-time data: `?cursor=xxx&limit=20`
- Offset-based only for admin/dashboard with stable data: `?page=1&per_page=20`
- Always return `hasMore` / `nextCursor` or `totalCount` / `totalPages`
- Server-enforced max limit (typically 100) — never honor unbounded `limit` parameter
- Cursors must be opaque (see Opaque Identifiers below)

### Idempotency

All non-idempotent mutations (POST creating resources, payments, sends) must support an idempotency key:

- Client generates UUID v4 per mutation
- Sent via HTTP header: `Idempotency-Key: <uuid>`
- Server stores `(key → response)` mapping for minimum 24 hours
- On duplicate key: return cached response without re-executing side effects
- Keys are scoped per endpoint + per authenticated principal

Never rely on client-side retry logic for correctness — the server must be the source of truth for de-duplication.

Endpoints that are naturally idempotent (PUT, DELETE, PATCH with absolute values) don't require keys but may accept them.

### Opaque Identifiers

IDs and cursors exposed in API responses must be opaque strings:

- Never expose auto-incrementing integer IDs directly
- Use UUIDs, ULIDs, or base64-encoded opaque tokens
- Cursors must never be interpretable by clients (no date math, no arithmetic)

Rationale:
- Sequential integers leak business metrics (user count, order volume)
- Opaque cursors allow backend implementation changes without breaking clients
- UUIDs prevent ID enumeration attacks

If internal integer IDs exist for database efficiency, translate at the API boundary.

### Field Selection

For endpoints returning rich resources, support explicit field selection to reduce over-fetching:
- `GET /users/123?fields=id,name,email`
- Server returns only requested fields plus always-included core fields (id, type)
- Invalid field names return `400 Bad Request` with list of valid fields

### Resource Embedding

For relationships, support explicit embedding to reduce round-trips:
- `GET /orders/123?embed=items,customer`
- Without `embed`, return only foreign keys / IDs
- Document which relations support embedding in OpenAPI spec
- Cap embedding depth at 1 level — no nested embeds (`embed=items.product.variants`)

### Versioning
- URL prefix for breaking changes: `/api/v1/`, `/api/v2/`
- Non-breaking additions (new optional fields, new endpoints) → no version bump
- Deprecation: minimum 2 releases before removal, log usage of deprecated endpoints
- Never version via query param (`?version=2`) or custom header — URL path only

### Rate Limiting
- Return `429 Too Many Requests` with `Retry-After` header (seconds)
- Include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers on every response
- Authenticated endpoints: per-user limits
- Public endpoints: per-IP limits
- Always document limits in OpenAPI spec

### Date and Time
- All timestamps in responses use ISO 8601 with timezone: `2025-01-15T14:30:00Z`
- Always store and return in UTC — clients handle timezone conversion
- Never return epoch integers (`1736951400`) in public APIs
- Never accept timezone-naive datetimes in request bodies

## Non-negotiable Rules

### Security
- Secrets via env only — never hardcode
- Tokens: access token ≤15min, refresh token in httpOnly cookie
- Never expose internal error details to clients in production
- API keys in `Authorization: Bearer <token>` or custom `X-API-Key` header — never in URL query parameters
- Validate all input server-side — client validation is UX, not security
- Sanitize data before inclusion in logs (see Logging below)

### Logging
- Redact sensitive fields in all log output: `password`, `token`, `authorization`, `cookie`, `secret`, `api_key`
- Include correlation/request IDs for tracing
- Never log PII without explicit redaction
- Never log request/response bodies in production without sampling + redaction

### TypeScript
- Strict mode always enabled
- Use `z.infer<typeof Schema>` to derive types — no manual duplication
- Use `TRPCError` with appropriate codes — never throw raw errors

### Python
- Type hints on all function signatures
- Pydantic models for all API boundaries
- Never catch bare `Exception` — always specific types

### Database
- Never `prisma db push` in production — always `prisma migrate deploy`
- Always add indexes for frequently queried fields
- Never create multiple PrismaClient instances
- Django: always `makemigrations` + `migrate` — never modify DB manually

### Testing
- Mock external dependencies (DB, APIs, email)
- Test error paths, not just happy path
- No shared mutable state between tests