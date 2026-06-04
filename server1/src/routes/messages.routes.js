// Direct-message REST routes (history & conversation list).
// Sending happens over Socket.IO; these endpoints load past messages.
const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { publicUser } = require("../lib/helpers");

const router = express.Router();

// GET /api/messages  -> list of conversations (latest message per partner)
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const me = req.userId;
    const messages = await prisma.message.findMany({
      where: { OR: [{ senderId: me }, { receiverId: me }] },
      orderBy: { createdAt: "desc" },
      include: { sender: true, receiver: true },
    });

    // Reduce to one entry per conversation partner (latest message wins).
    const convos = new Map();
    for (const m of messages) {
      const partner = m.senderId === me ? m.receiver : m.sender;
      if (!convos.has(partner.id)) {
        convos.set(partner.id, {
          partner: publicUser(partner),
          lastMessage: m.text,
          lastAt: m.createdAt,
          unread: m.receiverId === me && !m.read,
        });
      }
    }
    res.json({ conversations: [...convos.values()] });
  } catch (e) {
    next(e);
  }
});

// GET /api/messages/:userId  -> full history with one user (and mark read)
router.get("/:userId", requireAuth, async (req, res, next) => {
  try {
    const me = req.userId;
    const other = Number(req.params.userId);

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: me, receiverId: other },
          { senderId: other, receiverId: me },
        ],
      },
      orderBy: { createdAt: "asc" },
      include: { sender: true },
    });

    // Mark messages from the other person as read.
    await prisma.message.updateMany({
      where: { senderId: other, receiverId: me, read: false },
      data: { read: true },
    });

    const partner = await prisma.user.findUnique({ where: { id: other } });

    res.json({
      partner: publicUser(partner),
      messages: messages.map((m) => ({
        id: m.id,
        text: m.text,
        senderId: m.senderId,
        receiverId: m.receiverId,
        createdAt: m.createdAt,
      })),
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
