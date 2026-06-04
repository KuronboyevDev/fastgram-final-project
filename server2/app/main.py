"""
FastGram Server 2 entry point.

FastAPI app that serves:
  • POST /graphql      — the GraphQL API (content discovery + analytics)
  • GET  /graphql      — GraphiQL playground (open in a browser to explore)
  • /internal/*        — service-to-service sync endpoints (called by Server 1)
  • GET  /health       — health check
"""
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from strawberry.fastapi import GraphQLRouter

from .database import init_db
from .schema import schema
from .internal import router as internal_router

load_dotenv()

app = FastAPI(title="FastGram Server 2", description="GraphQL content & analytics service")

CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()
    print("✅ Server 2 (GraphQL) ready — playground at http://localhost:8000/graphql")


@app.get("/health")
def health():
    return {"service": "server2", "status": "ok"}


# GraphQL endpoint (GraphiQL playground enabled for easy exploration).
graphql_app = GraphQLRouter(schema, graphiql=True)
app.include_router(graphql_app, prefix="/graphql")

# Internal microservice sync endpoints.
app.include_router(internal_router)
