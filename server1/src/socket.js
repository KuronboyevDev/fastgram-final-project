// Real-time layer (Socket.IO): online presence, direct messages, live notifications.
//
// Rooms: every authenticated socket joins a personal room "user:<id>".
// To push something to a specific user from anywhere in the app we just emit
// to their room. REST routes use emitToUser()/notifyUser() exported below.

const { Server } = require("socket.io");
const { verifyToken } = require("./lib/jwt");
const redis = require("./lib/redis");
const prisma = require("./lib/prisma");
const { publicUser } = require("./lib/helpers");

let io = null;
const ONLINE_KEY = "presence:online"; // a Redis set of online user Ids

function roomFor(userId) {
  return `user:${userId}`;
}

function initSocket(httpServer, corsOrigins) {
  io = new Server(httpServer, {
    cors: { origin: corsOrigins, credentials: true },
  });

  // Authenticate every socket using the same JWT as REST.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token"));
    try {
      const payload = verifyToken(token);
      socket.userId = payload.userId;
      socket.username = payload.username;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", async (socket) => {
    const uid = socket.userId;
    socket.join(roomFor(uid));
    await redis.sadd(ONLINE_KEY, uid);
    broadcastPresence();

    // ── Direct messages ──────────────────────────────────────────
    socket.on("message:send", async ({ toUserId, text }, ack) => {
      try {
        if (!toUserId || !text?.trim()) return ack?.({ error: "Invalid message" });
        const msg = await prisma.message.create({
          data: { senderId: uid, receiverId: Number(toUserId), text: text.trim() },
          include: { sender: true },
        });
        const payload = {
          id: msg.id,
          text: msg.text,
          senderId: msg.senderId,
          receiverId: msg.receiverId,
          createdAt: msg.createdAt,
          sender: publicUser(msg.sender),
        };
        // Deliver to the recipient and echo back to the sender (other tabs).
        io.to(roomFor(msg.receiverId)).emit("message:new", payload);
        ack?.({ ok: true, message: payload });

        // Also drop a notification for the recipient.
        await notifyUser({
          recipientId: msg.receiverId,
          actorId: uid,
          type: "message",
          text: `${socket.username} sent you a message`,
        });
      } catch (e) {
        ack?.({ error: e.message });
      }
    });

    // ── Typing indicator ─────────────────────────────────────────
    socket.on("message:typing", ({ toUserId }) => {
      io.to(roomFor(Number(toUserId))).emit("message:typing", { from: uid });
    });

    socket.on("disconnect", async () => {
      // Only mark offline if the user has no other open sockets.
      const sockets = await io.in(roomFor(uid)).fetchSockets();
      if (sockets.length === 0) {
        await redis.srem(ONLINE_KEY, uid);
        broadcastPresence();
      }
    });
  });

  console.log("✅ Socket.IO ready");
  return io;
}

async function broadcastPresence() {
  const online = await redis.smembers(ONLINE_KEY);
  io.emit("presence:update", { online: online.map(Number) });
}

// Emit an arbitrary event to one user (used by REST routes).
function emitToUser(userId, event, payload) {
  if (io) io.to(roomFor(userId)).emit(event, payload);
}

// Persist a notification AND push it live to the recipient.
async function notifyUser({ recipientId, actorId, type, text, postId = null }) {
  if (recipientId === actorId) return; // don't notify yourself
  const notif = await prisma.notification.create({
    data: { userId: recipientId, actorId, type, text, postId },
    include: { actor: true },
  });
  emitToUser(recipientId, "notification:new", {
    id: notif.id,
    type: notif.type,
    text: notif.text,
    postId: notif.postId,
    read: notif.read,
    createdAt: notif.createdAt,
    actor: publicUser(notif.actor),
  });
  return notif;
}

function getOnlineUsers() {
  return redis.smembers(ONLINE_KEY).then((ids) => ids.map(Number));
}

module.exports = { initSocket, emitToUser, notifyUser, getOnlineUsers };
