# Docker Standards

## When to Use

✅ Cloud deployment, CI/CD, team dev environment consistency, Kubernetes, local DB/Redis isolation
❌ Serverless deployments, simple scripts, early prototyping

## Non-negotiable Rules

### Production
- Always multi-stage builds: `deps` → `builder` → `runner`
- Run as non-root user — always create and switch to unprivileged user
- Never store secrets in Dockerfile — pass via env at runtime
- Always add `HEALTHCHECK`

### Node.js Specific
- Base image: `node:20-alpine` (never `latest`, never full Debian)
- `npm ci --only=production` in production stage, never full `npm install`
- Run `prisma migrate deploy` in CMD, not during build

### Python Specific
- Base image: `python:3.12-slim` (never `latest`, never full image)
- Use multi-stage: builder installs deps, runner copies only site-packages
- `pip install --no-cache-dir` in builder stage
- For Poetry: `poetry export -f requirements.txt` → `pip install` in runner (no Poetry in production image)
- For Django: `python manage.py collectstatic --noinput` in builder, not at runtime
- Gunicorn/Uvicorn as process manager — never `python manage.py runserver` in production

### Development
- Use `docker-compose` for local dev — never manual `docker run` chains
- Database service must have `healthcheck` + `depends_on` with `condition: service_healthy`
- Use service name as DB host (`postgres`, not `localhost`)

### Always
- `.dockerignore` required — must exclude: `node_modules`, `dist`, `.env*`, `.git`, `__pycache__`, `.venv`, test files
- Layer order: dependency files first → install → source files (cache optimization)
- Pin base image versions in production (e.g. `node:20.11-alpine`, `python:3.12.2-slim`)