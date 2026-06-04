# 🏛️ FastGram Architecture

This document explains **what each technology does** and **why it's in the
stack**. For request-by-request data flow see
[PROJECT_FLOW.md](PROJECT_FLOW.md).

---

## The big picture

```
            ┌──────────────────────────────────────────────────────────────┐
            │                        BROWSER (you)                          │
            │   Next.js · TanStack Query (server state) · Zustand (client)  │
            └───────────────┬──────────────────────────────────────────────┘
                            │  HTTP(REST) · HTTP(GraphQL) · WebSocket
                            ▼
            ┌──────────────────────────────────────────────────────────────┐
            │                    API GATEWAY  (:8080)                       │
            │   Express + http-proxy-middleware  — single public origin     │
            │   /api → S1   /graphql → S2   /socket.io → S1   /uploads → S1  │
            └───────┬───────────────────────────────────────┬──────────────┘
                    │                                         │
        REST + WS   ▼                                         ▼  GraphQL
    ┌───────────────────────────────┐         ┌──────────────────────────────┐
    │       SERVER 1  (:4000)        │  HTTP   │       SERVER 2  (:8000)       │
    │  Express + Socket.IO           │ ──────▶ │  FastAPI + Strawberry GraphQL │
    │  REST API · realtime           │  events │  content discovery · analytics│
    │  Prisma ORM                    │         │  SQLAlchemy ORM               │
    └──────┬───────────────┬─────────┘         └───────────────┬──────────────┘
           │               │                                   │
           ▼               ▼                                   ▼
   ┌──────────────┐ ┌──────────────┐                  ┌──────────────────┐
   │ Redis        │ │ PostgreSQL   │                  │ PostgreSQL       │
   │ (optional)   │ │ fastgram_main│                  │ fastgram_analytics│
   └──────────────┘ └──────────────┘                  └──────────────────┘
```

---

## Why TWO servers?

This is the core of the assignment. Each server owns a different **API style**
and a different **job**, and they have **separate databases** — a real
microservice split:

| | Server 1 | Server 2 |
|---|---|---|
| **Language** | Node.js (Express) | Python (FastAPI) |
| **API style** | **REST** | **GraphQL** |
| **Realtime** | ✅ Socket.IO | ❌ |
| **ORM** | Prisma | SQLAlchemy |
| **Database** | `fastgram_main` | `fastgram_analytics` |
| **Owns** | Users, posts, likes, comments, follows, DMs, notifications, media | A synced *mirror* used for Explore, trending & analytics |
| **Best at** | Transactions, writes, realtime push | Flexible nested reads (the social graph), aggregation |

**Why this split makes sense:** writes and realtime fit REST + WebSockets
(Server 1). Flexible, nested "give me exactly these fields across the graph"
reads fit **GraphQL** (Server 2) — e.g. Explore and analytics. They scale and
deploy independently.

---

## Component-by-component

### 🖥️ Frontend — Next.js 14 (App Router)
The UI. Uses the App Router with mostly client components (the app is highly
interactive). Talks **only to the gateway**.

- **TanStack Query** — *server state*. Fetches/caches REST + GraphQL data,
  handles loading/refetch, and optimistic updates (e.g. instant like toggle).
  See `frontend/src/app/page.js` (feed) and the `useQuery`/`useMutation` hooks.
- **Zustand** — *client state*. A tiny global store for the logged-in user and
  JWT (`frontend/src/store/auth.js`). Not server data — just app state.

### 🌉 Gateway — Express + http-proxy-middleware (:8080)
The **single entry point**. The browser only ever knows about `localhost:8080`;
the gateway forwards each path to the right backend:

| Path | Forwarded to | Why |
|---|---|---|
| `/api/*` | Server 1 | REST endpoints |
| `/graphql` | Server 2 | GraphQL endpoint |
| `/socket.io` | Server 1 (WebSocket) | realtime upgrade |
| `/uploads/*` | Server 1 | image/video streaming |

Benefits: one origin (no browser CORS pain), hides the internal topology, and is
the place you'd later add auth, rate-limiting, or logging. See `gateway/index.js`.

### ⚙️ Server 1 — Express + Socket.IO (:4000)
The workhorse. Implements the **REST API** and the **realtime layer**.

- **Express** — REST routes under `src/routes/*` (auth, users, posts, comments,
  feed, messages, notifications).
- **Socket.IO** — `src/socket.js`. Online presence, direct messages, and live
  notification pushes. Authenticated with the same JWT as REST.
- **Prisma ORM** — type-safe DB access to `fastgram_main`. Schema in
  `prisma/schema.prisma`, models: User, Post, Comment, Like, Follow, Message,
  Notification.
- **Multer + Range streaming** — `src/routes/media.routes.js`. Handles
  image/video uploads and streams video with HTTP `Range` requests so the
  `<video>` element can seek without downloading the whole file.

### 🐍 Server 2 — FastAPI + Strawberry GraphQL (:8000)
The discovery/analytics microservice.

- **FastAPI** — the web framework; also exposes service-only `/internal/*` REST
  endpoints that **receive sync events** from Server 1.
- **Strawberry GraphQL** — `app/schema.py`. Queries: `explore`,
  `trendingHashtags`, `postsByHashtag`, `userAnalytics`. Open the playground at
  `/graphql`.
- **SQLAlchemy ORM** — models in `app/models.py` for `fastgram_analytics`:
  `UserMirror`, `ContentIndex`, `SocialEdge`.

> **Content suggestion = NO machine learning (by design).** Explore mixes
> recent posts from people you **follow** with a **random** sample of everything
> else, then lightly shuffles. Simple, fast, explainable. See the `explore`
> resolver in `app/schema.py`.

### 🧠 Redis (optional, with fallback)
Used by Server 1 for:
- **Feed cache** — `feed:<userId>` caches a user's home feed for 30s
  (invalidated when someone they follow posts).
- **Online presence** — a set of currently-connected user ids.

If Redis isn't installed, `src/lib/redis.js` transparently swaps in an
in-memory implementation so nothing breaks. (See HOW_TO_RUN §5 for real Redis.)

### 🗄️ PostgreSQL ×2
Two independent databases enforce the microservice boundary:
- `fastgram_main` — source of truth (Server 1 / Prisma).
- `fastgram_analytics` — derived mirror (Server 2 / SQLAlchemy).

---

## Microservice communication (the diagram's "Add micro service communication")

Server 1 is the **source of truth**. Whenever core data changes, Server 1 fires
a small event to Server 2's internal REST endpoints so Server 2 can keep its
discovery/analytics mirror current:

```
Server 1                                   Server 2
─────────                                  ─────────
new user / register   ── POST ──────────▶  /internal/users      → UserMirror
new post created      ── POST ──────────▶  /internal/posts      → ContentIndex
new follow            ── POST ──────────▶  /internal/follows    → SocialEdge
```

These calls are **fire-and-forget** (`server1/src/lib/server2.js`): if Server 2
is down, Server 1 keeps working and just logs a warning. The same path is
exercised during seeding, which is why Server 2 should be up before you seed.

---

## Security / auth model
- **JWT** issued by Server 1 on login/register, stored in `localStorage`.
- Sent as `Authorization: Bearer <token>` on REST + GraphQL, and in the
  Socket.IO handshake `auth.token`.
- Server 1 verifies it in `middleware/auth.js` and in the socket handshake.
- Passwords are hashed with **bcrypt**; the API never returns password hashes.

---

## Tech-to-requirement checklist

| Required (diagram) | Where it lives |
|---|---|
| Next.js (TanStack, Zustand) | `frontend/` |
| Express | `server1/`, `gateway/` |
| Socket | `server1/src/socket.js` |
| FastAPI | `server2/` |
| PostgreSQL ×2 | `fastgram_main`, `fastgram_analytics` |
| Redis | `server1/src/lib/redis.js` |
| GraphQL | `server2/app/schema.py` |
| REST | `server1/src/routes/*` |
| ORM: Prisma | `server1/prisma/schema.prisma` |
| ORM: SQLAlchemy | `server2/app/models.py` |
| API Gateway | `gateway/index.js` |
| Microservice comms | `server1/src/lib/server2.js` ↔ `server2/app/internal.py` |
