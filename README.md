# Goodie Bag MVP

## Prerequisites

- Java 21
- Node 22+
- Docker Desktop (for local PostgreSQL and test containers)
- Maven wrapper included (`./mvnw`)

## Local startup

### 1. Copy environment template

```bash
cp .env.example .env
# Edit .env if you need different DB credentials
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

### 3. Start backend

```bash
cd backend
./mvnw spring-boot:run
# Flyway migrations run automatically on startup
# Backend listens on http://localhost:8080
```

### 4. Start frontend

```bash
cd frontend
npm install
npm run dev
# Frontend listens on http://localhost:5173
# /api/* requests are proxied to the backend
```

### 5. Verify

- Open http://localhost:5173 — page should show "Backend: ✓ connected"
- `curl http://localhost:8080/api/health` should return `{"status":"UP"}`

## Running tests

### Backend

```bash
cd backend
./mvnw verify
# Requires Docker (Testcontainers pulls postgres:16-alpine)
```

### Frontend

```bash
cd frontend
npm test
```

## Environment variables

See `.env.example` for all supported variables.
