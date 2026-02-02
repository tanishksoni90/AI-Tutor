from qdrant_client import QdrantClient
from qdrant_client.http import models
from src.core.config import settings
import logging

logger = logging.getLogger(__name__)

class VectorDBClient:
    def __init__(self):
        self.client = QdrantClient(
            host=settings.QDRANT_HOST,
            port=settings.QDRANT_PORT
        )
        self.collection_name = settings.QDRANT_COLLECTION_NAME
        # Auto-select dimension based on embedding mode
        use_local = settings.USE_LOCAL_EMBEDDINGS or not settings.GEMINI_API_KEY
        self.vector_size = settings.LOCAL_EMBEDDING_DIM if use_local else settings.EMBEDDING_DIM
        logger.info(f"VectorDBClient initialized: collection={self.collection_name}, dims={self.vector_size}")

    def ensure_collection_exists(self):
        """
        Checks if the collection exists. If not, creates it with the correct schema.
        If the collection exists, validates that the vector dimension matches.
        """
        try:
            collections = self.client.get_collections()
            exists = any(c.name == self.collection_name for c in collections.collections)

            if not exists:
                logger.info(f"Creating Qdrant collection: {self.collection_name}")
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=models.VectorParams(
                        size=self.vector_size,
                        distance=models.Distance.COSINE
                    )
                )
                
                # Create Payload Index for filtering by course_id (CRITICAL for Multi-tenancy)
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="course_id",
                    field_schema=models.PayloadSchemaType.KEYWORD
                )
                
                # Create Payload Index for assignment safety
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="assignment_allowed",
                    field_schema=models.PayloadSchemaType.BOOL
                )
                
                # Create Payload Index for session filtering
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="session_id",
                    field_schema=models.PayloadSchemaType.KEYWORD
                )
                
                # Create Payload Index for slide number (ordering/filtering)
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="slide_number",
                    field_schema=models.PayloadSchemaType.INTEGER
                )
                
                logger.info("Collection and indexes created successfully.")
            else:
                # Collection exists - validate vector dimension matches
                collection_info = self.client.get_collection(self.collection_name)
                existing_vector_size = collection_info.config.params.vectors.size
                
                if existing_vector_size != self.vector_size:
                    error_msg = (
                        f"Vector dimension mismatch for collection '{self.collection_name}': "
                        f"existing collection has {existing_vector_size} dimensions, "
                        f"but current configuration expects {self.vector_size} dimensions. "
                        f"This can occur when switching between embedding models. "
                        f"Please delete the existing collection or update the embedding configuration."
                    )
                    logger.error(error_msg)
                    raise ValueError(error_msg)
                
                logger.info(f"Collection {self.collection_name} already exists with matching vector size ({self.vector_size}).")
                
        except Exception as e:
            logger.error(f"Failed to initialize Qdrant: {str(e)}")
            raise e

    def get_client(self) -> QdrantClient:
        return self.client

# Singleton instance
qdrant_client = VectorDBClient()
