// Post routes: create (with image/video upload), read, delete, like/unlike.
const express = require("express");
const fs = require("fs");
const path = require("path");
const prisma = require("../lib/prisma");
const redis = require("../lib/redis");
const { requireAuth } = require("../middleware/auth");
const { upload, mediaTypeOf, UPLOAD_DIR } = require("../middleware/upload");
const { parseHashtags, publicPost } = require("../lib/helpers");
const { notifyUser } = require("../socket");
const server2 = require("../lib/server2");

const router = express.Router();

const postInclude = (userId) => ({
  author: true,
  _count: { select: { likes: true, comments: true } },
  likes: { where: { userId } },
});

// POST /api/posts  (multipart/form-data: media + caption)
router.post("/", requireAuth, upload.single("media"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "A media file is required" });
    const caption = req.body.caption || "";

    const post = await prisma.post.create({
      data: {
        authorId: req.userId,
        caption,
        mediaUrl: `/uploads/${req.file.filename}`,
        mediaType: mediaTypeOf(req.file.mimetype),
        hashtags: parseHashtags(caption),
      },
      include: postInclude(req.userId),
    });

    // Invalidate cached feeds of everyone who follows me (their feed changed).
    await invalidateFollowerFeeds(req.userId);

    // Microservice sync: let Server 2 index this post for Explore.
    server2.indexPost(post);

    res.status(201).json({ post: publicPost(post, req.userId) });
  } catch (e) {
    next(e);
  }
});

// GET /api/posts/:id
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: Number(req.params.id) },
      include: postInclude(req.userId),
    });
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json({ post: publicPost(post, req.userId) });
  } catch (e) {
    next(e);
  }
});

// DELETE /api/posts/:id  (author only)
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: Number(req.params.id) } });
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (post.authorId !== req.userId)
      return res.status(403).json({ error: "Not your post" });

    await prisma.post.delete({ where: { id: post.id } });
    // best-effort delete the file from disk
    const filePath = path.join(UPLOAD_DIR, path.basename(post.mediaUrl));
    fs.unlink(filePath, () => {});
    await invalidateFollowerFeeds(req.userId);
    res.json({ deleted: true });
  } catch (e) {
    next(e);
  }
});

// POST /api/posts/:id/like
router.post("/:id/like", requireAuth, async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ error: "Post not found" });

    await prisma.like
      .create({ data: { postId, userId: req.userId } })
      .catch(() => {}); // ignore duplicate likes

    await notifyUser({
      recipientId: post.authorId,
      actorId: req.userId,
      type: "like",
      text: `${req.username} liked your post`,
      postId,
    });

    const count = await prisma.like.count({ where: { postId } });
    res.json({ liked: true, likeCount: count });
  } catch (e) {
    next(e);
  }
});

// DELETE /api/posts/:id/like
router.delete("/:id/like", requireAuth, async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    await prisma.like
      .delete({ where: { postId_userId: { postId, userId: req.userId } } })
      .catch(() => {});
    const count = await prisma.like.count({ where: { postId } });
    res.json({ liked: false, likeCount: count });
  } catch (e) {
    next(e);
  }
});

// When a user's posts change, drop the cached home-feed of their followers.
async function invalidateFollowerFeeds(authorId) {
  try {
    const followers = await prisma.follow.findMany({
      where: { followingId: authorId },
      select: { followerId: true },
    });
    const keys = [authorId, ...followers.map((f) => f.followerId)].map(
      (id) => `feed:${id}`
    );
    if (keys.length) await redis.del(...keys);
  } catch {
    /* cache invalidation is best-effort */
  }
}

module.exports = router;
