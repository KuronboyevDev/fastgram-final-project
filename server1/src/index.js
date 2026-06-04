// ── FastGram Server 1 ───────────────────────────────────────────────
// Express + Socket.IO. Exposes the REST API for all core social features and
// the real-time layer (DMs / notifications / presence). Talks to PostgreSQL
// via Prisma and to Redis (with in-memory fallback) for caching/presence.

require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const { initSocket } = require("./socket");

// Routes
const authRoutes = require("./routes/auth.routes");
const usersRoutes = require("./routes/users.routes");
const postsRoutes = require("./routes/posts.routes");
const commentsRoutes = require("./routes/comments.routes");
const feedRoutes = require("./routes/feed.routes");
const messagesRoutes = require("./routes/messages.routes");
const notificationsRoutes = require("./routes/notifications.routes");
const mediaRoutes = require("./routes/media.routes");

const app = express();
const PORT = process.env.PORT || 4000;
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim());

app.use(cors({ origin: CORS_ORIGINS, credentials: true }));
app.use(express.json());
app.use(morgan("dev"));

// Health check
app.get("/api/health", (_req, res) =>
  res.json({ service: "server1", status: "ok", time: new Date().toISOString() })
);

// Media serving + generic upload are mounted at root (they own their own paths).
app.use("/", mediaRoutes);

// REST API
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/posts", commentsRoutes); // /api/posts/:id/comments
app.use("/api/feed", feedRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/notifications", notificationsRoutes);

// 404 + error handler
app.use((req, res) => res.status(404).json({ error: "Not found", path: req.path }));
app.use((err, _req, res, _next) => {
  console.error("❌", err.message);
  res.status(err.status || 500).json({ error: err.message || "Server error" });
});

// Create HTTP server so Express + Socket.IO share one port.
const server = http.createServer(app);
initSocket(server, CORS_ORIGINS);

server.listen(PORT, () => {
  console.log(`\n🚀 FastGram Server 1 (REST + Socket) on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health\n`);
});
