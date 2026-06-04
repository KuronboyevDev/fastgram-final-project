// Home feed: posts from people you follow (+ your own), newest first.
// Cached in Redis per-user for a short time to demonstrate caching.
const express = require("express");
const prisma = require("../lib/prisma");
const redis = require("../lib/redis");
const { requireAuth } = require("../middleware/auth");
const { publicPost } = require("../lib/helpers");

const router = express.Router();
const FEED_TTL_SECONDS = 30;

// GET /api/feed
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const cacheKey = `feed:${req.userId}`;

    // 1) Try cache first.
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json({ posts: JSON.parse(cached), cached: true });
    }

    // 2) Cache miss -> query PostgreSQL.
    const following = await prisma.follow.findMany({
      where: { followerId: req.userId },
      select: { followingId: true },
    });
    const authorIds = [req.userId, ...following.map((f) => f.followingId)];

    const posts = await prisma.post.findMany({
      where: { authorId: { in: authorIds } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        author: true,
        _count: { select: { likes: true, comments: true } },
        likes: { where: { userId: req.userId } },
      },
    });

    const shaped = posts.map((p) => publicPost(p, req.userId));

    // 3) Store in cache for next time.
    await redis.set(cacheKey, JSON.stringify(shaped), "EX", FEED_TTL_SECONDS);

    res.json({ posts: shaped, cached: false });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
