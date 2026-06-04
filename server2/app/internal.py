"""
Internal REST endpoints — the RECEIVING end of the microservice link.

Server 1 calls these (fire-and-forget) whenever core data changes, so Server 2
can keep its analytics/discovery mirror up to date:

    Server 1                         Server 2 (here)
    --------                         ----------------
    user registers / seeded   ──▶    POST /internal/users
    post created / seeded      ──▶    POST /internal/posts
    follow created / seeded    ──▶    POST /internal/follows

These are deliberately simple upserts and are not exposed through the gateway
to end users (they're service-to-service only).
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .database import get_session
from . import models

router = APIRouter(prefix="/internal", tags=["internal-sync"])


# ── Payload schemas ─────────────────────────────────────────────────
class UserIn(BaseModel):
    id: int
    username: str
    full_name: str = ""
    avatar_url: str = ""


class PostIn(BaseModel):
    id: int
    author_id: int
    author_username: str = ""
    caption: str = ""
    media_url: str = ""
    media_type: str = "image"
    hashtags: List[str] = []
    created_at: Optional[str] = None


class FollowIn(BaseModel):
    follower_id: int
    following_id: int


# ── Endpoints ───────────────────────────────────────────────────────
@router.post("/users")
def upsert_user(payload: UserIn, db: Session = Depends(get_session)):
    user = db.get(models.UserMirror, payload.id)
    if user is None:
        user = models.UserMirror(id=payload.id)
        db.add(user)
    user.username = payload.username
    user.full_name = payload.full_name
    user.avatar_url = payload.avatar_url
    db.commit()
    return {"ok": True, "user_id": payload.id}


@router.post("/posts")
def upsert_post(payload: PostIn, db: Session = Depends(get_session)):
    post = db.get(models.ContentIndex, payload.id)
    if post is None:
        post = models.ContentIndex(id=payload.id)
        db.add(post)
    post.author_id = payload.author_id
    post.author_username = payload.author_username
    post.caption = payload.caption
    post.media_url = payload.media_url
    post.media_type = payload.media_type
    post.hashtags = [h.lower() for h in (payload.hashtags or [])]
    if payload.created_at:
        try:
            post.created_at = datetime.fromisoformat(
                payload.created_at.replace("Z", "+00:00")
            )
        except ValueError:
            pass
    db.commit()
    return {"ok": True, "post_id": payload.id}


@router.post("/follows")
def upsert_follow(payload: FollowIn, db: Session = Depends(get_session)):
    exists = (
        db.query(models.SocialEdge)
        .filter_by(follower_id=payload.follower_id, following_id=payload.following_id)
        .first()
    )
    if not exists:
        db.add(
            models.SocialEdge(
                follower_id=payload.follower_id,
                following_id=payload.following_id,
            )
        )
        db.commit()
    return {"ok": True}
