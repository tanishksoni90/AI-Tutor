# Production Setup Guide

## Quick Start

### 1. Start Infrastructure (PostgreSQL + Qdrant)
```bash
docker-compose up -d
```

### 2. Install Dependencies
```bash
make install
```

### 3. Run Database Migrations
```bash
poetry run alembic upgrade head
```

### 4. Start the Server
```bash
make run
```

### 5. Test Production Features
```bash
poetry run python scripts/test_production_features.py
```

## What's Been Implemented

### ✅ Production Readiness Features

1. **Rate Limiting** ([src/middleware/rate_limiting.py](src/middleware/rate_limiting.py))
   - Per-user rate limiting (authenticated)
   - Per-IP rate limiting (unauthenticated)
   - Configurable limits per endpoint:
     - Tutor queries: 60/min
     - Ingestion: 10/hour
     - Auth: 5/min
   - Returns `429 Too Many Requests` with retry-after
   - Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`
   
   ⚠️ **Production Warning**: The current implementation uses in-memory storage (see `RateLimiter` class in `src/middleware/rate_limiting.py`) which is **single-instance only**. For multi-instance or high-availability production deployments, switch to a Redis-backed rate limiter to share state across instances. The in-memory approach will not enforce limits correctly when running multiple server instances behind a load balancer.

2. **Error Handling** ([src/middleware/error_handling.py](src/middleware/error_handling.py))
   - Structured error responses
   - Request ID tracking (`X-Request-ID`)
   - Environment-aware error details (verbose in dev, minimal in prod)
   - Custom exception classes
   - Automatic error logging with context

3. **Request Logging** ([src/middleware/logging.py](src/middleware/logging.py))
   - All requests logged with timing
   - Structured logging (JSON-ready)
   - Performance monitoring (warnings for slow requests >5s)
   - Client IP tracking (proxy-aware)
   - Response time header (`X-Response-Time`)

4. **CORS Configuration** ([src/middleware/cors.py](src/middleware/cors.py))
   - Environment-aware (strict in prod, permissive in dev)
   - Exposes custom headers to frontend
   - Credential support enabled
   - Production whitelist ready

5. **Health Checks** ([src/api/v1/health.py](src/api/v1/health.py))
   - `/health` - Basic health (fast, for load balancers)
   - `/health/detailed` - Full dependency check (DB, Qdrant, Gemini)
   - `/health/ready` - Kubernetes readiness probe
   - `/health/live` - Kubernetes liveness probe
   - `/metrics` - Basic metrics endpoint

6. **Configuration Validation** ([src/core/validation.py](src/core/validation.py))
   - Startup validation (fail fast)
   - Required environment variables check
   - Security checks (JWT secret, etc.)
   - Embedding configuration validation

7. **Enhanced Documentation**
   - Comprehensive API descriptions
   - Rate limit documentation
   - Response header documentation
   - Contact and license info

## API Endpoints

### Health & Monitoring
- `GET /` - Service info
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health with dependencies
- `GET /health/ready` - Readiness probe (K8s)
- `GET /health/live` - Liveness probe (K8s)
- `GET /metrics` - Metrics endpoint

### Documentation
- `GET /api/v1/docs` - Swagger UI
- `GET /api/v1/redoc` - ReDoc UI
- `GET /api/v1/openapi.json` - OpenAPI spec

### Core API
- `POST /api/v1/auth/login` - Login (5 req/min)
- `POST /api/v1/auth/register` - Register (3 req/hour)
- `POST /api/v1/tutor/ask` - Ask question (60 req/min)
- `POST /api/v1/ingestion/ingest` - Ingest PDF (10 req/hour)

## Environment Variables

Required:
```bash
PROJECT_NAME=AI-Tutor-Backend
GEMINI_API_KEY=your-gemini-api-key

# Database
POSTGRES_SERVER=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=aitutor

# Qdrant
QDRANT_HOST=localhost
QDRANT_PORT=6333

# Security (CHANGE IN PRODUCTION!)
# Generate a secure key: openssl rand -hex 32
# Or use a secret manager (AWS Secrets Manager, HashiCorp Vault, etc.)
# NEVER commit real secrets to the repository!
JWT_SECRET_KEY=<generate-a-secure-key-or-read-from-secret-store>

# Environment
ENV_MODE=dev  # or 'prod'
```

## Production Checklist

### Before Deployment

- [ ] Set unique `JWT_SECRET_KEY` (not default!)
- [ ] Set `ENV_MODE=prod`
- [ ] Configure production CORS origins in `src/middleware/cors.py`
- [ ] Run database migrations: `alembic upgrade head`
- [ ] Set strong database password
- [ ] Configure Qdrant authentication (if exposed)
- [ ] Review rate limits for your use case
- [ ] Set up SSL/TLS certificates

### Infrastructure

- [ ] PostgreSQL 15+ with connection pooling
- [ ] Qdrant vector database (self-hosted or cloud)
- [ ] Redis for distributed rate limiting (recommended)
- [ ] Load balancer (nginx/AWS ALB/etc.)
- [ ] CDN for static assets (if any)

### Monitoring & Observability

- [ ] Error tracking (Sentry integration ready)
- [ ] Log aggregation (ELK stack, CloudWatch, etc.)
- [ ] Metrics collection (Prometheus integration ready)
- [ ] Uptime monitoring (health endpoints)
- [ ] APM (Application Performance Monitoring)

### Testing

- [ ] Unit tests
- [ ] Integration tests
- [ ] Load testing (k6, Locust, etc.)
- [ ] Security testing (OWASP checks)
- [ ] Production feature tests: `python scripts/test_production_features.py`

### CI/CD

- [ ] Automated testing pipeline
- [ ] Docker image building
- [ ] Automated deployments
- [ ] Database migration automation
- [ ] Rollback strategy

### Security

- [ ] API authentication enforced
- [ ] Rate limiting enabled (✓)
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (SQLAlchemy ✓)
- [ ] XSS protection
- [ ] CORS properly configured (✓)
- [ ] Secrets management (HashiCorp Vault, AWS Secrets Manager, etc.)
- [ ] Regular dependency updates

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Middleware Stack (order matters!)      │
│  1. CORS                                 │
│  2. Error Handling                       │
│  3. Request Logging                      │
│  4. Rate Limiting                        │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  FastAPI Application                     │
│  - Health Checks                         │
│  - Auth Routes                           │
│  - Tutor Routes (RAG)                    │
│  - Ingestion Routes                      │
└──────┬──────────────────────────────────┘
       │
       ├─────────────┬─────────────┐
       ▼             ▼             ▼
  ┌─────────┐  ┌─────────┐  ┌─────────┐
  │  Postgres │  │  Qdrant │  │  Gemini │
  │   (SQL)  │  │ (Vector)│  │   (AI)  │
  └─────────┘  └─────────┘  └─────────┘
```

## Next Steps for Production

### Immediate
1. Switch from in-memory rate limiting to Redis
2. Add Sentry for error tracking
3. Set up proper logging infrastructure
4. Configure production database with replicas

### Short-term
1. Add Prometheus metrics export
2. Set up CI/CD pipeline
3. Add comprehensive test suite
4. Performance testing and optimization
5. Security audit

### Long-term
1. Horizontal scaling setup
2. Multi-region deployment
3. Advanced monitoring dashboards
4. Cost optimization
5. A/B testing infrastructure

## Development Commands

```bash
# Start infrastructure
docker-compose up -d

# Install dependencies
make install

# Run migrations
poetry run alembic upgrade head

# Start server (development)
make run

# Test production features
poetry run python scripts/test_production_features.py

# Test Priority 2 features
poetry run python scripts/test_priority2_features.py

# Create admin user
poetry run python scripts/create_admin.py

# Clean cache
make clean

# Stop infrastructure
docker-compose down
```

## Troubleshooting

### Server won't start
- Check if PostgreSQL is running: `docker ps | grep postgres`
- Check if Qdrant is running: `docker ps | grep qdrant`
- Verify `.env` file has all required variables
- Check logs for configuration errors

### Rate limiting not working
- In-memory implementation is single-instance only
- For production, implement Redis-backed rate limiting
- Check rate limit headers in responses

### Health check fails
- Check individual dependency status in `/health/detailed`
- Verify database connection
- Verify Qdrant connection
- Ensure Gemini API key is set

### Tests failing
- Ensure server is running on port 8000
- Check infrastructure is up: `docker-compose ps`
- Verify migrations are applied: `alembic current`

## License

Proprietary - Adda247
