# 📸 FastGram

A full-stack, Instagram-style social platform built on a **two-server microservice architecture**.

> Post photos & videos, follow people, like & comment, chat in real-time DMs, get live
> notifications, stream video, and discover new content on an Explore page — all powered by
> two independent backend servers (REST + GraphQL) behind a single API Gateway.

---

## 🧱 The Stack (exactly as the architecture diagram)

| Layer | Technology | Role |
|---|---|---|
| **Client** | Next.js 14 (App Router), TanStack Query, Zustand | UI + state |
| **Gateway** | Express + http-proxy-middleware | Single entry point, routes traffic |
| **Server 1** | Express + Socket.IO, **REST API**, Prisma ORM | Core social features + real-time |
| **Server 2** | FastAPI (Python) + Strawberry **GraphQL**, SQLAlchemy ORM | Content discovery + analytics |
| **Cache** | Redis (with automatic in-memory fallback) | Feed cache, presence, trending |
| **Database** | PostgreSQL ×2 (one per server) | Persistent storage |

```
                                          ┌─────────────┐      ┌──────────────┐
                                     ┌───▶│  SERVER 1   │─────▶│  Redis (or   │
                                     │    │  Express    │      │  in-memory)  │
┌────────┐     ┌──────────┐         │    │  Socket.IO  │      └──────────────┘
│ Client │────▶│ Gateway  │─────────┤    │  API: REST  │─────▶┌──────────────┐
│ Next.js│     │  :8080   │         │    └──────┬──────┘      │ PostgreSQL 1 │
└────────┘     └──────────┘         │           │ HTTP        │ (main data)  │
                                     │           │ events      └──────────────┘
                                     │           ▼
                                     │    ┌─────────────┐      ┌──────────────┐
                                     └───▶│  SERVER 2   │─────▶│ PostgreSQL 2 │
                                          │  FastAPI    │      │ (analytics)  │
                                          │ API:GraphQL │      └──────────────┘
                                          └─────────────┘
```

---

## ⚡ Quick Start (TL;DR)

> Full step-by-step (with troubleshooting) lives in **[docs/HOW_TO_RUN.md](docs/HOW_TO_RUN.md)**.

> ⚠️ **Order matters:** start **Server 2 before seeding Server 1**, because the
> seed pushes data to Server 2 over the microservice link. Use 5 terminals.

```bash
# 0. In pgAdmin create TWO empty databases: "fastgram_main" and "fastgram_analytics"

# 1. Server 2  (GraphQL, port 8000) — start this FIRST
cd server2
python -m venv .venv
.venv\Scripts\activate              # Windows  (mac/linux: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env              # then edit DB password
python -m app.seed                 # creates analytics tables
uvicorn app.main:app --reload --port 8000   # leave running

# 2. Server 1  (REST + Socket, port 4000)
cd server1
npm install
copy .env.example .env              # then edit DB password
npx prisma migrate dev --name init # creates main tables
npm run seed                        # Faker users + posts + media → also syncs Server 2
npm run dev                         # leave running

# 3. Gateway  (port 8080)
cd gateway
npm install
copy .env.example .env
npm run dev                         # leave running

# 4. Frontend (port 3000)
cd frontend
npm install
copy .env.example .env.local
npm run dev                         # open http://localhost:3000
```

Open **http://localhost:3000** and log in with a seeded account:

```
username: alice      password: password123
username: bob        password: password123
```

(Every seeded user uses the password `password123`.)

---

## 📚 Documentation

| Doc | What's inside |
|---|---|
| **[docs/HOW_TO_RUN.md](docs/HOW_TO_RUN.md)** | Install & run every service step-by-step, troubleshooting |
| **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** | What each technology does and why it's here |
| **[docs/PROJECT_FLOW.md](docs/PROJECT_FLOW.md)** | End-to-end request flows: who calls whom, how the 2 servers talk |

---

## ✨ Features

- 🔐 **Auth** — register / login with JWT
- 🖼️ **Posts** — upload **images & videos**, captions, hashtags
- 🎬 **Video streaming** — HTTP range-request streaming (seek/scrub support)
- ❤️ **Likes & 💬 comments**
- 👥 **Follow / unfollow**, followers & following lists
- 📰 **Home feed** — posts from people you follow (Redis-cached)
- 🧭 **Explore** — content discovery via **GraphQL** (Server 2): random + followed-network mix
- 💬 **Real-time DMs** — Socket.IO
- 🔔 **Live notifications** — likes, comments, follows, messages
- 🟢 **Online presence** — see who's online (Redis)
- 📈 **Trending hashtags & analytics** — Server 2 GraphQL

---

## 🗂️ Project Structure

```
FastGram/
├── README.md                ← you are here
├── docs/                    ← full documentation
│   ├── HOW_TO_RUN.md
│   ├── ARCHITECTURE.md
│   └── PROJECT_FLOW.md
├── gateway/                 ← API Gateway (Express proxy)  :8080
├── server1/                 ← Express + Socket + REST + Prisma  :4000
│   ├── prisma/schema.prisma
│   ├── prisma/seed.js       ← Faker seeding
│   ├── uploads/             ← user images & videos
│   └── src/
├── server2/                 ← FastAPI + GraphQL + SQLAlchemy  :8000
│   └── app/
└── frontend/                ← Next.js + TanStack + Zustand  :3000
    └── src/
```
