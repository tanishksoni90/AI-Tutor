from fastapi import FastAPI
from src.core.config import settings
from src.api.v1.auth import router as auth_router
from src.api.v1.tutor import router as tutor_router
from src.api.v1.ingestion import router as ingestion_router

def create_application() -> FastAPI:
    application = FastAPI(
        title=settings.PROJECT_NAME,
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        docs_url=f"{settings.API_V1_STR}/docs",
    )

    application.include_router(auth_router, prefix=settings.API_V1_STR)
    application.include_router(tutor_router, prefix=settings.API_V1_STR)
    application.include_router(ingestion_router, prefix=settings.API_V1_STR)

    @application.get("/health")
    async def health_check():
        return {
            "status": "ok",
            "project": settings.PROJECT_NAME,
            "mode": settings.ENV_MODE
        }

    return application

app = create_application()