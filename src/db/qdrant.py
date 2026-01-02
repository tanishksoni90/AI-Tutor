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
        self.vector_size = settings.EMBEDDING_DIM

    def ensure_collection_exists(self):
        """
        Checks if the collection exists. If not, creates it with the correct schema.
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
                logger.info(f"Collection {self.collection_name} already exists.")
                
        except Exception as e:
            logger.error(f"Failed to initialize Qdrant: {str(e)}")
            raise e

    def get_client(self) -> QdrantClient:
        return self.client

# Singleton instance
qdrant_client = VectorDBClient()
