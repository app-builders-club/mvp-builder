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

### Pagination
- Cursor-based for feeds and real-time data: `?cursor=xxx&limit=20`
- Offset-based only for admin/dashboard with stable data: `?page=1&per_page=20`
- Always return `hasMore` / `nextCursor` or `totalCount` / `totalPages`

### Versioning
- URL prefix for breaking changes: `/api/v1/`, `/api/v2/`
- Non-breaking additions (new optional fields) → no version bump
- Deprecation: minimum 2 releases before removal, log usage of deprecated endpoints

### Rate Limiting
- Return `429 Too Many Requests` with `Retry-After` header
- Authenticated endpoints: per-user limits
- Public endpoints: per-IP limits
- Always document limits in OpenAPI spec

## Non-negotiable Rules

### Security
- Secrets via env only — never hardcode
- Tokens: access token ≤15min, refresh token in httpOnly cookie
- Never expose internal error details to clients in production

### Logging
- Redact sensitive fields in all log output: `password`, `token`, `authorization`, `cookie`
- Include correlation/request IDs for tracing
- Never log PII without explicit redaction

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