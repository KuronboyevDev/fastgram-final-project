// Notification routes: list + mark read.
const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { publicUser } = require("../lib/helpers");

const router = express.Router();

// GET /api/notifications
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const notifs = await prisma.notification.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { actor: true },
    });
    res.json({
      notifications: notifs.map((n) => ({
        id: n.id,
        type: n.type,
        text: n.text,
        postId: n.postId,
        read: n.read,
        createdAt: n.createdAt,
        actor: publicUser(n.actor),
      })),
      unreadCount: notifs.filter((n) => !n.read).length,
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/notifications/read  -> mark all as read
router.post("/read", requireAuth, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.userId, read: false },
      data: { read: true },
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
