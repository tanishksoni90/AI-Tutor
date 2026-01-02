# AI Tutor Backend

Multi-tenant, course-scoped AI Tutor API with RAG-based knowledge retrieval.

## Setup

```bash
# Install dependencies
poetry install

# Start services
docker-compose up -d

# Run migrations
poetry run alembic upgrade head

# Initialize Qdrant collection
poetry run python scripts/init_qdrant.py
```

## Configuration

Copy `.env.example` to `.env` and configure:
- `GEMINI_API_KEY` - Your Gemini API key

## Development

```bash
# Run server
make run

# Test ingestion
poetry run python scripts/test_ingestion.py <path_to_pdf>
```

