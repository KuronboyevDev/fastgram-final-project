"""
GraphQL schema for Server 2 (Strawberry).

This is the API:GraphQL box in the architecture. It powers:
  • explore          — content discovery (your network + random discovery mix)
  • trendingHashtags — most-used hashtags across the platform
  • userAnalytics    — per-user stats (posts, likes, followers, following)
  • postsByHashtag   — all posts for a given hashtag

It reads ONLY from Server 2's own analytics DB (kept in sync by Server 1).
"""
import random
from typing import List, Optional

import strawberry
from sqlalchemy import func

from .database import SessionLocal
from . import models


# ── GraphQL output types ────────────────────────────────────────────
@strawberry.type
class Post:
    id: int
    author_id: int
    author_username: str
    caption: str
    media_url: str
    media_type: str
    hashtags: List[str]
    like_count: int
    created_at: str


@strawberry.type
class HashtagStat:
    tag: str
    count: int


@strawberry.type
class UserAnalytics:
    user_id: int
    username: str
    post_count: int
    total_likes: int
    follower_count: int
    following_count: int


def _to_post(row: models.ContentIndex) -> Post:
    return Post(
        id=row.id,
        author_id=row.author_id,
        author_username=row.author_username or "",
        caption=row.caption or "",
        media_url=row.media_url or "",
        media_type=row.media_type or "image",
        hashtags=list(row.hashtags or []),
        like_count=row.like_count or 0,
        created_at=row.created_at.isoformat() if row.created_at else "",
    )


# ── Queries ─────────────────────────────────────────────────────────
@strawberry.type
class Query:
    @strawberry.field
    def explore(self, user_id: Optional[int] = None, limit: int = 24) -> List[Post]:
        """
        Content discovery feed.

        Strategy (NO machine learning — by design):
          1. Pull recent posts authored by people the user FOLLOWS (their network).
          2. Pull a random sample of posts from everyone else (discovery).
          3. Mix them (network first, then random) and shuffle lightly.
        If no user_id is given, just returns a random sample.
        """
        db = SessionLocal()
        try:
            network_posts: List[models.ContentIndex] = []
            network_ids = set()

            if user_id is not None:
                following = (
                    db.query(models.SocialEdge.following_id)
                    .filter(models.SocialEdge.follower_id == user_id)
                    .all()
                )
                following_ids = [f[0] for f in following]
                if following_ids:
                    network_posts = (
                        db.query(models.ContentIndex)
                        .filter(models.ContentIndex.author_id.in_(following_ids))
                        .order_by(models.ContentIndex.created_at.desc())
                        .limit(limit)
                        .all()
                    )
                    network_ids = {p.id for p in network_posts}

            # Random discovery sample (exclude network + the user's own posts).
            random_pool = (
                db.query(models.ContentIndex)
                .filter(~models.ContentIndex.id.in_(network_ids or {0}))
                .all()
            )
            if user_id is not None:
                random_pool = [p for p in random_pool if p.author_id != user_id]
            random.shuffle(random_pool)

            # Interleave: keep ~half network, fill the rest with random discovery.
            half = max(1, limit // 2)
            chosen = network_posts[:half] + random_pool[: (limit - len(network_posts[:half]))]
            random.shuffle(chosen)
            return [_to_post(p) for p in chosen[:limit]]
        finally:
            db.close()

    @strawberry.field
    def trending_hashtags(self, limit: int = 10) -> List[HashtagStat]:
        """Most-used hashtags across all indexed posts."""
        db = SessionLocal()
        try:
            counts: dict[str, int] = {}
            for (tags,) in db.query(models.ContentIndex.hashtags).all():
                for tag in tags or []:
                    counts[tag] = counts.get(tag, 0) + 1
            ranked = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)
            return [HashtagStat(tag=t, count=c) for t, c in ranked[:limit]]
        finally:
            db.close()

    @strawberry.field
    def posts_by_hashtag(self, tag: str, limit: int = 30) -> List[Post]:
        db = SessionLocal()
        try:
            rows = (
                db.query(models.ContentIndex)
                .filter(models.ContentIndex.hashtags.any(tag.lower()))
                .order_by(models.ContentIndex.created_at.desc())
                .limit(limit)
                .all()
            )
            return [_to_post(r) for r in rows]
        finally:
            db.close()

    @strawberry.field
    def user_analytics(self, user_id: int) -> UserAnalytics:
        db = SessionLocal()
        try:
            user = db.query(models.UserMirror).filter_by(id=user_id).first()
            post_count = (
                db.query(func.count(models.ContentIndex.id))
                .filter(models.ContentIndex.author_id == user_id)
                .scalar()
            )
            total_likes = (
                db.query(func.coalesce(func.sum(models.ContentIndex.like_count), 0))
                .filter(models.ContentIndex.author_id == user_id)
                .scalar()
            )
            follower_count = (
                db.query(func.count(models.SocialEdge.id))
                .filter(models.SocialEdge.following_id == user_id)
                .scalar()
            )
            following_count = (
                db.query(func.count(models.SocialEdge.id))
                .filter(models.SocialEdge.follower_id == user_id)
                .scalar()
            )
            return UserAnalytics(
                user_id=user_id,
                username=user.username if user else f"user{user_id}",
                post_count=post_count or 0,
                total_likes=int(total_likes or 0),
                follower_count=follower_count or 0,
                following_count=following_count or 0,
            )
        finally:
            db.close()


schema = strawberry.Schema(query=Query)
