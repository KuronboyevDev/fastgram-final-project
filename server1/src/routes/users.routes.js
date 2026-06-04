// User routes: profiles, follow/unfollow, followers/following, suggestions, presence.
const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { publicUser, publicPost } = require("../lib/helpers");
const { notifyUser, getOnlineUsers } = require("../socket");
const server2 = require("../lib/server2");

const router = express.Router();

// GET /api/users/online  -> list of online user ids (from Redis presence)
router.get("/online", requireAuth, async (_req, res, next) => {
  try {
    res.json({ online: await getOnlineUsers() });
  } catch (e) {
    next(e);
  }
});

// GET /api/users/suggestions  -> people you don't follow yet
router.get("/suggestions", requireAuth, async (req, res, next) => {
  try {
    const following = await prisma.follow.findMany({
      where: { followerId: req.userId },
      select: { followingId: true },
    });
    const excludeIds = [req.userId, ...following.map((f) => f.followingId)];
    const users = await prisma.user.findMany({
      where: { id: { notIn: excludeIds } },
      take: 5,
      orderBy: { id: "desc" },
    });
    res.json({ users: users.map(publicUser) });
  } catch (e) {
    next(e);
  }
});

// GET /api/users/:username  -> profile + counts + posts
router.get("/:username", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      include: {
        _count: { select: { posts: true, followers: true, following: true } },
        posts: {
          orderBy: { createdAt: "desc" },
          include: {
            author: true,
            _count: { select: { likes: true, comments: true } },
            likes: { where: { userId: req.userId } },
          },
        },
      },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const isFollowing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId: req.userId, followingId: user.id },
      },
    });

    res.json({
      user: {
        ...publicUser(user),
        postCount: user._count.posts,
        followerCount: user._count.followers,
        followingCount: user._count.following,
        isFollowing: !!isFollowing,
        isMe: user.id === req.userId,
      },
      posts: user.posts.map((p) => publicPost(p, req.userId)),
    });
  } catch (e) {
    next(e);
  }
});

// PUT /api/users/me  -> update own profile (bio, fullName, avatarUrl)
router.put("/me/profile", requireAuth, async (req, res, next) => {
  try {
    const { fullName, bio, avatarUrl } = req.body;
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        ...(fullName !== undefined && { fullName }),
        ...(bio !== undefined && { bio }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      },
    });
    res.json({ user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

// POST /api/users/:id/follow
router.post("/:id/follow", requireAuth, async (req, res, next) => {
  try {
    const followingId = Number(req.params.id);
    if (followingId === req.userId)
      return res.status(400).json({ error: "You can't follow yourself" });

    await prisma.follow.upsert({
      where: {
        followerId_followingId: { followerId: req.userId, followingId },
      },
      create: { followerId: req.userId, followingId },
      update: {},
    });

    // Live notification + microservice sync to Server 2.
    await notifyUser({
      recipientId: followingId,
      actorId: req.userId,
      type: "follow",
      text: `${req.username} started following you`,
    });
    server2.syncFollow(req.userId, followingId);

    res.json({ following: true });
  } catch (e) {
    next(e);
  }
});

// DELETE /api/users/:id/follow
router.delete("/:id/follow", requireAuth, async (req, res, next) => {
  try {
    const followingId = Number(req.params.id);
    await prisma.follow
      .delete({
        where: {
          followerId_followingId: { followerId: req.userId, followingId },
        },
      })
      .catch(() => {});
    res.json({ following: false });
  } catch (e) {
    next(e);
  }
});

// GET /api/users/:username/followers
router.get("/:username/followers", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    const rows = await prisma.follow.findMany({
      where: { followingId: user.id },
      include: { follower: true },
    });
    res.json({ users: rows.map((r) => publicUser(r.follower)) });
  } catch (e) {
    next(e);
  }
});

// GET /api/users/:username/following
router.get("/:username/following", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    const rows = await prisma.follow.findMany({
      where: { followerId: user.id },
      include: { following: true },
    });
    res.json({ users: rows.map((r) => publicUser(r.following)) });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
