# Embedding Configuration Guide

## Overview

The AI-Tutor supports two embedding modes:
- **Production**: Google Gemini `gemini-embedding-001` (3072 dimensions by default; can be reduced to 1536 using `output_dimensionality` parameter)
- **Development**: E5-large-v2 local model (1024 dimensions)

## Configuration

### Environment Variables

```bash
# Production (requires API key)
GEMINI_API_KEY=your-api-key-here
EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_DIM=3072  # Default for gemini-embedding-001; set to 1536 if using output_dimensionality

# Development (local, no API key needed)
USE_LOCAL_EMBEDDINGS=true
LOCAL_EMBEDDING_MODEL=intfloat/e5-large-v2
LOCAL_EMBEDDING_DIM=1024
```

### Auto-Selection Logic

The system automatically selects the embedding model:
- If `USE_LOCAL_EMBEDDINGS=true` → Uses E5-large-v2 (local)
- If `GEMINI_API_KEY` is empty → Uses E5-large-v2 (local)
- Otherwise → Uses Gemini (production)

## Usage

### Development Mode (Local E5 Model)

```bash
# Test local embeddings
USE_LOCAL_EMBEDDINGS=true poetry run python scripts/test_local_embeddings.py

# Run ingestion with local embeddings (no Qdrant needed)
USE_QDRANT=false USE_LOCAL_EMBEDDINGS=true USE_SQLITE=true poetry run python scripts/test_ingestion.py <pdf>

# Start server with local embeddings
USE_QDRANT=false USE_LOCAL_EMBEDDINGS=true USE_SQLITE=true poetry run uvicorn src.main:app --reload
```

### Production Mode (Gemini)

```bash
# Requires GEMINI_API_KEY in .env file

# Run ingestion with Gemini
poetry run python scripts/test_ingestion.py <pdf>

# Start server with Gemini
make run
```

## Qdrant Collection Setup

The Qdrant collection dimension **must match** the embedding dimension:

```bash
# For development (1024-dim)
USE_LOCAL_EMBEDDINGS=true poetry run python scripts/init_qdrant.py

# For production (3072-dim)
poetry run python scripts/init_qdrant.py
```

**Important**: Delete and recreate the collection when switching between modes:
```bash
# First, find your Qdrant container name:
docker ps

# Then delete the collection (replace CONTAINER_NAME with your actual container name):
docker exec -it CONTAINER_NAME qdrant-cli collection delete course_knowledge
```

## Model Comparison

| Feature | Gemini | E5-large-v2 |
|---------|--------|-------------|
| Dimensions | 3072 (customizable via `output_dimensionality`) | 1024 |
| API Required | Yes | No |
| Cost | Pay per use | Free |
| Speed | Network dependent | Local (faster) |
| Quality | Excellent | Very good |
| Use Case | Production | Development/Testing |

## Testing

Verify embeddings work:

```bash
# Test local model
USE_LOCAL_EMBEDDINGS=true poetry run python scripts/test_local_embeddings.py

# Test Gemini model (requires API key)
poetry run python scripts/test_local_embeddings.py
```

Expected output:
- Single embedding: 1024-dim (local) or 1536-dim (Gemini)
- Batch embeddings: Same dimension for all
- Semantic similarity: Higher for related texts

## Troubleshooting

### Model Download (First Time)

The E5-large-v2 model (1.34GB) downloads automatically on first use:
```
model.safetensors: 100%|███████| 1.34G/1.34G [01:16<00:00, 17.6MB/s]
```

This is cached locally in `~/.cache/torch/sentence_transformers/`

### Dimension Mismatch

Error: `Qdrant vector dimension mismatch`

Solution: Recreate Qdrant collection with correct dimension:
```bash
USE_LOCAL_EMBEDDINGS=true poetry run python scripts/init_qdrant.py
```

### API Key Issues

Error: `GEMINI_API_KEY not set`

Solution: Add to `.env` file or use local embeddings:
```bash
USE_LOCAL_EMBEDDINGS=true
```

## Recommendations

### For Local Development
- Use `USE_LOCAL_EMBEDDINGS=true` + `USE_SQLITE=true`
- No Docker needed except Qdrant (optional)
- Fast iteration, no API costs

### For Production
- Use Gemini with PostgreSQL
- Set `GEMINI_API_KEY` in `.env`
- Better quality, 3072 dimensions by default

### For Testing
- Use local embeddings for unit tests
- Mock embedding service for integration tests
- Use Gemini for end-to-end production tests

## Notes on Gemini Embedding Dimensions

The `gemini-embedding-001` model produces 3072-dimensional embeddings by default. If you need smaller embeddings (e.g., 1536 dimensions), you can use the `output_dimensionality` parameter when calling the API:

```python
# Example: Request 1536 dimensions instead of 3072
result = genai.embed_content(
    model="models/gemini-embedding-001",
    content="Your text here",
    output_dimensionality=1536  # Optional: reduce from default 3072
)
```

When using reduced dimensions, ensure your `EMBEDDING_DIM` config and Qdrant collection are configured to match.
