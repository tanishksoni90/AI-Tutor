"""
Test local E5-large-v2 embeddings.

Usage:
    poetry run python scripts/test_local_embeddings.py
"""
import asyncio
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from src.services.embeddings import get_embedding_service


async def main():
    print("=" * 70)
    print("Testing Local Embedding Service (E5-large-v2)")
    print("=" * 70)
    
    # Get the embedding service (will auto-select local since no API key)
    service = get_embedding_service()
    
    print(f"\nModel: {service.model_name}")
    print(f"Dimensions: {service.dimensions}")
    
    # Test single embedding
    print("\n1. Testing single text embedding...")
    text = "AI agents can automate repetitive tasks and improve productivity."
    result = await service.embed_text(text)
    print(f"   ✓ Text: {text[:50]}...")
    print(f"   ✓ Vector length: {len(result.vector)}")
    print(f"   ✓ First 5 values: {result.vector[:5]}")
    
    # Test batch embedding
    print("\n2. Testing batch embedding...")
    texts = [
        "Machine learning models require large amounts of training data.",
        "Natural language processing enables computers to understand human language.",
        "Deep learning uses neural networks with multiple layers.",
        "Embeddings represent text as dense vectors in high-dimensional space."
    ]
    results = await service.embed_batch(texts)
    print(f"   ✓ Batch size: {len(results)}")
    for i, result in enumerate(results, 1):
        print(f"   ✓ Text {i}: {result.text[:40]}... → {len(result.vector)}-dim vector")
    
    # Test similarity
    print("\n3. Testing semantic similarity...")
    import numpy as np
    
    query = await service.embed_text("What are AI agents?")
    doc1 = await service.embed_text("AI agents are autonomous systems that can perform tasks.")
    doc2 = await service.embed_text("The weather is sunny today.")
    
    def cosine_similarity(v1, v2):
        norm_v1 = np.linalg.norm(v1)
        norm_v2 = np.linalg.norm(v2)
        if norm_v1 <= 1e-10 or norm_v2 <= 1e-10:
            return 0.0
        return np.dot(v1, v2) / (norm_v1 * norm_v2)
    
    sim1 = cosine_similarity(query.vector, doc1.vector)
    sim2 = cosine_similarity(query.vector, doc2.vector)
    
    print(f"   Query: 'What are AI agents?'")
    print(f"   ✓ Similarity with 'AI agents are...' = {sim1:.4f}")
    print(f"   ✓ Similarity with 'The weather is...' = {sim2:.4f}")
    print(f"   ✓ Correctly ranks relevant document higher: {sim1 > sim2}")
    
    print("\n" + "=" * 70)
    print("✅ Local Embeddings Working!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
