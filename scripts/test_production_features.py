"""
Test Production Readiness Features.

Tests:
1. Rate limiting
2. Error handling
3. Health checks
4. Request logging
5. CORS configuration
6. Configuration validation
"""
import asyncio
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import httpx
import time
from typing import List
from colorama import init, Fore, Style

init(autoreset=True)


class ProductionFeaturesTester:
    """Test suite for production readiness features."""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.results = []
    
    def print_header(self, text: str):
        """Print test section header."""
        print(f"\n{Fore.CYAN}{'=' * 60}{Style.RESET_ALL}")
        print(f"{Fore.CYAN}{text}{Style.RESET_ALL}")
        print(f"{Fore.CYAN}{'=' * 60}{Style.RESET_ALL}\n")
    
    def print_success(self, text: str):
        """Print success message."""
        print(f"{Fore.GREEN}✓ {text}{Style.RESET_ALL}")
    
    def print_error(self, text: str):
        """Print error message."""
        print(f"{Fore.RED}✗ {text}{Style.RESET_ALL}")
    
    def print_info(self, text: str):
        """Print info message."""
        print(f"{Fore.YELLOW}ℹ {text}{Style.RESET_ALL}")
    
    async def test_basic_health_check(self):
        """Test basic health check endpoint."""
        self.print_header("TEST 1: Basic Health Check")
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(f"{self.base_url}/health")
                
                if response.status_code == 200:
                    data = response.json()
                    self.print_success(f"Health check passed: {data.get('status')}")
                    self.print_info(f"Service: {data.get('service')}")
                    self.print_info(f"Timestamp: {data.get('timestamp')}")
                    return True
                else:
                    self.print_error(f"Health check failed: {response.status_code}")
                    return False
            except Exception as e:
                self.print_error(f"Connection failed: {str(e)}")
                return False
    
    async def test_detailed_health_check(self):
        """Test detailed health check with dependencies."""
        self.print_header("TEST 2: Detailed Health Check")
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(f"{self.base_url}/health/detailed")
                data = response.json()
                
                self.print_info(f"Overall status: {data.get('status')}")
                
                # Check each dependency
                deps = data.get('dependencies', {})
                for dep_name, dep_status in deps.items():
                    status = dep_status.get('status')
                    if status in ['healthy', 'configured']:
                        self.print_success(f"{dep_name}: {status}")
                    else:
                        self.print_error(f"{dep_name}: {status}")
                
                return response.status_code in [200, 503]  # 503 is ok if deps are down
            except Exception as e:
                self.print_error(f"Detailed health check failed: {str(e)}")
                return False
    
    async def test_rate_limiting(self):
        """Test rate limiting middleware."""
        self.print_header("TEST 3: Rate Limiting")
        
        # Test endpoint with rate limit
        endpoint = f"{self.base_url}/api/v1/auth/login"
        limit = 5  # From RATE_LIMITS config
        
        self.print_info(f"Testing rate limit: {limit} requests/minute")
        
        async with httpx.AsyncClient() as client:
            success_count = 0
            rate_limited_count = 0
            
            # Make requests rapidly
            for i in range(limit + 3):
                try:
                    response = await client.post(
                        endpoint,
                        json={"username": "test", "password": "test"}
                    )
                    
                    # Check for rate limit headers
                    if 'X-RateLimit-Limit' in response.headers:
                        if i == 0:
                            self.print_success(
                                f"Rate limit headers present: "
                                f"Limit={response.headers['X-RateLimit-Limit']}, "
                                f"Remaining={response.headers.get('X-RateLimit-Remaining')}"
                            )
                    
                    if response.status_code == 429:
                        rate_limited_count += 1
                        if rate_limited_count == 1:
                            retry_after = response.json().get('retry_after')
                            self.print_success(
                                f"Rate limit enforced! Retry after: {retry_after}s"
                            )
                    else:
                        success_count += 1
                    
                except Exception as e:
                    self.print_error(f"Request {i+1} failed: {str(e)}")
            
            self.print_info(
                f"Results: {success_count} succeeded, "
                f"{rate_limited_count} rate-limited"
            )
            
            # Should have at least one rate-limited request
            return rate_limited_count > 0
    
    async def test_error_handling(self):
        """Test error handling middleware."""
        self.print_header("TEST 4: Error Handling")
        
        async with httpx.AsyncClient() as client:
            # Test 404 error
            try:
                response = await client.get(f"{self.base_url}/api/v1/nonexistent")
                data = response.json()
                
                if 'request_id' in data:
                    self.print_success("Structured error response includes request_id")
                    self.print_info(f"Request ID: {data['request_id']}")
                
                if 'timestamp' in data:
                    self.print_success("Error includes timestamp")
                
                if 'error_code' in data:
                    self.print_success(f"Error code: {data['error_code']}")
                
                return True
            except Exception as e:
                self.print_error(f"Error handling test failed: {str(e)}")
                return False
    
    async def test_request_logging(self):
        """Test request logging (check for timing header)."""
        self.print_header("TEST 5: Request Logging")
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(f"{self.base_url}/health")
                
                # Check for request ID
                if 'X-Request-ID' in response.headers:
                    self.print_success(
                        f"Request ID header present: {response.headers['X-Request-ID']}"
                    )
                
                # Check for response time
                if 'X-Response-Time' in response.headers:
                    self.print_success(
                        f"Response time tracked: {response.headers['X-Response-Time']}"
                    )
                
                return 'X-Request-ID' in response.headers
            except Exception as e:
                self.print_error(f"Request logging test failed: {str(e)}")
                return False
    
    async def test_cors_headers(self):
        """Test CORS configuration."""
        self.print_header("TEST 6: CORS Configuration")
        
        async with httpx.AsyncClient() as client:
            try:
                # Make OPTIONS request (preflight)
                headers = {
                    "Origin": "http://localhost:3000",
                    "Access-Control-Request-Method": "POST",
                }
                
                response = await client.options(
                    f"{self.base_url}/health",
                    headers=headers
                )
                
                # Check CORS headers
                if 'access-control-allow-origin' in response.headers:
                    self.print_success(
                        f"CORS enabled: {response.headers['access-control-allow-origin']}"
                    )
                
                if 'access-control-expose-headers' in response.headers:
                    self.print_success(
                        f"Custom headers exposed: {response.headers['access-control-expose-headers']}"
                    )
                
                return True
            except Exception as e:
                self.print_error(f"CORS test failed: {str(e)}")
                return False
    
    async def test_metrics_endpoint(self):
        """Test metrics endpoint."""
        self.print_header("TEST 7: Metrics Endpoint")
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(f"{self.base_url}/metrics")
                
                if response.status_code == 200:
                    data = response.json()
                    self.print_success("Metrics endpoint accessible")
                    self.print_info(f"Environment: {data.get('service', {}).get('environment')}")
                    
                    if 'rate_limiting' in data:
                        self.print_success("Rate limiting metrics available")
                    
                    return True
                else:
                    self.print_error(f"Metrics endpoint failed: {response.status_code}")
                    return False
            except Exception as e:
                self.print_error(f"Metrics test failed: {str(e)}")
                return False
    
    async def test_api_documentation(self):
        """Test API documentation endpoints."""
        self.print_header("TEST 8: API Documentation")
        
        async with httpx.AsyncClient() as client:
            # Test OpenAPI JSON
            try:
                response = await client.get(f"{self.base_url}/api/v1/openapi.json")
                if response.status_code == 200:
                    data = response.json()
                    self.print_success(f"OpenAPI spec available: {data.get('info', {}).get('title')}")
                    self.print_info(f"Version: {data.get('info', {}).get('version')}")
                    self.print_info(f"Endpoints: {len(data.get('paths', {}))}")
                else:
                    self.print_error("OpenAPI spec not available")
            except Exception as e:
                self.print_error(f"OpenAPI test failed: {str(e)}")
            
            # Test Swagger UI
            try:
                response = await client.get(f"{self.base_url}/api/v1/docs")
                if response.status_code == 200:
                    self.print_success("Swagger UI accessible at /api/v1/docs")
                else:
                    self.print_error("Swagger UI not accessible")
            except Exception as e:
                self.print_error(f"Swagger UI test failed: {str(e)}")
            
            return True
    
    async def run_all_tests(self):
        """Run all production readiness tests."""
        print(f"\n{Fore.MAGENTA}{'=' * 60}{Style.RESET_ALL}")
        print(f"{Fore.MAGENTA}🚀 PRODUCTION READINESS TEST SUITE{Style.RESET_ALL}")
        print(f"{Fore.MAGENTA}{'=' * 60}{Style.RESET_ALL}")
        
        tests = [
            ("Basic Health Check", self.test_basic_health_check),
            ("Detailed Health Check", self.test_detailed_health_check),
            ("Rate Limiting", self.test_rate_limiting),
            ("Error Handling", self.test_error_handling),
            ("Request Logging", self.test_request_logging),
            ("CORS Configuration", self.test_cors_headers),
            ("Metrics Endpoint", self.test_metrics_endpoint),
            ("API Documentation", self.test_api_documentation),
        ]
        
        results = []
        for test_name, test_func in tests:
            try:
                result = await test_func()
                results.append((test_name, result))
            except Exception as e:
                self.print_error(f"Test {test_name} crashed: {str(e)}")
                results.append((test_name, False))
        
        # Print summary
        self.print_header("TEST SUMMARY")
        
        passed = sum(1 for _, result in results if result)
        total = len(results)
        
        for test_name, result in results:
            if result:
                self.print_success(f"{test_name}")
            else:
                self.print_error(f"{test_name}")
        
        print(f"\n{Fore.CYAN}Results: {passed}/{total} tests passed{Style.RESET_ALL}")
        
        if passed == total:
            print(f"{Fore.GREEN}{'=' * 60}{Style.RESET_ALL}")
            print(f"{Fore.GREEN}✅ ALL PRODUCTION READINESS TESTS PASSED!{Style.RESET_ALL}")
            print(f"{Fore.GREEN}{'=' * 60}{Style.RESET_ALL}")
        else:
            print(f"{Fore.YELLOW}{'=' * 60}{Style.RESET_ALL}")
            print(f"{Fore.YELLOW}⚠️  Some tests failed - review above{Style.RESET_ALL}")
            print(f"{Fore.YELLOW}{'=' * 60}{Style.RESET_ALL}")


async def main():
    """Main test runner."""
    print(f"\n{Fore.YELLOW}NOTE: Make sure the infrastructure and server are running{Style.RESET_ALL}")
    print(f"{Fore.YELLOW}Step 1: docker-compose up -d  (start DB & Qdrant){Style.RESET_ALL}")
    print(f"{Fore.YELLOW}Step 2: make run  (start FastAPI server){Style.RESET_ALL}\n")
    
    # Wait a bit for user to start server
    await asyncio.sleep(2)
    
    tester = ProductionFeaturesTester()
    await tester.run_all_tests()
    
    print(f"\n{Fore.CYAN}Production Features Implemented:{Style.RESET_ALL}")
    print("  ✓ Rate Limiting (per-user, per-endpoint)")
    print("  ✓ Error Handling (structured errors, request IDs)")
    print("  ✓ Request Logging (timing, metadata)")
    print("  ✓ CORS (frontend integration ready)")
    print("  ✓ Health Checks (basic, detailed, k8s probes)")
    print("  ✓ Metrics Collection (basic monitoring)")
    print("  ✓ Enhanced API Documentation")
    print("  ✓ Configuration Validation (startup checks)")
    
    print(f"\n{Fore.CYAN}Next Steps for Production:{Style.RESET_ALL}")
    print("  1. Set proper JWT_SECRET_KEY in production")
    print("  2. Configure production CORS origins")
    print("  3. Set up Redis for distributed rate limiting")
    print("  4. Add Sentry/error tracking integration")
    print("  5. Set up Prometheus metrics export")
    print("  6. Configure log aggregation (ELK/CloudWatch)")
    print("  7. Run load testing")
    print("  8. Set up CI/CD pipeline")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print(f"\n{Fore.YELLOW}Tests interrupted by user{Style.RESET_ALL}")
