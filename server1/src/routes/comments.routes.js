// Comment routes: list + add comments on a post.
const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { publicUser } = require("../lib/helpers");
const { notifyUser } = require("../socket");

const router = express.Router();

// GET /api/posts/:id/comments
router.get("/:id/comments", requireAuth, async (req, res, next) => {
  try {
    const comments = await prisma.comment.findMany({
      where: { postId: Number(req.params.id) },
      orderBy: { createdAt: "asc" },
      include: { author: true },
    });
    res.json({
      comments: comments.map((c) => ({
        id: c.id,
        text: c.text,
        createdAt: c.createdAt,
        author: publicUser(c.author),
      })),
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/posts/:id/comments
router.post("/:id/comments", requireAuth, async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "Comment text required" });

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ error: "Post not found" });

    const comment = await prisma.comment.create({
      data: { postId, authorId: req.userId, text: text.trim() },
      include: { author: true },
    });

    await notifyUser({
      recipientId: post.authorId,
      actorId: req.userId,
      type: "comment",
      text: `${req.username} commented: ${text.trim().slice(0, 40)}`,
      postId,
    });

    res.status(201).json({
      comment: {
        id: comment.id,
        text: comment.text,
        createdAt: comment.createdAt,
        author: publicUser(comment.author),
      },
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
