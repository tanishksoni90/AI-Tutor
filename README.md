# AI Tutor Backend

Multi-tenant, course-scoped AI Tutor API with RAG-based knowledge retrieval.

## Quick Start

### Development Mode (No Docker, No API Keys)

```bash
# Install dependencies
poetry install

# Setup SQLite test database
poetry run python scripts/setup_test_db.py

# Test with local embeddings (E5-large-v2, 1024-dim)
USE_LOCAL_EMBEDDINGS=true USE_SQLITE=true poetry run python scripts/test_ingestion.py <pdf>

# Start server
USE_LOCAL_EMBEDDINGS=true USE_SQLITE=true make run
```

### Production Mode (PostgreSQL + Gemini)

```bash
# Start services
docker-compose up -d

# Run migrations
poetry run alembic upgrade head

# Initialize Qdrant collection (1536-dim)
poetry run python scripts/init_qdrant.py

# Test ingestion
poetry run python scripts/test_ingestion.py <pdf>
```

## Configuration

### Environment Variables

```bash
# Database (default: PostgreSQL, set USE_SQLITE=true for local testing)
USE_SQLITE=false
POSTGRES_SERVER=localhost
POSTGRES_DB=aitutor

# Embeddings (auto-selects local if no API key)
USE_LOCAL_EMBEDDINGS=false  # Set to true to force local model
GEMINI_API_KEY=your-api-key  # Leave empty to auto-use local model

# Local: E5-large-v2 (1024-dim, no API key)
# Production: Gemini (1536-dim, requires API key)
```

See [docs/EMBEDDING_CONFIG.md](docs/EMBEDDING_CONFIG.md) for detailed embedding configuration.

## Development

```bash
# Run server
make run

# Test local embeddings
USE_LOCAL_EMBEDDINGS=true poetry run python scripts/test_local_embeddings.py

# Test ingestion
poetry run python scripts/test_ingestion.py <path_to_pdf>
```

