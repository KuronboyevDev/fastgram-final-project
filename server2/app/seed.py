"""
Server 2 setup / seed.

Server 2's data is a MIRROR of Server 1, kept in sync over the /internal/*
endpoints. So "seeding" Server 2 just means creating its tables — the actual
content arrives when you run Server 1's seed (npm run seed) while THIS server
is running, and live as users post.

Run:  python -m app.seed
"""
from .database import init_db, SessionLocal
from . import models


def main():
    print("🌱 Server 2: creating analytics tables...")
    init_db()

    db = SessionLocal()
    try:
        users = db.query(models.UserMirror).count()
        posts = db.query(models.ContentIndex).count()
        edges = db.query(models.SocialEdge).count()
    finally:
        db.close()

    print("✅ Tables ready.")
    print(f"   Currently mirrored: {users} users, {posts} posts, {edges} follows.")
    if posts == 0:
        print(
            "\n   ℹ️  No content yet. Make sure THIS server is running, then run\n"
            "      Server 1's seed:  cd server1 && npm run seed\n"
            "      That will populate both databases via microservice sync."
        )


if __name__ == "__main__":
    main()
