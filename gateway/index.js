// ── FastGram API Gateway ────────────────────────────────────────────
// The single public entry point (port 8080). The frontend talks ONLY to the
// gateway; the gateway forwards each request to the right backend service:
//
//   /api/*       ──▶  Server 1 (Express REST)
//   /uploads/*   ──▶  Server 1 (image/video streaming, Range supported)
//   /socket.io   ──▶  Server 1 (WebSocket upgrade for real-time)
//   /graphql     ──▶  Server 2 (FastAPI GraphQL)
//
// This is the "Gateway" bridge box in the architecture diagram. It hides the
// fact that there are two separate servers behind one origin (also avoids CORS
// headaches for the browser).

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const http = require("http");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const PORT = process.env.PORT || 8080;
const SERVER1 = process.env.SERVER1_URL || "http://localhost:4000";
const SERVER2 = process.env.SERVER2_URL || "http://localhost:8000";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(morgan("dev"));

// Gateway's own health check (aggregates nothing — just proves it's up).
app.get("/health", (_req, res) =>
  res.json({ service: "gateway", status: "ok", routes: { SERVER1, SERVER2 } })
);

// NOTE: we mount every proxy at the ROOT and select traffic with `pathFilter`
// (not `app.use("/api", ...)`). In http-proxy-middleware v3, mounting on a
// sub-path makes Express strip that prefix, so "/api/auth/login" would be
// forwarded as "/auth/login". Using pathFilter forwards the FULL path intact.

// ── GraphQL  →  Server 2 ────────────────────────────────────────────
app.use(
  createProxyMiddleware({
    pathFilter: (path) => path.startsWith("/graphql"),
    target: SERVER2,
    changeOrigin: true,
  })
);

// ── REST + media (images/videos)  →  Server 1 ───────────────────────
// Range headers are forwarded as-is, so video streaming works through here.
app.use(
  createProxyMiddleware({
    pathFilter: (path) => path.startsWith("/api") || path.startsWith("/uploads"),
    target: SERVER1,
    changeOrigin: true,
  })
);

// ── WebSocket (Socket.IO)  →  Server 1 ──────────────────────────────
const socketProxy = createProxyMiddleware({
  pathFilter: (path) => path.startsWith("/socket.io"),
  target: SERVER1,
  changeOrigin: true,
  ws: true,
});
app.use(socketProxy);

const server = http.createServer(app);
// Handle the HTTP→WS upgrade handshake for Socket.IO.
server.on("upgrade", socketProxy.upgrade);

server.listen(PORT, () => {
  console.log(`\n🌉 FastGram Gateway on http://localhost:${PORT}`);
  console.log(`   /api      → ${SERVER1}`);
  console.log(`   /uploads  → ${SERVER1}`);
  console.log(`   /socket.io→ ${SERVER1} (ws)`);
  console.log(`   /graphql  → ${SERVER2}\n`);
});
