"""
Test ingestion using API endpoint instead of direct database access.

Usage:
    poetry run python scripts/test_ingestion_api.py <path_to_pdf>
"""
import requests
import sys
import os

def test_ingestion_via_api(pdf_path: str, base_url: str = "http://localhost:8000"):
    """Test ingestion via HTTP API."""
    
    if not os.path.exists(pdf_path):
        print(f"❌ ERROR: File not found: {pdf_path}")
        return False
    
    print("=" * 70)
    print("📚 INGESTION PIPELINE TEST (via API)")
    print("=" * 70)
    print(f"\n📄 PDF File: {pdf_path}\n")
    
    # Step 1: Create test organization via direct database (skip for now)
    # We'll use API endpoint which should handle this
    
    print("Step 1: Testing ingestion endpoint...")
    print("-" * 70)
    
    # Prepare the request
    with open(pdf_path, 'rb') as f:
        files = {'file': (os.path.basename(pdf_path), f, 'application/pdf')}
        
        data = {
            'course_id': 'test-course-id-123',  # Will need to create course first via API
            'title': 'AI Agents - Session Deck',
            'content_type': 'slide',
            'session_id': 'module_5',
            'assignment_allowed': 'true'
        }
        
        print(f"\n📤 Uploading to {base_url}/api/v1/ingestion/ingest...")
        
        try:
            response = requests.post(
                f"{base_url}/api/v1/ingestion/ingest",
                files=files,
                data=data,
                timeout=120  # 2 minutes for large files
            )
            
            print(f"\n📊 Response Status: {response.status_code}")
            print(f"📊 Response:\n{response.text}\n")
            
            if response.status_code == 200:
                result = response.json()
                print("✅ SUCCESS! Ingestion completed")
                print("\n📈 Metrics:")
                print(f"  • Document ID: {result.get('document_id')}")
                print(f"  • Slides Extracted: {result.get('slides_extracted')}")
                print(f"  • Chunks Created: {result.get('chunks_created')}")
                print(f"  • Embeddings Generated: {result.get('embeddings_generated')}")
                print(f"  • Total Characters: {result.get('total_characters')}")
                return True
            else:
                print(f"❌ FAILED with status {response.status_code}")
                return False
                
        except requests.exceptions.Timeout:
            print("⏱️  Request timed out - file might be too large or service slow")
            return False
        except requests.exceptions.ConnectionError:
            print("❌ Connection error - is the server running?")
            print("   Start with: make run")
            return False
        except Exception as e:
            print(f"❌ ERROR: {str(e)}")
            import traceback
            traceback.print_exc()
            return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: poetry run python scripts/test_ingestion_api.py <path_to_pdf>")
        print("Example: poetry run python scripts/test_ingestion_api.py ./docs/slides.pdf")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    success = test_ingestion_via_api(pdf_path)
    
    if success:
        print("\n" + "=" * 70)
        print("✅ INGESTION TEST PASSED")
        print("=" * 70)
        sys.exit(0)
    else:
        print("\n" + "=" * 70)
        print("❌ INGESTION TEST FAILED")
        print("=" * 70)
        sys.exit(1)
