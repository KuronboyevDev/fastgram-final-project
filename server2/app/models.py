"""
SQLAlchemy models for Server 2 (the analytics / content-discovery database).

Server 2 does NOT own the social data — Server 1 does. These tables are a
lightweight MIRROR kept in sync via the /internal/* REST endpoints that
Server 1 calls whenever something changes. This lets Explore and analytics
run as a fully independent microservice with its own PostgreSQL database.
"""
from sqlalchemy import Column, Integer, String, DateTime, ARRAY, UniqueConstraint
from sqlalchemy.sql import func
from .database import Base


class UserMirror(Base):
    __tablename__ = "user_mirror"

    id = Column(Integer, primary_key=True)  # same id as Server 1 user
    username = Column(String, index=True)
    full_name = Column(String, default="")
    avatar_url = Column(String, default="")


class ContentIndex(Base):
    """A copy of each post, used to build the Explore feed & trending."""
    __tablename__ = "content_index"

    id = Column(Integer, primary_key=True)  # same id as Server 1 post
    author_id = Column(Integer, index=True)
    author_username = Column(String, default="")
    caption = Column(String, default="")
    media_url = Column(String, default="")
    media_type = Column(String, default="image")  # "image" | "video"
    hashtags = Column(ARRAY(String), default=list)
    like_count = Column(Integer, default=0)
    view_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SocialEdge(Base):
    """A copy of the follow graph, so Explore can prioritise your network."""
    __tablename__ = "social_edge"

    id = Column(Integer, primary_key=True, autoincrement=True)
    follower_id = Column(Integer, index=True)
    following_id = Column(Integer, index=True)

    __table_args__ = (
        UniqueConstraint("follower_id", "following_id", name="uq_edge"),
    )
