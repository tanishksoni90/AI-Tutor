import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from src.db.qdrant import qdrant_client

if __name__ == "__main__":
    print("Initializing Qdrant...")
    qdrant_client.ensure_collection_exists()
    print("Done.")