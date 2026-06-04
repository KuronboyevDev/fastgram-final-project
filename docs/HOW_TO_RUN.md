# ▶️ How to Run FastGram

This guide gets all **four** pieces running locally on Windows (works on
mac/Linux too). No Docker required.

```
Frontend :3000   →   Gateway :8080   →   Server 1 :4000  (REST + Socket)
                                     →   Server 2 :8000  (GraphQL)
                     Server 1 / Server 2 → PostgreSQL :5432
                     Server 1            → Redis (optional)
```

---

## 0. Prerequisites

| Tool | Version used | Check |
|---|---|---|
| Node.js | 18+ (tested on 22) | `node -v` |
| Python | 3.10+ (tested on 3.11) | `python --version` |
| PostgreSQL | 14+ (tested on 17) | `psql --version` |
| pgAdmin | 4 (ships with PostgreSQL) | open it |
| Redis | **optional** (see step 5) | — |

> You'll run **5 terminals** total (Server 1, Server 2, Gateway, Frontend, plus
> one for the seed/setup commands). Keep each running.

---

## 1. Create the two databases (pgAdmin)

FastGram uses **two separate PostgreSQL databases** — one per server.

1. Open **pgAdmin** and connect to your local server (remember the password you
   set for the `postgres` user during install).
2. Right-click **Databases → Create → Database…**
3. Create **`fastgram_main`** (Server 1's data).
4. Create **`fastgram_analytics`** (Server 2's data).

> You do **not** create any tables by hand — the ORMs (Prisma & SQLAlchemy) do
> that for you in the steps below.

---

## 2. Server 2 — FastAPI + GraphQL (start FIRST)

We start Server 2 first so that when we seed Server 1, the data can sync over.

```powershell
cd server2
python -m venv .venv
.venv\Scripts\activate                 # mac/linux: source .venv/bin/activate
pip install -r requirements.txt

copy .env.example .env                  # mac/linux: cp .env.example .env
```

Edit **`server2/.env`** and set your Postgres password in `DATABASE_URL`:

```
DATABASE_URL=postgresql://postgres:YOURPASSWORD@localhost:5432/fastgram_analytics
```

Create the analytics tables, then run the server:

```powershell
python -m app.seed                      # creates tables (prints "Tables ready")
uvicorn app.main:app --reload --port 8000
```

✅ Leave it running. Visit **http://localhost:8000/graphql** to open the GraphQL
playground.

---

## 3. Server 1 — Express + Socket + REST

```powershell
cd server1
npm install
copy .env.example .env
```

Edit **`server1/.env`** and set your Postgres password in `DATABASE_URL`:

```
DATABASE_URL="postgresql://postgres:YOURPASSWORD@localhost:5432/fastgram_main"
```

Create the tables (Prisma migration), then seed with Faker data:

```powershell
npx prisma migrate dev --name init      # creates all tables in fastgram_main
npm run seed                            # users, posts, images+videos, follows…
```

The seed downloads real images & sample videos into `server1/uploads/` and, because
Server 2 is already running, **mirrors everything into Server 2** via the
microservice link. You'll see `Server2 sync` activity in both terminals.

Now start it:

```powershell
npm run dev                             # http://localhost:4000
```

✅ Leave it running.

---

## 4. Gateway + Frontend

**Gateway** (new terminal):

```powershell
cd gateway
npm install
copy .env.example .env
npm run dev                             # http://localhost:8080
```

**Frontend** (new terminal):

```powershell
cd frontend
npm install
copy .env.example .env.local
npm run dev                             # http://localhost:3000
```

Open **http://localhost:3000** and log in:

| Username | Password |
|---|---|
| `alice` | `password123` |
| `bob` | `password123` |
| `charlie` / `diana` | `password123` |

---

## 5. Redis (optional)

The app runs **without Redis** — it automatically uses an in-memory fallback
cache and you'll see this in Server 1's logs:

```
⚠️  Redis not reachable — using in-memory fallback cache.
```

To use **real Redis** (recommended for showing the caching layer "for real"):

- **Easiest on Windows:** install [Memurai](https://www.memurai.com/get-memurai)
  (a native Redis-compatible server). It listens on `localhost:6379` — no config
  change needed. Restart Server 1 and you'll see `✅ Redis connected`.
- **Or** use a free [Redis Cloud](https://redis.com/try-free/) instance and put
  its URL in `server1/.env` → `REDIS_URL=redis://...`.

Either way the code is identical — only the `REDIS_URL` changes.

---

## 6. Quick smoke test

| Action | Where | Proves |
|---|---|---|
| Log in as `alice` | / | Auth (JWT) via Server 1 |
| Scroll the feed | / | REST + Redis cache (watch the “⚡ Redis cache” badge) |
| Open **Explore** | /explore | GraphQL (Server 2) |
| Open another browser as `bob`, send `alice` a DM | /messages | Socket.IO realtime |
| Like `bob`'s post as `alice` | feed | Live notification to bob |
| Create a post with a video | /create | Upload + video streaming |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `P1000: Authentication failed` (Prisma) | Wrong DB password in `server1/.env`. |
| `password authentication failed` (SQLAlchemy) | Wrong password in `server2/.env`. |
| `database "fastgram_main" does not exist` | Create it in pgAdmin (step 1). |
| Explore is empty | Server 2 wasn't running when you seeded. Re-run `npm run seed` in `server1` with Server 2 up. |
| Images/videos don't load | Make sure the **gateway** is running (media is served through it). |
| `uvicorn: command not found` | Activate the venv first (`.venv\Scripts\activate`). |
| Port already in use | Change the port in that service's `.env` (and the gateway's upstream URLs). |
| Frontend can't reach API | Confirm `frontend/.env.local` → `NEXT_PUBLIC_API_URL=http://localhost:8080`. |
