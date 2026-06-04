# 🔄 FastGram — How It Works (End-to-End Flows)

This traces real user actions through the code: **which function calls which**,
where the request goes, and how the answer comes back. File references use
`path:function`.

Legend: **Browser** → **Gateway (:8080)** → **Server 1 (:4000)** / **Server 2 (:8000)** → **DB**

---

## 0. Where the user starts

The browser loads **Next.js** at `http://localhost:3000`.

1. `frontend/src/app/layout.js` wraps everything in `Providers`
   (`providers.js` → TanStack Query) .
2. The first protected page renders `components/Shell.js`, which calls
   `useAuth().init()` (`store/auth.js`).
3. `init()` reads the JWT from `localStorage` and calls
   `GET /api/auth/me` through the gateway. If valid → user is set; if not →
   `Shell` redirects to `/login`.

Every browser→backend call goes through the **gateway** (`lib/api.js` and
`lib/graphql.js` both point at `NEXT_PUBLIC_API_URL = http://localhost:8080`).
The browser never talks to `:4000` or `:8000` directly.

---

## 1. Login (authentication)

```
Browser                Gateway            Server 1                  Postgres(main)
  │  POST /api/auth/login │                  │                          │
  ├──────────────────────▶ /api → :4000      │                          │
  │                       ├──────────────────▶ auth.routes login()      │
  │                       │                  ├─ prisma.user.findFirst ──▶│
  │                       │                  │◀── user row ──────────────┤
  │                       │                  ├─ bcrypt.compare()         │
  │                       │                  ├─ signToken()  (lib/jwt.js)│
  │◀───── { token, user } ◀──────────────────┤                          │
```

- **Frontend:** `store/auth.js:login()` → `api.post('/api/auth/login')`.
- **Server 1:** `routes/auth.routes.js` → verifies password with bcrypt, signs a
  JWT (`lib/jwt.js:signToken`).
- The token is saved in `localStorage` and attached to **every** future request
  by the axios interceptor in `lib/api.js`.

---

## 2. Home feed (REST + Redis cache)

User lands on `/` → `frontend/src/app/page.js:Feed` runs
`useQuery(['feed'])` → `GET /api/feed`.

```
Browser → Gateway → Server 1: routes/feed.routes.js
   1. redis.get("feed:<userId>")            (lib/redis.js)
        ├─ HIT  → return cached JSON  → response has { cached: true }
        └─ MISS → 2. prisma.follow.findMany (who I follow)
                  3. prisma.post.findMany   (their posts + mine)
                  4. shape via helpers.publicPost()
                  5. redis.set("feed:<userId>", …, EX 30)
                     return { cached: false }
```

- The UI shows a **“⚡ served from Redis cache”** badge when `cached: true`.
- The cache is invalidated in `routes/posts.routes.js:invalidateFollowerFeeds()`
  whenever someone you follow creates/deletes a post (their followers' `feed:*`
  keys are deleted).

---

## 3. Create a post (upload + video + microservice sync)

`/create` (`frontend/src/app/create/page.js`) sends `multipart/form-data`
(`media` file + `caption`) to `POST /api/posts`.

```
Browser → Gateway → Server 1: routes/posts.routes.js (POST "/")
   1. multer (middleware/upload.js) saves the file to server1/uploads/<rnd>.<ext>
   2. helpers.parseHashtags(caption)  → ["sunset","travel"]
   3. prisma.post.create({...})       → row in fastgram_main
   4. invalidateFollowerFeeds()       → clears followers' Redis feed cache
   5. server2.indexPost(post)         → ★ microservice call (see §7)
   6. respond { post } with absolute media URL (helpers.absoluteMediaUrl)
```

The new post immediately appears in the author's feed and is now indexed in
Server 2 for Explore.

### How video playback works
- Media is requested as `GET /uploads/<file>` → gateway → Server 1
  `routes/media.routes.js:serveMedia`.
- For videos the browser sends a `Range` header; `serveMedia` responds `206
  Partial Content` with just the requested byte range, so `<video>` can
  **seek/stream** without downloading the whole file.

---

## 4. Explore (GraphQL → Server 2)

`/explore` (`frontend/src/app/explore/page.js`) calls
`lib/graphql.js:gql(EXPLORE_QUERY, { userId, limit })`.

```
Browser → Gateway (/graphql) → Server 2: app/schema.py
   Query.explore(user_id, limit):
     1. SocialEdge → ids the user follows         (from synced mirror)
     2. ContentIndex → recent posts by those ids  (the "network" half)
     3. ContentIndex → random sample of the rest  (the "discovery" half)
     4. mix + light shuffle → return [Post]
   Query.trendingHashtags(limit):
     count hashtags across ContentIndex → top N
```

> No ML: it's just "people you follow" + "random discovery", mixed. This reads
> **only** Server 2's own `fastgram_analytics` DB — proving the GraphQL service
> runs independently of Server 1.

Clicking a tile opens a lightbox built straight from the GraphQL response.
`#hashtag` links go to `/explore/tag/[tag]` → `postsByHashtag` query.

---

## 5. Real-time direct messages (Socket.IO)

When the user is authenticated, `Shell.js` opens one socket via
`lib/socket.js:getSocket()` (JWT passed in the handshake; verified by
`server1/src/socket.js` `io.use(...)`).

Sending a message from `messages/[userId]/page.js:send()`:

```
Browser A  ──emit "message:send" {toUserId, text}──▶  Server 1 socket.js
   socket.on("message:send"):
     1. prisma.message.create()                       → fastgram_main
     2. io.to("user:<receiver>").emit("message:new")  → pushes to Browser B
     3. ack({ ok, message })                          → Browser A appends it
     4. notifyUser(...)                               → DB notif + live push
Browser B  ◀── "message:new" ──  renders the bubble instantly
```

- **Presence:** on connect, `socket.js` does `redis.sadd("presence:online", uid)`
  and broadcasts `presence:update`; on disconnect it removes the user.
- **Typing:** `message:typing` is relayed to the partner's room.

---

## 6. Like → live notification

```
Browser → Gateway → Server 1: routes/posts.routes.js (POST /:id/like)
   1. prisma.like.create()                       → fastgram_main
   2. socket.js:notifyUser({type:"like", ...}):
        a. prisma.notification.create()
        b. emitToUser(authorId, "notification:new", …)
   3. return { liked:true, likeCount }
```

The post author (if online) instantly gets a toast via `Shell.js`'s
`socket.on("notification:new")`, and the sidebar bell badge updates (TanStack
Query refetches `['notifications']`). The liker sees an optimistic heart toggle
(`PostCard.js:toggleLike` `onMutate`).

---

## 7. ★ How the two servers connect (microservice sync)

Server 1 is the **source of truth**; Server 2 keeps a mirror for GraphQL.
The link is plain HTTP, fire-and-forget, in `server1/src/lib/server2.js`:

```
Server 1                                            Server 2 (app/internal.py)
─────────                                           ──────────────────────────
auth.routes register / seed → syncUser(user)  ──▶   POST /internal/users   → UserMirror upsert
posts.routes create / seed  → indexPost(post) ──▶   POST /internal/posts   → ContentIndex upsert
users.routes follow / seed  → syncFollow(...) ──▶   POST /internal/follows → SocialEdge insert
```

- `lib/server2.js:safePost()` wraps each call in try/catch — **if Server 2 is
  down, Server 1 still succeeds** (the user action never fails because of it).
- These `/internal/*` routes are **not** exposed through the gateway, so they're
  service-to-service only.
- During **seeding** (`server1/prisma/seed.js`) every created user/post/follow is
  awaited through these same functions — that's why Server 2 must be running
  before you seed, and why Explore is populated immediately afterwards.

---

## End-to-end summary (one picture)

```
            LOGIN ───────────────▶ S1 /api/auth ─▶ Postgres(main)  ─▶ JWT back
   FEED  (REST + cache) ─────────▶ S1 /api/feed ─▶ Redis / Postgres(main)
  CREATE (upload+video) ─────────▶ S1 /api/posts ─▶ disk + Postgres(main)
                                          └──────▶ S2 /internal/posts (sync)
 EXPLORE (GraphQL) ──────────────▶ S2 /graphql ─▶ Postgres(analytics)
   DM / NOTIFS (realtime) ───────▶ S1 Socket.IO ─▶ Postgres(main) + push
                       (all of the above pass through the GATEWAY :8080)
```
